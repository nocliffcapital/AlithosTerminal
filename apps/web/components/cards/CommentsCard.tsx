'use client';

import React, { useState, useCallback } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { useAuth } from '@/lib/hooks/useAuth';
import { useMarket } from '@/lib/hooks/usePolymarketData';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, Plus, Trash2, MessageSquare, Send, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarketSelector } from '@/components/MarketSelector';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/Toast';

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
  const { selectedMarketId } = useMarketStore();
  const effectiveMarketId = propMarketId || selectedMarketId;
  const { dbUser } = useAuth();
  const { user: privyUser } = usePrivy();
  const { success, error: showError } = useToast();
  const { data: market } = useMarket(effectiveMarketId);
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newComment, setNewComment] = useState('');
  const queryClient = useQueryClient();

  // Fetch comments
  const { data: comments = [], isLoading, error: commentsError } = useQuery<Comment[]>({
    queryKey: ['comments', effectiveMarketId],
    queryFn: async () => {
      if (!effectiveMarketId) return [];
      
      try {
        const response = await fetch(`/api/comments?marketId=${effectiveMarketId}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          
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
        
        const data = await response.json();
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
      queryClient.invalidateQueries({ queryKey: ['comments', effectiveMarketId] });
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
      queryClient.invalidateQueries({ queryKey: ['comments', effectiveMarketId] });
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

  const handleMarketSelect = useCallback((marketId: string | null) => {
    if (onMarketChange) {
      onMarketChange(marketId);
    }
    setShowMarketSelector(false);
  }, [onMarketChange]);

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
          description="Choose a market from the selector below to view and add comments"
          action={{
            label: 'Select Market',
            onClick: () => setShowMarketSelector(true),
          }}
          className="p-4"
        />
        <MarketSelector
          open={showMarketSelector}
          onOpenChange={setShowMarketSelector}
          onSelect={handleMarketSelect}
        />
      </>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-accent/10 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={() => setShowMarketSelector(true)}
            className="p-1.5 hover:bg-accent/60 rounded-md transition-colors flex-shrink-0"
            title="Select market"
            aria-label="Select market"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <span className="text-xs font-medium truncate text-foreground" title={market?.question}>
            {market?.question || 'Select market'}
          </span>
        </div>
        {!showCreate && dbUser && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreate(true)}
            className="text-xs h-6 px-2 flex-shrink-0"
          >
            <Plus className="h-3 w-3 mr-1" />
            Comment
          </Button>
        )}
      </div>

      <MarketSelector
        open={showMarketSelector}
        onOpenChange={setShowMarketSelector}
        onSelect={handleMarketSelect}
      />

      {/* Create Comment Form */}
      {showCreate && dbUser && (
        <div className="px-4 py-3 border-b border-border bg-accent/5 flex-shrink-0">
          <div className="flex flex-col gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full min-h-[80px] p-2 text-xs rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              maxLength={5000}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
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
                  className="text-xs h-6 px-2"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateComment}
                  disabled={!newComment.trim() || createCommentMutation.isPending}
                  className="text-xs h-6 px-2"
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
                    <p className="text-[10px] font-medium text-destructive mb-1">
                      Troubleshooting:
                    </p>
                    <p className="text-[10px] text-muted-foreground">
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

