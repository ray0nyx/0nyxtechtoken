import React from 'react';
import { BarReplay } from '@/components/backtesting/BarReplay';
import { useTheme } from '@/components/ThemeProvider';

const Backtesting = () => {
  const { theme } = useTheme();

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-gray-900 dark:text-white">

      {/* Main Chart Area */}
      <div className="flex-1 flex flex-col">
        <BarReplay />
      </div>
    </div>
  );
};

export default Backtesting; 