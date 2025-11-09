import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const createThemeSchema = z.object({
  name: z.string().min(1).max(100),
  config: z.record(z.unknown()),
  isPublic: z.boolean().default(false),
});

/**
 * GET /api/themes
 * Fetch user's themes
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const isPublic = searchParams.get('isPublic') === 'true';

    const where: any = {
      userId: user.id,
    };

    if (isPublic !== undefined) {
      where.isPublic = isPublic;
    }

    const themes = await prisma.theme.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ themes });
  } catch (error) {
    console.error('[GET /api/themes] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch themes', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/themes
 * Create a new theme
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createThemeSchema.parse(body);

    const theme = await prisma.theme.create({
      data: {
        userId: user.id,
        name: validatedData.name,
        config: validatedData.config as Prisma.InputJsonValue,
        isPublic: validatedData.isPublic,
      },
    });

    return NextResponse.json({ theme });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[POST /api/themes] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create theme', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

