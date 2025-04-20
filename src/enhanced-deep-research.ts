import FirecrawlApp, { SearchResponse } from '@mendable/firecrawl-js';
import { generateObject } from 'ai';
import { compact } from 'lodash-es';
import pLimit from 'p-limit';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { getModel, trimPrompt } from './ai/providers';
import { systemPrompt } from './prompt';
import { MeshRestrictiveness, PubMedArticle, pubMedResultToMarkdown, searchPubMed } from './pubmed';
import { createEnhancedReportPrompt } from './enhanced-report-prompt';
import {
  LayeredLearning,
  ResearchResult,
  StructuredLearning,
  TopicNode
} from './types';
import { aggregateHierarchicalLearnings } from './learning-processing';
import { progressiveSummarization } from './summarization';
import { calculateMaxContentSize, selectImportantContent } from './content-selection';
import { writeFinalReportWithChunking } from './report-generation';
import { identifyResearchDomain, templateBasedReportGeneration } from './template-generation';

function log(...args: any[]) {
  console.log(...args);
}

export type ResearchProgress = {
  currentDepth: number;
  totalDepth: number;
  currentBreadth: number;
  totalBreadth: number;
  currentQuery?: string;
  totalQueries: number;
  completedQueries: number;
  stage?: 'research' | 'processing' | 'report-generation';
  processingStage?: 'hierarchical-aggregation' | 'progressive-summarization' | 'content-selection' | 'report-generation';
};

// Helper function to calculate token limit based on insight detail
function calculateTokenLimit(insightDetail: number): number {
  // Scale exponentially to give more dramatic effect at higher levels
  // Level 1: ~1000 tokens (concise)
  // Level 5: ~4000 tokens (detailed)
  // Level 10: ~10000 tokens (comprehensive)

  if (insightDetail <= 3) {
    // 1000-2000 tokens for levels 1-3
    return 1000 + (insightDetail - 1) * 500;
  } else if (insightDetail <= 7) {
    // 2000-6000 tokens for levels 4-7
    return 2000 + (insightDetail - 4) * 1000;
  } else {
    // 6000-10000 tokens for levels 8-10
    return 6000 + (insightDetail - 8) * 1333;
  }
}

// Helper function to calculate the appropriate number of learnings based on insight detail
function calculateLearningsCount(insightDetail: number, breadth: number): number {
  // For higher detail levels, we need fewer learnings to avoid context window issues
  if (insightDetail >= 8) {
    return Math.max(2, Math.min(3, breadth - 2)); // 2-3 learnings for high detail
  } else if (insightDetail >= 5) {
    return Math.max(3, Math.min(5, breadth - 1)); // 3-5 learnings for medium detail
  } else {
    return Math.max(5, Math.min(8, breadth));     // 5-8 learnings for low detail
  }
}

// Helper function to get detail level description
function getDetailLevelDescription(insightDetail: number): string {
  if (insightDetail >= 8) return "comprehensive and in-depth";
  if (insightDetail >= 5) return "detailed and thorough";
  if (insightDetail >= 3) return "moderately detailed";
  return "concise but informative";
}

// Helper function to get report length based on insight detail
function getReportLength(insightDetail: number): string {
  if (insightDetail >= 8) return "a comprehensive, in-depth report that thoroughly covers all aspects of the topic";
  if (insightDetail >= 5) return "a detailed report that covers the topic thoroughly";
  if (insightDetail >= 3) return "a moderately detailed report that covers the key aspects of the topic";
  return "a concise report that covers the essential aspects of the topic";
}

// increase this if you have higher API rate limits
const ConcurrencyLimit = Number(process.env.FIRECRAWL_CONCURRENCY) || 2;

// Initialize Firecrawl with optional API key and optional base url
const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_KEY ?? '',
  apiUrl: process.env.FIRECRAWL_BASE_URL,
});

// take en user query, return a list of SERP queries
async function generateSerpQueries({
  query,
  numQueries = 3,
  learnings,
}: {
  query: string;
  numQueries?: number;

  // optional, if provided, the research will continue from the last learning
  learnings?: StructuredLearning[];
}) {
  // Convert structured learnings to simple strings for backward compatibility
  const learningTexts = learnings?.map(l => `${l.title}\n\n${l.content}`) || [];

  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: <prompt>${query}</prompt>\n\n${
      learningTexts.length > 0
        ? `Here are some learnings from previous research, use them to generate more specific queries: ${learningTexts.join(
            '\n',
          )}`
        : ''
    }`,
    schema: z.object({
      queries: z
        .array(
          z.object({
            query: z.string().describe('The SERP query'),
            researchGoal: z
              .string()
              .describe(
                'First talk about the goal of the research that this query is meant to accomplish, then go deeper into how to advance the research once the results are found, mention additional research directions. Be as specific as possible, especially for additional research directions.',
              ),
          }),
        )
        .describe(`List of SERP queries, max of ${numQueries}`),
    }),
  });
  log(`Created ${res.object.queries.length} queries`, res.object.queries);

  return res.object.queries.slice(0, numQueries);
}

async function processSerpResult({
  query,
  result,
  numLearnings = 5,
  numFollowUpQuestions = 3,
  pubMedArticles = [],
  breadth = 5,
  insightDetail = 5,
}: {
  query: string;
  result: SearchResponse;
  numLearnings?: number;
  numFollowUpQuestions?: number;
  pubMedArticles?: PubMedArticle[];
  breadth?: number;
  insightDetail?: number;
}) {
  // Calculate parameters based on insight detail
  const tokenLimit = calculateTokenLimit(insightDetail);
  const adjustedNumLearnings = calculateLearningsCount(insightDetail, breadth);

  const contents = compact(result.data.map(item => item.markdown)).map(content =>
    trimPrompt(content, 25_000),
  );

  // Add PubMed articles to contents if available
  if (pubMedArticles && pubMedArticles.length > 0) {
    const pubMedContents = pubMedArticles.map(article => pubMedResultToMarkdown(article));
    contents.push(...pubMedContents);
  }

  log(`Ran ${query}, found ${contents.length} contents (including ${pubMedArticles?.length || 0} PubMed articles)`);

  // Create the learning extraction prompt based on insight detail
  const detailLevel = getDetailLevelDescription(insightDetail);
  const learningPrompt = createLearningPrompt(query, adjustedNumLearnings, insightDetail, detailLevel, contents);

  // Define the schema for structured learnings
  const schema = z.object({
    structuredLearnings: z.array(z.object({
      title: z.string().describe("A descriptive title for this learning"),
      content: z.string().describe("The detailed content exploring this learning"),
      sources: z.array(z.string()).describe("References to specific sources used"),
      keyPoints: z.array(z.string()).describe("Key points from this learning"),
      importance: z.number().describe("Importance rating from 1-10"),
      topics: z.array(z.string()).describe("Primary topics this learning relates to"),
    })).describe(`List of ${detailLevel} learnings, max of ${adjustedNumLearnings}`),
    followUpQuestions: z.array(z.string()).describe(
      `List of follow-up questions to research the topic further, max of ${numFollowUpQuestions}`,
    ),
  });

  // Generate the structured learnings
  const res = await generateObject({
    model: getModel(),
    abortSignal: AbortSignal.timeout(180_000), // Longer timeout for detailed generation
    system: systemPrompt(),
    prompt: learningPrompt,
    max_tokens: tokenLimit * adjustedNumLearnings, // Set max tokens based on insight detail
    schema,
  });

  // Convert the AI response to our StructuredLearning format
  const structuredLearnings: StructuredLearning[] = res.object.structuredLearnings.map(learning => ({
    id: uuidv4(),
    title: learning.title,
    content: learning.content,
    sources: learning.sources,
    keyPoints: learning.keyPoints,
    importance: learning.importance,
    topics: learning.topics,
    metadata: {
      depth: 0, // Will be set by the caller
      confidenceScore: 0.8, // Default confidence score
      contentType: determineContentType(learning.content),
    },
  }));

  log(`Created ${structuredLearnings.length} structured learnings`);

  // Convert structured learnings to simple strings for backward compatibility
  const simpleLearnings = structuredLearnings.map(learning => {
    return `${learning.title}\n\n${learning.content}`;
  });

  return {
    learnings: simpleLearnings,
    structuredLearnings,
    followUpQuestions: res.object.followUpQuestions,
  };
}

// Helper function to determine content type based on text analysis
function determineContentType(content: string): 'factual' | 'analytical' | 'conceptual' {
  // Simple heuristic based on keywords and patterns
  const lowerContent = content.toLowerCase();

  // Check for analytical indicators
  const analyticalIndicators = [
    'analysis', 'analyze', 'evaluate', 'assessment', 'implications',
    'suggests that', 'indicates that', 'this means', 'therefore',
    'consequently', 'as a result', 'this suggests', 'in contrast',
    'however', 'although', 'despite', 'nonetheless', 'nevertheless'
  ];

  // Check for conceptual indicators
  const conceptualIndicators = [
    'concept', 'theory', 'framework', 'paradigm', 'approach',
    'philosophy', 'perspective', 'viewpoint', 'understanding',
    'conceptualization', 'abstract', 'theoretical', 'hypothetical'
  ];

  // Count indicators
  let analyticalCount = 0;
  let conceptualCount = 0;

  analyticalIndicators.forEach(indicator => {
    const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
    const matches = lowerContent.match(regex);
    if (matches) analyticalCount += matches.length;
  });

  conceptualIndicators.forEach(indicator => {
    const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
    const matches = lowerContent.match(regex);
    if (matches) conceptualCount += matches.length;
  });

  // Normalize by content length (per 1000 characters)
  const contentLength = content.length / 1000;
  const normalizedAnalytical = analyticalCount / contentLength;
  const normalizedConceptual = conceptualCount / contentLength;

  // Determine type based on normalized counts
  if (normalizedConceptual > 0.5 && normalizedConceptual > normalizedAnalytical) {
    return 'conceptual';
  } else if (normalizedAnalytical > 0.5) {
    return 'analytical';
  } else {
    return 'factual';
  }
}

// Helper function to create the appropriate learning prompt
function createLearningPrompt(query: string, numLearnings: number, insightDetail: number, detailLevel: string, contents: string[]): string {
  const pagesEstimate = Math.floor(calculateTokenLimit(insightDetail)/800) + "-" + Math.ceil(calculateTokenLimit(insightDetail)/600);

  let promptTemplate = `Given the following contents from a SERP search for the query <query>${query}</query>, generate ${numLearnings} ${detailLevel} learnings.\n\n`;

  if (insightDetail >= 8) {
    promptTemplate += `
    Each learning should:
    1. Have a clear, descriptive title
    2. Be extremely thorough and comprehensive (${pagesEstimate} pages of content)
    3. Deeply analyze the topic with multiple perspectives
    4. Include all relevant facts, figures, statistics, and data points
    5. Discuss methodologies, limitations, and implications
    6. Compare and contrast different viewpoints or approaches
    7. Incorporate specific examples, case studies, or applications
    8. Cite specific sources for key information
    9. Be structured with clear sections and logical flow
    10. Include 5-10 key topics that this learning relates to
    11. Include an importance rating (1-10) indicating how central this learning is to the research topic
    `;
  } else if (insightDetail >= 5) {
    promptTemplate += `
    Each learning should:
    1. Have a clear, descriptive title
    2. Be detailed and informative (${pagesEstimate} pages of content)
    3. Include specific facts, figures, and context
    4. Provide analysis beyond just summarizing information
    5. Reference specific sources where appropriate
    6. Be well-organized with a logical structure
    7. Include 3-7 key topics that this learning relates to
    8. Include an importance rating (1-10) indicating how central this learning is to the research topic
    `;
  } else if (insightDetail >= 3) {
    promptTemplate += `
    Each learning should:
    1. Have a clear, descriptive title
    2. Be moderately detailed (${pagesEstimate} pages of content)
    3. Capture the important information on the topic
    4. Include key facts and figures where relevant
    5. Be focused and well-structured
    6. Include 2-5 key topics that this learning relates to
    7. Include an importance rating (1-10) indicating how central this learning is to the research topic
    `;
  } else {
    promptTemplate += `
    Each learning should:
    1. Be concise but informative
    2. Capture the essential information on the topic
    3. Include key facts and figures where relevant
    4. Be focused and to the point
    5. Include 1-3 key topics that this learning relates to
    6. Include an importance rating (1-10) indicating how central this learning is to the research topic
    `;
  }

  promptTemplate += `\n\nMake sure each learning is unique and focuses on a different aspect of the topic.\nInclude specific entities, metrics, numbers, and dates where relevant.\nFor each learning, include a list of sources that contributed to that learning.\n\n<contents>${contents.map(content => `<content>\n${content}\n</content>`).join('\n')}</contents>`;

  return trimPrompt(promptTemplate);
}

export async function enhancedDeepResearch({
  query,
  breadth,
  depth,
  learnings = [],
  visitedUrls = [],
  pubMedArticles = [],
  meshRestrictiveness = MeshRestrictiveness.MEDIUM,
  insightDetail = 5,
  onProgress,
}: {
  query: string;
  breadth: number;
  depth: number;
  learnings?: StructuredLearning[];
  visitedUrls?: string[];
  pubMedArticles?: PubMedArticle[];
  meshRestrictiveness?: MeshRestrictiveness;
  insightDetail?: number;
  onProgress?: (progress: ResearchProgress) => void;
}): Promise<ResearchResult> {
  const progress: ResearchProgress = {
    currentDepth: depth,
    totalDepth: depth,
    currentBreadth: breadth,
    totalBreadth: breadth,
    totalQueries: 0,
    completedQueries: 0,
    stage: 'research',
  };

  const reportProgress = (update: Partial<ResearchProgress>) => {
    Object.assign(progress, update);
    onProgress?.(progress);
  };

  const serpQueries = await generateSerpQueries({
    query,
    learnings,
    numQueries: breadth,
  });

  reportProgress({
    totalQueries: serpQueries.length,
    currentQuery: serpQueries[0]?.query,
  });

  const limit = pLimit(ConcurrencyLimit);

  const results = await Promise.all(
    serpQueries.map(serpQuery =>
      limit(async () => {
        try {
          // Search Firecrawl
          const result = await firecrawl.search(serpQuery.query, {
            timeout: 15000,
            limit: 10,
            scrapeOptions: { formats: ['markdown'] },
          });

          // Search PubMed if enabled
          let newPubMedArticles: PubMedArticle[] = [];
          if (process.env.INCLUDE_PUBMED_SEARCH === 'true' && process.env.PUBMED_API_KEY) {
            const pubMedResult = await searchPubMed(serpQuery.query, 5, true, meshRestrictiveness);
            newPubMedArticles = pubMedResult.articles;
          }

          // Collect URLs from this search
          const newUrls = compact(result.data.map(item => item.url));
          // Reduce breadth more gradually to maintain more queries at deeper levels
          const newBreadth = Math.ceil(breadth * 0.75);
          const newDepth = depth - 1;

          // Combine PubMed articles
          const allPubMedArticles = [...pubMedArticles, ...newPubMedArticles];

          const newResults = await processSerpResult({
            query: serpQuery.query,
            result,
            numFollowUpQuestions: newBreadth,
            pubMedArticles: newPubMedArticles,
            breadth,
            insightDetail,
          });

          // Set depth metadata for the new structured learnings
          const newStructuredLearnings = newResults.structuredLearnings.map(learning => ({
            ...learning,
            metadata: {
              ...learning.metadata,
              depth: depth,
            },
          }));

          const allStructuredLearnings = [...learnings, ...newStructuredLearnings];
          const allUrls = [...visitedUrls, ...newUrls];

          if (newDepth > 0) {
            log(`Researching deeper, breadth: ${newBreadth}, depth: ${newDepth}`);

            reportProgress({
              currentDepth: newDepth,
              currentBreadth: newBreadth,
              completedQueries: progress.completedQueries + 1,
              currentQuery: serpQuery.query,
            });

            const nextQuery = `
            Previous research goal: ${serpQuery.researchGoal}
            Follow-up research directions: ${newResults.followUpQuestions.map(q => `\n${q}`).join('')}
          `.trim();

            return enhancedDeepResearch({
              query: nextQuery,
              breadth: newBreadth,
              depth: newDepth,
              learnings: allStructuredLearnings,
              visitedUrls: allUrls,
              pubMedArticles: allPubMedArticles,
              meshRestrictiveness,
              insightDetail,
              onProgress,
            });
          } else {
            reportProgress({
              currentDepth: 0,
              completedQueries: progress.completedQueries + 1,
              currentQuery: serpQuery.query,
            });
            return {
              learnings: allStructuredLearnings,
              visitedUrls: allUrls,
              pubMedArticles: allPubMedArticles,
            };
          }
        } catch (e: any) {
          if (e.message && e.message.includes('Timeout')) {
            log(`Timeout error running query: ${serpQuery.query}: `, e);
          } else {
            log(`Error running query: ${serpQuery.query}: `, e);
          }
          return {
            learnings: [],
            visitedUrls: [],
            pubMedArticles: [],
          };
        }
      }),
    ),
  );

  // Combine all structured learnings from results
  const allStructuredLearnings = results.flatMap(r => r.learnings || []);

  // Combine all PubMed articles from results
  const allPubMedArticles = results.flatMap(r => r.pubMedArticles || []);

  // Deduplicate PubMed articles by ID
  const uniquePubMedArticles = allPubMedArticles.reduce((acc, article) => {
    if (!acc.some(a => a.id === article.id)) {
      acc.push(article);
    }
    return acc;
  }, [] as PubMedArticle[]);

  // Deduplicate structured learnings by ID
  const uniqueStructuredLearnings = allStructuredLearnings.reduce((acc, learning) => {
    if (!acc.some(l => l.id === learning.id)) {
      acc.push(learning);
    }
    return acc;
  }, [] as StructuredLearning[]);

  // Combine all URLs from results
  const allUrls = [...new Set(results.flatMap(r => r.visitedUrls))];

  return {
    learnings: uniqueStructuredLearnings,
    visitedUrls: allUrls,
    pubMedArticles: uniquePubMedArticles,
  };
}

export async function enhancedWriteFinalReport({
  prompt,
  learnings,
  visitedUrls,
  pubMedArticles = [],
  insightDetail = 5,
  onProgress,
}: {
  prompt: string;
  learnings: StructuredLearning[];
  visitedUrls: string[];
  pubMedArticles?: PubMedArticle[];
  insightDetail?: number;
  onProgress?: (progress: ResearchProgress) => void;
}): Promise<string> {
  const progress: ResearchProgress = {
    currentDepth: 0,
    totalDepth: 0,
    currentBreadth: 0,
    totalBreadth: 0,
    totalQueries: 0,
    completedQueries: 0,
    stage: 'processing',
  };

  const reportProgress = (update: Partial<ResearchProgress>) => {
    Object.assign(progress, update);
    onProgress?.(progress);
  };

  // 1. Apply hierarchical aggregation to learnings
  reportProgress({
    processingStage: 'hierarchical-aggregation',
  });
  log('Applying hierarchical aggregation to learnings...');
  const hierarchicalLearnings = await aggregateHierarchicalLearnings(learnings);

  // 2. Apply progressive summarization
  reportProgress({
    processingStage: 'progressive-summarization',
  });
  log('Applying progressive summarization...');
  const summarizedLearnings = await progressiveSummarization(
    learnings,
    Math.max(...learnings.map(l => l.metadata.depth))
  );

  // 3. Select important content if exceeding context limits
  reportProgress({
    processingStage: 'content-selection',
  });
  log('Selecting important content...');
  const maxContentSize = calculateMaxContentSize(insightDetail);
  const selectedLearnings = selectImportantContent(
    summarizedLearnings.layeredLearnings,
    maxContentSize
  );

  // 4. Generate report using chunking and templates
  reportProgress({
    processingStage: 'report-generation',
    stage: 'report-generation',
  });
  log('Generating final report...');

  // Determine which report generation approach to use based on insight detail
  let finalReport: string;

  if (insightDetail >= 7) {
    // For high detail levels, use chunked report generation
    finalReport = await writeFinalReportWithChunking({
      prompt,
      learnings: selectedLearnings,
      visitedUrls,
      pubMedArticles,
      insightDetail,
    });
  } else {
    // For lower detail levels, use template-based report generation
    const domainType = await identifyResearchDomain(prompt, selectedLearnings);
    finalReport = await templateBasedReportGeneration(
      prompt,
      selectedLearnings,
      insightDetail,
      visitedUrls,
      pubMedArticles
    );
  }

  // Log the approximate word count for debugging
  const wordCount = finalReport.split(/\s+/).length;
  console.log(`Generated report with approximately ${wordCount} words`);

  return finalReport;
}
