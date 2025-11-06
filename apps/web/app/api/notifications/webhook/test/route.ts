import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { z } from 'zod';
import { testWebhook } from '@/lib/notifications/webhook-client';

const testWebhookSchema = z.object({
  url: z.string().url(),
});

/**
 * POST /api/notifications/webhook/test
 * Test webhook URL to verify it's accessible
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = testWebhookSchema.parse(body);

    const result = await testWebhook(validated.url);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/notifications/webhook/test] Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid webhook URL', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to test webhook' },
      { status: 500 }
    );
  }
}

