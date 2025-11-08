'use client';

import React, { useState, useMemo } from 'react';
import { useLayoutStore, LinkGroup, LINK_GROUP_COLORS } from '@/stores/layout-store';
import { Link2, Unlink, Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface LinkManagerProps {
  cardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Export toolbar component for use in page.tsx
export function LinkSelectionToolbar() {
  const {
    linkSelectionMode,
    selectedCardIdsForLinking,
    clearLinkSelection,
    confirmLinkSelection,
    linkGroups,
  } = useLayoutStore();
  
  const [linkGroupName, setLinkGroupName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('');

  // Get colors already used in the current workspace
  const usedColors = useMemo(() => {
    return new Set(Object.values(linkGroups).map(group => group.color));
  }, [linkGroups]);

  const handleConfirmSelection = () => {
    const linkGroupId = confirmLinkSelection(linkGroupName || undefined, selectedColor || undefined);
    
    if (linkGroupId) {
      // Reset state
      setLinkGroupName('');
      setSelectedColor('');
    }
  };

  if (!linkSelectionMode) return null;

  return (
    <div className="sticky top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border px-2 sm:px-4 py-2 sm:py-3">
      <div className="flex items-center justify-between gap-4 max-w-full">
        {/* Left side - Status and controls */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-md border border-primary/50 bg-primary/10">
              <div className="text-xs font-medium text-primary">
                Selection Mode Active
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedCardIdsForLinking.size} card{selectedCardIdsForLinking.size !== 1 ? 's' : ''} selected
              </div>
            </div>
          </div>

          {/* Color Selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Color:</span>
            <div className="flex gap-1.5">
              {LINK_GROUP_COLORS.map(color => {
                const isSelected = selectedColor === color;
                const isUsed = usedColors.has(color);
                return (
                  <button
                    key={color}
                    onClick={() => !isUsed && setSelectedColor(isSelected ? '' : color)}
                    disabled={isUsed}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all relative flex items-center justify-center",
                      isSelected 
                        ? "border-foreground scale-110" 
                        : isUsed
                        ? "border-border opacity-30 cursor-not-allowed"
                        : "border-border hover:scale-105"
                    )}
                    style={{ backgroundColor: isSelected ? color : 'transparent' }}
                    title={isUsed ? `${color} (already used)` : color}
                  >
                    {isSelected && (
                      <Check className="h-3 w-3 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
                    )}
                    {!isSelected && (
                      <div 
                        className="w-full h-full rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name Input */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Name:</span>
            <input
              type="text"
              value={linkGroupName}
              onChange={(e) => setLinkGroupName(e.target.value)}
              placeholder="e.g., Bitcoin Analysis"
              className="w-48 px-2 py-1 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={() => clearLinkSelection()}
            variant="outline"
            size="sm"
            className="h-8"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSelection}
            disabled={selectedCardIdsForLinking.size < 2}
            size="sm"
            className="h-8"
          >
            <Check className="h-3 w-3 mr-2" />
            Confirm ({selectedCardIdsForLinking.size})
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LinkManager({ cardId, open, onOpenChange }: LinkManagerProps) {
  const { 
    currentLayout, 
    linkGroups, 
    addCardToLinkGroup, 
    removeCardFromLinkGroup,
    getCardLinkGroup,
    getLinkedCards,
    linkSelectionMode,
    selectedCardIdsForLinking,
    startLinkSelection,
    clearLinkSelection,
    confirmLinkSelection,
  } = useLayoutStore();
  
  const [linkGroupName, setLinkGroupName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  
  const currentLinkGroup = getCardLinkGroup(cardId);
  const linkedCardIds = getLinkedCards(cardId);
  
  // Get colors already used in the current workspace (excluding current link group if editing)
  const usedColors = useMemo(() => {
    const used = new Set(Object.values(linkGroups)
      .filter(group => group.id !== currentLinkGroup?.id)
      .map(group => group.color));
    return used;
  }, [linkGroups, currentLinkGroup]);
  
  // When dialog opens and user wants to create a new link, start selection mode
  const handleStartSelection = () => {
    startLinkSelection(cardId);
  };
  
  // When dialog closes, clear selection mode if it was active
  const handleClose = (open: boolean) => {
    if (!open && linkSelectionMode) {
      clearLinkSelection();
    }
    onOpenChange(open);
  };

  const handleConfirmSelection = () => {
    const linkGroupId = confirmLinkSelection(linkGroupName || undefined, selectedColor || undefined);
    
    if (linkGroupId) {
      // Reset state
      setLinkGroupName('');
      setSelectedColor('');
      onOpenChange(false);
    }
  };

  const handleAddToExistingLink = (linkGroupId: string) => {
    addCardToLinkGroup(cardId, linkGroupId);
    onOpenChange(false);
  };

  const handleUnlink = () => {
    if (currentLinkGroup) {
      removeCardFromLinkGroup(cardId);
    }
    onOpenChange(false);
  };

  // Get available link groups (excluding the current one)
  const availableLinkGroups = Object.values(linkGroups).filter(
    group => group.id !== currentLinkGroup?.id
  );

  return (
    <Dialog open={open && !linkSelectionMode} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Card Links</DialogTitle>
            <DialogDescription>
              Link cards together to automatically sync their market selection
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Current Link Status */}
            {currentLinkGroup && (
              <div className="p-3 rounded-md border border-border bg-accent/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full border-2 border-border"
                      style={{ backgroundColor: currentLinkGroup.color }}
                    />
                    <span className="text-sm font-medium">
                      {currentLinkGroup.name || 'Linked Group'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUnlink}
                    className="h-7 px-2 text-xs"
                  >
                    <Unlink className="h-3 w-3 mr-1" />
                    Unlink
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Linked with {linkedCardIds.length} other card{linkedCardIds.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            {/* Create New Link Group */}
            {!currentLinkGroup && (
              <div className="space-y-3">
                <div className="text-sm font-medium">Create New Link</div>
                
                <div className="text-xs text-muted-foreground mb-3">
                  Click the button below to start selecting cards on the screen
                </div>
                <Button
                  onClick={handleStartSelection}
                  className="w-full"
                  size="sm"
                >
                  <Link2 className="h-3 w-3 mr-2" />
                  Start Selecting Cards
                </Button>
              </div>
            )}

            {/* Add to Existing Link Group */}
            {!currentLinkGroup && availableLinkGroups.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="text-sm font-medium">Add to Existing Link</div>
                <div className="space-y-2">
                  {availableLinkGroups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => handleAddToExistingLink(group.id)}
                      className="w-full flex items-center justify-between p-2 rounded-md border border-border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border-2 border-border"
                          style={{ backgroundColor: group.color }}
                        />
                        <span className="text-xs">
                          {group.name || 'Unnamed Group'} ({group.cardIds.length} cards)
                        </span>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
  );
}

