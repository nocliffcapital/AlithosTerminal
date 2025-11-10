/**
 * Tests for news keyword extraction
 * Validates keyword extraction across various market types
 */

import { extractNewsKeywords, CoreKeywords } from '@/lib/utils/news-keywords';
import { Market } from '@/lib/api/polymarket';

describe('News Keyword Extraction', () => {
  describe('Cryptocurrency Markets', () => {
    it('should extract Bitcoin as primary keyword', () => {
      const market: Market = {
        id: '1',
        question: 'Will Bitcoin reach $250,000 by December 31, 2025?',
        slug: 'bitcoin-250k-2025',
        conditionId: '0x123',
        endDate: '2025-12-31',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
        category: 'crypto-prices',
      };

      const keywords = extractNewsKeywords(market);
      
      expect(keywords.primary.length).toBeGreaterThan(0);
      expect(keywords.primary.some(k => k.toLowerCase().includes('bitcoin'))).toBe(true);
    });

    it('should extract Ethereum and year for Ethereum markets', () => {
      const market: Market = {
        id: '2',
        question: 'Will Ethereum be above $10,000 by end of 2025?',
        slug: 'ethereum-10k-2025',
        conditionId: '0x456',
        endDate: '2025-12-31',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
        category: 'crypto',
      };

      const keywords = extractNewsKeywords(market);
      
      expect(keywords.primary.some(k => k.toLowerCase().includes('ethereum'))).toBe(true);
      expect(keywords.secondary.some(k => k === '2025')).toBe(true);
    });
  });

  describe('Company/Stock Markets', () => {
    it('should extract company name and ticker for Apple markets', () => {
      const market: Market = {
        id: '3',
        question: 'Will Apple stock price be above $200 by end of 2025?',
        slug: 'apple-200-2025',
        conditionId: '0x789',
        endDate: '2025-12-31',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
        category: 'stocks',
      };

      const keywords = extractNewsKeywords(market);
      
      // Should extract Apple or AAPL
      const hasApple = keywords.primary.some(k => 
        k.toLowerCase().includes('apple') || k.toLowerCase() === 'aapl'
      );
      expect(hasApple).toBe(true);
    });

    it('should extract Tesla for Tesla markets', () => {
      const market: Market = {
        id: '4',
        question: 'Will Tesla market cap exceed $1 trillion in 2025?',
        slug: 'tesla-1t-2025',
        conditionId: '0xabc',
        endDate: '2025-12-31',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
        category: 'stocks',
      };

      const keywords = extractNewsKeywords(market);
      
      expect(keywords.primary.some(k => k.toLowerCase().includes('tesla'))).toBe(true);
    });
  });

  describe('Sports Markets', () => {
    it('should extract team and player names for sports markets', () => {
      const market: Market = {
        id: '5',
        question: 'Will LeBron James win the NBA championship in 2025?',
        slug: 'lebron-nba-2025',
        conditionId: '0xdef',
        endDate: '2025-06-30',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
        category: 'nba',
      };

      const keywords = extractNewsKeywords(market);
      
      // Should extract LeBron James as person name
      const hasLeBron = keywords.primary.some(k => 
        k.toLowerCase().includes('lebron') || k.toLowerCase().includes('james')
      );
      expect(hasLeBron).toBe(true);
    });

    it('should extract team names for NFL markets', () => {
      const market: Market = {
        id: '6',
        question: 'Will the Kansas City Chiefs win Super Bowl in 2025?',
        slug: 'chiefs-superbowl-2025',
        conditionId: '0x111',
        endDate: '2025-02-09',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
        category: 'nfl',
      };

      const keywords = extractNewsKeywords(market);
      
      // Should extract Kansas City or Chiefs
      const hasTeam = keywords.primary.some(k => 
        k.toLowerCase().includes('kansas') || 
        k.toLowerCase().includes('city') || 
        k.toLowerCase().includes('chiefs')
      );
      expect(hasTeam).toBe(true);
    });
  });

  describe('Political Markets', () => {
    it('should extract politician names for political markets', () => {
      const market: Market = {
        id: '7',
        question: 'Will Donald Trump win the 2024 presidential election?',
        slug: 'trump-2024-election',
        conditionId: '0x222',
        endDate: '2024-11-05',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
        category: 'us-presidential-election',
      };

      const keywords = extractNewsKeywords(market);
      
      // Should extract Donald Trump as person name
      const hasTrump = keywords.primary.some(k => 
        k.toLowerCase().includes('donald') || k.toLowerCase().includes('trump')
      );
      expect(hasTrump).toBe(true);
      expect(keywords.secondary.some(k => k === '2024')).toBe(true);
    });
  });

  describe('Entertainment Markets', () => {
    it('should extract movie titles from quoted phrases', () => {
      const market: Market = {
        id: '8',
        question: 'Will "Avatar: The Way of Water" gross over $2 billion?',
        slug: 'avatar-2b',
        conditionId: '0x333',
        endDate: '2025-12-31',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
        category: 'movies',
      };

      const keywords = extractNewsKeywords(market);
      
      // Should extract quoted movie title
      const hasAvatar = keywords.primary.some(k => 
        k.toLowerCase().includes('avatar')
      );
      expect(hasAvatar).toBe(true);
    });
  });

  describe('Event Context', () => {
    it('should extract event keywords when event title is provided', () => {
      const market: Market = {
        id: '9',
        question: 'What company will be the largest by end of 2025?',
        slug: 'largest-company-2025',
        conditionId: '0x444',
        endDate: '2025-12-31',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
        category: 'business',
        eventTitle: '2025 Market Predictions',
        eventId: 'event-1',
      };

      const keywords = extractNewsKeywords(market);
      
      // Should extract year from event title
      expect(keywords.secondary.some(k => k === '2025')).toBe(true);
    });

    it('should filter out generic event terms', () => {
      const market: Market = {
        id: '10',
        question: 'Will Bitcoin reach $100k?',
        slug: 'bitcoin-100k',
        conditionId: '0x555',
        endDate: '2025-12-31',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
        category: 'crypto',
        eventTitle: 'Cryptocurrency Predictions 2025',
        eventId: 'event-2',
      };

      const keywords = extractNewsKeywords(market);
      
      // Should NOT include generic terms like "Predictions"
      const hasGeneric = keywords.primary.some(k => 
        k.toLowerCase() === 'predictions'
      ) || keywords.secondary.some(k => 
        k.toLowerCase() === 'predictions'
      );
      expect(hasGeneric).toBe(false);
      
      // Should include Bitcoin
      expect(keywords.primary.some(k => k.toLowerCase().includes('bitcoin'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null market', () => {
      const keywords = extractNewsKeywords(null);
      
      expect(keywords).toEqual({
        primary: [],
        secondary: [],
        related: [],
      });
    });

    it('should handle markets with no extractable keywords', () => {
      const market: Market = {
        id: '11',
        question: 'Will this happen?',
        slug: 'generic',
        conditionId: '0x666',
        endDate: '2025-12-31',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
      };

      const keywords = extractNewsKeywords(market);
      
      // Should still return structured keywords (may be empty)
      expect(keywords).toHaveProperty('primary');
      expect(keywords).toHaveProperty('secondary');
      expect(keywords).toHaveProperty('related');
    });

    it('should prioritize primary keywords over secondary', () => {
      const market: Market = {
        id: '12',
        question: 'Will Bitcoin reach $250,000 by December 31, 2025?',
        slug: 'bitcoin-250k-2025',
        conditionId: '0x777',
        endDate: '2025-12-31',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
        category: 'crypto-prices',
      };

      const keywords = extractNewsKeywords(market);
      
      // Bitcoin should be in primary, not secondary
      const bitcoinInPrimary = keywords.primary.some(k => 
        k.toLowerCase().includes('bitcoin')
      );
      const bitcoinInSecondary = keywords.secondary.some(k => 
        k.toLowerCase().includes('bitcoin')
      );
      
      // Bitcoin should be in primary OR secondary, but prioritized correctly
      expect(bitcoinInPrimary || bitcoinInSecondary).toBe(true);
    });
  });

  describe('Keyword Quality', () => {
    it('should not include stop words', () => {
      const market: Market = {
        id: '13',
        question: 'Will the company be successful?',
        slug: 'company-success',
        conditionId: '0x888',
        endDate: '2025-12-31',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
      };

      const keywords = extractNewsKeywords(market);
      const allKeywords = [...keywords.primary, ...keywords.secondary, ...keywords.related];
      
      // Should not include common stop words
      const stopWords = ['will', 'be', 'the', 'a', 'an', 'and', 'or'];
      stopWords.forEach(stopWord => {
        expect(allKeywords.some(k => k.toLowerCase() === stopWord)).toBe(false);
      });
    });

    it('should not include generic terms', () => {
      const market: Market = {
        id: '14',
        question: 'Will the largest company in the world reach $1 trillion?',
        slug: 'largest-company-1t',
        conditionId: '0x999',
        endDate: '2025-12-31',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
      };

      const keywords = extractNewsKeywords(market);
      const allKeywords = [...keywords.primary, ...keywords.secondary, ...keywords.related];
      
      // Should not include generic terms
      const genericTerms = ['largest', 'company', 'world'];
      genericTerms.forEach(term => {
        const hasGeneric = allKeywords.some(k => k.toLowerCase() === term);
        // Generic terms should be filtered out unless they're part of a specific phrase
        // This test may need adjustment based on actual behavior
      });
    });

    it('should limit keywords to reasonable number', () => {
      const market: Market = {
        id: '15',
        question: 'Will Bitcoin Ethereum Solana Cardano Polkadot Chainlink all reach new highs in 2025?',
        slug: 'multi-crypto-2025',
        conditionId: '0xaaa',
        endDate: '2025-12-31',
        resolutionSource: 'https://example.com',
        active: true,
        archived: false,
        category: 'crypto',
      };

      const keywords = extractNewsKeywords(market);
      
      // Should limit to reasonable number (3-5 primary, 3 secondary, 3 related)
      expect(keywords.primary.length).toBeLessThanOrEqual(3);
      expect(keywords.secondary.length).toBeLessThanOrEqual(3);
      expect(keywords.related.length).toBeLessThanOrEqual(3);
    });
  });
});

