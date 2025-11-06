import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createJournalEntrySchema = z.object({
  marketId: z.string().optional(),
  timestamp: z.string().datetime(),
  note: z.string().min(1).max(10000),
  attachments: z.record(z.unknown()).optional(),
});

const updateJournalEntrySchema = z.object({
  marketId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  note: z.string().min(1).max(10000).optional(),
  attachments: z.record(z.unknown()).optional(),
  postMortem: z.record(z.unknown()).optional(),
});

/**
 * GET /api/journal
 * Fetch user's journal entries
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const marketId = searchParams.get('marketId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {
      userId: user.id,
    };

    if (marketId) {
      where.marketId = marketId;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    const entries = await prisma.journalEntry.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      skip: offset,
    });

    const total = await prisma.journalEntry.count({ where });

    return NextResponse.json({
      entries,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[GET /api/journal] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journal entries', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/journal
 * Create a new journal entry
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createJournalEntrySchema.parse(body);

    const entry = await prisma.journalEntry.create({
      data: {
        userId: user.id,
        marketId: validatedData.marketId || null,
        timestamp: new Date(validatedData.timestamp),
        note: validatedData.note,
        attachments: validatedData.attachments || null,
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[POST /api/journal] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create journal entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

