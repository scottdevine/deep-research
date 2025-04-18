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

type ResearchResult = {
  learnings: string[];
  visitedUrls: string[];
  pubMedArticles?: PubMedArticle[];
};

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
  numLearnings = 3,
  numFollowUpQuestions = 3,
  pubMedArticles = [],
}: {
  query: string;
  result: SearchResponse;
  numLearnings?: number;
  numFollowUpQuestions?: number;
  pubMedArticles?: PubMedArticle[];
}) {
  const contents = compact(result.data.map(item => item.markdown)).map(content =>
    trimPrompt(content, 25_000),
  );

  // Add PubMed articles to contents if available
  if (pubMedArticles && pubMedArticles.length > 0) {
    const pubMedContents = pubMedArticles.map(article => pubMedResultToMarkdown(article));
    contents.push(...pubMedContents);
  }

  log(`Ran ${query}, found ${contents.length} contents (including ${pubMedArticles?.length || 0} PubMed articles)`);

  const res = await generateObject({
    model: getModel(),
    abortSignal: AbortSignal.timeout(60_000),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Given the following contents from a SERP search for the query <query>${query}</query>, generate a list of learnings from the contents. Return a maximum of ${numLearnings} learnings, but feel free to return less if the contents are clear. Make sure each learning is unique and not similar to each other. The learnings should be concise and to the point, as detailed and information dense as possible. Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates. The learnings will be used to research the topic further.\n\n<contents>${contents
        .map(content => `<content>\n${content}\n</content>`)
        .join('\n')}</contents>`,
    ),
    schema: z.object({
      learnings: z.array(z.string()).describe(`List of learnings, max of ${numLearnings}`),
      followUpQuestions: z
        .array(z.string())
        .describe(
          `List of follow-up questions to research the topic further, max of ${numFollowUpQuestions}`,
        ),
    }),
  });
  log(`Created ${res.object.learnings.length} learnings`, res.object.learnings);

  return res.object;
}

export async function writeFinalReport({
  prompt,
  learnings,
  visitedUrls,
  pubMedArticles = [],
}: {
  prompt: string;
  learnings: string[];
  visitedUrls: string[];
  pubMedArticles?: PubMedArticle[];
}) {
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

  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Given the following prompt from the user, write a final report on the topic using the learnings from research. Make it as detailed as possible, aim for 3 or more pages, and include ALL the learnings from research.\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from previous research:\n\n<learnings>\n${learningsString}\n</learnings>\n\nVERY IMPORTANT: For EVERY factual statement in your report, you MUST include a citation to the relevant source. Here are the available sources you can cite:\n\n<sources>${sourcesString}</sources>\n\nCitation format:\n- For web sources: Use [web1], [web2], etc. at the end of the sentence or paragraph containing the information.\n- For PubMed sources: Use [pubmed1], [pubmed2], etc. at the end of the sentence or paragraph containing the information.\n\nYou MUST include at least one citation for every paragraph. If a paragraph contains information from multiple sources, include all relevant citations. If you're unsure which exact source a piece of information came from, cite multiple potential sources.\n\nExample of proper citation:\n"Recent studies have shown that immunotherapy is effective for treating certain types of cancer [web1][pubmed2]. However, the efficacy varies significantly based on cancer type and patient characteristics [pubmed1][web3]."`,
    ),
    schema: z.object({
      reportMarkdown: z.string().describe('Final report on the topic in Markdown with proper citations'),
    }),
  });

  // Append the sources section to the report with proper formatting
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

  return res.object.reportMarkdown + sourcesSection;
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
  onProgress,
}: {
  query: string;
  breadth: number;
  depth: number;
  learnings?: string[];
  visitedUrls?: string[];
  pubMedArticles?: PubMedArticle[];
  meshRestrictiveness?: MeshRestrictiveness;
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
            limit: 5,
            scrapeOptions: { formats: ['markdown'] },
          });

          // Search PubMed if enabled
          let newPubMedArticles: PubMedArticle[] = [];
          if (process.env.INCLUDE_PUBMED_SEARCH === 'true' && process.env.PUBMED_API_KEY) {
            const pubMedResult = await searchPubMed(serpQuery.query, 3, true, meshRestrictiveness);
            newPubMedArticles = pubMedResult.articles;
          }

          // Collect URLs from this search
          const newUrls = compact(result.data.map(item => item.url));
          const newBreadth = Math.ceil(breadth / 2);
          const newDepth = depth - 1;

          // Combine PubMed articles
          const allPubMedArticles = [...pubMedArticles, ...newPubMedArticles];

          const newLearnings = await processSerpResult({
            query: serpQuery.query,
            result,
            numFollowUpQuestions: newBreadth,
            pubMedArticles: newPubMedArticles,
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
