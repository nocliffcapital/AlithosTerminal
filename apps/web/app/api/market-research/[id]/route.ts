import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { withRateLimit, rateLimitConfigs } from '@/lib/middleware-api';
import { getPrismaClient } from '@/lib/prisma';
import { MarketResearchResult } from '@/lib/market-research/types';

/**
 * GET /api/market-research/[id]
 * Get a specific research result by ID
 */
async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const prisma = getPrismaClient();

    const research = await prisma.marketResearch.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!research) {
      return NextResponse.json(
        { error: 'Research not found' },
        { status: 404 }
      );
    }

    const result = research.result as unknown as MarketResearchResult;
    
    // Include intermediate results if available
    if (research.intermediateResults) {
      (result as any).intermediate = research.intermediateResults;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Market Research Get] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch research result',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withRateLimit(handler, rateLimitConfigs.read);



