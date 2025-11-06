import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Alert, AlertCondition, AlertAction } from '@/lib/alerts/alert-system';
import { updateAlertSchema, userIdSchema, formatZodError, idParamSchema } from '@/lib/validators';

/**
 * GET /api/alerts/[id]
 * Fetches a single alert by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    
    // Validate route params
    const paramValidation = idParamSchema.safeParse({ id });
    if (!paramValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid route parameters',
          ...formatZodError(paramValidation.error),
        },
        { status: 400 }
      );
    }

    // Validate query params
    const userIdValidation = userIdSchema.safeParse(searchParams.get('userId'));
    if (!userIdValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          ...formatZodError(userIdValidation.error),
        },
        { status: 400 }
      );
    }

    const userId = userIdValidation.data;

    const alert = await prisma.alert.findFirst({
      where: {
        id,
        userId, // Ensure user owns this alert
      },
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Transform to Alert interface format
    const conditions = (alert.conditions as unknown) as AlertCondition[];
    const actions = (alert.actions as unknown) as AlertAction[];
    const marketId = (alert.conditions as any)?.marketId;

    const transformedAlert: Alert = {
      id: alert.id,
      name: alert.name,
      marketId: marketId || undefined,
      conditions,
      actions,
      isActive: alert.isActive,
      lastTriggered: alert.lastTriggered ? new Date(alert.lastTriggered) : undefined,
    };

    return NextResponse.json({ alert: transformedAlert });
  } catch (error) {
    console.error('[Alerts API] Error fetching alert:', error);
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
 * PUT /api/alerts/[id]
 * Updates an existing alert
 * 
 * Body:
 * - userId: User ID (required)
 * - name: Alert name (optional)
 * - marketId: Market ID (optional)
 * - conditions: Alert conditions array (optional)
 * - actions: Alert actions array (optional)
 * - isActive: Active status (optional)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Validate route params
    const paramValidation = idParamSchema.safeParse({ id });
    if (!paramValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid route parameters',
          ...formatZodError(paramValidation.error),
        },
        { status: 400 }
      );
    }

    // Validate request body
    const validation = updateAlertSchema.safeParse(body);
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

    // Verify alert exists and belongs to user
    const existingAlert = await prisma.alert.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingAlert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (conditions !== undefined) {
      // Store marketId in conditions JSON
      const conditionsWithMarketId = {
        ...conditions,
        marketId,
      };

      updateData.conditions = conditionsWithMarketId as any;
    } else if (marketId !== undefined) {
      // Update marketId in existing conditions
      const existingConditions = (existingAlert.conditions as any) || {};
      updateData.conditions = {
        ...existingConditions,
        marketId,
      } as any;
    }

    if (actions !== undefined) {
      updateData.actions = actions as any;
    }

    if (cooldownPeriodMinutes !== undefined) {
      updateData.cooldownPeriodMinutes = cooldownPeriodMinutes ?? null;
    }

    const updatedAlert = await prisma.alert.update({
      where: { id },
      data: updateData,
    });

    // Transform to Alert interface format
    const updatedConditions = (updatedAlert.conditions as unknown) as AlertCondition[];
    const updatedActions = (updatedAlert.actions as unknown) as AlertAction[];
    const updatedMarketId = (updatedAlert.conditions as any)?.marketId || marketId;

    const transformedAlert: Alert = {
      id: updatedAlert.id,
      name: updatedAlert.name,
      marketId: updatedMarketId || undefined,
      conditions: conditions !== undefined ? conditions as AlertCondition[] : updatedConditions,
      actions: actions !== undefined ? actions as AlertAction[] : updatedActions,
      isActive: updatedAlert.isActive,
      cooldownPeriodMinutes: updatedAlert.cooldownPeriodMinutes ?? undefined,
      lastTriggered: updatedAlert.lastTriggered ? new Date(updatedAlert.lastTriggered) : undefined,
    };

    return NextResponse.json({ alert: transformedAlert });
  } catch (error) {
    console.error('[Alerts API] Error updating alert:', error);
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
 * DELETE /api/alerts/[id]
 * Deletes an alert
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    
    // Validate route params
    const paramValidation = idParamSchema.safeParse({ id });
    if (!paramValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid route parameters',
          ...formatZodError(paramValidation.error),
        },
        { status: 400 }
      );
    }

    // Validate query params
    const userIdValidation = userIdSchema.safeParse(searchParams.get('userId'));
    if (!userIdValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          ...formatZodError(userIdValidation.error),
        },
        { status: 400 }
      );
    }

    const userId = userIdValidation.data;

    // Verify alert exists and belongs to user
    const existingAlert = await prisma.alert.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingAlert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    await prisma.alert.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Alerts API] Error deleting alert:', error);
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
 * PATCH /api/alerts/[id]/trigger
 * Updates the lastTriggered timestamp for an alert
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Validate route params
    const paramValidation = idParamSchema.safeParse({ id });
    if (!paramValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid route parameters',
          ...formatZodError(paramValidation.error),
        },
        { status: 400 }
      );
    }

    const updatedAlert = await prisma.alert.update({
      where: { id },
      data: {
        lastTriggered: new Date(),
      },
    });

    return NextResponse.json({ 
      success: true,
      lastTriggered: updatedAlert.lastTriggered,
    });
  } catch (error) {
    console.error('[Alerts API] Error updating trigger timestamp:', error);
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

