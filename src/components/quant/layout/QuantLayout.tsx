import { Outlet } from 'react-router-dom';
import QuantSidebar from './QuantSidebar';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function QuantLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  return (
    <div className="flex h-screen bg-[#0a0e17] text-white overflow-hidden">
      <QuantSidebar onCollapseChange={setIsSidebarCollapsed} />
      {/* Main content area - margin adjusts based on sidebar collapsed state */}
      <main className={cn(
        "flex-1 overflow-y-auto pb-16 md:pb-0 transition-all duration-300",
        isSidebarCollapsed ? "md:ml-16" : "md:ml-64"
      )}>
        <Outlet />
      </main>
    </div>
  );
}

