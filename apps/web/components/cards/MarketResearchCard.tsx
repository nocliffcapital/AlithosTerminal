'use client';

import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useMarket } from '@/lib/hooks/usePolymarketData';
import { Loader2, CheckCircle2, XCircle, AlertCircle, ExternalLink, Brain, TrendingUp, Sparkles, FileSearch, CheckCircle, Download, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MarketResearchResult, FinalVerdict, GradedSource } from '@/lib/market-research/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { MarketSelector } from '@/components/MarketSelector';
import { CardMarketContext } from '@/components/layout/Card';

interface MarketResearchCardProps {
  marketId?: string;
  onMarketChange?: (marketId: string | null) => void;
}

type ResearchStage = {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  estimatedTime: number; // in milliseconds
};

const RESEARCH_STAGES: ResearchStage[] = [
  { id: 'researching', label: 'Researching sources', Icon: FileSearch, estimatedTime: 4000 },
  { id: 'planning', label: 'Planning research strategy', Icon: Brain, estimatedTime: 1500 },
  { id: 'searching', label: 'Searching credible sources', Icon: FileSearch, estimatedTime: 3000 },
  { id: 'grading', label: 'Grading sources (A-D)', Icon: Sparkles, estimatedTime: 2000 },
  { id: 'analyzing', label: 'Running multi-agent analysis', Icon: Brain, estimatedTime: 5000 },
  { id: 'reasoning', label: 'Applying Bayesian reasoning', Icon: TrendingUp, estimatedTime: 2000 },
  { id: 'finalizing', label: 'Finalizing results', Icon: CheckCircle, estimatedTime: 1000 },
];

/**
 * Check if a string is a valid HTTP/HTTPS URL
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function MarketResearchCardComponent({ marketId: propMarketId, onMarketChange }: MarketResearchCardProps = {}) {
  const { user, authenticated } = usePrivy();
  // Use prop marketId only - don't fall back to global state to avoid shared state issues
  const effectiveMarketId = propMarketId;
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const { data: market, isLoading: marketLoading } = useMarket(effectiveMarketId ?? null);
  const { setMarketQuestion } = React.useContext(CardMarketContext);
  const [researchResult, setResearchResult] = useState<MarketResearchResult | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [showIntermediateResults, setShowIntermediateResults] = useState(false);
  const [intermediateResults, setIntermediateResults] = useState<any>(null);

  const handleSelect = (marketId: string) => {
    if (onMarketChange) {
      onMarketChange(marketId);
    }
    setResearchResult(null);
    setError(null);
  };

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

  // Animate through stages while research is running
  useEffect(() => {
    if (!isResearching) {
      setCurrentStage(0);
      setStageProgress(0);
      return;
    }

    let currentStageIndex = 0;
    let stageStartTime = Date.now();
    let stageTimeout: NodeJS.Timeout;

    const updateProgress = () => {
      const stage = RESEARCH_STAGES[currentStageIndex];
      const elapsed = Date.now() - stageStartTime;
      const progress = Math.min(100, (elapsed / stage.estimatedTime) * 100);
      setStageProgress(progress);

      if (progress >= 100 && currentStageIndex < RESEARCH_STAGES.length - 1) {
        // Move to next stage
        currentStageIndex++;
        setCurrentStage(currentStageIndex);
        stageStartTime = Date.now();
        setStageProgress(0);
      }
    };

    // Update progress every 50ms
    const progressInterval = setInterval(updateProgress, 50);

    // Cycle through stages
    const cycleStage = () => {
      if (currentStageIndex < RESEARCH_STAGES.length - 1) {
        currentStageIndex++;
        setCurrentStage(currentStageIndex);
        stageStartTime = Date.now();
        setStageProgress(0);
        
        const stage = RESEARCH_STAGES[currentStageIndex];
        stageTimeout = setTimeout(cycleStage, stage.estimatedTime);
      }
    };

    // Start cycling through stages
    const firstStage = RESEARCH_STAGES[0];
    stageTimeout = setTimeout(cycleStage, firstStage.estimatedTime);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(stageTimeout);
    };
  }, [isResearching]);

  const handleAnalyze = async () => {
    if (!effectiveMarketId) {
      setError('Please select a market first');
      return;
    }

    if (!authenticated || !user?.id) {
      setError('Please authenticate to use this feature');
      return;
    }

    setIsResearching(true);
    setError(null);
    setResearchResult(null);
    setCurrentStage(0);
    setStageProgress(0);

    // Add timeout for long-running requests (180 seconds to match backend)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 180 seconds (3 minutes)

    try {
      const response = await fetch('/api/market-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Privy-User-Id': user.id, // Send Privy user ID for authentication
        },
        body: JSON.stringify({ marketId: effectiveMarketId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Research failed: ${response.statusText}`);
      }

      const responseData: any = await response.json();
      const result: MarketResearchResult = responseData;
      
      // Extract intermediate results if available
      if (responseData.intermediate) {
        setIntermediateResults(responseData.intermediate);
      }
      
      // Complete all stages before showing result
      setCurrentStage(RESEARCH_STAGES.length - 1);
      setStageProgress(100);
      
      // Small delay to show completion
      setTimeout(() => {
        setResearchResult(result);
        setIsResearching(false);
      }, 500);
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[MarketResearchCard] Research error:', err);
      
      if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('timeout'))) {
        setError('Request timed out. The analysis is taking longer than expected. Please try again with a different market.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to analyze market');
      }
      setIsResearching(false);
    }
  };

  const getVerdictColor = (verdict: FinalVerdict) => {
    switch (verdict) {
      case 'YES':
        return 'text-green-400';
      case 'NO':
        return 'text-red-400';
      case 'UNCERTAIN':
        return 'text-yellow-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const getVerdictIcon = (verdict: FinalVerdict) => {
    switch (verdict) {
      case 'YES':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'NO':
        return <XCircle className="h-4 w-4" />;
      case 'UNCERTAIN':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'text-green-400';
      case 'B':
        return 'text-blue-400';
      case 'C':
        return 'text-yellow-400';
      case 'D':
        return 'text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const handleExport = () => {
    if (!researchResult) return;

    const exportData = {
      ...researchResult,
      intermediate: intermediateResults,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `market-research-${researchResult.marketId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!effectiveMarketId) {
    return (
      <>
        <EmptyState
          icon={Brain}
          title="Select a market to analyze"
          description="Use the search icon in the navbar to select a market"
          action={{
            label: 'Select Market',
            onClick: () => setShowMarketSelector(true),
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

  if (marketLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground text-xs">Loading market...</div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Market not found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Analyze Button */}
        {!researchResult && !isResearching && (
          <div className="flex flex-col items-center justify-center gap-3 py-6">
            <div className="flex flex-col items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10 border border-primary/20">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-foreground mb-1">
                  AI Market Research
                </div>
                <div className="text-xs text-muted-foreground">
                  {market ? `Analyzing: ${market.question}` : 'Select a market to analyze'}
                </div>
              </div>
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={isResearching || !market}
              size="sm"
              className="w-full max-w-xs"
            >
              <Brain className="h-3.5 w-3.5 mr-2" />
              Analyze Market
            </Button>
            {error && (
              <div className="text-xs text-red-400 text-center mt-2 px-4">{error}</div>
            )}
          </div>
        )}

        {/* Loading Animation with Progress Stages */}
        {isResearching && (
          <div className="flex flex-col items-center justify-center gap-6 py-6">
            {/* Animated Brain Icon */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute w-20 h-20 bg-primary/20 rounded-full animate-ping" />
                <div className="absolute w-16 h-16 bg-primary/30 rounded-full animate-pulse" />
              </div>
              <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
                <Brain className="h-10 w-10 text-primary relative z-10 animate-pulse" />
              </div>
            </div>

            {/* Current Stage */}
            <div className="w-full max-w-full md:max-w-md space-y-2.5">
              {RESEARCH_STAGES.map((stage, index) => {
                const isActive = index === currentStage;
                const isCompleted = index < currentStage;
                const isCurrent = index === currentStage && isResearching;

                return (
                  <div
                    key={stage.id}
                    className={`relative transition-all duration-300 ${
                      isActive ? 'opacity-100' : isCompleted ? 'opacity-70' : 'opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className={`flex-shrink-0 transition-all duration-300 ${
                        isCompleted
                          ? 'text-green-400'
                          : isActive
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="h-3.5 w-3.5" />
                        ) : (
                          <stage.Icon className={`h-3.5 w-3.5 ${isActive ? 'animate-pulse' : ''}`} />
                        )}
                      </div>
                      <span className={`text-xs font-medium transition-colors duration-200 flex-1 ${
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {stage.label}
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    {isCurrent && (
                      <div className="w-full bg-background h-1 rounded-full overflow-hidden ml-6">
                        <div
                          className="h-full bg-primary transition-all duration-75 ease-out"
                          style={{ width: `${stageProgress}%` }}
                        />
                      </div>
                    )}
                    
                    {isCompleted && (
                      <div className="w-full bg-background h-1 rounded-full ml-6">
                        <div className="h-full bg-green-400 w-full" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Overall Progress Indicator */}
            <div className="w-full max-w-full md:max-w-md space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between text-xs ml-6">
                <span className="text-muted-foreground font-medium">Overall Progress</span>
                <span className="font-semibold text-foreground">
                  {Math.round(((currentStage + stageProgress / 100) / RESEARCH_STAGES.length) * 100)}%
                </span>
              </div>
              <div className="w-full bg-background h-2 rounded-full overflow-hidden ml-6">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-300"
                  style={{
                    width: `${((currentStage + stageProgress / 100) / RESEARCH_STAGES.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Status Message */}
            <div className="text-center pt-2">
              <div className="text-xs font-semibold text-foreground mb-1">
                {RESEARCH_STAGES[currentStage].label}
              </div>
              <div className="text-xs text-muted-foreground">
                This may take a minute...
              </div>
            </div>
          </div>
        )}

        {/* Research Results */}
        {researchResult && (
          <>
            {/* Final Verdict */}
            <div className="border border-border bg-card p-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground">Final Verdict</span>
                <div className={`flex items-center gap-1 ${getVerdictColor(researchResult.verdict)}`}>
                  {getVerdictIcon(researchResult.verdict)}
                  <span className="text-xs font-bold">{researchResult.verdict}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Confidence</span>
                <span className="text-xs font-semibold">
                  {(researchResult.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-background h-1.5 mb-1.5">
                <div
                  className="h-1.5 bg-primary"
                  style={{ width: `${researchResult.confidence * 100}%` }}
                />
              </div>
            </div>

            {/* Bayesian Probabilities */}
            <div className="border border-border bg-card p-2">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Bayesian Probabilities</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-green-400 font-medium">YES</span>
                  <span className="font-mono font-semibold">{(researchResult.bayesianResult.probabilities.yes * 100).toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-yellow-400 font-medium">UNCERTAIN</span>
                  <span className="font-mono font-semibold">{(researchResult.bayesianResult.probabilities.uncertain * 100).toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-red-400 font-medium">NO</span>
                  <span className="font-mono font-semibold">{(researchResult.bayesianResult.probabilities.no * 100).toFixed(1)}%</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                {researchResult.bayesianResult.explanation}
              </div>
            </div>

            {/* Analysis Summary */}
            <div className="border border-border bg-card p-2">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Analysis Summary</div>
              <div className="space-y-2">
                <div className="text-xs">
                  <div className="font-medium mb-0.5">Aggregator Assessment:</div>
                  <div className="text-muted-foreground leading-relaxed">
                    {researchResult.analysisResult.aggregator.reasoning}
                  </div>
                </div>
                <div className="text-xs">
                  <div className="font-medium mb-0.5">Overall Confidence:</div>
                  <div className="text-muted-foreground">
                    {(researchResult.analysisResult.overallConfidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Source Grades */}
            <div className="border border-border bg-card p-2">
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Source Grades ({researchResult.gradedSources.length} sources)
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {researchResult.gradedSources.slice(0, 5).map((gs, index) => (
                  <div key={index} className="text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`font-semibold ${getGradeColor(gs.grade)}`}>
                        Grade {gs.grade}
                      </span>
                      <span className="text-muted-foreground truncate ml-2 max-w-[60%]">
                        {gs.source.title}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {gs.source.domain || 'Unknown domain'}
                    </div>
                    {gs.source.url && isValidUrl(gs.source.url) && (
                      <a
                        href={gs.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-1 transition-colors duration-200"
                      >
                        View Source
                        <ExternalLink className="h-2 w-2" />
                      </a>
                    )}
                  </div>
                ))}
                {researchResult.gradedSources.length > 5 && (
                  <div className="text-[9px] text-muted-foreground text-center pt-1">
                    +{researchResult.gradedSources.length - 5} more sources
                  </div>
                )}
              </div>
            </div>

            {/* Research Strategy */}
            <div className="border border-border bg-card p-2">
              <div className="text-[10px] font-medium text-muted-foreground mb-1.5">Research Strategy</div>
              <div className="text-[10px] text-muted-foreground leading-relaxed">
                {researchResult.researchStrategy.timelineConsiderations}
              </div>
              {researchResult.researchStrategy.importantFactors.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-border">
                  <div className="text-[10px] font-medium mb-0.5">Key Factors:</div>
                  <div className="text-[9px] text-muted-foreground">
                    {researchResult.researchStrategy.importantFactors.slice(0, 3).join(', ')}
                  </div>
                </div>
              )}
            </div>

            {/* Intermediate Agent Outputs */}
            {intermediateResults && (
              <div className="border border-border bg-card p-2">
                <button
                  onClick={() => setShowIntermediateResults(!showIntermediateResults)}
                  className="w-full flex items-center justify-between text-[10px] font-medium text-muted-foreground mb-1.5 hover:text-foreground transition-colors"
                >
                  <span>Intermediate Agent Outputs</span>
                  {showIntermediateResults ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
                {showIntermediateResults && (
                  <div className="space-y-2 mt-2">
                    <div className="text-xs">
                      <div className="font-medium mb-1 text-green-400">Analyst Output:</div>
                      <div className="text-[9px] text-muted-foreground leading-relaxed max-h-20 overflow-y-auto bg-background p-1.5 rounded">
                        {intermediateResults.analystOutput || 'N/A'}
                      </div>
                    </div>
                    <div className="text-xs">
                      <div className="font-medium mb-1 text-blue-400">Critic Output:</div>
                      <div className="text-[9px] text-muted-foreground leading-relaxed max-h-20 overflow-y-auto bg-background p-1.5 rounded">
                        {intermediateResults.criticOutput || 'N/A'}
                      </div>
                    </div>
                    <div className="text-xs">
                      <div className="font-medium mb-1 text-purple-400">Aggregator Output:</div>
                      <div className="text-[9px] text-muted-foreground leading-relaxed max-h-20 overflow-y-auto bg-background p-1.5 rounded">
                        {intermediateResults.aggregatorOutput || 'N/A'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleExport}
                disabled={!researchResult}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={isResearching}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                {isResearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Re-analyzing...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Re-analyze
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const MarketResearchCard = React.memo(MarketResearchCardComponent, (prevProps, nextProps) => {
  if (!prevProps || !nextProps) return false;
  return prevProps.marketId === nextProps.marketId;
});

