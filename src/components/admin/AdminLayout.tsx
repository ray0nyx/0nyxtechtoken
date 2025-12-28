import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { 
  Users, 
  BarChart3, 
  Settings, 
  Home, 
  Database, 
  ActivitySquare, 
  Bell, 
  BookOpen,
  LogOut,
  ChevronLeft,
  Menu,
  ArrowLeft,
  UserPlus,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { 
    label: "Dashboard", 
    icon: <Home className="h-5 w-5" />, 
    path: "/admin" 
  },
  { 
    label: "Users", 
    icon: <Users className="h-5 w-5" />, 
    path: "/admin/users" 
  },
  { 
    label: "Affiliates", 
    icon: <UserPlus className="h-5 w-5" />, 
    path: "/admin/affiliates" 
  },
  { 
    label: "Affiliate Applications", 
    icon: <FileText className="h-5 w-5" />, 
    path: "/admin/affiliate-applications" 
  },
  { 
    label: "Analytics", 
    icon: <BarChart3 className="h-5 w-5" />, 
    path: "/admin/analytics" 
  },
  { 
    label: "Event Logs", 
    icon: <ActivitySquare className="h-5 w-5" />, 
    path: "/admin/logs" 
  },
  { 
    label: "Database", 
    icon: <Database className="h-5 w-5" />, 
    path: "/admin/database" 
  },
  { 
    label: "Notifications", 
    icon: <Bell className="h-5 w-5" />, 
    path: "/admin/notifications" 
  },
  { 
    label: "Documentation", 
    icon: <BookOpen className="h-5 w-5" />, 
    path: "/admin/docs" 
  },
  { 
    label: "Settings", 
    icon: <Settings className="h-5 w-5" />, 
    path: "/admin/settings" 
  },
];

export function AdminLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const supabase = createClient();
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div 
        className={`bg-card border-r shadow-md transition-all duration-300 ${
          collapsed ? "w-[70px]" : "w-[260px]"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo and collapse button */}
          <div className="p-4 flex items-center justify-between border-b">
            {!collapsed && (
              <div className="font-bold text-xl">
                <span className="text-purple-500">0nyx</span><span className="text-gray-500">Tech</span> Admin
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-full"
            >
              {collapsed ? (
                <Menu className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </Button>
          </div>
          
          {/* Navigation items */}
          <div className="flex-1 py-6 overflow-y-auto">
            <nav className="px-2 space-y-1">
              {/* Back to App link */}
              <Link
                to="/app"
                className={`
                  flex items-center px-3 py-3 rounded-lg transition-colors mb-4 border-b pb-4
                  bg-secondary/20 text-primary hover:bg-secondary/30
                `}
              >
                <div className="flex items-center justify-center">
                  <ArrowLeft className="h-5 w-5" />
                </div>
                {!collapsed && (
                  <span className="ml-3 font-medium">Back to App</span>
                )}
              </Link>
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      flex items-center px-3 py-3 rounded-lg transition-colors
                      ${isActive 
                        ? "bg-primary/10 text-primary" 
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      }
                    `}
                  >
                    <div className="flex items-center justify-center">
                      {item.icon}
                    </div>
                    {!collapsed && (
                      <span className="ml-3 font-medium">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
          
          {/* Sign out button */}
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              className="w-full flex items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              {!collapsed && <span className="ml-2">Sign Out</span>}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 overflow-auto bg-background">
        <Card className="m-4 p-6 rounded-2xl h-[calc(100%-2rem)]">
          <Outlet />
        </Card>
      </div>
    </div>
  );
} 