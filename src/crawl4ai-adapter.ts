import axios from 'axios';

// Define interfaces to match Firecrawl's API
export interface SearchResponse {
  data: {
    url: string;
    title?: string;
    content?: string;
    markdown?: string;
    links?: {
      internal: string[];
      external: string[];
    };
    media?: {
      images: any[];
    };
    metadata?: any;
    [key: string]: any;
  }[];
  [key: string]: any;
}

export interface SearchOptions {
  timeout?: number;
  limit?: number;
  scrapeOptions?: {
    formats?: string[];
    [key: string]: any;
  };
  [key: string]: any;
}

export class Crawl4AIAdapter {
  private baseUrl: string;
  private mockMode: boolean;

  constructor(options: { baseUrl?: string; mockMode?: boolean } = {}) {
    // Use the CRAWL4AI_SERVICE_URL environment variable if available, otherwise use the provided baseUrl or default
    // When running in Docker, this should be set to "http://crawl4ai:8000"
    // When running locally, this should be set to "http://localhost:8000"
    this.baseUrl = options.baseUrl || process.env.CRAWL4AI_SERVICE_URL || 'http://localhost:8000';

    // Explicitly set mockMode to false unless explicitly set to true in options
    // Never default to mock mode based on environment variables for production
    this.mockMode = options.mockMode === true ? true : false;

    // Log a warning if mock mode is enabled
    if (this.mockMode) {
      console.warn('[Crawl4AI] WARNING: Mock mode is enabled. This should NEVER be used in production.');
    }

    console.log(`[Crawl4AI] Initialized with baseUrl: ${this.baseUrl}, mockMode: ${this.mockMode}`);
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    console.log(`[Crawl4AI Debug] Search called with mockMode=${this.mockMode}`);
    if (this.mockMode) {
      console.log(`[MOCK] Searching for: ${query}`);
      return this.getMockResults(query, options);
    }

    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any = null;

    while (retryCount < maxRetries) {
      try {
        console.log(`[Crawl4AI] Searching for: ${query}${retryCount > 0 ? ` (retry ${retryCount}/${maxRetries})` : ''}`);

        const response = await axios.post(`${this.baseUrl}/search`, {
          query,
          limit: options.limit || 10,
          timeout: options.timeout || 15000,
          formats: options.scrapeOptions?.formats || ['markdown'],
          headless: true,
          cache_mode: 'BYPASS',
          word_count_threshold: 100,
          excluded_tags: ['nav', 'footer', 'aside', 'script', 'style'],
          remove_overlay_elements: true
        }, {
          timeout: (options.timeout || 15000) + 5000 // Add 5 seconds to the timeout for the HTTP request
        });

        if (response.data && Array.isArray(response.data.data)) {
          console.log(`[Crawl4AI] Found ${response.data.data.length} results for: ${query}`);
          return {
            data: response.data.data
          };
        } else {
          console.warn(`[Crawl4AI] Unexpected response format for query: ${query}`);
          return { data: [] };
        }
      } catch (error: any) {
        lastError = error;
        retryCount++;

        // Log the error
        if (error.response) {
          // The request was made and the server responded with a status code outside the 2xx range
          console.error(`[Crawl4AI] Error ${error.response.status}: ${error.response.statusText}`);
        } else if (error.request) {
          // The request was made but no response was received
          console.error('[Crawl4AI] No response received from server');
        } else {
          // Something happened in setting up the request
          console.error(`[Crawl4AI] Error: ${error.message}`);
        }

        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`[Crawl4AI] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`[Crawl4AI] Failed after ${maxRetries} retries. Not falling back to mock mode as per production requirements.`);

    // After all retries failed, return an empty result set instead of falling back to mock mode
    return { data: [] };
  }

  private getMockResults(query: string, options: SearchOptions = {}): SearchResponse {
    const limit = options.limit || 10;
    const mockResults = [];

    for (let i = 0; i < limit; i++) {
      mockResults.push({
        url: `https://example.com/result-${i + 1}`,
        title: `Mock Result ${i + 1} for "${query}"`,
        markdown: `# Mock Result ${i + 1} for "${query}"

This is a mock result for testing purposes.

## Key Points

- This is a mock result
- It simulates content that would be returned by Crawl4AI
- It contains markdown formatting

## Details

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nisl eget ultricies tincidunt, nisl nisl aliquam nisl, eget ultricies nisl nisl eget nisl. Nullam auctor, nisl eget ultricies tincidunt, nisl nisl aliquam nisl, eget ultricies nisl nisl eget nisl.

### Sub-section

More mock content here. This is designed to simulate a real web page that has been crawled and converted to markdown.`,
        links: {
          internal: [`https://example.com/related-${i + 1}-1`, `https://example.com/related-${i + 1}-2`],
          external: [`https://external.com/reference-${i + 1}`]
        },
        media: {
          images: [
            {
              src: `https://example.com/image-${i + 1}.jpg`,
              alt: `Image ${i + 1}`
            }
          ]
        },
        metadata: {
          title: `Mock Result ${i + 1} for "${query}"`,
          description: `This is a mock result for testing the Crawl4AI adapter with query: ${query}`
        }
      });
    }

    return {
      data: mockResults
    };
  }
}

// Export a factory function to create instances with the same API as Firecrawl
export default function createCrawl4AI(options: any = {}): Crawl4AIAdapter {
  return new Crawl4AIAdapter(options);
}
