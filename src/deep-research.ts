import FirecrawlApp, { SearchResponse } from '@mendable/firecrawl-js';
import { generateObject } from 'ai';
import { compact } from 'lodash-es';
import pLimit from 'p-limit';
import { z } from 'zod';

import { getModel, trimPrompt } from './ai/providers';
import { systemPrompt } from './prompt';
import { MeshRestrictiveness, PubMedArticle, pubMedResultToMarkdown, searchPubMed } from './pubmed';

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
};

// Interface for detailed learning structure
export interface DetailedLearning {
  title: string;           // A descriptive title for the learning
  content: string;         // The detailed content of the learning
  sources: string[];       // References to sources used
  keyPoints?: string[];    // Optional list of key points
}

type ResearchResult = {
  learnings: string[];
  visitedUrls: string[];
  pubMedArticles?: PubMedArticle[];
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

// Helper function to calculate report token limit based on insight detail
// Reports need more tokens than individual learnings
function calculateReportTokenLimit(insightDetail: number): number {
  // Scale more aggressively to ensure detailed reports
  // Level 1: ~4000 tokens (concise report, ~3000 words)
  // Level 5: ~12000 tokens (detailed report, ~9000 words)
  // Level 10: ~24000 tokens (comprehensive report, ~18000 words)

  if (insightDetail <= 3) {
    // 4000-8000 tokens for levels 1-3
    return 4000 + (insightDetail - 1) * 2000;
  } else if (insightDetail <= 7) {
    // 8000-16000 tokens for levels 4-7
    return 8000 + (insightDetail - 4) * 2000;
  } else {
    // 16000-24000 tokens for levels 8-10
    return 16000 + (insightDetail - 8) * 2667;
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
  learnings?: string[];
}) {
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: <prompt>${query}</prompt>\n\n${
      learnings
        ? `Here are some learnings from previous research, use them to generate more specific queries: ${learnings.join(
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

  // Define the schema based on insight detail level
  let schema;
  if (insightDetail >= 5) {
    // For medium to high detail, use detailed learning structure
    schema = z.object({
      detailedLearnings: z.array(z.object({
        title: z.string().describe("A descriptive title for this learning"),
        content: z.string().describe("The detailed content exploring this learning"),
        sources: z.array(z.string()).describe("References to specific sources used"),
        keyPoints: z.array(z.string()).describe("Key points from this learning")
      })).describe(`List of ${detailLevel} learnings, max of ${adjustedNumLearnings}`),
      followUpQuestions: z.array(z.string()).describe(
        `List of follow-up questions to research the topic further, max of ${numFollowUpQuestions}`,
      ),
    });
  } else {
    // For low detail, use simple string array for learnings
    schema = z.object({
      learnings: z.array(z.string()).describe(`List of ${detailLevel} learnings, max of ${adjustedNumLearnings}`),
      followUpQuestions: z.array(z.string()).describe(
        `List of follow-up questions to research the topic further, max of ${numFollowUpQuestions}`,
      ),
    });
  }

  // Generate the learnings
  const res = await generateObject({
    model: getModel(),
    abortSignal: AbortSignal.timeout(180_000), // Longer timeout for detailed generation
    system: systemPrompt(),
    prompt: learningPrompt,
    max_tokens: tokenLimit * adjustedNumLearnings, // Set max tokens based on insight detail
    schema,
  });

  // Process the result based on insight detail level
  if (insightDetail >= 5 && 'detailedLearnings' in res.object) {
    // Convert detailed learnings to simple strings for backward compatibility
    const simpleLearnings = res.object.detailedLearnings.map(learning => {
      return `${learning.title}\n\n${learning.content}`;
    });

    log(`Created ${res.object.detailedLearnings.length} detailed learnings`);

    return {
      learnings: simpleLearnings,
      followUpQuestions: res.object.followUpQuestions,
      detailedLearnings: res.object.detailedLearnings
    };
  } else {
    log(`Created ${res.object.learnings.length} learnings`);
    return res.object;
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
    `;
  } else if (insightDetail >= 3) {
    promptTemplate += `
    Each learning should:
    1. Have a clear, descriptive title
    2. Be moderately detailed (${pagesEstimate} pages of content)
    3. Capture the important information on the topic
    4. Include key facts and figures where relevant
    5. Be focused and well-structured
    `;
  } else {
    promptTemplate += `
    Each learning should:
    1. Be concise but informative
    2. Capture the essential information on the topic
    3. Include key facts and figures where relevant
    4. Be focused and to the point
    `;
  }

  promptTemplate += `\n\nMake sure each learning is unique and focuses on a different aspect of the topic.\nInclude specific entities, metrics, numbers, and dates where relevant.\nFor each learning, include a list of sources that contributed to that learning.\n\n<contents>${contents.map(content => `<content>\n${content}\n</content>`).join('\n')}</contents>`;

  return trimPrompt(promptTemplate);
}

export async function writeFinalReport({
  prompt,
  learnings,
  visitedUrls,
  pubMedArticles = [],
  insightDetail = 5,
}: {
  prompt: string;
  learnings: string[];
  visitedUrls: string[];
  pubMedArticles?: PubMedArticle[];
  insightDetail?: number;
}) {
  // Determine report length based on insight detail
  const reportLength = getReportLength(insightDetail);
  const detailLevel = getDetailLevelDescription(insightDetail);

  // Convert learnings to a format for the prompt
  const learningsString = learnings
    .map(learning => `<learning>\n${learning}\n</learning>`)
    .join('\n');

  // Prepare sources for citation
  const webSources = visitedUrls.map((url, index) => ({
    id: `web${index + 1}`,
    url,
    type: 'web'
  }));

  const pubmedSources = pubMedArticles.map((article, index) => ({
    id: `pubmed${index + 1}`,
    url: article.url,
    title: article.title,
    authors: article.authors?.join(', ') || '[No authors listed]',
    journal: article.journal || '[Journal not specified]',
    publicationDate: article.publicationDate || '[Date not specified]',
    doi: article.doi,
    type: 'pubmed'
  }));

  const allSources = [...webSources, ...pubmedSources];
  const sourcesString = JSON.stringify(allSources);

  // Create the report generation prompt based on insight detail
  const reportPrompt = createReportPrompt(prompt, reportLength, insightDetail, detailLevel, learningsString, sourcesString);

  // Log that we're generating the report
  console.log(`Generating ${detailLevel} report based on all learnings (no token limit)`);

  // Generate the final report without token limits
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: trimPrompt(reportPrompt),
    // No max_tokens parameter - let the model use as many tokens as needed based on the content
    abortSignal: AbortSignal.timeout(900_000), // Very long timeout (15 minutes) for detailed reports
    schema: z.object({
      reportMarkdown: z.string().describe(`${detailLevel} final report (${reportLength}) on the topic in Markdown with proper citations. The report MUST be comprehensive and include ALL information from the learnings.`),
    }),
  });

  // Log the approximate word count for debugging
  const wordCount = res.object.reportMarkdown.split(/\s+/).length;
  console.log(`Generated report with approximately ${wordCount} words`);

  // Add references section
  const referencesSection = createReferencesSection(webSources, pubmedSources);

  return res.object.reportMarkdown + referencesSection;
}

// Helper function to create the report prompt
function createReportPrompt(
  prompt: string,
  reportLength: string,
  insightDetail: number,
  detailLevel: string,
  learningsString: string,
  sourcesString: string
): string {
  let promptTemplate = `Given the following prompt from the user, write a ${detailLevel} final report (${reportLength}) on the topic using the learnings from research.\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from previous research:\n\n<learnings>\n${learningsString}\n</learnings>\n\n`;

  if (insightDetail >= 7) {
    promptTemplate += `
    Your report MUST:
    1. Be EXTREMELY detailed and comprehensive (${reportLength})
    2. Include ALL the information from the learnings in great detail
    3. Be well-structured with clear sections, subsections, and a logical flow
    4. Include a detailed executive summary at the beginning
    5. Provide in-depth analysis that builds upon the detailed learnings
    6. Cover multiple perspectives and approaches
    7. Discuss implications, applications, and future directions
    8. Maintain academic rigor throughout
    9. CRITICAL: Do not omit ANY important information from the learnings
    10. Expand each section with substantial detail, examples, and analysis
    `;
  } else if (insightDetail >= 4) {
    promptTemplate += `
    Your report MUST:
    1. Be detailed and thorough (${reportLength})
    2. Incorporate ALL the key information from the learnings
    3. Have a clear structure with appropriate sections and subsections
    4. Include a comprehensive executive summary
    5. Provide substantial analysis and insights for each topic
    6. Consider different perspectives where relevant
    7. CRITICAL: Do not omit ANY important information from the learnings
    8. Expand each section with sufficient detail, examples, and analysis
    `;
  } else {
    promptTemplate += `
    Your report MUST:
    1. Be clear and well-organized (${reportLength})
    2. Capture all the essential information from the learnings
    3. Have a logical structure with clear sections
    4. Focus on the most important points while providing adequate detail
    5. CRITICAL: Do not omit ANY important information from the learnings
    6. Provide enough detail to make the report informative and useful
    `;
  }

  promptTemplate += `\n\nVERY IMPORTANT: For EVERY factual statement in your report, you MUST include a citation to the relevant source. Here are the available sources you can cite:\n\n<sources>${sourcesString}</sources>\n\nCitation format:\n- For web sources: Use [web1], [web2], etc. at the end of the sentence or paragraph containing the information.\n- For PubMed sources: Use [pubmed1], [pubmed2], etc. at the end of the sentence or paragraph containing the information.\n\nYou MUST include at least one citation for every paragraph. If a paragraph contains information from multiple sources, include all relevant citations. If you're unsure which exact source a piece of information came from, cite multiple potential sources.\n\nExample of proper citation:\n"Recent studies have shown that immunotherapy is effective for treating certain types of cancer [web1][pubmed2]. However, the efficacy varies significantly based on cancer type and patient characteristics [pubmed1][web3]."\n\nRemember, this report should be ${detailLevel.toUpperCase()}, covering all aspects of the topic in appropriate detail.`;

  return promptTemplate;
}

// Helper function to create the references section
function createReferencesSection(webSources: any[], pubmedSources: any[]): string {
  let sourcesSection = `\n\n## References\n\n`;

  // Add web sources
  if (webSources.length > 0) {
    sourcesSection += `### Web Sources\n\n`;
    sourcesSection += webSources.map(source => {
      return `[${source.id}] ${source.url}`;
    }).join('\n\n');
  }

  // Add PubMed citations if available
  if (pubmedSources.length > 0) {
    sourcesSection += '\n\n### PubMed Citations\n\n';
    sourcesSection += pubmedSources.map(source => {
      return `[${source.id}] ${source.authors}. ${source.title}. ${source.journal}. ${source.publicationDate}. ${source.doi ? `doi: ${source.doi}` : ''}\n   [PubMed Link](${source.url})`;
    }).join('\n\n');
  }

  return sourcesSection;
}

export async function writeFinalAnswer({
  prompt,
  learnings,
}: {
  prompt: string;
  learnings: string[];
}) {
  const learningsString = learnings
    .map(learning => `<learning>\n${learning}\n</learning>`)
    .join('\n');

  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Given the following prompt from the user, write a final answer on the topic using the learnings from research. Follow the format specified in the prompt. Do not yap or babble or include any other text than the answer besides the format specified in the prompt. Keep the answer as concise as possible - usually it should be just a few words or maximum a sentence. Try to follow the format specified in the prompt (for example, if the prompt is using Latex, the answer should be in Latex. If the prompt gives multiple answer choices, the answer should be one of the choices).\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from research on the topic that you can use to help answer the prompt:\n\n<learnings>\n${learningsString}\n</learnings>`,
    ),
    schema: z.object({
      exactAnswer: z
        .string()
        .describe('The final answer, make it short and concise, just the answer, no other text'),
    }),
  });

  return res.object.exactAnswer;
}

export async function deepResearch({
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
  learnings?: string[];
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

          const newLearnings = await processSerpResult({
            query: serpQuery.query,
            result,
            numFollowUpQuestions: newBreadth,
            pubMedArticles: newPubMedArticles,
            breadth,
            insightDetail,
          });
          const allLearnings = [...learnings, ...newLearnings.learnings];
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
            Follow-up research directions: ${newLearnings.followUpQuestions.map(q => `\n${q}`).join('')}
          `.trim();

            return deepResearch({
              query: nextQuery,
              breadth: newBreadth,
              depth: newDepth,
              learnings: allLearnings,
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
              learnings: allLearnings,
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

  // Combine all PubMed articles from results
  const allPubMedArticles = results.flatMap(r => r.pubMedArticles || []);

  // Deduplicate PubMed articles by ID
  const uniquePubMedArticles = allPubMedArticles.reduce((acc, article) => {
    if (!acc.some(a => a.id === article.id)) {
      acc.push(article);
    }
    return acc;
  }, [] as PubMedArticle[]);

  return {
    learnings: [...new Set(results.flatMap(r => r.learnings))],
    visitedUrls: [...new Set(results.flatMap(r => r.visitedUrls))],
    pubMedArticles: uniquePubMedArticles,
  };
}
