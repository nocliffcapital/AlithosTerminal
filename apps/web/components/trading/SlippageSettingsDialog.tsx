'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { validateSlippageTolerance, formatSlippage } from '@/lib/web3/slippage-utils';
import { AlertCircle, Info } from 'lucide-react';

interface SlippageSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTolerance: number; // percentage (e.g., 0.5 for 0.5%)
  onSave: (tolerance: number) => void;
}

export function SlippageSettingsDialog({ open, onOpenChange, currentTolerance, onSave }: SlippageSettingsDialogProps) {
  const [tolerance, setTolerance] = useState(currentTolerance);
  const [customTolerance, setCustomTolerance] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presetTolerances = [0.1, 0.5, 1.0, 2.0, 5.0];

  const handlePresetClick = (preset: number) => {
    setTolerance(preset);
    setUseCustom(false);
    setCustomTolerance('');
    setError(null);
  };

  const handleCustomChange = (value: string) => {
    setCustomTolerance(value);
    const num = parseFloat(value);
    if (isNaN(num)) {
      setError('Invalid number');
      return;
    }
    if (!validateSlippageTolerance(num)) {
      setError('Must be between 0.1% and 10%');
      return;
    }
    setTolerance(num);
    setError(null);
  };

  const handleSave = () => {
    if (!validateSlippageTolerance(tolerance)) {
      setError('Invalid slippage tolerance');
      return;
    }
    onSave(tolerance);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Slippage Tolerance
            <div className="relative group">
              <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50 w-64 p-3 bg-popover border border-border rounded-md shadow-lg text-xs pointer-events-none">
                <p className="font-medium mb-1.5 text-foreground">What is slippage?</p>
                <p className="text-muted-foreground leading-relaxed">
                  Slippage is the difference between the expected price and the actual execution price. 
                  Higher slippage tolerance allows trades to execute even if the price moves, but may result in worse execution prices.
                </p>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            Set your maximum acceptable price slippage
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preset Tolerances */}
          <div className="space-y-2">
            <Label className="text-xs">Preset Tolerances</Label>
            <div className="grid grid-cols-5 gap-2">
              {presetTolerances.map((preset) => (
                <Button
                  key={preset}
                  variant={tolerance === preset && !useCustom ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                  className="text-xs"
                >
                  {formatSlippage(preset)}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Tolerance */}
          <div className="space-y-2">
            <Label className="text-xs">Custom Tolerance</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={customTolerance}
                onChange={(e) => {
                  setUseCustom(true);
                  handleCustomChange(e.target.value);
                }}
                placeholder="0.5"
                step="0.1"
                min="0.1"
                max="10"
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground self-center">%</span>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {error}
              </div>
            )}
          </div>

          {/* Slider */}
          <div className="space-y-2">
            <Label className="text-xs">Slippage: {formatSlippage(tolerance)}</Label>
            <Slider
              value={[tolerance]}
              onValueChange={([value]) => {
                setTolerance(value);
                setUseCustom(false);
                setCustomTolerance('');
                setError(null);
              }}
              min={0.1}
              max={10}
              step={0.1}
            />
          </div>

          {/* Warning */}
          {tolerance > 5 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-400 mb-1">High Slippage Warning</p>
                  <p className="text-muted-foreground">
                    A slippage tolerance above 5% may result in significant price impact. Use with caution.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1" disabled={!!error || !validateSlippageTolerance(tolerance)}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

