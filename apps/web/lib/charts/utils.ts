import { ColorType, IChartApi, ISeriesApi, LineStyleOptions, Time } from 'lightweight-charts';

/**
 * Chart theme configuration matching the design system
 */
export const chartTheme = {
  layout: {
    background: { type: ColorType.Solid, color: '#0A0A0A' }, // --background
    textColor: '#E5E7EB', // --muted-foreground (light gray)
  },
  grid: {
    vertLines: {
      color: 'rgba(34, 34, 34, 0.2)', // Subtle grid lines matching --border
      style: 2, // Dotted
    },
    horzLines: {
      color: 'rgba(34, 34, 34, 0.2)',
      style: 2, // Dotted
    },
  },
  rightPriceScale: {
    borderColor: 'rgba(34, 34, 34, 0.5)',
    textColor: '#B3B3B3', // --muted-foreground
    fontSize: 11,
  },
  timeScale: {
    borderColor: 'rgba(34, 34, 34, 0.5)',
    textColor: '#B3B3B3', // --muted-foreground
    fontSize: 10,
  },
  crosshair: {
    mode: 1, // Normal mode
    vertLine: {
      color: '#666666',
      width: 1,
      style: 0, // Solid
    } as any,
    horzLine: {
      color: '#666666',
      width: 1,
      style: 0, // Solid
    } as any,
  },
};

/**
 * Chart color constants matching current implementation
 */
export const chartColors = {
  yes: '#3b82f6', // Blue
  no: '#ca8a04', // Dark Yellow
  multiOutcome: [
    '#10b981', // green
    '#ef4444', // red
    '#3b82f6', // blue
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#6366f1', // indigo
  ],
  depthBid: '#22c55e', // Green for bids
  depthAsk: '#ef4444', // Red for asks
};

/**
 * Line series styling options
 */
export const lineSeriesOptions: Partial<LineStyleOptions> = {
  lineWidth: 2,
  color: chartColors.yes,
  lineVisible: true,
  crosshairMarkerVisible: true,
  crosshairMarkerRadius: 4,
};

/**
 * Convert timestamp from milliseconds to Unix timestamp (seconds)
 */
export function timestampToUnixSeconds(timestamp: number): Time {
  return Math.floor(timestamp / 1000) as Time;
}

/**
 * Convert Unix timestamp (seconds) to milliseconds
 */
export function unixSecondsToTimestamp(time: Time): number {
  return Number(time) * 1000;
}

/**
 * Format date based on time range for axis labels
 */
export function formatDateForTimeRange(
  timestamp: number,
  timeRange: '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL',
  timeSpan?: number
): string {
  const date = new Date(timestamp);
  
  switch (timeRange) {
    case '1H':
    case '6H': {
      if (timeSpan && timeSpan <= 10 * 60 * 1000) {
        // Very short span: show seconds
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      }
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    case '1D':
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    case '1W':
    case '1M':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    case 'ALL':
    default: {
      const formatOptions: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
      };
      if (timeSpan && timeSpan > 365 * 24 * 60 * 60 * 1000) {
        formatOptions.year = 'numeric';
      }
      return date.toLocaleDateString('en-US', formatOptions);
    }
  }
}

/**
 * Convert Recharts data format to Lightweight Charts format
 */
export interface RechartsDataPoint {
  date: string;
  [key: string]: string | number;
}

export interface LightweightChartDataPoint {
  time: Time;
  value: number;
}

/**
 * Convert Recharts data to Lightweight Charts format
 * Handles both YES/NO and multi-outcome formats
 */
export function convertRechartsToLightweight(
  data: RechartsDataPoint[],
  dataKey: string,
  timestampKey?: string
): LightweightChartDataPoint[] {
  return data
    .map((point) => {
      // Try to get timestamp from point (if it has _timestamp)
      let timestamp: number;
      if (timestampKey && point[timestampKey]) {
        timestamp = point[timestampKey] as number;
      } else if ((point as any)._timestamp) {
        timestamp = (point as any)._timestamp;
      } else {
        // Fallback: try to parse date string
        const date = new Date(point.date);
        if (isNaN(date.getTime())) {
          return null;
        }
        timestamp = date.getTime();
      }

      const value = point[dataKey];
      if (typeof value !== 'number' || isNaN(value)) {
        return null;
      }

      return {
        time: timestampToUnixSeconds(timestamp),
        value,
      };
    })
    .filter((point): point is LightweightChartDataPoint => point !== null);
}

/**
 * Convert historical price data (from API) to Lightweight Charts format
 */
export interface HistoricalPrice {
  timestamp: number; // milliseconds
  price: number; // 0-1
  probability?: number; // 0-100
}

export function convertHistoricalPricesToLightweight(
  prices: HistoricalPrice[]
): LightweightChartDataPoint[] {
  return prices
    .map((price) => {
      // Ensure we have a valid timestamp
      if (!price.timestamp || isNaN(price.timestamp)) {
        return null;
      }
      
      // Calculate probability value - prefer probability field, fallback to price * 100
      let value: number;
      if (price.probability != null && !isNaN(price.probability) && isFinite(price.probability)) {
        // Use probability field directly (should already be 0-100)
        value = price.probability;
      } else if (price.price != null && !isNaN(price.price) && isFinite(price.price)) {
        // Convert price from decimal (0-1) to percentage (0-100)
        // Price should always be in 0-1 format from the API
        value = price.price * 100;
      } else {
        return null; // Skip invalid data points
      }
      
      // Clamp value to 0-100 range (probabilities should be percentages)
      // This ensures we never show values outside the valid probability range
      value = Math.max(0, Math.min(100, value));
      
      return {
        time: timestampToUnixSeconds(price.timestamp),
        value,
      };
    })
    .filter((point): point is LightweightChartDataPoint => point !== null);
}

/**
 * Get color for multi-outcome market by index
 */
export function getMultiOutcomeColor(index: number): string {
  return chartColors.multiOutcome[index % chartColors.multiOutcome.length];
}

/**
 * Create a custom tooltip element
 */
export function createCustomTooltip(): HTMLElement {
  const tooltip = document.createElement('div');
  tooltip.className = 'lwc-tooltip';
  tooltip.style.cssText = `
    position: absolute;
    z-index: 1000;
    pointer-events: none;
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-radius: 0;
    padding: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    font-size: 12px;
    color: hsl(var(--foreground));
  `;
  return tooltip;
}

/**
 * Update tooltip content
 */
export function updateTooltip(
  tooltip: HTMLElement,
  title: string,
  values: Array<{ label: string; value: number; color: string }>
): void {
  tooltip.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 8px; color: hsl(var(--foreground));">${title}</div>
    ${values
      .map(
        (v) =>
          `<div style="margin: 2px 0; color: ${v.color};">${v.label}: ${v.value.toFixed(2)}%</div>`
      )
      .join('')}
  `;
}

/**
 * Position tooltip near crosshair
 */
export function positionTooltip(
  tooltip: HTMLElement,
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number
): void {
  const tooltipWidth = tooltip.offsetWidth || 150;
  const tooltipHeight = tooltip.offsetHeight || 100;
  
  // Position to the right of crosshair, but ensure it fits in viewport
  let left = x + 20;
  let top = y - tooltipHeight / 2;
  
  // Adjust if tooltip goes off right edge
  if (left + tooltipWidth > containerWidth) {
    left = x - tooltipWidth - 20;
  }
  
  // Adjust if tooltip goes off top/bottom
  if (top < 0) {
    top = 10;
  } else if (top + tooltipHeight > containerHeight) {
    top = containerHeight - tooltipHeight - 10;
  }
  
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

