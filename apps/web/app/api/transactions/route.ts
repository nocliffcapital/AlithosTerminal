import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { Address } from 'viem';
import { USDC_ADDRESS } from '@/lib/web3/polymarket-contracts';
import { onChainService } from '@/lib/api/onchain';

/**
 * GET /api/transactions
 * Fetch transaction history for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuth(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('walletAddress') as Address | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const type = searchParams.get('type'); // 'trade', 'deposit', 'withdraw', 'all'

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    // Fetch transactions from multiple sources
    const transactions: any[] = [];

    // 1. Fetch on-chain transactions (ERC20 transfers, contract interactions)
    try {
      const onchainTransactions = await onChainService.getWalletTransactions(walletAddress, limit);
      transactions.push(...onchainTransactions.map((tx: any) => ({
        id: tx.hash,
        type: 'onchain',
        hash: tx.hash,
        timestamp: new Date(tx.timestamp || Date.now()).toISOString(),
        from: tx.from,
        to: tx.to,
        value: tx.value,
        token: tx.tokenAddress || null,
        status: tx.status || 'confirmed',
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        explorerUrl: `https://polygonscan.com/tx/${tx.hash}`,
      })));
    } catch (error) {
      console.error('Failed to fetch on-chain transactions:', error);
    }

    // 2. Fetch Polymarket fills/trades (if available)
    try {
      // For now, we'll fetch fills from The Graph/Subgraph
      // This would need to be filtered by wallet address
      // Note: This is a placeholder - actual implementation would query user's fills
    } catch (error) {
      console.error('Failed to fetch Polymarket trades:', error);
    }

    // Sort by timestamp (newest first)
    transactions.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

    // Apply filters
    let filteredTransactions = transactions;
    if (type && type !== 'all') {
      filteredTransactions = transactions.filter((tx) => {
        if (type === 'trade') {
          // Identify trades by checking if it's a Polymarket contract interaction
          return tx.type === 'trade' || tx.to?.toLowerCase().includes('polymarket');
        }
        if (type === 'deposit') {
          // Identify deposits by checking if USDC is received
          return tx.type === 'deposit' || (tx.token === USDC_ADDRESS.toLowerCase() && tx.to?.toLowerCase() === walletAddress.toLowerCase());
        }
        if (type === 'withdraw') {
          // Identify withdrawals by checking if USDC is sent
          return tx.type === 'withdraw' || (tx.token === USDC_ADDRESS.toLowerCase() && tx.from?.toLowerCase() === walletAddress.toLowerCase());
        }
        return true;
      });
    }

    // Apply pagination
    const paginatedTransactions = filteredTransactions.slice(offset, offset + limit);

    return NextResponse.json({
      transactions: paginatedTransactions,
      total: filteredTransactions.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[GET /api/transactions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

