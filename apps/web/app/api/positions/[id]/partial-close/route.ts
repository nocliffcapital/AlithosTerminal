import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';

/**
 * POST /api/positions/[id]/partial-close
 * Partially close a position (sell percentage of position)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const positionId = params.id;
    const body = await request.json();
    const { percentage, amount } = body;

    if (!percentage && !amount) {
      return NextResponse.json({ error: 'Percentage or amount is required' }, { status: 400 });
    }

    // TODO: Implement actual partial position closing
    // This would:
    // 1. Get current position size
    // 2. Calculate sell amount based on percentage or amount
    // 3. Execute sell transaction for partial amount
    // 4. Update position size
    // 5. Record position history entry

    return NextResponse.json({
      success: false,
      error: 'Partial position closing not yet fully implemented. Requires position size tracking.',
    });
  } catch (error) {
    console.error('[POST /api/positions/[id]/partial-close] Error:', error);
    return NextResponse.json(
      { error: 'Failed to partially close position', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

