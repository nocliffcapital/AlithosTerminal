'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useMarket, useMarkets } from '@/lib/hooks/usePolymarketData';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, Plus, Trash2, MessageSquare, Send, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/Toast';
import { MarketSelector } from '@/components/MarketSelector';
import { realtimeClient } from '@/lib/api/realtime-client';
import { CardMarketContext } from '@/components/layout/Card';

interface Comment {
  id: string;
  userId: string;
  marketId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string | null;
    walletAddress: string | null;
    profile?: {
      name?: string | null;
      pseudonym?: string | null;
      displayUsernamePublic?: boolean;
      bio?: string | null;
      isMod?: boolean;
      isCreator?: boolean;
      profileImage?: string | null;
      baseAddress?: string | null;
    } | null;
  };
  reactions?: any[];
  reactionCount?: number;
  reportCount?: number;
}

interface CommentsCardProps {
  marketId?: string;
  onMarketChange?: (marketId: string | null) => void;
}

function CommentsCardComponent({ marketId: propMarketId, onMarketChange }: CommentsCardProps = {}) {
  // Use prop marketId only - don't fall back to global state to avoid shared state issues
  const effectiveMarketId = propMarketId;
  const { dbUser } = useAuth();
  const { user: privyUser } = usePrivy();
  const { success, error: showError } = useToast();
  const { setMarketQuestion } = React.useContext(CardMarketContext);
  
  // Fetch all markets to get eventId (markets list has eventId populated)
  const { data: allMarkets = [] } = useMarkets({ active: true });
  const { data: marketFromHook } = useMarket(effectiveMarketId || null);
  
  // Use market from allMarkets if available (has eventId/eventTitle), otherwise fall back to marketFromHook
  // This ensures we have the full market data with eventId populated
  const market = React.useMemo(() => {
    if (!effectiveMarketId) return null;
    // First, try to find market in allMarkets (has eventId/eventTitle populated from events API)
    const marketFromAllMarkets = allMarkets.find(m => m.id === effectiveMarketId);
    if (marketFromAllMarkets) {
      console.log('[CommentsCard] Using market from allMarkets with eventId:', marketFromAllMarkets.eventId);
      return marketFromAllMarkets;
    }
    // Fall back to market from useMarket hook
    console.log('[CommentsCard] Using market from useMarket hook, eventId:', marketFromHook?.eventId);
    return marketFromHook || null;
  }, [effectiveMarketId, allMarkets, marketFromHook]);

  // Set market question in context for card header display
  // Always show the full question (like Market Search), not extracted option name
  React.useEffect(() => {
    if (!setMarketQuestion) return;
    
    // Defer state update to avoid render warnings
    requestAnimationFrame(() => {
      if (market) {
        // Always show the full question, matching Market Search behavior
        setMarketQuestion(market.question || null);
      } else {
        setMarketQuestion(null);
      }
    });
  }, [market, setMarketQuestion]);
  
  const [showCreate, setShowCreate] = useState(false);
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const [newComment, setNewComment] = useState('');
  const queryClient = useQueryClient();

  // Get eventId or seriesId for comments (comments are typically on Events/Series, not individual markets)
  const eventId = market?.eventId || (market as any)?.event_id;
  const seriesId = market?.seriesId || (market as any)?.series_id;
  
  // Log which ID we're using for debugging
  React.useEffect(() => {
    if (market && effectiveMarketId) {
      console.log('[CommentsCard] Market data for comments:', {
        marketId: effectiveMarketId,
        eventId: eventId || 'not found',
        seriesId: seriesId || 'not found',
        eventTitle: market.eventTitle || 'not found',
        hasEventId: !!eventId,
        hasSeriesId: !!seriesId,
      });
    }
  }, [market, effectiveMarketId, eventId, seriesId]);

  // Subscribe to real-time comment updates
  useEffect(() => {
    if (!effectiveMarketId || !market) return;

    // Comments are typically associated with Series or Events, not individual markets
    // IMPORTANT: Comments are often on Series level, not Event level
    // Try to get seriesId first, then eventId, then fall back to market ID
    let entityIdToUse: number | null = null;
    let entityTypeToUse: string = 'market';
    
    // Try seriesId first (comments are often on Series level)
    if (seriesId) {
      const seriesIdAsInt = parseInt(seriesId.toString(), 10);
      if (!isNaN(seriesIdAsInt)) {
        entityIdToUse = seriesIdAsInt;
        entityTypeToUse = 'Series';
        console.log('[CommentsCard] Using seriesId for comments:', seriesIdAsInt);
      }
    }
    
    // If no seriesId, try eventId
    if (!entityIdToUse && eventId) {
      const eventIdAsInt = parseInt(eventId.toString(), 10);
      if (!isNaN(eventIdAsInt)) {
        entityIdToUse = eventIdAsInt;
        entityTypeToUse = 'Event';
        console.log('[CommentsCard] Using eventId for comments:', eventIdAsInt);
      }
    }
    
    // Fall back to market ID if no eventId or seriesId
    if (!entityIdToUse) {
      const idAsInt = parseInt(market.id, 10);
      if (!isNaN(idAsInt)) {
        entityIdToUse = idAsInt;
        entityTypeToUse = 'market';
        console.log('[CommentsCard] Using market ID for comments:', idAsInt);
      } else {
        const conditionIdAsInt = parseInt(market.conditionId, 10);
        if (!isNaN(conditionIdAsInt)) {
          entityIdToUse = conditionIdAsInt;
          entityTypeToUse = 'market';
        } else {
          const marketIdAsInt = parseInt(effectiveMarketId, 10);
          if (!isNaN(marketIdAsInt)) {
            entityIdToUse = marketIdAsInt;
            entityTypeToUse = 'market';
          }
        }
      }
    }

    if (!entityIdToUse) {
      // Silently return - not all markets have numeric IDs
      return;
    }

    // Store identifiers for filtering (include both event/market IDs)
    const entityIdentifiers = new Set([
      entityIdToUse.toString(),
      effectiveMarketId,
      market.id,
      market.conditionId,
      eventId?.toString(),
      (market as any).seriesId?.toString(),
    ].filter(Boolean));

      // Try different entity types for comment subscription
      // IMPORTANT: Prioritize Series first (comments are often on Series level)
      // Then Event, then market
      const entityTypes = entityTypeToUse === 'Series'
        ? ['Series', 'Event', 'market']
        : entityTypeToUse === 'Event' 
        ? ['Series', 'Event', 'market'] // Try Series first even if we have Event ID
        : ['Series', 'Event', 'market']; // Always try Series first
    
    const unsubscribeFunctions: Array<() => void> = [];
    let messageUnsubscribe: (() => void) | null = null;
    let invalidationTimeout: NodeJS.Timeout | null = null;
    let lastToastTime = 0;
    const TOAST_DEBOUNCE_MS = 2000; // Prevent duplicate toasts within 2 seconds

    // Helper function to transform real-time comment to Comment interface
    const transformRealtimeComment = (payload: any): Comment | null => {
      try {
        const commentId = payload.id || payload.commentId || `${payload.parentEntityID}-${Date.now()}`;
        const userId = payload.userId || payload.user?.id || payload.owner || '';
        const marketId = payload.parentEntityID?.toString() || payload.marketId || effectiveMarketId;
        const content = payload.body || payload.content || payload.text || '';
        const createdAt = payload.createdAt || payload.created_at || payload.timestamp || new Date().toISOString();
        const updatedAt = payload.updatedAt || payload.updated_at || createdAt;

        if (!content) {
          return null;
        }

        return {
          id: commentId.toString(),
          userId: userId.toString(),
          marketId: marketId.toString(),
          content,
          createdAt: typeof createdAt === 'string' ? createdAt : new Date(createdAt).toISOString(),
          updatedAt: typeof updatedAt === 'string' ? updatedAt : new Date(updatedAt).toISOString(),
          user: {
            id: userId.toString(),
            email: payload.user?.email || null,
            walletAddress: payload.user?.walletAddress || payload.user?.address || payload.owner || null,
            profile: payload.user?.profile || null,
          },
          reactions: payload.reactions || [],
          reactionCount: payload.reactionCount || payload.reaction_count || 0,
          reportCount: payload.reportCount || payload.report_count || 0,
        };
      } catch (error) {
        console.error('[CommentsCard] Error transforming real-time comment:', error);
        return null;
      }
    };

    // Subscribe to real-time comment updates
    const setupSubscription = () => {
      // Connect client if not already connected
      if (!realtimeClient.isConnected()) {
        realtimeClient.connect();
      }

      // Subscribe to comment updates for each entity type using the entity ID
      // IMPORTANT: Use seriesId for Series subscriptions, eventId for Event subscriptions
      entityTypes.forEach((entityType) => {
        try {
          // Use seriesId if available and entityType is Series, otherwise use entityIdToUse
          const idToUse = (entityType === 'Series' && seriesId) 
            ? parseInt(seriesId.toString(), 10)
            : (entityType === 'Event' && eventId)
            ? parseInt(eventId.toString(), 10)
            : entityIdToUse!;
          
          if (isNaN(idToUse)) {
            console.warn(`[CommentsCard] Invalid ID for ${entityType}, skipping subscription`);
            return;
          }
          
          const unsubscribe = realtimeClient.subscribeToComments(
            idToUse,
            entityType,
            privyUser?.wallet?.address ? { address: privyUser.wallet.address } : undefined
          );
          unsubscribeFunctions.push(unsubscribe);
          console.log(`[CommentsCard] Subscribed to comments for ${entityType} with ID ${idToUse}`);
        } catch (error) {
          console.warn(`[CommentsCard] Failed to subscribe to comments for ${entityType}:`, error);
        }
      });

      // Listen for comment messages - accept comments for the event/series/market
      messageUnsubscribe = realtimeClient.onMessage((message) => {
        if (message.topic === 'comments') {
          const payload = message.payload as any;
          const commentEntityId = payload.parentEntityID?.toString() || payload.parentEntityId?.toString() || payload.marketId || payload.eventId;
          
          // Accept comments for the event/series/market (not just the specific market)
          if (commentEntityId && entityIdentifiers.has(commentEntityId.toString())) {
            console.log('[CommentsCard] 📨 Received real-time comment:', message.type, payload);
            
            // Clear existing timeout
            if (invalidationTimeout) {
              clearTimeout(invalidationTimeout);
            }
            
            // Handle different message types
            if (message.type === 'comment_created' || message.type === 'comment_updated') {
              const transformedComment = transformRealtimeComment(payload);
              
              if (transformedComment) {
                // Update query cache directly with the new comment (use the same query key as the query)
                // IMPORTANT: Prioritize seriesId over eventId (comments are often on Series level)
                const queryKey = seriesId
                  ? ['comments', 'series', seriesId, effectiveMarketId]
                  : eventId 
                  ? ['comments', 'event', eventId, effectiveMarketId]
                  : ['comments', effectiveMarketId];
                
                queryClient.setQueryData<Comment[]>(queryKey, (oldComments = []) => {
                  // Check if comment already exists
                  const existingIndex = oldComments.findIndex(c => c.id === transformedComment.id);
                  
                  if (existingIndex >= 0) {
                    // Update existing comment
                    const updated = [...oldComments];
                    updated[existingIndex] = transformedComment;
                    return updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                  } else {
                    // Add new comment at the beginning (most recent first)
                    return [transformedComment, ...oldComments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                  }
                });
                
                // Show toast for new comments (debounced)
                if (message.type === 'comment_created') {
                  const now = Date.now();
                  if (now - lastToastTime > TOAST_DEBOUNCE_MS) {
                    lastToastTime = now;
                    setTimeout(() => {
                      success('New comment', 'A new comment was posted');
                    }, 200);
                  }
                }
              }
            } else if (message.type === 'comment_deleted') {
              // Remove comment from cache (use the same query key as the query)
              // IMPORTANT: Prioritize seriesId over eventId (comments are often on Series level)
              const queryKey = seriesId
                ? ['comments', 'series', seriesId, effectiveMarketId]
                : eventId 
                ? ['comments', 'event', eventId, effectiveMarketId]
                : ['comments', effectiveMarketId];
              
              queryClient.setQueryData<Comment[]>(queryKey, (oldComments = []) => {
                const commentId = payload.id || payload.commentId;
                if (commentId) {
                  return oldComments.filter(c => c.id !== commentId.toString());
                }
                return oldComments;
              });
            } else {
              // For other message types, just invalidate to refetch (use the same query key as the query)
              // IMPORTANT: Prioritize seriesId over eventId (comments are often on Series level)
              const queryKey = seriesId
                ? ['comments', 'series', seriesId, effectiveMarketId]
                : eventId 
                ? ['comments', 'event', eventId, effectiveMarketId]
                : ['comments', effectiveMarketId];
              
              invalidationTimeout = setTimeout(() => {
                queryClient.invalidateQueries({ queryKey });
                invalidationTimeout = null;
              }, 100);
            }
          }
        }
      });

      if (messageUnsubscribe) {
        unsubscribeFunctions.push(messageUnsubscribe);
      }
    };

    // Small delay to ensure client is ready
    const timeoutId = setTimeout(setupSubscription, 500);

    return () => {
      clearTimeout(timeoutId);
      // Clear any pending invalidations
      if (invalidationTimeout) {
        clearTimeout(invalidationTimeout);
        invalidationTimeout = null;
      }
      unsubscribeFunctions.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('[CommentsCard] Error unsubscribing from real-time comments:', error);
        }
      });
    };
  }, [effectiveMarketId, market?.id, market?.conditionId, eventId, seriesId, queryClient, privyUser?.wallet?.address, success]);

  // Use seriesId/eventId in query key so comments are properly cached for the series/event
  // IMPORTANT: Prioritize seriesId over eventId (comments are often on Series level)
  const commentsQueryKey = seriesId
    ? ['comments', 'series', seriesId, effectiveMarketId]
    : eventId 
    ? ['comments', 'event', eventId, effectiveMarketId]
    : ['comments', effectiveMarketId];

  // Fetch comments
  const { data: comments = [], isLoading, error: commentsError } = useQuery<Comment[]>({
    queryKey: commentsQueryKey,
    queryFn: async () => {
      if (!effectiveMarketId) {
        console.log('[CommentsCard] No marketId provided, skipping fetch');
        return [];
      }
      
      console.log('[CommentsCard] Fetching comments for market:', effectiveMarketId, seriesId ? `(seriesId: ${seriesId})` : eventId ? `(eventId: ${eventId})` : '');
      
      try {
        // According to Polymarket API docs, comments don't require authentication
        // Comments are public and accessible without wallet address
        // The API route will automatically try eventId/seriesId if available
        const response = await fetch(`/api/comments?marketId=${effectiveMarketId}`);
        
        console.log('[CommentsCard] API response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          
          console.error('[CommentsCard] API error response:', errorData);
          
          // Build a comprehensive error message
          let errorMessage = errorData.error || `Failed to fetch comments: ${response.status}`;
          if (errorData.details) {
            errorMessage += ` - ${errorData.details}`;
          }
          if (errorData.hint) {
            errorMessage += ` (${errorData.hint})`;
          }
          
          const error = new Error(errorMessage);
          // Store full error data for display
          (error as any).errorData = errorData;
          (error as any).statusCode = response.status;
          throw error;
        }
        
        // Read debug header before consuming response
        const debugHeader = response.headers.get('X-Comments-Debug');
        const data = await response.json();
        
        if (debugHeader) {
          try {
            const debugInfo = JSON.parse(debugHeader);
            console.log('[CommentsCard] 📊 Debug info:', debugInfo);
            if (debugInfo.commentsFound === 0) {
              console.warn('[CommentsCard] ⚠️ No comments found for market:', {
                marketId: debugInfo.marketId,
                numericMarketId: debugInfo.numericMarketId,
                marketIdFromAPI: debugInfo.marketIdFromAPI,
                conditionId: debugInfo.conditionId,
              });
              console.warn('[CommentsCard] 💡 This market may not have comments on Polymarket, or the entity type may not match.');
              console.warn('[CommentsCard] 💡 Try checking the Polymarket website directly to see if this market has comments.');
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
        
        console.log('[CommentsCard] Received comments:', Array.isArray(data) ? `${data.length} comments` : 'not an array');
        if (data.length > 0) {
          console.log('[CommentsCard] ✅ Sample comment:', data[0]);
        } else {
          console.log('[CommentsCard] ℹ️ Empty comments array - market may not have comments yet');
        }
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('[CommentsCard] Error fetching comments:', error);
        throw error;
      }
    },
    enabled: !!effectiveMarketId,
    staleTime: 30 * 1000, // 30 seconds
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Add Privy user ID header for authentication
      if (privyUser?.id) {
        headers['X-Privy-User-Id'] = privyUser.id;
      }
      
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers,
        body: JSON.stringify({ marketId: effectiveMarketId, content }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create comment');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      success('Comment added', 'Your comment has been posted successfully.');
      setNewComment('');
      setShowCreate(false);
    },
    onError: (error: Error) => {
      showError('Failed to create comment', error.message);
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const headers: HeadersInit = {};
      
      // Add Privy user ID header for authentication
      if (privyUser?.id) {
        headers['X-Privy-User-Id'] = privyUser.id;
      }
      
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete comment');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      success('Comment deleted', 'Comment has been deleted successfully.');
    },
    onError: (error: Error) => {
      showError('Failed to delete comment', error.message);
    },
  });

  const handleCreateComment = useCallback(async () => {
    if (!newComment.trim()) {
      showError('Invalid input', 'Please enter a comment');
      return;
    }

    if (!effectiveMarketId) {
      showError('No market selected', 'Please select a market first');
      return;
    }

    createCommentMutation.mutate(newComment.trim());
  }, [newComment, effectiveMarketId, createCommentMutation, showError]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }
    deleteCommentMutation.mutate(commentId);
  }, [deleteCommentMutation]);


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getUserDisplayName = (user: Comment['user']) => {
    // Use Polymarket profile data if available
    if (user.profile) {
      if (user.profile.displayUsernamePublic && user.profile.name) {
        return user.profile.name;
      }
      if (user.profile.pseudonym) {
        return user.profile.pseudonym;
      }
    }
    // Fallback to email or wallet address
    if (user.email) {
      return user.email.split('@')[0];
    }
    if (user.walletAddress) {
      return `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`;
    }
    return 'Anonymous';
  };

  if (!effectiveMarketId) {
    return (
      <>
        <EmptyState
          icon={MessageSquare}
          title="Select a market to view comments"
          description="Use the search icon in the navbar to select a market"
          action={{
            label: 'Select Market',
            onClick: () => setShowMarketSelector(true),
            icon: Search,
          }}
          className="p-4"
        />
        <MarketSelector
          open={showMarketSelector}
          onOpenChange={setShowMarketSelector}
          onSelect={(id) => {
            if (onMarketChange) onMarketChange(id);
            setShowMarketSelector(false);
          }}
        />
      </>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-end px-3 py-2 border-b border-border bg-accent/20 flex-shrink-0 gap-2">
        {!showCreate && dbUser && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreate(true)}
            className="text-xs px-2 flex-shrink-0"
          >
            <Plus className="h-3 w-3 mr-1" />
            Comment
          </Button>
        )}
      </div>

      {/* Create Comment Form */}
      {showCreate && dbUser && (
        <div className="px-3 py-3 border-b border-border bg-accent/10 flex-shrink-0">
          <div className="flex flex-col gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full min-h-[80px] p-3 text-xs rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
              maxLength={5000}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {newComment.length}/5000
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreate(false);
                    setNewComment('');
                  }}
                  className="text-xs px-2"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateComment}
                  disabled={!newComment.trim() || createCommentMutation.isPending}
                  className="text-xs px-2"
                >
                  {createCommentMutation.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3 mr-1" />
                      Post
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comments List */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="sm" text="Loading comments..." />
          </div>
        ) : commentsError ? (
          // Debug: Log error details
          (() => {
            console.error('[CommentsCard] Error loading comments:', commentsError);
            return null;
          })(),
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-sm text-muted-foreground max-w-md px-4">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50 text-destructive" />
              <p className="text-destructive font-medium">Failed to load comments</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs">
                  {commentsError instanceof Error ? commentsError.message : 'Unknown error'}
                </p>
                {commentsError instanceof Error && (
                  (commentsError as any).errorData?.hint || 
                  commentsError.message.includes('Prisma') ||
                  commentsError.message.includes('migration') ||
                  commentsError.message.includes('regenerated')
                ) && (
                  <div className="mt-3 p-2 bg-destructive/10 rounded-md border border-destructive/20">
                    <p className="text-xs font-semibold text-destructive mb-1">
                      Troubleshooting:
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(commentsError as any).errorData?.hint ? (
                        <span>{(commentsError as any).errorData.hint}</span>
                      ) : commentsError.message.includes('regenerated') ? (
                        <>
                          1. Run: <code className="bg-background/50 px-1 rounded">npx prisma generate</code><br />
                          2. Restart the Next.js dev server
                        </>
                      ) : (
                        <>
                          1. Run: <code className="bg-background/50 px-1 rounded">npx prisma migrate dev</code><br />
                          2. If migration already exists, restart the dev server
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No comments yet</p>
              <p className="text-xs mt-1">Be the first to comment on this market</p>
            </div>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="p-3 rounded-md border border-border bg-card hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-medium text-primary">
                      {getUserDisplayName(comment.user).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">
                      {getUserDisplayName(comment.user)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatDate(comment.createdAt)}
                    </div>
                  </div>
                </div>
                {dbUser && dbUser.id === comment.userId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteComment(comment.id)}
                    disabled={deleteCommentMutation.isPending}
                    className="text-xs h-5 w-5 p-0 flex-shrink-0 hover:text-destructive"
                    title="Delete comment"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="text-xs text-foreground whitespace-pre-wrap break-words mt-2">
                {comment.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default CommentsCardComponent;

