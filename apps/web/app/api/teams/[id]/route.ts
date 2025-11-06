import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

/**
 * GET /api/teams/[id]
 * Fetch a single team
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

    const teamId = params.id;

    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
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

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json({ team });
  } catch (error) {
    console.error('[GET /api/teams/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/teams/[id]
 * Update a team
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

    const teamId = params.id;
    const body = await request.json();
    const validatedData = updateTeamSchema.parse(body);

    // Check if user is team owner or admin
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: user.id,
        role: {
          in: ['OWNER', 'ADMIN'],
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: validatedData,
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
    console.error('[PUT /api/teams/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update team', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teams/[id]
 * Delete a team
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

    const teamId = params.id;

    // Check if user is team owner
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: user.id,
        role: 'OWNER',
      },
    });

    if (!teamMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.team.delete({
      where: { id: teamId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/teams/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete team', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

