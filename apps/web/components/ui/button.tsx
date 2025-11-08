import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 active:bg-primary/95 shadow-md',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/20 active:bg-destructive/95 shadow-md',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-border hover:shadow-sm active:bg-accent/80',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:shadow-md hover:shadow-secondary/10 active:bg-secondary/95 shadow-sm',
        ghost: 'hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
        link: 'text-primary underline-offset-4 hover:underline hover:text-primary/80',
        subtle: 'bg-accent/50 text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/90',
        buy: 'bg-green-600 text-white hover:bg-green-600/90 hover:shadow-lg hover:shadow-green-600/20 active:bg-green-600/95 shadow-md border border-green-600',
        sell: 'bg-red-600 text-white hover:bg-red-600/90 hover:shadow-lg hover:shadow-red-600/20 active:bg-red-600/95 shadow-md border border-red-600',
      },
      size: {
        default: 'h-10 px-4 py-2 text-sm',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-8 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };

