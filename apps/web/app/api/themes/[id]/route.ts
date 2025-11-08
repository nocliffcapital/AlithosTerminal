import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const updateThemeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.unknown()).optional(),
  isPublic: z.boolean().optional(),
});

/**
 * GET /api/themes/[id]
 * Fetch a single theme
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

    const themeId = params.id;

    const theme = await prisma.theme.findFirst({
      where: {
        id: themeId,
        OR: [
          { userId: user.id },
          { isPublic: true },
        ],
      },
    });

    if (!theme) {
      return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
    }

    return NextResponse.json({ theme });
  } catch (error) {
    console.error('[GET /api/themes/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch theme', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/themes/[id]
 * Update a theme
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

    const themeId = params.id;
    const body = await request.json();
    const validatedData = updateThemeSchema.parse(body);

    // Check if theme exists and belongs to user
    const existingTheme = await prisma.theme.findFirst({
      where: {
        id: themeId,
        userId: user.id,
      },
    });

    if (!existingTheme) {
      return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
    }

    // Prepare update data with proper JSON type casting
    const updateData: {
      name?: string;
      config?: Prisma.InputJsonValue;
      isPublic?: boolean;
    } = {};

    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name;
    }
    if (validatedData.config !== undefined) {
      updateData.config = validatedData.config as Prisma.InputJsonValue;
    }
    if (validatedData.isPublic !== undefined) {
      updateData.isPublic = validatedData.isPublic;
    }

    const theme = await prisma.theme.update({
      where: { id: themeId },
      data: updateData,
    });

    return NextResponse.json({ theme });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[PUT /api/themes/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update theme', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/themes/[id]
 * Delete a theme
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

    const themeId = params.id;

    // Check if theme exists and belongs to user
    const existingTheme = await prisma.theme.findFirst({
      where: {
        id: themeId,
        userId: user.id,
      },
    });

    if (!existingTheme) {
      return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
    }

    await prisma.theme.delete({
      where: { id: themeId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/themes/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete theme', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

