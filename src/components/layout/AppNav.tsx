import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PlusCircle, BarChart2, BookOpen, FileText } from "lucide-react";
import { UserMenu } from "@/components/user/UserMenu";

export default function AppNav() {
  return (
    <header className="w-full border-b">
      <div className="container flex h-16 items-center px-4 md:px-6">
        <Link to="/" className="flex items-center space-x-2 hover:opacity-80">
          <img
            src="/TraderLog.png"
            alt="TraderLog Logo"
            className="h-8 w-8"
          />
          <span className="text-2xl font-bold">TraderLog</span>
        </Link>
        <nav className="ml-auto flex items-center gap-4 sm:gap-6">
          <Link to="/app/trades/add">
            <Button variant="ghost" className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Add Trade
            </Button>
          </Link>
          <Link to="/app/trades">
            <Button variant="ghost" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Trade Log
            </Button>
          </Link>
          <Link to="/app/analytics">
            <Button variant="ghost" className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Analytics
            </Button>
          </Link>
          <Link to="/app/reports">
            <Button variant="ghost" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Reports
            </Button>
          </Link>
          <UserMenu />
        </nav>
      </div>
    </header>
  );
} 