'use client';

import React, { useState, useMemo } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { useMarketPrice } from '@/lib/hooks/usePolymarketData';
import {
  probToLogit,
  logitToProb,
  probToDecimalOdds,
  decimalOddsToProb,
  probToUSOdds,
  usOddsToProb,
} from '@alithos-terminal/shared';
import { Loader2, Search, RefreshCw, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarketSelector } from '@/components/MarketSelector';

type ConversionType = 'probability' | 'decimalOdds' | 'usOdds' | 'logit';

function PriceConverterCardComponent() {
  const { selectedMarketId, getMarket } = useMarketStore();
  const { data: price, isLoading } = useMarketPrice(selectedMarketId);
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  
  // Input state
  const [inputType, setInputType] = useState<ConversionType>('probability');
  const [inputValue, setInputValue] = useState<string>('');

  const market = selectedMarketId ? getMarket(selectedMarketId) : null;
  const currentProbability = price && typeof price === 'object' && 'probability' in price 
    ? (price as { probability: number }).probability 
    : 0;

  // Calculate all conversions
  const conversions = useMemo(() => {
    if (!inputValue) return null;

    const inputNum = parseFloat(inputValue);
    if (isNaN(inputNum)) return null;

    let prob: number;

    // Convert input to probability first
    switch (inputType) {
      case 'probability':
        if (inputNum < 0 || inputNum > 100) return null;
        prob = inputNum / 100;
        break;
      case 'decimalOdds':
        if (inputNum <= 1) return null;
        prob = decimalOddsToProb(inputNum);
        break;
      case 'usOdds':
        prob = usOddsToProb(inputNum);
        break;
      case 'logit':
        prob = logitToProb(inputNum);
        break;
      default:
        return null;
    }

    // Clamp probability to valid range
    if (prob <= 0 || prob >= 1) return null;

    // Calculate all conversions
    return {
      probability: prob * 100,
      decimalOdds: probToDecimalOdds(prob),
      usOdds: probToUSOdds(prob),
      logit: probToLogit(prob),
    };
  }, [inputValue, inputType]);

  const handleUseCurrentPrice = () => {
    if (currentProbability > 0) {
      setInputType('probability');
      setInputValue(currentProbability.toFixed(2));
    }
  };

  const handleSwap = () => {
    if (conversions) {
      // Swap to the "opposite" format
      if (inputType === 'probability') {
        setInputType('decimalOdds');
        setInputValue(conversions.decimalOdds.toFixed(2));
      } else if (inputType === 'decimalOdds') {
        setInputType('usOdds');
        setInputValue(conversions.usOdds.toFixed(0));
      } else if (inputType === 'usOdds') {
        setInputType('logit');
        setInputValue(conversions.logit.toFixed(4));
      } else {
        setInputType('probability');
        setInputValue(conversions.probability.toFixed(2));
      }
    }
  };

  return (
    <div className="h-full flex flex-col p-3 space-y-3 overflow-y-auto">
      {/* Market Info */}
      {selectedMarketId && (
        <div className="text-xs flex-shrink-0 border-b border-border pb-2">
          <div className="font-medium truncate">{market?.question || 'Market'}</div>
          <div className="text-muted-foreground mt-0.5">
            Current: {currentProbability.toFixed(1)}%
          </div>
        </div>
      )}

      {!selectedMarketId && (
        <div className="flex flex-col items-center justify-center gap-2 flex-shrink-0">
          <Button
            onClick={() => setShowMarketSelector(true)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Search className="h-4 w-4 mr-2" />
            Select Market (Optional)
          </Button>
        </div>
      )}

      {isLoading && selectedMarketId ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col space-y-3 flex-1 min-h-0">
          {/* Input Section */}
          <div className="space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Convert From</Label>
              {currentProbability > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={handleUseCurrentPrice}
                >
                  Use Current ({currentProbability.toFixed(1)}%)
                </Button>
              )}
            </div>
            
            {/* Input Type Selector */}
            <div className="grid grid-cols-2 gap-2">
              {(['probability', 'decimalOdds', 'usOdds', 'logit'] as ConversionType[]).map((type) => (
                <Button
                  key={type}
                  variant={inputType === type ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs capitalize"
                  onClick={() => setInputType(type)}
                >
                  {type === 'decimalOdds' ? 'Decimal' : type === 'usOdds' ? 'US Odds' : type}
                </Button>
              ))}
            </div>

            {/* Input Value */}
            <div className="space-y-1">
              <Label className="text-xs">
                {inputType === 'probability' ? 'Probability (%)' :
                 inputType === 'decimalOdds' ? 'Decimal Odds' :
                 inputType === 'usOdds' ? 'US Odds' :
                 'Logit'}
              </Label>
              <Input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="text-sm font-mono"
                placeholder={
                  inputType === 'probability' ? 'e.g., 65.5' :
                  inputType === 'decimalOdds' ? 'e.g., 1.52' :
                  inputType === 'usOdds' ? 'e.g., -150' :
                  'e.g., 0.585'
                }
              />
            </div>
          </div>

          {/* Conversions */}
          {conversions && (
            <div className="space-y-3 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <ArrowLeftRight className="h-4 w-4" />
                <span className="text-xs font-semibold">Conversions</span>
              </div>

              <div className="space-y-2 p-3 bg-muted rounded-lg border border-border">
                {/* Probability */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Probability:</span>
                  <span className="font-mono font-medium text-sm">{conversions.probability.toFixed(2)}%</span>
                </div>

                {/* Decimal Odds */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Decimal Odds:</span>
                  <span className="font-mono font-medium text-sm">{conversions.decimalOdds.toFixed(2)}</span>
                </div>

                {/* US Odds */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">US Odds:</span>
                  <span className="font-mono font-medium text-sm">
                    {conversions.usOdds > 0 ? '+' : ''}{conversions.usOdds.toFixed(0)}
                  </span>
                </div>

                {/* Logit */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Logit:</span>
                  <span className="font-mono font-medium text-sm">{conversions.logit.toFixed(4)}</span>
                </div>
              </div>

              {/* Quick Swap Button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={handleSwap}
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Swap to {inputType === 'probability' ? 'Decimal' : inputType === 'decimalOdds' ? 'US Odds' : inputType === 'usOdds' ? 'Logit' : 'Probability'}
              </Button>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-muted-foreground flex-shrink-0 p-2 bg-muted/50 rounded">
            <div className="font-medium mb-1">Quick Reference:</div>
            <div className="space-y-0.5">
              <div>• Probability: 0-100% (e.g., 65.5%)</div>
              <div>• Decimal Odds: &gt;1 (e.g., 1.52)</div>
              <div>• US Odds: +favorite / -underdog (e.g., -150, +200)</div>
              <div>• Logit: any real number (e.g., 0.585)</div>
            </div>
          </div>
        </div>
      )}

      <MarketSelector
        open={showMarketSelector}
        onOpenChange={setShowMarketSelector}
      />
    </div>
  );
}

export const PriceConverterCard = React.memo(PriceConverterCardComponent);

