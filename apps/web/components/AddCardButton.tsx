'use client';

import { useState } from 'react';
import { 
  Plus, 
  Lock, 
  Star, 
  TrendingUp, 
  BarChart3, 
  Search, 
  Shield, 
  Zap, 
  Settings 
} from 'lucide-react';
import { useLayoutStore, CardType } from '@/stores/layout-store';
import { useWorkspaces } from '@/lib/hooks/useWorkspace';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './ui/dropdown-menu';
import { cardCategories, CardCategory, getCardInfo, getCardDescription } from '@/lib/card-categories';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface AddCardButtonProps {
  variant?: 'floating' | 'inline';
}

export function AddCardButton({ variant = 'floating' }: AddCardButtonProps = {}) {
  const { addCard, currentWorkspaceId } = useLayoutStore();
  const favouriteCardTypes = useLayoutStore((state) => state.favouriteCardTypes);
  const toggleFavouriteCardType = useLayoutStore((state) => state.toggleFavouriteCardType);
  const isFavouriteCardType = useLayoutStore((state) => state.isFavouriteCardType);
  const { data: workspaces = [] } = useWorkspaces();
  const [open, setOpen] = useState(false);

  const currentWorkspace = workspaces.find((w: any) => w.id === currentWorkspaceId);
  const isLocked = currentWorkspace?.locked || false;

  const handleAddCard = (type: CardType) => {
    if (isLocked) return;
    addCard({
      id: `card-${Date.now()}`,
      type,
    });
    setOpen(false);
  };

  const handleToggleFavourite = (e: React.MouseEvent, type: CardType) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavouriteCardType(type);
  };

  const categoryOrder: CardCategory[] = [
    'Trading',
    'Analysis',
    'Research',
    'Risk Management',
    'Automation',
    'Utilities',
  ];

  // Category icons mapping
  const categoryIcons: Record<CardCategory, typeof TrendingUp> = {
    'Trading': TrendingUp,
    'Analysis': BarChart3,
    'Research': Search,
    'Risk Management': Shield,
    'Automation': Zap,
    'Utilities': Settings,
  };

  return (
    <TooltipProvider>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button 
                variant={variant === 'inline' ? 'outline' : 'default'}
                size={variant === 'inline' ? 'sm' : 'lg'}
                className={variant === 'inline' 
                  ? `gap-2 ${
                      isLocked 
                        ? 'cursor-not-allowed opacity-50' 
                        : ''
                    }`
                  : `fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 ${
                      isLocked 
                        ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`
                }
                disabled={isLocked}
              >
                {isLocked ? (
                  <Lock className={variant === 'inline' ? 'h-3.5 w-3.5' : 'h-6 w-6'} />
                ) : (
                  <Plus className={variant === 'inline' ? 'h-3.5 w-3.5' : 'h-6 w-6'} />
                )}
                {variant === 'inline' && <span className="text-xs">Add Card</span>}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isLocked ? 'Workspace is locked' : 'Add Card'}</p>
          </TooltipContent>
        </Tooltip>
      {!isLocked && (
        <DropdownMenuContent align="start" className="w-72">
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Add Card</span>
            </div>
          </div>
          
          {/* Favourites section */}
          {favouriteCardTypes.length > 0 && (
            <>
              <div className="px-3 py-2">
                <DropdownMenuLabel className="px-0 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  Favourites
                </DropdownMenuLabel>
              </div>
              <div className="px-1">
                {favouriteCardTypes.map((type) => {
                  const cardInfo = getCardInfo(type);
                  if (!cardInfo) return null;
                  
                  return (
                    <Tooltip key={type} delayDuration={300}>
                      <TooltipTrigger asChild>
                        <DropdownMenuItem
                          onClick={() => handleAddCard(type)}
                          className="cursor-pointer flex items-center justify-between group px-2 py-2.5 rounded-md mx-1"
                          onPointerEnter={(e) => e.stopPropagation()}
                          onPointerLeave={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500 flex-shrink-0" />
                            <span className="text-sm truncate">{cardInfo.label}</span>
                          </div>
                          <Star
                            className="h-3.5 w-3.5 ml-2 fill-yellow-500 text-yellow-500 opacity-0 group-hover:opacity-100 cursor-pointer flex-shrink-0 transition-opacity"
                            onClick={(e) => handleToggleFavourite(e, type)}
                          />
                        </DropdownMenuItem>
                      </TooltipTrigger>
                      <TooltipContent side="right" align="start" sideOffset={8}>
                        <p className="max-w-xs">{getCardDescription(type)}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
              <DropdownMenuSeparator className="my-1 bg-border" />
            </>
          )}
          
          {/* Categories */}
          <div className="py-1">
            {categoryOrder.map((category, categoryIndex) => {
              const categoryCards = cardCategories[category];
              if (!categoryCards) return null;
              const cards = categoryCards.filter(({ type }) => !isFavouriteCardType(type));
              if (cards.length === 0) return null;
              
              const CategoryIcon = categoryIcons[category];
              
              return (
                <div key={category}>
                  {categoryIndex > 0 && <DropdownMenuSeparator className="my-1 bg-border" />}
                  {cards.length === 1 ? (
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <DropdownMenuItem
                          onClick={() => handleAddCard(cards[0].type)}
                          className="cursor-pointer flex items-center justify-between group px-2 py-2.5 rounded-md mx-1"
                          onPointerEnter={(e) => e.stopPropagation()}
                          onPointerLeave={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm truncate">{cards[0].label}</span>
                          </div>
                          <Star
                            className={`h-3.5 w-3.5 ml-2 cursor-pointer flex-shrink-0 transition-opacity ${
                              isFavouriteCardType(cards[0].type)
                                ? 'fill-yellow-500 text-yellow-500 opacity-100'
                                : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                            }`}
                            onClick={(e) => handleToggleFavourite(e, cards[0].type)}
                          />
                        </DropdownMenuItem>
                      </TooltipTrigger>
                      <TooltipContent side="right" align="start" sideOffset={8}>
                        <p className="max-w-xs">{getCardDescription(cards[0].type)}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="cursor-pointer px-2 py-2.5 rounded-md mx-1">
                        <div className="flex items-center gap-2">
                          <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{category}</span>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56">
                        {cards.map(({ type, label }) => (
                          <Tooltip key={type} delayDuration={300}>
                            <TooltipTrigger asChild>
                              <DropdownMenuItem
                                onClick={() => handleAddCard(type)}
                                className="cursor-pointer flex items-center justify-between group px-2 py-2.5 rounded-md"
                                onPointerEnter={(e) => e.stopPropagation()}
                                onPointerLeave={(e) => e.stopPropagation()}
                              >
                                <span className="text-sm flex-1 min-w-0 truncate">{label}</span>
                                <Star
                                  className={`h-3.5 w-3.5 ml-2 cursor-pointer flex-shrink-0 transition-opacity ${
                                    isFavouriteCardType(type)
                                      ? 'fill-yellow-500 text-yellow-500 opacity-100'
                                      : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                                  }`}
                                  onClick={(e) => handleToggleFavourite(e, type)}
                                />
                              </DropdownMenuItem>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="start" sideOffset={8}>
                              <p className="max-w-xs">{getCardDescription(type)}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                </div>
              );
            })}
          </div>
        </DropdownMenuContent>
      )}
      </DropdownMenu>
    </TooltipProvider>
  );
}

