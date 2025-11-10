'use client';

import { useState } from 'react';
import { Plus, Lock, Star } from 'lucide-react';
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
} from './ui/dropdown-menu';
import { cardCategories, CardCategory, getCardInfo } from '@/lib/card-categories';

export function AddCardButton() {
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

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={isLocked} title={isLocked ? 'Workspace is locked' : 'Add Card'}>
          {isLocked ? (
            <>
              <Lock className="h-4 w-4 mr-2" />
              Locked
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add Card
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      {!isLocked && (
        <DropdownMenuContent align="start" className="w-64">
          {/* Favourites section */}
          {favouriteCardTypes.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Favourites
              </div>
              {favouriteCardTypes.map((type) => {
                const cardInfo = getCardInfo(type);
                if (!cardInfo) return null;
                
                return (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => handleAddCard(type)}
                    className="cursor-pointer"
                  >
                    <Star 
                      className="h-3.5 w-3.5 mr-2 fill-yellow-500 text-yellow-500 cursor-pointer" 
                      onClick={(e) => handleToggleFavourite(e, type)}
                    />
                    {cardInfo.label}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
            </>
          )}
          
          {/* Categories */}
          {categoryOrder.map((category, categoryIndex) => {
            const categoryCards = cardCategories[category];
            if (!categoryCards) return null;
            const cards = categoryCards.filter(({ type }) => !isFavouriteCardType(type));
            if (cards.length === 0) return null;
            
            return (
              <div key={category}>
                {categoryIndex > 0 && <DropdownMenuSeparator />}
                {cards.length === 1 ? (
                  <DropdownMenuItem
                    onClick={() => handleAddCard(cards[0].type)}
                    className="cursor-pointer flex items-center justify-between group"
                  >
                    <span>{cards[0].label}</span>
                    <Star
                      className={`h-3.5 w-3.5 ml-2 cursor-pointer ${
                        isFavouriteCardType(cards[0].type)
                          ? 'fill-yellow-500 text-yellow-500'
                          : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => handleToggleFavourite(e, cards[0].type)}
                    />
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      {category}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {cards.map(({ type, label }) => (
                        <DropdownMenuItem
                          key={type}
                          onClick={() => handleAddCard(type)}
                          className="cursor-pointer flex items-center justify-between group"
                        >
                          <span>{label}</span>
                          <Star
                            className={`h-3.5 w-3.5 ml-2 cursor-pointer ${
                              isFavouriteCardType(type)
                                ? 'fill-yellow-500 text-yellow-500'
                                : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                            }`}
                            onClick={(e) => handleToggleFavourite(e, type)}
                          />
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
              </div>
            );
          })}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}

