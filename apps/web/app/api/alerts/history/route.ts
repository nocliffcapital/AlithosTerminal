import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/alerts/history
 * Fetch alert trigger history for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const alertId = searchParams.get('alertId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    try {
      // Get alerts for the user
      const where: any = {
        userId: user.id,
      };

      if (alertId) {
        where.id = alertId;
      }

      const alerts = await prisma.alert.findMany({
        where,
        select: {
          id: true,
          name: true,
          lastTriggered: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          lastTriggered: 'desc',
        },
        take: limit,
        skip: offset,
      });

      // Format history entries
      const history = alerts
        .filter((alert) => alert.lastTriggered !== null)
        .map((alert) => ({
          id: alert.id,
          alertId: alert.id,
          alertName: alert.name,
          triggeredAt: alert.lastTriggered,
          createdAt: alert.createdAt,
        }));

      return NextResponse.json({
        history,
        total: history.length,
        limit,
        offset,
      });
    } catch (error) {
      console.error('Failed to fetch alert history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch alert history', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[GET /api/alerts/history] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alert history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

