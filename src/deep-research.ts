import FirecrawlApp, { SearchResponse } from '@mendable/firecrawl-js';
import { generateObject, generateText } from 'ai';
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
  // Level 1: ~8000 tokens (concise report, ~6000 words)
  // Level 5: ~20000 tokens (detailed report, ~15000 words)
  // Level 10: ~32000 tokens (comprehensive report, ~24000 words)

  if (insightDetail <= 3) {
    // 8000-14000 tokens for levels 1-3
    return 8000 + (insightDetail - 1) * 3000;
  } else if (insightDetail <= 7) {
    // 14000-26000 tokens for levels 4-7
    return 14000 + (insightDetail - 4) * 3000;
  } else {
    // 26000-32000 tokens for levels 8-10
    return 26000 + (insightDetail - 8) * 3000;
  }
}

// Helper function to calculate the appropriate number of learnings based on insight detail
function calculateLearningsCount(insightDetail: number, breadth: number): number {
  // With increased token limits, we can extract more learnings even at higher detail levels
  if (insightDetail >= 8) {
    return Math.max(3, Math.min(5, breadth - 1)); // 3-5 learnings for high detail
  } else if (insightDetail >= 5) {
    return Math.max(4, Math.min(7, breadth));     // 4-7 learnings for medium detail
  } else {
    return Math.max(5, Math.min(10, breadth));    // 5-10 learnings for low detail
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
  if (insightDetail >= 8) return "an extremely comprehensive, in-depth report (15,000-20,000 words) that thoroughly covers all aspects of the topic with extensive detail and analysis";
  if (insightDetail >= 5) return "a very detailed report (8,000-15,000 words) that covers the topic thoroughly with substantial depth and breadth";
  if (insightDetail >= 3) return "a moderately detailed report (5,000-8,000 words) that covers all key aspects of the topic with good depth";
  return "a well-structured report (3,000-5,000 words) that covers the essential aspects of the topic with adequate detail";
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
  modelId,
}: {
  query: string;
  numQueries?: number;
  // optional, if provided, the research will continue from the last learning
  learnings?: string[];
  modelId?: string;
}) {
  try {
    // First try with structured JSON output
    const res = await generateObject({
      model: getModel(modelId),
      system: systemPrompt(),
      prompt: `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other. Format your response as a JSON object with a 'queries' array containing objects with 'query' and 'researchGoal' properties. Do not wrap your response in markdown code blocks or any other formatting: <prompt>${query}</prompt>\n\n${
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
  } catch (error) {
    console.log('Error generating structured queries, falling back to text parsing:', error);

    try {
      // Try to extract JSON from markdown code blocks if that's the issue
      if (error.cause?.text) {
        const jsonMatch = error.cause.text.match(/```(?:json)?\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          try {
            const parsedJson = JSON.parse(jsonMatch[1]);
            if (parsedJson.queries && Array.isArray(parsedJson.queries)) {
              log(`Created ${parsedJson.queries.length} queries from extracted JSON`, parsedJson.queries);
              return parsedJson.queries.slice(0, numQueries);
            }
          } catch (jsonError) {
            console.log('Failed to parse extracted JSON:', jsonError);
          }
        }
      }

      // Fallback to text generation and parsing
      const response = await generateText({
        model: getModel(modelId),
        system: systemPrompt(),
        prompt: `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other. Number each query (1., 2., 3.) and put each on a new line. For each query, also include a research goal on the next line, indented with a tab or spaces: <prompt>${query}</prompt>\n\n${
          learnings
            ? `Here are some learnings from previous research, use them to generate more specific queries: ${learnings.join(
                '\n',
              )}`
            : ''
        }`,
      });

      // Parse the text response to extract queries
      const queries = [];

      if (response && response.content) {
        const lines = response.content.split('\n');
        let currentQuery = null;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Look for lines that start with a number followed by a period
          const queryMatch = line.match(/^\s*\d+\.\s*(.+)/);
          if (queryMatch && queryMatch[1]) {
            if (currentQuery) {
              queries.push(currentQuery);
            }

            currentQuery = {
              query: queryMatch[1].trim(),
              researchGoal: ''
            };
          } else if (currentQuery && line && !line.match(/^\s*\d+\./) && i > 0) {
            // If we have a current query and this line isn't a new numbered query,
            // add it to the research goal
            if (currentQuery.researchGoal) {
              currentQuery.researchGoal += ' ' + line;
            } else {
              currentQuery.researchGoal = line;
            }
          }
        }

        // Add the last query if there is one
        if (currentQuery) {
          queries.push(currentQuery);
        }
      }

      // If we couldn't parse any queries, generate some default ones
      if (queries.length === 0) {
        const defaultQueries = [
          {
            query: `Latest advancements in ${query}`,
            researchGoal: `This query aims to find the most recent developments and breakthroughs in ${query}. The research will focus on identifying cutting-edge technologies, methodologies, and applications that have emerged in the past 1-2 years.`
          },
          {
            query: `Real-world applications of ${query}`,
            researchGoal: `This query seeks to discover practical implementations and use cases of ${query} in various industries and sectors. The research will examine how the technology or concept is being applied to solve real-world problems and the impact it has had.`
          }
        ];

        return defaultQueries.slice(0, numQueries);
      }

      log(`Created ${queries.length} queries from text parsing`, queries);
      return queries.slice(0, numQueries);
    } catch (fallbackError) {
      console.error('Error in fallback query generation:', fallbackError);

      // Ultimate fallback - return generic queries
      const genericQueries = [
        {
          query: `Latest advancements in ${query}`,
          researchGoal: `This query aims to find the most recent developments and breakthroughs in ${query}. The research will focus on identifying cutting-edge technologies, methodologies, and applications that have emerged in the past 1-2 years.`
        },
        {
          query: `Real-world applications of ${query}`,
          researchGoal: `This query seeks to discover practical implementations and use cases of ${query} in various industries and sectors. The research will examine how the technology or concept is being applied to solve real-world problems and the impact it has had.`
        }
      ];

      return genericQueries.slice(0, numQueries);
    }
  }
}

async function processSerpResult({
  query,
  result,
  numLearnings = 5,
  numFollowUpQuestions = 3,
  pubMedArticles = [],
  breadth = 5,
  insightDetail = 5,
  modelId,
}: {
  query: string;
  result: SearchResponse;
  numLearnings?: number;
  numFollowUpQuestions?: number;
  pubMedArticles?: PubMedArticle[];
  breadth?: number;
  insightDetail?: number;
  modelId?: string;
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

  // Skip the structured output approach entirely and just use text generation
  // This is more reliable across different models
  try {
    const response = await generateText({
      model: getModel(modelId),
      abortSignal: AbortSignal.timeout(180_000),
      system: systemPrompt(),
      prompt: learningPrompt + "\n\nProvide your response in a clear, structured format with numbered learnings and follow-up questions. Include a title for each learning, followed by detailed content, and list the sources used for each learning.",
      max_tokens: tokenLimit * adjustedNumLearnings,
    });

    if (!response || !response.content) {
      throw new Error('Failed to generate learnings');
    }

    // Parse the text response
    return parseTextLearnings(response.content, insightDetail, adjustedNumLearnings, numFollowUpQuestions);
  } catch (error) {
    console.error('Error generating learnings:', error);
    throw new Error('Failed to generate learnings');
  }

}

// Process the structured learning results
function processLearningResults(result: any, insightDetail: number) {
  // Process the result based on insight detail level
  if (insightDetail >= 5 && 'detailedLearnings' in result) {
    // Convert detailed learnings to simple strings for backward compatibility
    const simpleLearnings = result.detailedLearnings.map((learning: any) => {
      return `${learning.title}\n\n${learning.content}`;
    });

    log(`Created ${result.detailedLearnings.length} detailed learnings`);

    return {
      learnings: simpleLearnings,
      followUpQuestions: result.followUpQuestions,
      detailedLearnings: result.detailedLearnings
    };
  } else {
    log(`Created ${result.learnings.length} learnings`);
    return result;
  }
}

// Parse text-based learning results
function parseTextLearnings(text: string, insightDetail: number, numLearnings: number, numFollowUpQuestions: number) {
  // First try to extract JSON from the text
  try {
    // Check if the text contains a JSON object
    // Remove any text before the JSON object
    const jsonStartIndex = text.indexOf('{');
    const jsonEndIndex = text.lastIndexOf('}');

    if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
      const jsonText = text.substring(jsonStartIndex, jsonEndIndex + 1);
      try {
        // Try to parse the JSON
        const jsonObj = JSON.parse(jsonText);
        if (jsonObj.learnings && Array.isArray(jsonObj.learnings)) {
          // Successfully parsed JSON with learnings
          const extractedLearnings = jsonObj.learnings;

          // Convert to the expected format
          let learnings: string[] = [];
          let detailedLearnings: any[] = [];

          for (const learning of extractedLearnings) {
            if (typeof learning === 'string') {
              learnings.push(learning);
            } else if (learning.title && learning.content) {
              // This is a detailed learning
              detailedLearnings.push({
                title: learning.title,
                content: learning.content,
                sources: learning.sources || [],
                keyPoints: learning.keyPoints || ["Key points not explicitly provided"]
              });

              // Also add to simple learnings
              learnings.push(`${learning.title}\n\n${learning.content}`);
            }
          }

          // Extract follow-up questions if available
          let followUpQuestions: string[] = [];
          if (jsonObj.followUpQuestions && Array.isArray(jsonObj.followUpQuestions)) {
            followUpQuestions = jsonObj.followUpQuestions.slice(0, numFollowUpQuestions);
          } else {
            // Generate generic follow-up questions
            followUpQuestions = [
              "What are the most recent developments in this field?",
              "What are the practical applications of these findings?",
              "What are the limitations or challenges in this area?"
            ].slice(0, numFollowUpQuestions);
          }

          // Log the results
          if (detailedLearnings.length > 0) {
            log(`Created ${detailedLearnings.length} detailed learnings from JSON`);
            return {
              learnings,
              followUpQuestions,
              detailedLearnings
            };
          } else {
            log(`Created ${learnings.length} learnings from JSON`);
            return {
              learnings,
              followUpQuestions
            };
          }
        }
      } catch (e) {
        // JSON parsing failed, continue with text parsing
        console.log('JSON parsing failed, falling back to text parsing:', e);
      }
    }
  } catch (e) {
    // Error in JSON extraction, continue with text parsing
    console.log('Error in JSON extraction, falling back to text parsing:', e);
  }

  // Split the text into sections
  const sections = text.split(/\n\s*\n+/);

  // Initialize arrays for learnings and follow-up questions
  let learnings: string[] = [];
  let followUpQuestions: string[] = [];
  let detailedLearnings: any[] = [];

  // Process each section
  for (const section of sections) {
    const trimmedSection = section.trim();

    // Skip empty sections
    if (!trimmedSection) continue;

    // Check if this section contains follow-up questions
    if (
      trimmedSection.toLowerCase().includes('follow-up questions') ||
      trimmedSection.toLowerCase().includes('follow up questions') ||
      trimmedSection.toLowerCase().includes('further research')
    ) {
      // Extract questions using numbered or bulleted list patterns
      const questionMatches = trimmedSection.match(/(?:^|\n)\s*(?:\d+\.|-|\*|•)\s*(.+?)(?=(?:\n\s*(?:\d+\.|-|\*|•))|$)/gs);

      if (questionMatches) {
        followUpQuestions = questionMatches
          .map(q => q.replace(/^\s*(?:\d+\.|-|\*|•)\s*/, '').trim())
          .filter(q => q.length > 0)
          .slice(0, numFollowUpQuestions);
      }

      continue;
    }

    // Check if this is a learning
    if (
      trimmedSection.match(/^\s*(?:Learning|\d+\.|Key Finding|Finding)/) ||
      trimmedSection.includes('Title:') ||
      trimmedSection.match(/^[A-Z][^\n.]+:/) || // Starts with capitalized word followed by colon
      trimmedSection.match(/"title"\s*:\s*"[^"]+"/) // Contains a JSON-like title field
    ) {
      // For higher insight detail, try to parse as detailed learning
      if (insightDetail >= 5) {
        // Try to extract title and content from JSON-like format
        const jsonTitleMatch = trimmedSection.match(/"title"\s*:\s*"([^"]+)"/);
        const jsonContentMatch = trimmedSection.match(/"content"\s*:\s*"([^"]+)"/);

        if (jsonTitleMatch && jsonContentMatch) {
          const title = jsonTitleMatch[1].trim();
          const content = jsonContentMatch[1].trim();

          // Extract sources if available
          let sources: string[] = [];
          const jsonSourcesMatch = trimmedSection.match(/"sources"\s*:\s*\[([^\]]+)\]/);
          if (jsonSourcesMatch) {
            const sourcesText = jsonSourcesMatch[1].trim();
            sources = sourcesText
              .split(/,/)
              .map(s => s.trim().replace(/^"|"$/g, ''))
              .filter(s => s.length > 0);
          }

          // Add to detailed learnings
          detailedLearnings.push({
            title,
            content,
            sources,
            keyPoints: ["Key points not explicitly provided"]
          });

          // Also add to simple learnings
          learnings.push(`${title}\n\n${content}`);
        } else {
          // Try regular text format
          const titleMatch = trimmedSection.match(/(?:Title|Learning \d+|Key Finding \d+):?\s*([^\n]+)/);
          const contentMatch = trimmedSection.match(/(?:Content|Description|Details):?\s*([\s\S]+?)(?=(?:Sources|Key Points|References)|$)/i);
          const sourcesMatch = trimmedSection.match(/(?:Sources|References):?\s*([\s\S]+?)(?=(?:Key Points)|$)/i);
          const keyPointsMatch = trimmedSection.match(/(?:Key Points|Main Points):?\s*([\s\S]+?)$/i);

          if (titleMatch) {
            const title = titleMatch[1].trim();
            const content = contentMatch ? contentMatch[1].trim() : trimmedSection;

            // Extract sources if available
            let sources: string[] = [];
            if (sourcesMatch) {
              const sourcesText = sourcesMatch[1].trim();
              sources = sourcesText
                .split(/\n|,|;/)
                .map(s => s.trim())
                .filter(s => s.length > 0);
            }

            // Extract key points if available
            let keyPoints: string[] = [];
            if (keyPointsMatch) {
              const keyPointsText = keyPointsMatch[1].trim();
              keyPoints = keyPointsText
                .split(/\n|•|-|\*/)
                .map(p => p.trim())
                .filter(p => p.length > 0);
            }

            // Add to detailed learnings
            detailedLearnings.push({
              title,
              content,
              sources,
              keyPoints: keyPoints.length > 0 ? keyPoints : ["Key points not explicitly provided"]
            });

            // Also add to simple learnings
            learnings.push(`${title}\n\n${content}`);
          } else {
            // Fallback to treating as simple learning
            learnings.push(trimmedSection);
          }
        }
      } else {
        // For lower insight detail, just add as simple learning
        learnings.push(trimmedSection);
      }
    } else if (learnings.length < numLearnings) {
      // If we haven't found enough learnings yet, treat this section as a learning
      learnings.push(trimmedSection);
    }
  }

  // Ensure we don't exceed the requested number of learnings
  learnings = learnings.slice(0, numLearnings);

  // If we couldn't extract follow-up questions, generate some generic ones
  if (followUpQuestions.length === 0) {
    followUpQuestions = [
      "What are the most recent developments in this field?",
      "What are the practical applications of these findings?",
      "What are the limitations or challenges in this area?"
    ].slice(0, numFollowUpQuestions);
  }

  // Log the results
  if (detailedLearnings.length > 0) {
    log(`Created ${detailedLearnings.length} detailed learnings from text`);
    return {
      learnings,
      followUpQuestions,
      detailedLearnings
    };
  } else {
    log(`Created ${learnings.length} learnings from text`);
    return {
      learnings,
      followUpQuestions
    };
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
  modelId,
}: {
  prompt: string;
  learnings: string[];
  visitedUrls: string[];
  pubMedArticles?: PubMedArticle[];
  insightDetail?: number;
  modelId?: string;
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

  // Calculate token limit for the report based on insight detail
  const reportTokenLimit = calculateReportTokenLimit(insightDetail);

  // Create the report generation prompt based on insight detail
  const reportPrompt = createReportPrompt(prompt, reportLength, insightDetail, detailLevel, learningsString, sourcesString);

  // Log that we're generating the report
  console.log(`Generating ${detailLevel} report based on all learnings with token limit of ${reportTokenLimit} tokens (approx. ${Math.floor(reportTokenLimit / 1.33)} words)`);

  // Skip the structured output approach entirely and just use text generation
  // This is more reliable across different models
  try {
    const response = await generateText({
      model: getModel(modelId),
      system: systemPrompt(),
      prompt: trimPrompt(reportPrompt + `\n\nProvide your report directly in Markdown format. Do not include any JSON formatting or additional wrappers. Your report should be extremely comprehensive and detailed, aiming for at least ${Math.floor(reportTokenLimit * 0.75 / 1.33)} words.`),
      max_tokens: reportTokenLimit,
      abortSignal: AbortSignal.timeout(900_000), // Very long timeout (15 minutes) for detailed reports
    });

    if (!response || !response.content) {
      throw new Error('Failed to generate report');
    }

    // Clean up the response - remove any JSON or code block formatting
    let reportMarkdown = response.content.trim();

    // Remove markdown code blocks if present
    reportMarkdown = reportMarkdown.replace(/```(?:markdown|md)?([\s\S]*?)```/g, '$1').trim();

    // Try to extract JSON from the text
    try {
      // Check if the text contains a JSON object
      const jsonStartIndex = reportMarkdown.indexOf('{');
      const jsonEndIndex = reportMarkdown.lastIndexOf('}');

      if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
        const jsonText = reportMarkdown.substring(jsonStartIndex, jsonEndIndex + 1);
        try {
          // Try to parse the JSON
          const jsonObj = JSON.parse(jsonText);
          if (jsonObj.reportMarkdown) {
            // Successfully parsed JSON with reportMarkdown field
            reportMarkdown = jsonObj.reportMarkdown;
          }
        } catch (e) {
          // JSON parsing failed, try regex extraction
          console.log('JSON parsing failed, trying regex extraction:', e);

          // Try to extract the reportMarkdown field using regex
          const jsonMatch = jsonText.match(/"reportMarkdown"\s*:\s*"([\s\S]*?)"(?:,|\s*})/i);
          if (jsonMatch && jsonMatch[1]) {
            // Unescape any escaped quotes and newlines
            reportMarkdown = jsonMatch[1]
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
          }
        }
      }
    } catch (e) {
      // Error in JSON extraction, keep as is
      console.log('Error in JSON extraction, keeping original text:', e);
    }

    // Log the approximate word count for debugging
    const wordCount = reportMarkdown.split(/\s+/).length;
    console.log(`Generated report with approximately ${wordCount} words`);

    // Add references section
    const referencesSection = createReferencesSection(webSources, pubmedSources);

    return reportMarkdown + referencesSection;
  } catch (error) {
    console.error('Error generating report:', error);
    throw new Error('Failed to generate report');
  }
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
  // Calculate approximate word count target based on insight detail
  const wordCountTarget = insightDetail >= 8 ? "15,000-20,000" :
                         insightDetail >= 5 ? "8,000-15,000" :
                         insightDetail >= 3 ? "5,000-8,000" : "3,000-5,000";

  let promptTemplate = `Given the following prompt from the user, write a ${detailLevel} final report (${reportLength}) on the topic using the learnings from research. Your report should be approximately ${wordCountTarget} words in length to ensure comprehensive coverage of the topic.\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from previous research:\n\n<learnings>\n${learningsString}\n</learnings>\n\n`;

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
    11. IMPORTANT: Aim for a length of approximately ${wordCountTarget} words
    12. Significantly expand on each learning with additional context, analysis, and implications
    13. Include detailed examples, case studies, and applications where relevant
    14. Provide extensive background information to contextualize the topic
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
    9. IMPORTANT: Aim for a length of approximately ${wordCountTarget} words
    10. Expand on each learning with additional context and analysis
    11. Include examples and applications where relevant
    12. Provide background information to contextualize the topic
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
    7. IMPORTANT: Aim for a length of approximately ${wordCountTarget} words
    8. Expand on each learning with additional context where helpful
    9. Include examples where they clarify concepts
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
  modelId,
}: {
  prompt: string;
  learnings: string[];
  modelId?: string;
}) {
  const learningsString = learnings
    .map(learning => `<learning>\n${learning}\n</learning>`)
    .join('\n');

  const res = await generateObject({
    model: getModel(modelId),
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
  modelId,
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
  modelId?: string;
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
    modelId,
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
            modelId,
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
              modelId,
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
