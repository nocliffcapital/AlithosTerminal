/**
 * Mobile utilities for responsive design
 */

/**
 * Check if device is mobile
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/**
 * Check if device is tablet
 */
export function isTablet(): boolean {
  if (typeof window === 'undefined') return false;
  const width = window.innerWidth;
  return width >= 768 && width < 1024;
}

/**
 * Check if device is desktop
 */
export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 1024;
}

/**
 * Get current breakpoint
 */
export function getBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  if (isMobile()) return 'mobile';
  if (isTablet()) return 'tablet';
  return 'desktop';
}

/**
 * Mobile-specific responsive classes
 */
export const mobileClasses = {
  container: 'px-2 sm:px-4 md:px-6',
  card: 'p-2 sm:p-3 md:p-4',
  text: {
    xs: 'text-[10px] sm:text-xs',
    sm: 'text-xs sm:text-sm',
    base: 'text-sm sm:text-base',
    lg: 'text-base sm:text-lg',
  },
  button: {
    sm: 'h-6 px-2 text-xs sm:h-7 sm:px-3',
    base: 'h-8 px-3 text-sm sm:h-9 sm:px-4',
    lg: 'h-10 px-4 text-base sm:h-11 sm:px-5',
  },
  grid: {
    cols2: 'grid-cols-1 sm:grid-cols-2',
    cols3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    cols4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
  },
  spacing: {
    gap: 'gap-2 sm:gap-4',
    gapSmall: 'gap-1 sm:gap-2',
    gapLarge: 'gap-4 sm:gap-6',
  },
};

/**
 * Hook to use mobile utilities
 */
export function useMobile() {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      breakpoint: 'desktop' as const,
    };
  }

  return {
    isMobile: window.innerWidth < 768,
    isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024,
    breakpoint: getBreakpoint(),
  };
}

