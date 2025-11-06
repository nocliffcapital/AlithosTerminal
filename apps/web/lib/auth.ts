import { NextRequest } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';

export interface AuthResult {
  userId: string;
  privyId?: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
  walletAddress: string | null;
  privyId?: string;
}

/**
 * Get authenticated user from request
 * Extracts Privy user ID from headers or cookies and looks up in database
 * 
 * Returns: { user: AuthUser | null, error: string | null }
 * 
 * Note: Client should send X-Privy-User-Id header in authenticated requests
 * TODO: Implement proper Privy server-side authentication using @privy-io/server-auth
 */
export async function getAuth(request: NextRequest): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    // Check for Privy user ID in custom header (client should send this)
    const privyUserId = request.headers.get('x-privy-user-id');
    
    // Fallback: Check cookies (Privy may set these)
    const cookiePrivyId = privyUserId || 
      request.cookies.get('privy_user_id')?.value ||
      request.cookies.get('__privy_user_id')?.value;
    
    if (!cookiePrivyId) {
      return { user: null, error: 'No authentication token found' };
    }
    
    // Look up user in database by privyId
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { privyId: cookiePrivyId },
      select: {
        id: true,
        email: true,
        walletAddress: true,
        privyId: true,
      },
    });
    
    if (user) {
      return {
        user: {
          id: user.id,
          email: user.email,
          walletAddress: user.walletAddress,
          privyId: user.privyId || cookiePrivyId,
        },
        error: null,
      };
    }
    
    return { user: null, error: 'User not found' };
  } catch (error) {
    console.error('[getAuth] Error:', error);
    return { user: null, error: error instanceof Error ? error.message : 'Authentication error' };
  }
}

