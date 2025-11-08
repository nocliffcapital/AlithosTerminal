import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const updateJournalEntrySchema = z.object({
  marketId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  note: z.string().min(1).max(10000).optional(),
  attachments: z.record(z.unknown()).optional(),
  postMortem: z.record(z.unknown()).optional(),
});

/**
 * GET /api/journal/[id]
 * Fetch a single journal entry
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const entryId = params.id;

    const entry = await prisma.journalEntry.findFirst({
      where: {
        id: entryId,
        userId: user.id,
      },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('[GET /api/journal/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journal entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/journal/[id]
 * Update a journal entry
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const entryId = params.id;
    const body = await request.json();
    const validatedData = updateJournalEntrySchema.parse(body);

    // Check if entry exists and belongs to user
    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        id: entryId,
        userId: user.id,
      },
    });

    if (!existingEntry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (validatedData.marketId !== undefined) {
      updateData.marketId = validatedData.marketId || null;
    }
    if (validatedData.timestamp) {
      updateData.timestamp = new Date(validatedData.timestamp);
    }
    if (validatedData.note !== undefined) {
      updateData.note = validatedData.note;
    }
    if (validatedData.attachments !== undefined) {
      updateData.attachments = (validatedData.attachments ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    }
    if (validatedData.postMortem !== undefined) {
      updateData.postMortem = (validatedData.postMortem ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    }

    const entry = await prisma.journalEntry.update({
      where: { id: entryId },
      data: updateData,
    });

    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[PUT /api/journal/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update journal entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/journal/[id]
 * Delete a journal entry
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const entryId = params.id;

    // Check if entry exists and belongs to user
    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        id: entryId,
        userId: user.id,
      },
    });

    if (!existingEntry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    await prisma.journalEntry.delete({
      where: { id: entryId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/journal/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete journal entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

