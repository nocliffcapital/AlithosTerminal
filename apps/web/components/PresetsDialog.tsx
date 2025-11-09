'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { validateSlippageTolerance, formatSlippage } from '@/lib/web3/slippage-utils';

interface PresetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyPreset: number;
  sellPreset: number;
  slippagePreset: number;
  onSave: (buyPreset: number, sellPreset: number, slippagePreset: number) => void;
}

export function PresetsDialog({ 
  open, 
  onOpenChange, 
  buyPreset: initialBuyPreset, 
  sellPreset: initialSellPreset,
  slippagePreset: initialSlippagePreset,
  onSave 
}: PresetsDialogProps) {
  const [buyPreset, setBuyPreset] = useState<number>(initialBuyPreset);
  const [sellPreset, setSellPreset] = useState<number>(initialSellPreset);
  const [slippagePreset, setSlippagePreset] = useState<number>(initialSlippagePreset);
  const [editingBuy, setEditingBuy] = useState<boolean>(false);
  const [editingSell, setEditingSell] = useState<boolean>(false);
  const [editingSlippage, setEditingSlippage] = useState<boolean>(false);
  const [editBuyValue, setEditBuyValue] = useState<string>('');
  const [editSellValue, setEditSellValue] = useState<string>('');
  const [editSlippageValue, setEditSlippageValue] = useState<string>('');

  // Update local state when dialog opens
  useEffect(() => {
    if (open) {
      console.log('[PresetsDialog] Dialog opened, loading initial presets:', { initialBuyPreset, initialSellPreset, initialSlippagePreset });
      setBuyPreset(initialBuyPreset);
      setSellPreset(initialSellPreset);
      setSlippagePreset(initialSlippagePreset);
      setEditingBuy(false);
      setEditingSell(false);
      setEditingSlippage(false);
      setEditBuyValue('');
      setEditSellValue('');
      setEditSlippageValue('');
    }
  }, [open, initialBuyPreset, initialSellPreset, initialSlippagePreset]);

  const handleSave = () => {
    console.log('[PresetsDialog] handleSave called');
    console.log('[PresetsDialog] Current buyPreset:', buyPreset);
    console.log('[PresetsDialog] Current sellPreset:', sellPreset);
    console.log('[PresetsDialog] Current slippagePreset:', slippagePreset);
    console.log('[PresetsDialog] Calling onSave with:', { buyPreset, sellPreset, slippagePreset });
    onSave(buyPreset, sellPreset, slippagePreset);
    console.log('[PresetsDialog] onSave called, closing dialog');
    onOpenChange(false);
  };

  const startEditBuy = () => {
    setEditingBuy(true);
    setEditBuyValue(buyPreset.toString());
  };

  const saveBuyEdit = () => {
    const value = parseFloat(editBuyValue);
    console.log('[PresetsDialog] saveBuyEdit called:', { editBuyValue, value, isValid: !isNaN(value) && value > 0 });
    if (!isNaN(value) && value > 0) {
      console.log('[PresetsDialog] Updating buy preset from', buyPreset, 'to', value);
      setBuyPreset(value);
      console.log('[PresetsDialog] Buy preset updated to:', value);
    } else {
      console.warn('[PresetsDialog] Invalid value for buy preset:', { value, editBuyValue });
    }
    setEditingBuy(false);
    setEditBuyValue('');
  };

  const cancelBuyEdit = () => {
    setEditingBuy(false);
    setEditBuyValue('');
  };

  const startEditSell = () => {
    setEditingSell(true);
    setEditSellValue(sellPreset.toString());
  };

  const saveSellEdit = () => {
    const value = parseFloat(editSellValue);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      console.log('[PresetsDialog] Updating sell preset from', sellPreset, 'to', value);
      setSellPreset(value);
      console.log('[PresetsDialog] Sell preset updated to:', value);
    } else {
      console.warn('[PresetsDialog] Invalid value for sell preset:', { value, editSellValue });
    }
    setEditingSell(false);
    setEditSellValue('');
  };

  const cancelSellEdit = () => {
    setEditingSell(false);
    setEditSellValue('');
  };

  const startEditSlippage = () => {
    setEditingSlippage(true);
    setEditSlippageValue(slippagePreset.toString());
  };

  const saveSlippageEdit = () => {
    const value = parseFloat(editSlippageValue);
    if (!isNaN(value) && validateSlippageTolerance(value)) {
      console.log('[PresetsDialog] Updating slippage preset from', slippagePreset, 'to', value);
      setSlippagePreset(value);
      console.log('[PresetsDialog] Slippage preset updated to:', value);
    } else {
      console.warn('[PresetsDialog] Invalid value for slippage preset:', { value, editSlippageValue });
    }
    setEditingSlippage(false);
    setEditSlippageValue('');
  };

  const cancelSlippageEdit = () => {
    setEditingSlippage(false);
    setEditSlippageValue('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Presets</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Set your quick buy, sell, and slippage preset values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Buy Preset */}
          <div className="space-y-3">
            <Label className="text-sm font-bold text-foreground">Buy Preset (USDC)</Label>
            {editingBuy ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={editBuyValue}
                  onChange={(e) => setEditBuyValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveBuyEdit();
                    } else if (e.key === 'Escape') {
                      cancelBuyEdit();
                    }
                  }}
                  className="h-10 text-sm font-mono"
                  autoFocus
                  placeholder="Enter amount"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveBuyEdit}
                  className="h-10"
                >
                  ✓
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelBuyEdit}
                  className="h-10"
                >
                  ✕
                </Button>
              </div>
            ) : (
              <div className="relative group">
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-2 border border-green-600/50 rounded-md bg-green-600/10 text-green-400 font-semibold">
                    ${buyPreset}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startEditBuy}
                    className="h-10"
                  >
                    Edit
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Sell Preset */}
          <div className="space-y-3">
            <Label className="text-sm font-bold text-foreground">Sell Preset (%)</Label>
            {editingSell ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={editSellValue}
                  onChange={(e) => setEditSellValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveSellEdit();
                    } else if (e.key === 'Escape') {
                      cancelSellEdit();
                    }
                  }}
                  className="h-10 text-sm font-mono"
                  autoFocus
                  placeholder="Enter percentage"
                  min="0"
                  max="100"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveSellEdit}
                  className="h-10"
                >
                  ✓
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelSellEdit}
                  className="h-10"
                >
                  ✕
                </Button>
              </div>
            ) : (
              <div className="relative group">
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-2 border border-red-600/50 rounded-md bg-red-600/10 text-red-400 font-semibold">
                    {sellPreset}%
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startEditSell}
                    className="h-10"
                  >
                    Edit
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Slippage Preset */}
          <div className="space-y-3">
            <Label className="text-sm font-bold text-foreground">Slippage Preset (%)</Label>
            {editingSlippage ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={editSlippageValue}
                  onChange={(e) => setEditSlippageValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveSlippageEdit();
                    } else if (e.key === 'Escape') {
                      cancelSlippageEdit();
                    }
                  }}
                  className="h-10 text-sm font-mono"
                  autoFocus
                  placeholder="Enter slippage %"
                  min="0.1"
                  max="10"
                  step="0.1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveSlippageEdit}
                  className="h-10"
                >
                  ✓
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelSlippageEdit}
                  className="h-10"
                >
                  ✕
                </Button>
              </div>
            ) : (
              <div className="relative group">
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-2 border border-blue-600/50 rounded-md bg-blue-600/10 text-blue-400 font-semibold">
                    {formatSlippage(slippagePreset)}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startEditSlippage}
                    className="h-10"
                  >
                    Edit
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600 text-white">
              Save Presets
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
