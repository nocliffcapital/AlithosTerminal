'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useMarket, useMarkets } from '@/lib/hooks/usePolymarketData';
import { useAdjacentNews } from '@/lib/hooks/useAdjacentNews';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/useAuth';
import { usePrivy } from '@privy-io/react-auth';
import { useMarketStore } from '@/stores/market-store';
import { Loader2, FileText, Newspaper, MessageSquare, Plus, Trash2, Send, ExternalLink, Calendar, User } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/Toast';

interface MarketInfoPanelProps {
  marketId?: string | null;
}

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

export function MarketInfoPanel({ marketId }: MarketInfoPanelProps) {
  const [activeTab, setActiveTab] = useState<'criteria' | 'news' | 'comments'>('criteria');
  const [newComment, setNewComment] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  
  const { dbUser } = useAuth();
  const { user: privyUser } = usePrivy();
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const { getMarket } = useMarketStore();
  
  // Fetch all markets to get eventId
  const { data: allMarkets = [] } = useMarkets({ active: true });
  const { data: marketFromHook, isLoading: isLoadingMarket } = useMarket(marketId || null);
  
  // Use market from allMarkets if available (has eventId/eventTitle), otherwise fall back to marketFromHook or store
  // Same approach as NewsCard
  const market = useMemo(() => {
    if (!marketId) return null;
    const marketFromAllMarkets = allMarkets.find(m => m.id === marketId);
    const storedMarket = getMarket(marketId);
    return marketFromAllMarkets || marketFromHook || storedMarket || null;
  }, [marketId, allMarkets, marketFromHook, getMarket]);
  
  // Get eventId and seriesId from market
  const eventId = market?.eventId;
  const seriesId = market?.seriesId;
  
  // Fetch relevant news (same as NewsCard)
  const { data: newsData, isLoading: isLoadingNews, error: newsError } = useAdjacentNews({
    market: market || null,
    days: 7,
    limit: 10,
    enabled: !!market,
  });
  
  // Format date helper (same as CommentsCard)
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
  
  // Get user display name (same as CommentsCard)
  const getUserDisplayName = (user: Comment['user']) => {
    if (user.profile) {
      if (user.profile.displayUsernamePublic && user.profile.name) {
        return user.profile.name;
      }
      if (user.profile.pseudonym) {
        return user.profile.pseudonym;
      }
    }
    if (user.walletAddress) {
      return `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`;
    }
    return 'Anonymous';
  };
  
  // Comments query key (same as CommentsCard)
  const commentsQueryKey = seriesId
    ? ['comments', 'series', seriesId, marketId]
    : eventId 
    ? ['comments', 'event', eventId, marketId]
    : ['comments', marketId];
  
  // Fetch comments (same as CommentsCard)
  const { data: comments = [], isLoading: isLoadingComments, error: commentsError } = useQuery<Comment[]>({
    queryKey: commentsQueryKey,
    queryFn: async () => {
      if (!marketId) return [];
      
      const response = await fetch(`/api/comments?marketId=${marketId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to fetch comments: ${response.status}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!marketId,
    staleTime: 30 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  
  // Create comment mutation (same as CommentsCard)
  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (privyUser?.id) {
        headers['X-Privy-User-Id'] = privyUser.id;
      }
      
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers,
        body: JSON.stringify({ marketId, content }),
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
  
  // Delete comment mutation (same as CommentsCard)
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const headers: HeadersInit = {};
      
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
    if (!marketId) {
      showError('No market selected', 'Please select a market first');
      return;
    }
    createCommentMutation.mutate(newComment.trim());
  }, [newComment, marketId, createCommentMutation, showError]);
  
  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }
    deleteCommentMutation.mutate(commentId);
  }, [deleteCommentMutation]);
  
  // Deduplicate news (same as NewsCard)
  const normalizeTitle = (title: string): string => {
    return title.toLowerCase().trim().replace(/\s+/g, ' ');
  };
  
  const deduplicatedNews = useMemo(() => {
    if (!newsData?.data || newsData.data.length === 0) return [];
    
    const titleGroups = new Map<string, typeof newsData.data>();
    
    newsData.data.forEach((article) => {
      const normalizedTitle = normalizeTitle(article.title);
      if (!titleGroups.has(normalizedTitle)) {
        titleGroups.set(normalizedTitle, []);
      }
      titleGroups.get(normalizedTitle)!.push(article);
    });
    
    const deduplicated: Array<{
      article: typeof newsData.data[0];
      sources: typeof newsData.data;
      sourceCount: number;
    }> = [];
    
    titleGroups.forEach((articles) => {
      const sorted = articles.sort((a, b) => {
        const dateA = new Date(a.publishedDate).getTime();
        const dateB = new Date(b.publishedDate).getTime();
        return dateB - dateA;
      });
      
      deduplicated.push({
        article: sorted[0],
        sources: sorted,
        sourceCount: sorted.length,
      });
    });
    
    return deduplicated.sort((a, b) => {
      const dateA = new Date(a.article.publishedDate).getTime();
      const dateB = new Date(b.article.publishedDate).getTime();
      return dateB - dateA;
    });
  }, [newsData]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Tabs */}
      <div className="flex-shrink-0 flex items-center gap-1 border-b border-border px-2">
        <button
          type="button"
          onClick={() => setActiveTab('criteria')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
            activeTab === 'criteria'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="h-3 w-3" />
          Resolution Criteria
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('news')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
            activeTab === 'news'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Newspaper className="h-3 w-3" />
          Relevant News
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('comments')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
            activeTab === 'comments'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquare className="h-3 w-3" />
          Comments
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {!marketId ? (
          <EmptyState
            icon={FileText}
            title="No market selected"
            description="Select a market to view information"
          />
        ) : isLoadingMarket ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {activeTab === 'criteria' && (
              <div className="space-y-3">
                {market?.resolutionCriteria || market?.resolutionSource ? (
                  <>
                    {market.resolutionCriteria && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-2">Rules</div>
                        <div className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                          {market.resolutionCriteria}
                        </div>
                      </div>
                    )}
                    {market.resolutionSource && (
                      <div className="pt-3 border-t border-border">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Primary Resolution Source</div>
                        {market.resolutionSource.startsWith('http') ? (
                          <a
                            href={market.resolutionSource}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            {market.resolutionSource}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <div className="text-xs text-foreground">{market.resolutionSource}</div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState
                    icon={FileText}
                    title="No resolution criteria"
                    description="This market does not have resolution criteria available"
                  />
                )}
              </div>
            )}

            {activeTab === 'news' && (
              <div className="space-y-2">
                {isLoadingNews ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : newsError ? (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    {newsError instanceof Error ? newsError.message : 'Failed to load news'}
                  </div>
                ) : deduplicatedNews.length > 0 ? (
                  <>
                    {deduplicatedNews.map(({ article, sourceCount }) => (
                      <div
                        key={article.url}
                        className="py-2 border-b border-border/30 last:border-b-0 hover:bg-accent/10 transition-colors"
                      >
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block group mb-1"
                        >
                          <h3 className="text-xs font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                            {article.title}
                          </h3>
                        </a>
                        {article.snippet && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1.5">
                            {article.snippet}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <ExternalLink className="h-2.5 w-2.5" />
                            <span className="truncate max-w-[100px]">{article.domain}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            <span>{formatDate(article.publishedDate)}</span>
                          </div>
                          {article.author && (
                            <div className="flex items-center gap-1">
                              <User className="h-2.5 w-2.5" />
                              <span className="truncate max-w-[80px]">{article.author}</span>
                            </div>
                          )}
                          {sourceCount > 1 && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-semibold">
                              {sourceCount - 1} more
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <EmptyState
                    icon={Newspaper}
                    title="No relevant news"
                    description="No relevant news articles found for this market"
                  />
                )}
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="space-y-2">
                {/* Create Comment Form */}
                {privyUser && (
                  <div className="space-y-1.5">
                    {!showCreate ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCreate(true)}
                        className="w-full text-xs h-7"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Comment
                      </Button>
                    ) : (
                      <div className="space-y-1.5 p-1.5 bg-background/50 rounded border border-border">
                        <Input
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Write a comment..."
                          className="text-xs h-7"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                              handleCreateComment();
                            }
                          }}
                        />
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            onClick={handleCreateComment}
                            disabled={!newComment.trim() || createCommentMutation.isPending}
                            className="flex-1 text-xs h-7"
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Post
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowCreate(false);
                              setNewComment('');
                            }}
                            className="text-xs h-7"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Comments List */}
                {isLoadingComments ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : commentsError ? (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    {commentsError instanceof Error ? commentsError.message : 'Failed to load comments'}
                  </div>
                ) : comments.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No comments yet"
                    description="Be the first to comment on this market"
                  />
                ) : (
                  <div className="space-y-1">
                    {comments.map((comment) => (
                      <div key={comment.id} className="p-1 bg-background/50 rounded border border-border">
                        <div className="flex items-center justify-between gap-1.5 mb-0.5">
                          <div className="text-xs font-medium text-foreground leading-tight flex-1 min-w-0">
                            {getUserDisplayName(comment.user)}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div className="text-[10px] text-muted-foreground leading-tight">
                              {formatDate(comment.createdAt)}
                            </div>
                            {dbUser && dbUser.id === comment.userId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteComment(comment.id)}
                                disabled={deleteCommentMutation.isPending}
                                className="text-xs h-4 w-4 p-0 flex-shrink-0 hover:text-destructive"
                                title="Delete comment"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-foreground whitespace-pre-wrap break-words mt-0.5 leading-relaxed">
                          {comment.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
