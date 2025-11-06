import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createTeamSchema = z.object({
  workspaceId: z.string(),
  name: z.string().min(1).max(100),
});

/**
 * GET /api/teams
 * Fetch user's teams
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teams = await prisma.team.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                walletAddress: true,
              },
            },
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ teams });
  } catch (error) {
    console.error('[GET /api/teams] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teams
 * Create a new team
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createTeamSchema.parse(body);

    // Check if workspace exists and user has access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: validatedData.workspaceId,
        userId: user.id,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Check if team already exists for this workspace
    const existingTeam = await prisma.team.findUnique({
      where: {
        workspaceId: validatedData.workspaceId,
      },
    });

    if (existingTeam) {
      return NextResponse.json({ error: 'Team already exists for this workspace' }, { status: 400 });
    }

    // Create team with user as owner
    const team = await prisma.team.create({
      data: {
        workspaceId: validatedData.workspaceId,
        name: validatedData.name,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                walletAddress: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ team });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[POST /api/teams] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create team', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

