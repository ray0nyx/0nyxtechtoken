import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Analytics } from '@/components/Analytics';

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-[60px] min-h-screen">
        <Outlet />
      </main>
      <Analytics />
    </div>
  );
} 