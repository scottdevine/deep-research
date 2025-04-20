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

  constructor(options: { baseUrl?: string } = {}) {
    this.baseUrl = options.baseUrl || process.env.CRAWL4AI_SERVICE_URL || 'http://localhost:8000';
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    try {
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
      });

      return {
        data: response.data.data
      };
    } catch (error) {
      console.error('Error calling Crawl4AI service:', error);
      return { data: [] };
    }
  }
}

// Export a factory function to create instances with the same API as Firecrawl
export default function createCrawl4AI(options: any = {}): Crawl4AIAdapter {
  return new Crawl4AIAdapter(options);
}
