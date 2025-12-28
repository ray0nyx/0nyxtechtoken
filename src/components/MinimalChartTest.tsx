import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';

export function MinimalChartTest() {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('[Minimal] Component mounted');
    
    if (chartContainerRef.current) {
      try {
        console.log('[Minimal] Creating chart...');
        const chart = createChart(chartContainerRef.current);
        console.log('[Minimal] Chart created:', chart);
        
        console.log('[Minimal] createChart type:', typeof createChart);
        console.log('[Minimal] chart type:', typeof chart);
        console.log('[Minimal] chart methods:', Object.keys(chart));
        
        console.log('[Minimal] Adding candlestick series using new API...');
        // In v5.0.x, addCandlestickSeries was removed and replaced with addSeries
        if (typeof chart.addSeries === 'function') {
          const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: true,
            wickVisible: true,
          });
          console.log('[Minimal] Candlestick series added:', candleSeries);
        } else {
          console.error('[Minimal] addSeries is not a function!');
          console.log('[Minimal] chart.addSeries:', chart.addSeries);
        }
      } catch (error) {
        console.error('[Minimal] Error creating chart:', error);
      }
    }

    return () => {
      console.log('[Minimal] Component unmounting, cleanup here if needed');
    };
  }, []);

  return (
    <div>
      <h2>Minimal Chart Test</h2>
      <div 
        ref={chartContainerRef} 
        style={{ 
          width: '600px', 
          height: '400px', 
          border: '1px solid #ccc'
        }}
      />
    </div>
  );
}

export default MinimalChartTest; 