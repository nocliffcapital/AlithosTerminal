// On-chain data service using The Graph and other indexers

const THE_GRAPH_API = 'https://api.thegraph.com/subgraphs/name/polymarket';
const ALCHEMY_API = process.env.NEXT_PUBLIC_ALCHEMY_API_URL || '';
const MORALIS_API = process.env.NEXT_PUBLIC_MORALIS_API_URL || '';

export interface Fill {
  id: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  amount: string;
  price: number;
  timestamp: number;
  user: string;
  transactionHash: string;
}

export interface WalletTag {
  address: string;
  type: 'whale' | 'market-maker' | 'new-money' | 'unknown';
  labels: string[];
}

class OnChainService {
  private walletTags: Map<string, WalletTag> = new Map();

  async getMarketFills(marketId: string, limit = 100): Promise<Fill[]> {
    // Query The Graph for fills
    const query = `
      query GetMarketFills($marketId: String!, $limit: Int!) {
        fills(
          where: { market: $marketId }
          orderBy: timestamp
          orderDirection: desc
          first: $limit
        ) {
          id
          market
          outcome
          amount
          price
          timestamp
          user
          transactionHash
        }
      }
    `;

    try {
      const response = await fetch(THE_GRAPH_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { marketId, limit },
        }),
      });

      const data = await response.json();
      return data.data?.fills || [];
    } catch (error) {
      console.error('The Graph query error:', error);
      return [];
    }
  }

  async getWalletTransactions(address: string, limit = 50): Promise<any[]> {
    if (ALCHEMY_API) {
      return this.getAlchemyTransactions(address, limit);
    }
    if (MORALIS_API) {
      return this.getMoralisTransactions(address, limit);
    }
    return [];
  }

  private async getAlchemyTransactions(address: string, limit: number): Promise<any[]> {
    try {
      const response = await fetch(ALCHEMY_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [
            {
              fromBlock: '0x0',
              toAddress: address,
              maxCount: `0x${limit.toString(16)}`,
              category: ['external', 'erc20'],
            },
          ],
          id: 1,
        }),
      });

      const data = await response.json();
      return data.result?.transfers || [];
    } catch (error) {
      console.error('Alchemy API error:', error);
      return [];
    }
  }

  private async getMoralisTransactions(address: string, limit: number): Promise<any[]> {
    try {
      const response = await fetch(`${MORALIS_API}/transaction?chain=polygon&address=${address}&limit=${limit}`, {
        headers: {
          'X-API-Key': process.env.NEXT_PUBLIC_MORALIS_API_KEY || '',
        },
      });

      const data = await response.json();
      return data.result || [];
    } catch (error) {
      console.error('Moralis API error:', error);
      return [];
    }
  }

  tagWallet(address: string): WalletTag {
    if (this.walletTags.has(address)) {
      return this.walletTags.get(address)!;
    }

    // Heuristic-based tagging (simplified)
    // In production, this would use ML or heuristics based on transaction patterns
    const tag: WalletTag = {
      address,
      type: 'unknown',
      labels: [],
    };

    this.walletTags.set(address, tag);
    return tag;
  }

  async detectBursts(fills: Fill[], windowMs = 60000): Promise<Fill[]> {
    // Detect burst patterns (rapid fills in short time)
    const now = Date.now();
    const windowStart = now - windowMs;

    const recentFills = fills.filter((fill) => fill.timestamp * 1000 > windowStart);

    // Group by time buckets
    const buckets: Map<number, Fill[]> = new Map();
    const bucketSize = 5000; // 5 second buckets

    recentFills.forEach((fill) => {
      const bucket = Math.floor((fill.timestamp * 1000) / bucketSize) * bucketSize;
      if (!buckets.has(bucket)) {
        buckets.set(bucket, []);
      }
      buckets.get(bucket)!.push(fill);
    });

    // Find buckets with high activity (> 5 fills in 5 seconds)
    const bursts: Fill[] = [];
    buckets.forEach((fills, bucket) => {
      if (fills.length > 5) {
        bursts.push(...fills);
      }
    });

    return bursts;
  }
}

export const onChainService = new OnChainService();
export default onChainService;

