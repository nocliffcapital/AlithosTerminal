import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { Alert, AlertCondition, AlertAction } from '@/lib/alerts/alert-system';
import { createAlertSchema, getAlertsQuerySchema, formatZodError } from '@/lib/validators';

/**
 * GET /api/alerts
 * Fetches all alerts for a user
 * 
 * Query params:
 * - userId: User ID (required)
 * - active: Filter by active status (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const validation = getAlertsQuerySchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          ...formatZodError(validation.error),
        },
        { status: 400 }
      );
    }

    const { userId, active } = validation.data;

    // Build where clause
    const where: any = { userId };
    if (active !== undefined) {
      where.isActive = active;
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Transform database alerts to Alert interface format
    const transformedAlerts: Alert[] = alerts.map((alert) => {
      const conditions = (alert.conditions as unknown) as AlertCondition[];
      const actions = (alert.actions as unknown) as AlertAction[];
      
      // Extract marketId from conditions if present, or use a separate field
      // For now, we'll store marketId in the conditions JSON as metadata
      const marketId = (alert.conditions as any)?.marketId;

      return {
        id: alert.id,
        name: alert.name,
        marketId: marketId || undefined,
        conditions,
        actions,
        isActive: alert.isActive,
        cooldownPeriodMinutes: alert.cooldownPeriodMinutes ?? undefined,
        lastTriggered: alert.lastTriggered ? new Date(alert.lastTriggered) : undefined,
      };
    });

    return NextResponse.json({ alerts: transformedAlerts });
  } catch (error) {
    console.error('[Alerts API] Error fetching alerts:', error);
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

/**
 * POST /api/alerts
 * Creates a new alert
 * 
 * Body:
 * - userId: User ID (required)
 * - name: Alert name (required)
 * - marketId: Market ID (optional)
 * - conditions: Alert conditions array (required)
 * - actions: Alert actions array (required)
 * - isActive: Active status (optional, default: true)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = createAlertSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          ...formatZodError(validation.error),
        },
        { status: 400 }
      );
    }

    const { userId, name, marketId, conditions, actions, isActive, cooldownPeriodMinutes } = validation.data;

    // Store marketId in conditions JSON as metadata for easy access
    const conditionsWithMarketId = {
      ...conditions,
      marketId, // Store marketId separately for easy querying later
    };

    const alert = await prisma.alert.create({
      data: {
        userId,
        name,
        conditions: conditionsWithMarketId as Prisma.InputJsonValue,
        actions: actions as Prisma.InputJsonValue,
        isActive: isActive ?? true,
        cooldownPeriodMinutes: cooldownPeriodMinutes ?? null,
      },
    });

    // Transform to Alert interface format
    const transformedAlert: Alert = {
      id: alert.id,
      name: alert.name,
      marketId: marketId || undefined,
      conditions: conditions as AlertCondition[],
      actions: actions as AlertAction[],
      isActive: alert.isActive,
      cooldownPeriodMinutes: alert.cooldownPeriodMinutes ?? undefined,
      lastTriggered: alert.lastTriggered ? new Date(alert.lastTriggered) : undefined,
    };

    return NextResponse.json({ alert: transformedAlert }, { status: 201 });
  } catch (error) {
    console.error('[Alerts API] Error creating alert:', error);
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

