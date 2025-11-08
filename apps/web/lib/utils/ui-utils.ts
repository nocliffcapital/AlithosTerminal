import { type ClassValue, cn } from './utils';

/**
 * Spacing utilities for consistent spacing across cards
 */
export const spacing = {
  // Card content padding
  cardPadding: 'p-3',
  cardPaddingLarge: 'p-4',
  
  // Section spacing
  sectionSpacing: 'space-y-3',
  sectionSpacingLarge: 'space-y-4',
  
  // Gap spacing
  gapSmall: 'gap-2',
  gapMedium: 'gap-3',
  gapLarge: 'gap-4',
  
  // Header padding
  headerPadding: 'px-3 py-2',
  headerPaddingLarge: 'px-4 py-2.5',
} as const;

/**
 * Typography utilities for consistent text styling
 */
export const typography = {
  // Labels
  label: 'text-xs text-muted-foreground font-medium',
  labelSmall: 'text-[10px] text-muted-foreground font-medium',
  
  // Values
  value: 'text-sm font-semibold',
  valueSmall: 'text-xs font-semibold',
  valueMono: 'text-sm font-mono font-semibold',
  valueMonoSmall: 'text-xs font-mono font-semibold',
  
  // Headings
  heading: 'text-xs font-semibold',
  headingSmall: 'text-[10px] font-semibold',
  
  // Body text
  body: 'text-xs',
  bodySmall: 'text-[10px]',
  bodyMuted: 'text-xs text-muted-foreground',
  bodyMutedSmall: 'text-[10px] text-muted-foreground',
  
  // Monospace for numbers/prices
  mono: 'font-mono text-xs',
  monoSmall: 'font-mono text-[10px]',
} as const;

/**
 * Helper function to combine spacing classes
 */
export function getSpacingClasses(
  cardPadding?: 'default' | 'large',
  sectionSpacing?: 'default' | 'large',
  gap?: 'small' | 'medium' | 'large'
): string {
  const classes: string[] = [];
  
  if (cardPadding === 'large') {
    classes.push(spacing.cardPaddingLarge);
  } else {
    classes.push(spacing.cardPadding);
  }
  
  if (sectionSpacing === 'large') {
    classes.push(spacing.sectionSpacingLarge);
  } else {
    classes.push(spacing.sectionSpacing);
  }
  
  if (gap === 'small') {
    classes.push(spacing.gapSmall);
  } else if (gap === 'large') {
    classes.push(spacing.gapLarge);
  } else {
    classes.push(spacing.gapMedium);
  }
  
  return cn(classes);
}

/**
 * Helper function to combine typography classes
 */
export function getTypographyClasses(
  type: keyof typeof typography,
  ...additionalClasses: ClassValue[]
): string {
  return cn(typography[type], ...additionalClasses);
}

