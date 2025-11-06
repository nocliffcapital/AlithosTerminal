'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { getGasPrices, formatGasPrice, GasPrice, GasSettings } from '@/lib/web3/gas-utils';
import { Loader2 } from 'lucide-react';

interface GasSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPriority?: 'slow' | 'standard' | 'fast' | 'instant';
  onSave: (priority: 'slow' | 'standard' | 'fast' | 'instant') => void;
}

export function GasSettingsDialog({ open, onOpenChange, currentPriority = 'standard', onSave }: GasSettingsDialogProps) {
  const [gasPrices, setGasPrices] = useState<GasPrice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<'slow' | 'standard' | 'fast' | 'instant'>(currentPriority);

  useEffect(() => {
    if (open) {
      fetchGasPrices();
    }
  }, [open]);

  const fetchGasPrices = async () => {
    setIsLoading(true);
    try {
      const prices = await getGasPrices();
      setGasPrices(prices);
    } catch (error) {
      console.error('Failed to fetch gas prices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    onSave(selectedPriority);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gas Settings</DialogTitle>
          <DialogDescription>
            Choose your preferred gas price priority
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : gasPrices ? (
            <>
              {/* Priority Selection */}
              <div className="space-y-3">
                <Label className="text-xs">Gas Priority</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['slow', 'standard', 'fast', 'instant'] as const).map((priority) => (
                    <Button
                      key={priority}
                      variant={selectedPriority === priority ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedPriority(priority)}
                      className="capitalize"
                    >
                      {priority}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Current Gas Prices */}
              <div className="p-3 bg-muted rounded space-y-2">
                <Label className="text-xs font-medium">Current Gas Prices</Label>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Slow:</span>
                    <span className="font-mono">{formatGasPrice(gasPrices.slow)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Standard:</span>
                    <span className="font-mono">{formatGasPrice(gasPrices.standard)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fast:</span>
                    <span className="font-mono">{formatGasPrice(gasPrices.fast)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Instant:</span>
                    <span className="font-mono">{formatGasPrice(gasPrices.instant)}</span>
                  </div>
                </div>
              </div>

              {/* Selected Priority Info */}
              <div className="p-3 bg-primary/10 border border-primary/20 rounded">
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Selected:</span>
                    <span className="font-semibold capitalize">{selectedPriority}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gas Price:</span>
                    <span className="font-mono font-semibold">
                      {formatGasPrice(gasPrices[selectedPriority])}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-sm text-muted-foreground p-4">
              Failed to load gas prices
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1" disabled={isLoading}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

