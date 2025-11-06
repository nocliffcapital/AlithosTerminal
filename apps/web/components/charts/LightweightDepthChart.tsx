'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, AreaSeriesPartialOptions, HistogramSeriesPartialOptions, Time } from 'lightweight-charts';
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
        background: { type: 'solid' as const, color: '#0A0A0A' },
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
    if (!chartRef.current || !isReady || !data || data.length === 0) return;

    // Separate bids and asks
    const bids = data.filter(d => d.side === 'bid').sort((a, b) => b.price - a.price);
    const asks = data.filter(d => d.side === 'ask').sort((a, b) => a.price - b.price);

    // Create bid series (green)
    if (!bidSeriesRef.current) {
      bidSeriesRef.current = chartRef.current.addHistogramSeries({
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
      askSeriesRef.current = chartRef.current.addHistogramSeries({
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
    
    // Find price range
    const allPrices = data.map(d => d.price);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice;
    
    // Create a base timestamp (we'll use this as a reference point)
    const baseTime = Date.now() / 1000;
    
    // Convert bids to chart data
    const bidData = bids.map((bid, index) => {
      // Map price to a time value (normalized 0-1, then scaled to a reasonable time range)
      const priceRatio = (bid.price - minPrice) / priceRange;
      const time = baseTime + priceRatio * 86400; // Spread over 1 day in seconds
      return {
        time: time as Time,
        value: bid.cumulative,
        color: chartColors.depthBid,
      };
    });

    // Convert asks to chart data
    const askData = asks.map((ask, index) => {
      const priceRatio = (ask.price - minPrice) / priceRange;
      const time = baseTime + priceRatio * 86400;
      return {
        time: time as Time,
        value: ask.cumulative,
        color: chartColors.depthAsk,
      };
    });

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

