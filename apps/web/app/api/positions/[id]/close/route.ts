import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';

/**
 * POST /api/positions/[id]/close
 * Close a position (sell all outcome tokens)
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
    const { amount, outcome } = body;

    if (!amount || !outcome) {
      return NextResponse.json({ error: 'Amount and outcome are required' }, { status: 400 });
    }

    // TODO: Implement actual position closing
    // This would:
    // 1. Get current position size
    // 2. Execute sell transaction for full position
    // 3. Update position status to closed
    // 4. Record position history entry

    return NextResponse.json({
      success: false,
      error: 'Position closing not yet fully implemented. Requires position size tracking.',
    });
  } catch (error) {
    console.error('[POST /api/positions/[id]/close] Error:', error);
    return NextResponse.json(
      { error: 'Failed to close position', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

