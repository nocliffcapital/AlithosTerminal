'use client';

import { useState, useEffect } from 'react';
import { X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface PresetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyPresets: number[];
  sellPresets: number[];
  onSave: (buyPresets: number[], sellPresets: number[]) => void;
}

export function PresetsDialog({ 
  open, 
  onOpenChange, 
  buyPresets: initialBuyPresets, 
  sellPresets: initialSellPresets,
  onSave 
}: PresetsDialogProps) {
  const [buyPresets, setBuyPresets] = useState<number[]>(initialBuyPresets);
  const [sellPresets, setSellPresets] = useState<number[]>(initialSellPresets);
  const [selectedBuy, setSelectedBuy] = useState<number | null>(initialBuyPresets[0] || null);
  const [selectedSell, setSelectedSell] = useState<number | null>(initialSellPresets[0] || null);
  const [editingBuy, setEditingBuy] = useState<number | null>(null);
  const [editingSell, setEditingSell] = useState<number | null>(null);
  const [editBuyValue, setEditBuyValue] = useState<string>('');
  const [editSellValue, setEditSellValue] = useState<string>('');

  useEffect(() => {
    if (open) {
      setBuyPresets(initialBuyPresets);
      setSellPresets(initialSellPresets);
      setEditingBuy(null);
      setEditingSell(null);
      setEditBuyValue('');
      setEditSellValue('');
      // Initialize selected presets to first value if arrays are not empty
      setSelectedBuy(initialBuyPresets.length > 0 ? initialBuyPresets[0] : null);
      setSelectedSell(initialSellPresets.length > 0 ? initialSellPresets[0] : null);
    }
  }, [open, initialBuyPresets, initialSellPresets]);

  const handleSave = () => {
    onSave(buyPresets, sellPresets);
    onOpenChange(false);
  };

  const startEditBuy = (index: number) => {
    setEditingBuy(index);
    setEditBuyValue(buyPresets[index].toString());
  };

  const saveBuyEdit = (index: number) => {
    const value = parseFloat(editBuyValue);
    if (!isNaN(value) && value > 0) {
      const updated = [...buyPresets];
      updated[index] = value;
      setBuyPresets(updated);
    }
    setEditingBuy(null);
    setEditBuyValue('');
  };

  const cancelBuyEdit = () => {
    setEditingBuy(null);
    setEditBuyValue('');
  };

  const startEditSell = (index: number) => {
    setEditingSell(index);
    setEditSellValue(sellPresets[index].toString());
  };

  const saveSellEdit = (index: number) => {
    const value = parseFloat(editSellValue);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      const updated = [...sellPresets];
      updated[index] = value;
      setSellPresets(updated);
    }
    setEditingSell(null);
    setEditSellValue('');
  };

  const cancelSellEdit = () => {
    setEditingSell(null);
    setEditSellValue('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Presets</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Set your quick buy and sell presets. Hover a preset and click the pencil to edit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Buy Presets */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Buy presets</h3>
            <div className="flex gap-2">
              {buyPresets.map((preset, index) => (
                <div key={`buy-preset-${preset}`} className="relative group flex-1">
                  {editingBuy === index ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={editBuyValue}
                        onChange={(e) => setEditBuyValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveBuyEdit(index);
                          } else if (e.key === 'Escape') {
                            cancelBuyEdit();
                          }
                        }}
                        className="h-10 text-sm font-mono"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveBuyEdit(index)}
                        className="h-10"
                      >
                        ✓
                      </Button>
                    </div>
                  ) : (
                    <div className="relative group flex-1">
                      <button
                        onClick={() => {
                          setSelectedBuy(preset);
                        }}
                        className={`relative w-full px-4 py-2 border rounded-md transition-colors ${
                          selectedBuy === preset
                            ? 'bg-purple-500 text-white border-purple-500'
                            : 'bg-background border-border hover:bg-accent group-hover:border-primary/50'
                        }`}
                      >
                        <span className="font-semibold">${preset}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditBuy(index);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded"
                          title="Edit preset"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sell Presets */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Sell presets</h3>
            <div className="flex gap-2">
              {sellPresets.map((preset, index) => (
                <div key={`sell-preset-${preset}`} className="relative group flex-1">
                  {editingSell === index ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={editSellValue}
                        onChange={(e) => setEditSellValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveSellEdit(index);
                          } else if (e.key === 'Escape') {
                            cancelSellEdit();
                          }
                        }}
                        className="h-10 text-sm font-mono"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveSellEdit(index)}
                        className="h-10"
                      >
                        ✓
                      </Button>
                    </div>
                  ) : (
                    <div className="relative group flex-1">
                      <button
                        onClick={() => {
                          setSelectedSell(preset);
                        }}
                        className={`relative w-full px-4 py-2 border rounded-md transition-colors ${
                          selectedSell === preset
                            ? 'bg-purple-500 text-white border-purple-500'
                            : 'bg-background border-border hover:bg-accent group-hover:border-primary/50'
                        }`}
                      >
                        <span className="font-semibold">{preset}%</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditSell(index);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded"
                          title="Edit preset"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-purple-500 hover:bg-purple-600 text-white">
              Save Presets
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

