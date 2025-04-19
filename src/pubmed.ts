import axios from 'axios';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

import { getModel } from './ai/providers';
import { systemPrompt } from './prompt';

// Define the PubMed API response schema
export const PubMedArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  abstract: z.string().optional(),
  authors: z.array(z.string()).optional(),
  journal: z.string().optional(),
  publicationDate: z.string().optional(),
  doi: z.string().optional(),
  url: z.string(),
});

export type PubMedArticle = z.infer<typeof PubMedArticleSchema>;

export type PubMedSearchResponse = {
  articles: PubMedArticle[];
  total: number;
};

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

// Format citation based on the style specified in env
function formatCitation(article: PubMedArticle): string {
  const citationStyle = process.env.CITATION_STYLE || 'NLM';

  // Default to NLM style (National Library of Medicine)
  if (citationStyle === 'NLM') {
    const authors = article.authors && article.authors.length > 0
      ? article.authors.join(', ')
      : '[No authors listed]';

    return `${authors}. ${article.title}. ${article.journal || '[Journal not specified]'}. ${
      article.publicationDate || '[Date not specified]'
    }. doi: ${article.doi || '[DOI not available]'}`;
  }

  // MLA style
  if (citationStyle === 'mla') {
    const authors = article.authors && article.authors.length > 0
      ? article.authors.join(', ')
      : '[No authors listed]';

    return `${authors}. "${article.title}." ${article.journal || '[Journal not specified]'}, ${
      article.publicationDate || '[Date not specified]'
    }.`;
  }

  // Chicago style
  if (citationStyle === 'chicago') {
    const authors = article.authors && article.authors.length > 0
      ? article.authors.join(', ')
      : '[No authors listed]';

    return `${authors}. "${article.title}." ${article.journal || '[Journal not specified]'} (${
      article.publicationDate || '[Date not specified]'
    }).`;
  }

  // Default to NLM if style not recognized
  return `${article.authors?.join(', ') || '[No authors listed]'}. ${article.title}. ${
    article.journal || '[Journal not specified]'
  }. ${article.publicationDate || '[Date not specified]'}.`;
}

// Convert PubMed API response to markdown format
export function pubMedResultToMarkdown(article: PubMedArticle): string {
  const citation = formatCitation(article);

  return `
## ${article.title}

${article.abstract || 'No abstract available.'}

**Citation:** ${citation}

**URL:** ${article.url}
`;
}

// MeSH term restrictiveness levels
export enum MeshRestrictiveness {
  LOW = 'low',       // Fewer MeSH terms, broader search
  MEDIUM = 'medium', // Balanced approach
  HIGH = 'high'      // More MeSH terms, narrower search
}

// Convert natural language query to MeSH terms
export async function convertToMeshTerms(query: string, restrictiveness: MeshRestrictiveness = MeshRestrictiveness.MEDIUM): Promise<string> {
  try {
    log(`Converting query to MeSH terms: ${query}`);

    // Prepare prompt based on restrictiveness level
    let restrictivenessguidance = '';

    switch(restrictiveness) {
      case MeshRestrictiveness.LOW:
        restrictivenessguidance = 'Create a BROAD search strategy with fewer MeSH terms and more general concepts. Prioritize recall over precision to capture a wide range of potentially relevant articles.';
        break;
      case MeshRestrictiveness.HIGH:
        restrictivenessguidance = 'Create a NARROW search strategy with more specific MeSH terms and subheadings. Prioritize precision over recall to find the most directly relevant articles.';
        break;
      case MeshRestrictiveness.MEDIUM:
      default:
        restrictivenessguidance = 'Create a BALANCED search strategy with a moderate number of MeSH terms. Aim for a good balance between precision and recall.';
        break;
    }

    try {
      // First try with structured JSON output
      const res = await generateObject({
        model: getModel(),
        system: systemPrompt(),
        prompt: `You are a medical research expert specializing in PubMed searches. Convert the following natural language query into an optimized PubMed search query using appropriate MeSH (Medical Subject Headings) terms. Format the query with proper Boolean operators (AND, OR, NOT) and use MeSH terms with [MeSH] tags where appropriate. Include relevant subheadings and qualifiers if needed.

${restrictivenessguidance}

Natural language query: ${query}

Provide ONLY the formatted PubMed search query with MeSH terms as a JSON object with a 'meshQuery' field. Do not wrap your response in markdown code blocks or any other formatting.`,
        schema: z.object({
          meshQuery: z.string().describe('The optimized PubMed search query using MeSH terms')
        }),
      });

      log(`Converted to MeSH query: ${res.object.meshQuery}`);
      return res.object.meshQuery;
    } catch (jsonError) {
      // Fallback to text generation
      log('Falling back to text generation for MeSH terms');
      const response = await generateText({
        model: getModel(),
        system: systemPrompt(),
        prompt: `You are a medical research expert specializing in PubMed searches. Convert the following natural language query into an optimized PubMed search query using appropriate MeSH (Medical Subject Headings) terms. Format the query with proper Boolean operators (AND, OR, NOT) and use MeSH terms with [MeSH] tags where appropriate. Include relevant subheadings and qualifiers if needed.

${restrictivenessguidance}

Natural language query: ${query}

Provide ONLY the formatted PubMed search query with MeSH terms, nothing else. Do not include any explanations, JSON formatting, or markdown.`,
      });

      if (response && response.content) {
        // Clean up the response - remove any markdown formatting or explanations
        let meshQuery = response.content.trim();

        // Remove markdown code blocks if present
        meshQuery = meshQuery.replace(/```[\s\S]*?```/g, '').trim();

        // Remove any lines that look like explanations
        const lines = meshQuery.split('\n');
        const queryLines = lines.filter(line =>
          line.includes('[MeSH]') ||
          line.includes('AND') ||
          line.includes('OR') ||
          line.includes('NOT') ||
          /\([^)]+\)/.test(line) // Contains parentheses
        );

        if (queryLines.length > 0) {
          meshQuery = queryLines.join(' ');
        }

        log(`Converted to MeSH query (text fallback): ${meshQuery}`);
        return meshQuery;
      }

      throw new Error('Failed to generate MeSH terms');
    }
  } catch (error) {
    log('Error converting to MeSH terms:', error);
    // If conversion fails, return the original query
    return query;
  }
}

// Search PubMed API
export async function searchPubMed(
  query: string,
  limit: number = 5,
  useMeshTerms: boolean = true,
  meshRestrictiveness: MeshRestrictiveness = MeshRestrictiveness.MEDIUM
): Promise<PubMedSearchResponse> {
  if (!process.env.PUBMED_API_KEY) {
    log('PubMed API key not found. Skipping PubMed search.');
    return { articles: [], total: 0 };
  }

  if (process.env.INCLUDE_PUBMED_SEARCH !== 'true') {
    log('PubMed search is disabled. Skipping PubMed search.');
    return { articles: [], total: 0 };
  }

  try {
    // Convert query to MeSH terms if enabled
    let searchQuery = query;
    if (useMeshTerms && process.env.USE_MESH_TERMS === 'true') {
      // Get restrictiveness from env or use the provided value
      const envRestrictiveness = process.env.MESH_RESTRICTIVENESS as MeshRestrictiveness;
      const effectiveRestrictiveness = envRestrictiveness || meshRestrictiveness;

      searchQuery = await convertToMeshTerms(query, effectiveRestrictiveness);
    }

    log(`Searching PubMed for: ${searchQuery}`);

    // First, search for IDs
    const searchResponse = await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi', {
      params: {
        db: 'pubmed',
        term: searchQuery,
        retmode: 'json',
        retmax: limit,
        api_key: process.env.PUBMED_API_KEY,
        usehistory: 'y', // Use history feature for better performance with complex queries
      },
    });

    const ids = searchResponse.data.esearchresult.idlist || [];
    if (ids.length === 0) {
      log('No PubMed results found.');
      return { articles: [], total: 0 };
    }

    // Then, fetch details for those IDs
    const detailsResponse = await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi', {
      params: {
        db: 'pubmed',
        id: ids.join(','),
        retmode: 'json',
        api_key: process.env.PUBMED_API_KEY,
      },
    });

    const results = detailsResponse.data.result || {};

    // Process and format the results
    const articles: PubMedArticle[] = ids.map(id => {
      const article = results[id];
      if (!article) return null;

      // Extract authors
      const authors = article.authors?.map((author: any) => author.name) || [];

      // Create URL
      const url = `https://pubmed.ncbi.nlm.nih.gov/${id}/`;

      // Extract DOI if available
      const doi = article.articleids?.find((id: any) => id.idtype === 'doi')?.value || '';

      return {
        id,
        title: article.title || 'No title available',
        abstract: article.abstract || '',
        authors,
        journal: article.fulljournalname || article.source || '',
        publicationDate: article.pubdate || '',
        doi,
        url,
      };
    }).filter(Boolean) as PubMedArticle[];

    log(`Found ${articles.length} PubMed articles.`);

    return {
      articles,
      total: parseInt(searchResponse.data.esearchresult.count, 10) || 0,
    };
  } catch (error) {
    log('Error searching PubMed:', error);
    return { articles: [], total: 0 };
  }
}
