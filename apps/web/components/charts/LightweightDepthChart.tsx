'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, AreaSeriesPartialOptions, HistogramSeriesPartialOptions, Time, ColorType } from 'lightweight-charts';
import { chartTheme, chartColors } from '@/lib/charts/utils';

interface DepthDataPoint {
  price: number;
  size: number;
  side: 'bid' | 'ask';
  cumulative: number;
}

interface LightweightDepthChartProps {
  data: DepthDataPoint[];
  height?: number;
  className?: string;
}

export function LightweightDepthChart({
  data,
  height,
  className = '',
}: LightweightDepthChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const bidSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const askSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      ...chartTheme,
      width: chartContainerRef.current.clientWidth,
      height: height || chartContainerRef.current.clientHeight,
      autoSize: true,
      layout: {
        ...chartTheme.layout,
        background: { type: ColorType.Solid, color: '#0A0A0A' },
      },
      rightPriceScale: {
        ...chartTheme.rightPriceScale,
        visible: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        ...chartTheme.timeScale,
        visible: false, // Hide time scale for depth chart
      },
    });

    chartRef.current = chart;
    setIsReady(true);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: height || chartContainerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [height]);

  // Create/update series when data changes
  useEffect(() => {
    if (!chartRef.current || !isReady || !data || data.length === 0) {
      // Clear series if no data
      if (bidSeriesRef.current) {
        bidSeriesRef.current.setData([]);
      }
      if (askSeriesRef.current) {
        askSeriesRef.current.setData([]);
      }
      return;
    }

    // Separate bids and asks (data should already be sorted, but ensure it)
    const bids = data.filter(d => d.side === 'bid' && d.price && !isNaN(d.price) && d.cumulative && !isNaN(d.cumulative))
      .sort((a, b) => a.price - b.price); // Sort ascending for visualization (lowest to highest)
    const asks = data.filter(d => d.side === 'ask' && d.price && !isNaN(d.price) && d.cumulative && !isNaN(d.cumulative))
      .sort((a, b) => a.price - b.price); // Sort ascending (lowest to highest)

    // Create bid series (green)
    if (!bidSeriesRef.current) {
      bidSeriesRef.current = (chartRef.current as any).addHistogramSeries({
        color: chartColors.depthBid,
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'right',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      });
    }

    // Create ask series (red)
    if (!askSeriesRef.current) {
      askSeriesRef.current = (chartRef.current as any).addHistogramSeries({
        color: chartColors.depthAsk,
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'right',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      });
    }

    // Convert depth data to chart format
    // For depth chart, we use price as the "time" axis and cumulative size as the value
    // Since Lightweight Charts doesn't support custom X-axis values directly,
    // we'll use a workaround: create a time-based index and map prices
    
    // Find price range (use all prices from both bids and asks)
    const allPrices = [...bids.map(d => d.price), ...asks.map(d => d.price)];
    if (allPrices.length === 0) {
      // No valid prices, clear series
      if (bidSeriesRef.current) {
        bidSeriesRef.current.setData([]);
      }
      if (askSeriesRef.current) {
        askSeriesRef.current.setData([]);
      }
      return;
    }
    
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice;
    
    // Avoid division by zero
    if (priceRange === 0 || isNaN(priceRange)) {
      if (bidSeriesRef.current) {
        bidSeriesRef.current.setData([]);
      }
      if (askSeriesRef.current) {
        askSeriesRef.current.setData([]);
      }
      return;
    }
    
    // Create a base timestamp (we'll use this as a reference point)
    const baseTime = Date.now() / 1000;
    
    // Convert bids to chart data
    const bidData = bids.map((bid) => {
      // Map price to a time value (normalized 0-1, then scaled to a reasonable time range)
      const priceRatio = (bid.price - minPrice) / priceRange;
      const time = baseTime + priceRatio * 86400; // Spread over 1 day in seconds
      return {
        time: time as Time,
        value: bid.cumulative || 0,
        color: chartColors.depthBid,
      };
    }).filter(d => d.value > 0); // Filter out zero values

    // Convert asks to chart data
    const askData = asks.map((ask) => {
      const priceRatio = (ask.price - minPrice) / priceRange;
      const time = baseTime + priceRatio * 86400;
      return {
        time: time as Time,
        value: ask.cumulative || 0,
        color: chartColors.depthAsk,
      };
    }).filter(d => d.value > 0); // Filter out zero values

    // Set data
    if (bidSeriesRef.current && bidData.length > 0) {
      bidSeriesRef.current.setData(bidData);
    }
    if (askSeriesRef.current && askData.length > 0) {
      askSeriesRef.current.setData(askData);
    }

    // Set price scale to show price range
    if (bidData.length > 0 || askData.length > 0) {
      chartRef.current.priceScale('right').applyOptions({
        autoScale: true,
      });
    }
  }, [data, isReady]);

  return (
    <div
      ref={chartContainerRef}
      className={`w-full h-full ${className}`}
      style={{ position: 'relative' }}
    />
  );
}

