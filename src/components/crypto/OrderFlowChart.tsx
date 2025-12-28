import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, HistogramData, ColorType } from 'lightweight-charts';
import { cn } from '@/lib/utils';

interface OrderFlowData {
  time: number;
  buyVolume: number;
  sellVolume: number;
  delta: number; // buyVolume - sellVolume
}

interface OrderFlowChartProps {
  data: OrderFlowData[];
  className?: string;
  height?: number;
  theme?: 'dark' | 'light';
}

export default function OrderFlowChart({
  data,
  className,
  height = 200,
  theme = 'dark',
}: OrderFlowChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const buyVolumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const sellVolumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const deltaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const colors = {
    dark: {
      backgroundColor: '#0a0e17',
      textColor: '#9ca3af',
      buyColor: '#10b981',
      sellColor: '#ef4444',
      deltaColor: '#3b82f6',
    },
    light: {
      backgroundColor: '#ffffff',
      textColor: '#374151',
      buyColor: '#10b981',
      sellColor: '#ef4444',
      deltaColor: '#3b82f6',
    },
  };

  const currentColors = colors[theme];

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clear existing chart
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {
        // Ignore cleanup errors
      }
      chartRef.current = null;
      buyVolumeSeriesRef.current = null;
      sellVolumeSeriesRef.current = null;
      deltaSeriesRef.current = null;
    }

    // Ensure container has dimensions
    if (chartContainerRef.current.clientWidth === 0 || chartContainerRef.current.clientHeight === 0) {
      requestAnimationFrame(() => {
        if (chartContainerRef.current && chartContainerRef.current.clientWidth > 0) {
          // Retry initialization
        }
      });
      return;
    }

    try {
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: currentColors.backgroundColor },
          textColor: currentColors.textColor,
        },
        width: chartContainerRef.current.clientWidth,
        height: height,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          visible: true,
        },
      });

      chartRef.current = chart;

      // Add buy volume series (green)
      const buyVolumeSeries = chart.addHistogramSeries({
        color: currentColors.buyColor + '80',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });
      buyVolumeSeriesRef.current = buyVolumeSeries;

      // Add sell volume series (red)
      const sellVolumeSeries = chart.addHistogramSeries({
        color: currentColors.sellColor + '80',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });
      sellVolumeSeriesRef.current = sellVolumeSeries;

      // Add delta line (blue)
      const deltaSeries = chart.addLineSeries({
        color: currentColors.deltaColor,
        lineWidth: 2,
        priceScaleId: 'delta',
      });
      deltaSeriesRef.current = deltaSeries;

      // Configure price scales
      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.5,
          bottom: 0,
        },
      });

      chart.priceScale('delta').applyOptions({
        scaleMargins: {
          top: 0,
          bottom: 0.5,
        },
      });

      // Handle resize
      const handleResize = () => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: height,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error initializing order flow chart:', error);
    }
  }, [currentColors, height]);

  // Update data
  useEffect(() => {
    if (!buyVolumeSeriesRef.current || !sellVolumeSeriesRef.current || !deltaSeriesRef.current) {
      return;
    }

    if (data.length === 0) {
      buyVolumeSeriesRef.current.setData([]);
      sellVolumeSeriesRef.current.setData([]);
      deltaSeriesRef.current.setData([]);
      return;
    }

    const buyData: HistogramData[] = data.map(d => ({
      time: d.time as any,
      value: d.buyVolume,
      color: currentColors.buyColor + '80',
    }));

    const sellData: HistogramData[] = data.map(d => ({
      time: d.time as any,
      value: -d.sellVolume, // Negative for visual separation
      color: currentColors.sellColor + '80',
    }));

    const deltaData = data.map(d => ({
      time: d.time as any,
      value: d.delta,
    }));

    buyVolumeSeriesRef.current.setData(buyData);
    sellVolumeSeriesRef.current.setData(sellData);
    deltaSeriesRef.current.setData(deltaData);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, currentColors]);

  return (
    <div className={cn('relative w-full', className)} style={{ height: `${height}px` }}>
      <div 
        ref={chartContainerRef} 
        className="w-full" 
        style={{ width: '100%', height: `${height}px` }}
      />
    </div>
  );
}










