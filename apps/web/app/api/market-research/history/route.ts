import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { withRateLimit, rateLimitConfigs } from '@/lib/middleware-api';
import { getPrismaClient } from '@/lib/prisma';
import { z } from 'zod';

const historyQuerySchema = z.object({
  marketId: z.string().optional(),
  limit: z.number().optional().default(20),
  offset: z.number().optional().default(0),
});

/**
 * GET /api/market-research/history
 * Get historical research results for a user
 */
async function handler(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const marketId = searchParams.get('marketId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const validationResult = historyQuerySchema.safeParse({
      marketId,
      limit,
      offset,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const prisma = getPrismaClient();
    
    const where: any = {
      userId: user.id,
    };

    if (marketId) {
      where.marketId = marketId;
    }

    const [researchResults, total] = await Promise.all([
      prisma.marketResearch.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
        select: {
          id: true,
          marketId: true,
          marketQuestion: true,
          verdict: true,
          confidence: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.marketResearch.count({ where }),
    ]);

    return NextResponse.json({
      results: researchResults,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Market Research History] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch research history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withRateLimit(handler, rateLimitConfigs.read);



