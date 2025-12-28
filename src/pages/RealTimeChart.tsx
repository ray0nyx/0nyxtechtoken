import React from 'react';
import TradingViewWidget from '@/components/TradingViewWidget';

const RealTimeChart: React.FC = () => {
  return (
    <div className="h-full w-full p-4">
      <h1 className="text-2xl font-bold mb-4">Real-Time Chart</h1>
      <div className="h-[calc(100%-2rem)] w-full">
        <TradingViewWidget />
      </div>
    </div>
  );
};

export default RealTimeChart; 