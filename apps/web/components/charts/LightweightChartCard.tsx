'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, LineSeriesPartialOptions, LineStyleOptions, Time, LineSeries } from 'lightweight-charts';
import { chartTheme, chartColors, lineSeriesOptions, convertHistoricalPricesToLightweight, LightweightChartDataPoint, createCustomTooltip, updateTooltip, positionTooltip } from '@/lib/charts/utils';

export interface SeriesData {
  data: LightweightChartDataPoint[];
  color: string;
  label: string;
  marketId?: string; // Optional marketId for toggling visibility
}

interface LightweightChartCardProps {
  series: SeriesData[];
  height?: number;
  className?: string;
  showLabels?: boolean; // Show outcome names on last data point
  onCrosshairMove?: (point: { time: Time; values: Record<string, number> } | null) => void;
  timeRange?: '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL'; // Timeframe to auto-adjust chart view
  showLegend?: boolean; // Control legend visibility (default: true)
  onToggleMarket?: (marketId: string) => void; // Callback to toggle market visibility
  hiddenMarketIds?: Set<string>; // Set of hidden market IDs
  allMarketsSeriesData?: SeriesData[]; // All markets data for legend (including hidden)
}

export function LightweightChartCard({
  series,
  height,
  className = '',
  showLabels = false,
  onCrosshairMove,
  timeRange = '1W',
  showLegend = true,
  onToggleMarket,
  hiddenMarketIds = new Set(),
  allMarketsSeriesData,
}: LightweightChartCardProps) {
  const [isLegendMinimized, setIsLegendMinimized] = useState(true);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Auto-minimize legend if more than 10 series
  useEffect(() => {
    if (series.length > 10) {
      setIsLegendMinimized(true);
    }
  }, [series.length]);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const tooltipRef = useRef<HTMLElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Wait for container to have dimensions
    const initChart = () => {
      if (!chartContainerRef.current) return;
      
      const width = chartContainerRef.current.clientWidth;
      const heightValue = height || chartContainerRef.current.clientHeight;
      
      // If container has no dimensions, wait a bit
      if (width === 0 || heightValue === 0) {
        // Use requestAnimationFrame to wait for layout
        requestAnimationFrame(() => {
          initChart();
        });
        return;
      }

      try {
        const chart = createChart(chartContainerRef.current, {
          ...chartTheme,
          width: width,
          height: heightValue,
          autoSize: false, // Explicitly set to false when providing width/height
          rightPriceScale: {
            ...chartTheme.rightPriceScale,
            autoScale: true, // Enable auto-scaling for probability charts
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
          },
          timeScale: {
            ...chartTheme.timeScale,
            // Don't fix edges - let the chart auto-scale
            fixLeftEdge: false,
            fixRightEdge: false,
            // Reduce minBarSpacing to allow showing more data points
            // Very small value allows all data points to be visible
            minBarSpacing: 0.001, // Allow maximum data points to be visible
          },
        });

            chartRef.current = chart;
            
            // Ensure chart is fully initialized before setting ready
            // Use a small delay to ensure the chart instance is complete
            requestAnimationFrame(() => {
              if (chartRef.current && typeof chartRef.current.addSeries === 'function') {
                // Configure time scale to not default to recent data
                // This helps ensure we show all data from start
                // Wrap in try-catch to handle any initialization timing issues
                try {
                  const timeScale = chartRef.current.timeScale();
                  if (timeScale) {
                    // Disable right bar margin to prevent defaulting to recent data
                    timeScale.applyOptions({
                      rightOffset: 0,
                      fixRightEdge: false,
                      fixLeftEdge: false,
                    });
                  }
                } catch (error) {
                  // If time scale isn't ready yet, that's okay - we'll set it later when data is available
                  console.warn('[LightweightChartCard] Time scale not ready during initialization:', error);
                }
                setIsReady(true);
              } else {
                // Retry if not ready
                setTimeout(() => {
                  if (chartRef.current && typeof chartRef.current.addSeries === 'function') {
                    try {
                      const timeScale = chartRef.current.timeScale();
                      if (timeScale) {
                        timeScale.applyOptions({
                          rightOffset: 0,
                          fixRightEdge: false,
                          fixLeftEdge: false,
                        });
                      }
                    } catch (error) {
                      console.warn('[LightweightChartCard] Time scale not ready during retry:', error);
                    }
                    setIsReady(true);
                  }
                }, 100);
              }
            });
      } catch (error) {
        console.error('[LightweightChartCard] Error creating chart:', error);
      }
    };

    // Start initialization
    initChart();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: height || chartContainerRef.current.clientHeight,
          autoSize: false, // Explicitly set to false when providing width/height
        });
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (chartContainerRef.current) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(chartContainerRef.current);
    }

    // Cleanup
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      setIsReady(false);
    };
  }, [height]);

  // OPTIMIZATION: Memoize price scale calculations to prevent recalculation on every render
  const priceScaleConfig = useMemo(() => {
    const hasData = series.some(s => s.data.length > 0);
    if (!hasData) return null;
    
    const allValues = series.flatMap(s => s.data.map(d => d.value)).filter(v => !isNaN(v) && v != null);
    if (allValues.length === 0) return null;
    
    // Calculate min and max from data
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    
    // Validate values
    if (isNaN(minValue) || isNaN(maxValue) || !isFinite(minValue) || !isFinite(maxValue)) {
      return null; // Will use autoScale fallback
    }
    
    const range = maxValue - minValue;
    
    // Adaptive padding based on value range
    let increment: number;
    if (range <= 0.05) {
      increment = 0.005;
    } else if (range <= 0.1) {
      increment = 0.01;
    } else if (range <= 0.5) {
      increment = 0.05;
    } else if (range <= 1) {
      increment = 0.1;
    } else if (range <= 5) {
      increment = 0.5;
    } else if (range <= 10) {
      increment = 1;
    } else {
      increment = 5;
    }
    
    // Add padding: round down min and round up max to nearest increment
    const paddedMin = Math.max(0, Math.floor(minValue / increment) * increment);
    const paddedMax = Math.ceil(maxValue / increment) * increment;
    
    // Add exactly 10% padding on each direction
    const padding = range * 0.1;
    const finalMin = Math.max(0, paddedMin - padding);
    const finalMax = paddedMax + padding;
    
    return { min: finalMin, max: finalMax };
  }, [series]);

  // Create/update series when data changes
  useEffect(() => {
    if (!chartRef.current || !isReady) {
      return;
    }
    
    // Double-check that chart has the addSeries method
    if (!chartRef.current || typeof chartRef.current.addSeries !== 'function') {
      return;
    }

    // Remove old series that are no longer in the new series list
    const currentLabels = new Set(series.map(s => s.label));
    seriesRefs.current.forEach((seriesInstance, label) => {
      if (!currentLabels.has(label)) {
        try {
          chartRef.current?.removeSeries(seriesInstance);
        } catch (error) {
          console.error('[LightweightChartCard] Error removing series:', error);
        }
        seriesRefs.current.delete(label);
      }
    });

    // Create or update series
    series.forEach((seriesData) => {
      let seriesInstance = seriesRefs.current.get(seriesData.label);

      if (!seriesInstance) {
        try {
          // Create new series - use addSeries with LineSeries class
          // In v5, addSeries takes the series type class as first param
          seriesInstance = chartRef.current!.addSeries(LineSeries, {
            ...lineSeriesOptions,
            color: seriesData.color,
          }) as ISeriesApi<'Line'>;
          if (seriesInstance) {
            seriesRefs.current.set(seriesData.label, seriesInstance);
          } else {
            // Only log errors, not warnings
            if (typeof window !== 'undefined' && !(window as any).__chart_series_error_logged) {
              (window as any).__chart_series_error_logged = true;
              console.error(`[LightweightChartCard] Failed to create series for ${seriesData.label}`);
            }
            return;
          }
        } catch (error) {
          // Only log errors once per session
          if (typeof window !== 'undefined' && !(window as any).__chart_series_error_logged) {
            (window as any).__chart_series_error_logged = true;
            console.error('[LightweightChartCard] Error creating series:', error);
          }
          return;
        }
      }

      // Update series data
      try {
        if (seriesData.data.length > 0 && seriesInstance) {
          // Sort data by time to ensure proper rendering
          const sortedData = [...seriesData.data].sort((a, b) => Number(a.time) - Number(b.time));
          
          // Remove duplicate timestamps - keep the last value for each timestamp
          const seenTimes = new Map<number, LightweightChartDataPoint>();
          
          for (const point of sortedData) {
            const time = Number(point.time);
            // Keep the last occurrence of each timestamp
            seenTimes.set(time, point);
          }
          
          // Convert map back to array and sort again (in case map iteration order differs)
          const finalData = Array.from(seenTimes.values()).sort((a, b) => Number(a.time) - Number(b.time));
          
          seriesInstance.setData(finalData);
        } else {
          if (seriesInstance) {
            seriesInstance.setData([]);
          }
        }
      } catch (error) {
        // Only log errors once per session
        if (typeof window !== 'undefined' && !(window as any).__chart_data_error_logged) {
          (window as any).__chart_data_error_logged = true;
          console.error('[LightweightChartCard] Error setting series data:', error);
        }
      }
    });
  }, [series, isReady]);

  // Apply memoized price scale config
  useEffect(() => {
    if (!chartRef.current || !isReady) return;
    
    if (priceScaleConfig) {
      // Set price scale with calculated range
      try {
        const priceScale = chartRef.current.priceScale('right');
        if (!priceScale) {
          return;
        }
        
        // Disable auto-scale and set the visible price range
        priceScale.applyOptions({
          autoScale: false,
          visible: true,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        });
        
        // Set the visible price range using setVisibleRange
        try {
          priceScale.setVisibleRange({
            from: priceScaleConfig.min,
            to: priceScaleConfig.max,
          });
        } catch (rangeError) {
          // If setting range fails, fallback to autoScale
          console.warn('[LightweightChartCard] Could not set price scale range (using autoScale):', rangeError);
          priceScale.applyOptions({
            autoScale: true,
            visible: true,
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
          });
        }
      } catch (error) {
        console.error('[LightweightChartCard] Error setting price scale range:', error);
        // Fallback to autoScale if setting range fails
        try {
          const priceScale = chartRef.current.priceScale('right');
          if (priceScale) {
            priceScale.applyOptions({
              autoScale: true,
              visible: true,
              scaleMargins: {
                top: 0.1,
                bottom: 0.1,
              },
            });
          }
        } catch (fallbackError) {
          console.warn('[LightweightChartCard] Error in price scale fallback:', fallbackError);
        }
      }
    } else {
      // If no data or invalid config, set default 0-100 range with autoScale
      try {
        const priceScale = chartRef.current.priceScale('right');
        if (priceScale) {
          priceScale.applyOptions({
            autoScale: true,
            visible: true,
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
          });
        }
      } catch (error) {
        console.warn('[LightweightChartCard] Error setting default price scale:', error);
      }
    }
  }, [isReady, priceScaleConfig]);

  // Track if user has manually interacted with the chart (scrolled/zoomed)
  const userInteractedRef = useRef(false);
  const previousTimeRangeRef = useRef(timeRange);
  const isUpdatingRef = useRef(false);
  
  // Calculate visible range based on timeframe
  const calculateVisibleRange = useCallback((times: number[], range: typeof timeRange): { from: Time; to: Time } | null => {
    if (times.length === 0) return null;
    
    const sortedTimes = [...times].sort((a, b) => a - b);
    const firstTime = sortedTimes[0];
    const lastTime = sortedTimes[sortedTimes.length - 1];
    
    // Check for valid numbers (0 is a valid timestamp, so we check for NaN/undefined)
    if (firstTime == null || lastTime == null || isNaN(firstTime) || isNaN(lastTime)) return null;
    
    // Calculate seconds to show based on timeframe
    let secondsToShow: number;
    switch (range) {
      case '1H':
        secondsToShow = 3600; // 1 hour
        break;
      case '6H':
        secondsToShow = 6 * 3600; // 6 hours
        break;
      case '1D':
        secondsToShow = 24 * 3600; // 1 day
        break;
      case '1W':
        secondsToShow = 7 * 24 * 3600; // 1 week
        break;
      case '1M':
        secondsToShow = 30 * 24 * 3600; // 1 month
        break;
      case 'ALL':
      default:
        // Show all data with small padding
        const timeSpan = lastTime - firstTime;
        const padding = Math.max(timeSpan * 0.02, 300); // 2% padding or 5 minutes minimum
        return {
          from: (firstTime - padding) as Time,
          to: (lastTime + padding) as Time,
        };
    }
    
    // For fixed timeframes, show the most recent data
    const visibleTo = lastTime;
    const visibleFrom = Math.max(firstTime, visibleTo - secondsToShow);
    
    // Add small padding
    const padding = Math.min(secondsToShow * 0.02, 300); // 2% padding or 5 minutes max
    
    return {
      from: (visibleFrom - padding) as Time,
      to: (visibleTo + padding) as Time,
    };
  }, []);
  
  // Separate effect to update time scale ONLY when timeframe changes or on initial load
  // This ensures the chart auto-adjusts when timeframe changes, but allows scrolling after that
  useEffect(() => {
    if (!chartRef.current || !isReady || isUpdatingRef.current) return;
    
    const allData = series.flatMap(s => s.data);
    if (allData.length === 0) return;
    
    // Check if timeframe changed - only update if it did
    const timeframeChanged = previousTimeRangeRef.current !== timeRange;
    
    // If user has interacted and timeframe hasn't changed, don't auto-adjust
    // This allows users to scroll/pan freely without interference
    if (userInteractedRef.current && !timeframeChanged) {
      return;
    }
    
    // Reset interaction flag when timeframe changes (allows auto-adjust)
    if (timeframeChanged) {
      userInteractedRef.current = false;
      previousTimeRangeRef.current = timeRange;
    }
    
    const times = allData.map(d => Number(d.time)).filter(t => !isNaN(t) && t != null);
    if (times.length === 0) return;
    
    const visibleRange = calculateVisibleRange(times, timeRange);
    
    if (!visibleRange) return;
    
    // Set flag to prevent re-entry during update
    isUpdatingRef.current = true;
    
    // Use a timeout to debounce and prevent infinite loops
    const timeoutId = setTimeout(() => {
      try {
        // Double-check chart is still available
        if (!chartRef.current) {
          isUpdatingRef.current = false;
          return;
        }
        
        const timeScale = chartRef.current.timeScale();
        if (!timeScale) {
          isUpdatingRef.current = false;
          return;
        }
        
        // Double-check that visibleRange is valid before using it
        if (!visibleRange || 
            visibleRange.from == null || 
            visibleRange.to == null ||
            isNaN(Number(visibleRange.from)) ||
            isNaN(Number(visibleRange.to))) {
          isUpdatingRef.current = false;
          return;
        }
        
        // Ensure we have at least one series with data before setting visible range
        const hasSeriesWithData = series.some(s => s.data.length > 0);
        if (!hasSeriesWithData) {
          isUpdatingRef.current = false;
          return;
        }
        
        // Only set visible range if timeframe changed or user hasn't interacted yet
        // This prevents resetting the view when user has scrolled away
        if (!userInteractedRef.current || timeframeChanged) {
          // Set visible range based on timeframe - this is the initial zoom
          // User can then scroll to see more data
          // Wrap in try-catch to handle any timing issues
          try {
            timeScale.setVisibleRange(visibleRange);
          } catch (rangeError) {
            // If setting range fails, it might be because chart isn't ready yet
            // Log but don't throw - this can happen during initialization
            console.warn('[LightweightChartCard] Could not set visible range (chart may not be ready):', rangeError);
          }
        }
        // Suppress debug logs to reduce console noise
      } catch (error) {
        console.error('[LightweightChartCard] Error setting visible range:', error);
      } finally {
        // Reset flag after a short delay to allow chart to update
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 200);
      }
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      isUpdatingRef.current = false;
    };
  }, [series, isReady, timeRange, calculateVisibleRange]); // Keep series to detect when data is available, but only set range when timeRange changes
  
  // Track user interactions to prevent resetting visible range
  // This allows users to scroll/zoom without interference
  useEffect(() => {
    if (!chartRef.current || !isReady) return;
    
    // Ensure chart is fully initialized before accessing time scale
    let timeScale: ReturnType<typeof chartRef.current.timeScale> | null = null;
    try {
      timeScale = chartRef.current.timeScale();
    } catch (error) {
      console.warn('[LightweightChartCard] Could not access time scale:', error);
      return;
    }
    
    if (!timeScale) return;
    
    // Track mouse down events to detect user scrolling/zooming
    let mouseDown = false;
    
    const handleMouseDown = () => {
      mouseDown = true;
      userInteractedRef.current = true;
    };
    
    const handleMouseUp = () => {
      mouseDown = false;
    };
    
    // Subscribe to visible range changes to detect user interactions
    // This fires when user scrolls or zooms
    let interactionTimeout: NodeJS.Timeout | null = null;
    const handleVisibleRangeChange = () => {
      // Don't mark as user interaction if we're programmatically updating
      if (isUpdatingRef.current) {
        return;
      }
      
      // If user has interacted with the chart, mark it
      // Small delay to avoid false positives from initial set
      if (!userInteractedRef.current) {
        if (interactionTimeout) {
          clearTimeout(interactionTimeout);
        }
        interactionTimeout = setTimeout(() => {
          userInteractedRef.current = true;
        }, 500);
      }
    };
    
    // Add mouse event listeners to detect user interactions
    let chartContainer: HTMLElement | null = null;
    try {
      chartContainer = chartRef.current.chartElement();
      if (chartContainer) {
        chartContainer.addEventListener('mousedown', handleMouseDown);
        chartContainer.addEventListener('mouseup', handleMouseUp);
        chartContainer.addEventListener('wheel', () => {
          userInteractedRef.current = true;
        });
      }
    } catch (error) {
      console.warn('[LightweightChartCard] Could not access chart element:', error);
    }
    
    // Subscribe to visible range changes (this fires when user scrolls/zooms)
    try {
      // Note: subscribeVisibleTimeRangeChange doesn't return an unsubscribe function
      // The subscription is automatically cleaned up when the chart is removed
      timeScale.subscribeVisibleTimeRangeChange(handleVisibleRangeChange);
    } catch (error) {
      console.warn('[LightweightChartCard] Could not subscribe to visible range changes:', error);
    }
    
    return () => {
      if (chartContainer) {
        chartContainer.removeEventListener('mousedown', handleMouseDown);
        chartContainer.removeEventListener('mouseup', handleMouseUp);
      }
      if (interactionTimeout) {
        clearTimeout(interactionTimeout);
      }
    };
  }, [isReady]);

  // Setup tooltip
  useEffect(() => {
    if (!chartRef.current || !isReady) return;
    
    // Don't set up tooltip if there's no data
    const hasData = series.some(s => s.data.length > 0);
    if (!hasData) return;

    // Create tooltip element
    if (!tooltipRef.current) {
      tooltipRef.current = createCustomTooltip();
      if (chartContainerRef.current) {
        chartContainerRef.current.appendChild(tooltipRef.current);
      }
    }

    const tooltip = tooltipRef.current;
    let lastTime: Time | null = null;

    const handleCrosshairMove = (param: any) => {
      if (!param || !param.time || !param.point) {
        tooltip.style.display = 'none';
        if (onCrosshairMove) {
          onCrosshairMove(null);
        }
        lastTime = null;
        return;
      }

      const time = param.time as Time;
      const point = param.point;
      const values: Record<string, number> = {};

      // Get values from all series at this time
      // For multi-series charts, we need to get values from all series, not just what's in param.seriesData
      // param.seriesData only contains series with exact data points at the hovered time
      // We need to query each series to find the closest data point
      const timeNumber = Number(time);
      
      // Iterate through series in the order they appear (to match legend order)
      series.forEach((seriesData) => {
        const label = seriesData.label;
        const seriesInstance = seriesRefs.current.get(label);
        
        if (!seriesInstance) return;
        
        // First, try to get value from param.seriesData (if available)
        if (param.seriesData) {
          const data = param.seriesData.get(seriesInstance);
          if (data && typeof data === 'object' && 'value' in data) {
            values[label] = (data as any).value as number;
            return; // Found exact match, skip to next series
          }
        }
        
        // If not in param.seriesData, find the closest data point in this series
        if (seriesData.data.length > 0) {
          // Find the closest data point to the hovered time
          // Data should already be sorted by time, but we'll do a linear search for simplicity
          // For typical data sizes (hundreds to thousands of points), this is fast enough
          let closestPoint = seriesData.data[0];
          let minDiff = Math.abs(Number(closestPoint.time) - timeNumber);
          
          for (const dataPoint of seriesData.data) {
            const dataTime = Number(dataPoint.time);
            const diff = Math.abs(dataTime - timeNumber);
            if (diff < minDiff) {
              minDiff = diff;
              closestPoint = dataPoint;
              // If we found an exact match, we can break early
              if (minDiff === 0) break;
            }
          }
          
          // Use the closest point if it's reasonably close (within 1 hour for time series)
          // For time-based charts, we want to show values even if not exact
          if (minDiff < 3600) { // Within 1 hour
            values[label] = closestPoint.value;
          }
        }
      });

      if (Object.keys(values).length === 0) {
        tooltip.style.display = 'none';
        if (onCrosshairMove) {
          onCrosshairMove(null);
        }
        lastTime = null;
        return;
      }

      // Format time for display
      const timestamp = Number(time) * 1000;
      const date = new Date(timestamp);
      const timeString = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Update tooltip content - maintain series order
      // Build tooltip values in the same order as series to match legend
      const tooltipValues = series
        .filter(s => values.hasOwnProperty(s.label))
        .map(seriesData => ({
          label: seriesData.label,
          value: values[seriesData.label],
          color: seriesData.color,
        }));

      updateTooltip(tooltip, timeString, tooltipValues);

      // Position tooltip
      if (chartContainerRef.current) {
        positionTooltip(
          tooltip,
          point.x,
          point.y,
          chartContainerRef.current.clientWidth,
          chartContainerRef.current.clientHeight
        );
      }

      tooltip.style.display = 'block';
      lastTime = time;

      if (onCrosshairMove) {
        onCrosshairMove({ time, values });
      }
    };

    chartRef.current.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      if (tooltip && tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
      tooltipRef.current = null;
    };
  }, [series, isReady, onCrosshairMove]);

  // Add labels to last data point if enabled (using markers)
  // Note: Markers API might have changed in v5, commenting out for now to get basic chart working
  // TODO: Re-implement markers/labels using v5 API once basic chart is working
  // useEffect(() => {
  //   if (!chartRef.current || !isReady || !showLabels) return;
  //   // Implementation for v5 markers API
  // }, [series, isReady, showLabels]);

  return (
    <div
      ref={chartContainerRef}
      className={`w-full h-full ${className}`}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Legend - Bottom Left */}
      {showLegend && ((allMarketsSeriesData && allMarketsSeriesData.length > 0) || series.length > 0) && (
        <div
          className="absolute bottom-9 left-2.5 z-10"
        >
          <div className="bg-background/95 backdrop-blur-sm rounded border border-border/50 overflow-hidden">
            {/* Legend Toggle Button */}
            {((allMarketsSeriesData && allMarketsSeriesData.length > 10) || series.length > 10) && (
              <button
                onClick={() => setIsLegendMinimized(!isLegendMinimized)}
                className="w-full px-3 py-1.5 text-[0.5rem] text-muted-foreground hover:text-foreground flex items-center justify-between bg-accent/20 hover:bg-accent/30 transition-colors"
                title={isLegendMinimized ? 'Expand legend' : 'Collapse legend'}
              >
                <span className="font-mono">
                  Legend ({allMarketsSeriesData ? allMarketsSeriesData.length : series.length})
                </span>
                <span>{isLegendMinimized ? '▼' : '▲'}</span>
              </button>
            )}
            {/* Legend Items - show all markets (including hidden) */}
            {!isLegendMinimized && (
              <div className="px-3 py-2 flex flex-col gap-0.5 justify-end max-h-[300px] overflow-y-auto">
                {(allMarketsSeriesData || series).map((item, index) => {
                  const isHidden = item.marketId ? hiddenMarketIds.has(item.marketId) : false;
                  return (
                    <div
                      key={item.marketId || index}
                      className={`flex items-center gap-2 cursor-pointer hover:bg-accent/30 px-1 py-0.5 rounded transition-colors ${
                        isHidden ? 'opacity-40' : ''
                      }`}
                      onClick={() => {
                        if (item.marketId && onToggleMarket) {
                          onToggleMarket(item.marketId);
                        }
                      }}
                      title={isHidden ? 'Click to show' : 'Click to hide'}
                    >
                      <div
                        className="w-3 h-0.5 flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[0.525rem] text-muted-foreground font-mono truncate">
                        {item.label}
                      </span>
                      {isHidden && (
                        <span className="text-[0.5rem] text-muted-foreground/50 ml-auto">(hidden)</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logo Overlay - Top Left */}
      <div
        className="absolute top-2 left-2 pointer-events-none z-10"
        style={{ opacity: 0.072 }}
      >
        <img 
          src="https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreicizxxhlc64ifefhkv52bjbjjwgeuyt6qvrqlpg6f3gzofeayah6q"
          alt="Alithos Terminal"
          className="h-7 sm:h-9 w-auto"
          style={{ objectFit: 'contain' }}
        />
      </div>
    </div>
  );
}

