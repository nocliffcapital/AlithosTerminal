'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 p-6 text-center', className)}>
      {Icon && (
        <Icon className="h-10 w-10 text-muted-foreground/50" />
      )}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className="mt-2 text-xs"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

