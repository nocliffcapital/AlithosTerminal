'use client';

import React, { useEffect } from 'react';
import { useToastStore, Toast as ToastType } from '@/stores/toast-store';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Individual toast component
 */
function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useToastStore((state) => state.removeToast);

  // Auto-dismiss after duration
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        removeToast(toast.id);
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.duration, toast.id, removeToast]);

  const iconMap = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const colorMap = {
    success: 'bg-green-500/10 border-green-500/20 text-green-400',
    error: 'bg-red-500/10 border-red-500/20 text-red-400',
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  };

  const iconColorMap = {
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400',
  };

  const Icon = iconMap[toast.type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border shadow-lg backdrop-blur-sm min-w-[300px] max-w-[400px]',
        colorMap[toast.type],
        'animate-in slide-in-from-right-full fade-in-0 duration-300'
      )}
    >
      <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconColorMap[toast.type])} />
      
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{toast.title}</div>
        {toast.description && (
          <div className="text-xs mt-1 opacity-90">{toast.description}</div>
        )}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              removeToast(toast.id);
            }}
            className="mt-2 text-xs font-medium underline hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 p-1 hover:bg-background/20 rounded transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Toast container component
 * Renders all active toasts
 */
export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}

/**
 * Hook to show toast notifications
 */
export function useToast() {
  const addToast = useToastStore((state) => state.addToast);

  const toast = React.useCallback(
    (toast: Omit<ToastType, 'id'>) => {
      return addToast(toast);
    },
    [addToast]
  );

  // Convenience methods
  const success = React.useCallback(
    (title: string, description?: string, options?: Partial<Omit<ToastType, 'id' | 'type' | 'title' | 'description'>>) => {
      return toast({ type: 'success', title, description, ...options });
    },
    [toast]
  );

  const error = React.useCallback(
    (title: string, description?: string, options?: Partial<Omit<ToastType, 'id' | 'type' | 'title' | 'description'>>) => {
      return toast({ type: 'error', title, description, ...options });
    },
    [toast]
  );

  const warning = React.useCallback(
    (title: string, description?: string, options?: Partial<Omit<ToastType, 'id' | 'type' | 'title' | 'description'>>) => {
      return toast({ type: 'warning', title, description, ...options });
    },
    [toast]
  );

  const info = React.useCallback(
    (title: string, description?: string, options?: Partial<Omit<ToastType, 'id' | 'type' | 'title' | 'description'>>) => {
      return toast({ type: 'info', title, description, ...options });
    },
    [toast]
  );

  return {
    toast,
    success,
    error,
    warning,
    info,
  };
}

