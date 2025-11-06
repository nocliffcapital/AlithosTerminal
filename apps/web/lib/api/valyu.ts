/**
 * Valyu DeepSearch API client
 * Provides credible, reasoned evidence instead of random web results
 */

import { Valyu } from 'valyu-js';
import { ValyuResult } from '@/lib/market-research/types';

class ValyuClient {
  private client: Valyu | null = null;
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.VALYU_API_KEY;
    if (this.apiKey) {
      this.client = new Valyu(this.apiKey);
    }
  }

  /**
   * Search for information using Valyu DeepSearch
   * @param query - Search query string
   * @returns Array of search results with title, url, and content
   */
  async search(query: string): Promise<ValyuResult[]> {
    if (!this.client) {
      throw new Error('Valyu API key not configured. Please set VALYU_API_KEY environment variable.');
    }

    try {
      const response = await this.client.search(query);
      
      // Map Valyu response to our ValyuResult interface
      return response.results.map((result: any) => ({
        title: result.title || 'Untitled',
        url: result.url || '',
        content: result.content || '',
        publishedDate: result.publishedDate || result.published_date,
        author: result.author,
        domain: result.domain || this.extractDomain(result.url),
      }));
    } catch (error) {
      console.error('[ValyuClient] Search error:', error);
      throw new Error(`Valyu search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string | undefined {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return undefined;
    }
  }

  /**
   * Check if Valyu client is configured
   */
  isConfigured(): boolean {
    return !!this.client;
  }
}

// Export singleton instance
export const valyuClient = new ValyuClient();



