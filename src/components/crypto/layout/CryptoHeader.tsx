import React from 'react';
import { Bell, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';

interface CryptoHeaderProps {
  title: string;
}

export default function CryptoHeader({ title }: CryptoHeaderProps) {
  const navigate = useNavigate();
  const supabase = createClient();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/signin');
  };

  return (
    <header className={cn(
      "h-16 border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-30",
      isDark ? "bg-[#0a0e17] border-[#1f2937]" : "bg-white border-gray-200"
    )}>
      <h1 className={cn(
        "text-xl font-semibold",
        isDark ? "text-white" : "text-gray-900"
      )}>{title}</h1>
      
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative",
            isDark 
              ? "text-[#9ca3af] hover:text-white hover:bg-[#1a1f2e]"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          )}
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#ef4444] rounded-full" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                isDark
                  ? "text-[#9ca3af] hover:text-white hover:bg-[#1a1f2e]"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={cn(
            "w-48",
            isDark ? "bg-[#1a1f2e] border-[#374151]" : "bg-white border-gray-200"
          )}>
            <DropdownMenuItem 
              onClick={() => navigate('/crypto/settings')}
              className={cn(
                isDark
                  ? "text-[#9ca3af] hover:text-white focus:text-white focus:bg-[#252b3d]"
                  : "text-gray-700 hover:text-gray-900 focus:text-gray-900 focus:bg-gray-100"
              )}
            >
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleSignOut}
              className={cn(
                "text-[#ef4444] hover:text-[#ef4444]",
                isDark ? "focus:bg-[#252b3d]" : "focus:bg-gray-100"
              )}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

