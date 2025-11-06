import { NextRequest, NextResponse } from 'next/server';
import { polymarketClient } from '@/lib/api/polymarket';
import { getPositionsQuerySchema, formatZodError } from '@/lib/validators';

export interface PositionWithPnL {
  marketId: string;
  outcome: 'YES' | 'NO';
  amount: string;
  costBasis: number;
  currentValue: number;
  realizedPnL?: number;
  unrealizedPnL?: number;
  entryPrice?: number;
  currentPrice?: number;
  market?: {
    question: string;
    slug: string;
    endDate?: string;
  };
}

/**
 * GET /api/positions
 * Fetches user positions from Polymarket API and calculates P&L
 * 
 * Query params:
 * - userId: User's wallet address (required)
 * - includeMarket: Include market metadata (default: true)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const validation = getPositionsQuerySchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          ...formatZodError(validation.error),
        },
        { status: 400 }
      );
    }

    const { userAddress, includeMarket } = validation.data;

    // Fetch positions from Data-API (requires CLOB auth but we'll try with L1 if available)
    // Also try P&L subgraph for more detailed P&L data
    let positions: PositionWithPnL[] = [];
    
    try {
      // First try: Data-API positions
      const dataApiPositions = await polymarketClient.getPositions(userAddress);
      
      if (dataApiPositions && dataApiPositions.length > 0) {
        positions = dataApiPositions.map((pos) => ({
          marketId: pos.marketId,
          outcome: pos.outcome,
          amount: pos.amount,
          costBasis: pos.costBasis || 0,
          currentValue: pos.currentValue || 0,
          unrealizedPnL: (pos.currentValue || 0) - (pos.costBasis || 0),
        }));
      }
    } catch (error) {
      console.warn('[Positions API] Data-API positions failed, trying P&L subgraph:', error);
    }

    // Second try: P&L subgraph (more detailed P&L data)
    try {
      const pnlData = await polymarketClient.getPnLData(userAddress);
      
      if (pnlData && pnlData.length > 0) {
        // Merge P&L data with existing positions or create new ones
        const pnlMap = new Map<string, PositionWithPnL>();
        
        // Add existing positions to map
        positions.forEach((pos) => {
          const key = `${pos.marketId}-${pos.outcome}`;
          pnlMap.set(key, pos);
        });
        
        // Update or add positions from P&L subgraph
        pnlData.forEach((pnl: any) => {
          const key = `${pnl.marketId || pnl.id}-${pnl.outcome || 'YES'}`;
          const existing = pnlMap.get(key);
          
          if (existing) {
            // Update existing position with P&L data
            existing.realizedPnL = pnl.realizedPnL || 0;
            existing.unrealizedPnL = pnl.unrealizedPnL !== undefined ? pnl.unrealizedPnL : existing.unrealizedPnL;
            existing.costBasis = pnl.costBasis || existing.costBasis;
            existing.currentValue = pnl.currentValue || existing.currentValue;
          } else {
            // Add new position from P&L subgraph
            pnlMap.set(key, {
              marketId: pnl.marketId || pnl.id,
              outcome: pnl.outcome || 'YES',
              amount: pnl.amount || '0',
              costBasis: pnl.costBasis || 0,
              currentValue: pnl.currentValue || 0,
              realizedPnL: pnl.realizedPnL || 0,
              unrealizedPnL: pnl.unrealizedPnL || 0,
            });
          }
        });
        
        positions = Array.from(pnlMap.values());
      }
    } catch (error) {
      console.warn('[Positions API] P&L subgraph failed:', error);
    }

    // If no positions found from either source, return empty array
    if (positions.length === 0) {
      return NextResponse.json({ positions: [] });
    }

    // Enrich with market metadata if requested
    if (includeMarket) {
      const enrichedPositions = await Promise.all(
        positions.map(async (pos) => {
          try {
            const market = await polymarketClient.getMarket(pos.marketId);
            if (market) {
              const currentPrice = market.outcomePrices?.[pos.outcome] || 0.5;
              const entryPrice = pos.costBasis > 0 && parseFloat(pos.amount) > 0
                ? pos.costBasis / parseFloat(pos.amount)
                : currentPrice;
              
              return {
                ...pos,
                entryPrice,
                currentPrice,
                market: {
                  question: market.question,
                  slug: market.slug,
                  endDate: market.endDate,
                },
              };
            }
          } catch (error) {
            console.warn(`[Positions API] Failed to fetch market ${pos.marketId}:`, error);
          }
          return pos;
        })
      );
      
      return NextResponse.json({ positions: enrichedPositions });
    }

    return NextResponse.json({ positions });
  } catch (error) {
    console.error('[Positions API] Error fetching positions:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Internal server error',
          details: error.message,
          ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error', details: 'Unknown error occurred' },
      { status: 500 }
    );
  }
}

