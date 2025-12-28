import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { LogOut, Settings, Home } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { useState, useEffect } from 'react';
import { SubscriptionStatus } from '@/components/subscription/SubscriptionStatus';

export function Navbar() {
  const navigate = useNavigate();
  const supabase = createClient();
  const [userInitials, setUserInitials] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // Get user data
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError) {
          console.warn("Auth error in Navbar, using fallback:", authError);
          setUserInitials('U');
          setIsLoaded(true);
          return;
        }

        if (!user) {
          setUserInitials('G');
          setIsLoaded(true);
          return;
        }

        // Default to first letter of email
        setUserInitials(user.email?.charAt(0).toUpperCase() || 'U');

        // Note: The auth.users table doesn't have full_name or avatar_url columns
        // We'll use the email-based initials we already set above
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUserInitials('U'); // Fallback
      } finally {
        setIsLoaded(true);
      }
    };

    fetchUserProfile();
  }, [supabase]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleHomePage = () => {
    navigate('/');
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <div className="flex flex-1 items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/app/analytics')}
          >
            <img
              src="/onyxtech-logo.png"
              alt="OnyxTech"
              className="h-8 w-auto"
            />
            <span className="font-semibold text-foreground">OnyxTech</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Subscription Status */}
            <div className="mr-2">
              <SubscriptionStatus />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={avatarUrl} alt="User" />
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={handleHomePage}
                  className="cursor-pointer"
                >
                  <Home className="mr-2 h-4 w-4" />
                  <span>Home page</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/app/settings')}
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sign Out</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </nav>
  );
} 