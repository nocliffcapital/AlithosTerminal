import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { getPrismaClient } from '@/lib/prisma';
import { notificationPreferencesSchema } from '@/lib/validators/notification-preferences';
import { parseNotificationPreferences } from '@/lib/types/notification-preferences';

/**
 * GET /api/user/preferences
 * Get user's notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrismaClient();
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { notificationPreferences: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const preferences = parseNotificationPreferences(dbUser.notificationPreferences);

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('[GET /api/user/preferences] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/preferences
 * Update user's notification preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = notificationPreferencesSchema.parse(body);

    // Clean up webhookUrl if webhook is disabled
    const preferences = {
      browser: validated.browser,
      email: validated.email,
      webhook: validated.webhook,
      webhookUrl: validated.webhook && validated.webhookUrl ? validated.webhookUrl : undefined,
    };

    const prisma = getPrismaClient();
    const dbUser = await prisma.user.update({
      where: { id: user.id },
      data: { notificationPreferences: preferences },
      select: { notificationPreferences: true },
    });

    const updatedPreferences = parseNotificationPreferences(dbUser.notificationPreferences);

    return NextResponse.json({
      preferences: updatedPreferences,
      message: 'Notification preferences updated successfully',
    });
  } catch (error) {
    console.error('[PUT /api/user/preferences] Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid preferences data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}

