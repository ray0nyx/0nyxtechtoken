import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/avatar';
import { LogOut, BarChart3, Shield } from 'lucide-react';

interface UserDropdownProps {
  className?: string;
}

export function UserDropdown({ className }: UserDropdownProps) {
  const navigate = useNavigate();
  const supabase = createClient();
  const [userInitials, setUserInitials] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // Get user data
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          setIsLoaded(true);
          return;
        }

        // Check if user has dev access or is a paid user
        const devUserIds = ["856950ff-d638-419d-bcf1-b7dac51d1c7f"];
        const adminUserIds = ["856950ff-d638-419d-bcf1-b7dac51d1c7f"];
        const isDevUser = devUserIds.includes(user.id);
        const isAdminUser = adminUserIds.includes(user.id);
        setIsAdmin(isAdminUser);
        
        // Check subscription status
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('status, access_level')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        const isPaidUser = subscription && subscription.status === 'active';
        setHasAccess(isDevUser || isPaidUser);

        // Default to first letter of email
        setUserInitials(user.email?.charAt(0).toUpperCase() || 'U');
        
        // Note: The auth.users table doesn't have full_name or avatar_url columns
        // We'll use the email-based initials we already set above
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUserInitials('U');
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

  const handleWagyuTechClick = () => {
    if (hasAccess) {
      navigate('/app/analytics');
    }
  };

  if (!isLoaded) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-8 w-8 rounded-full bg-gray-200"></div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`rounded-full ${className}`}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl} alt="User" />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {hasAccess && (
          <DropdownMenuItem 
            onClick={handleWagyuTechClick}
            className="cursor-pointer"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            <span className="text-purple-500 font-medium">WagyuTech</span>
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem 
            onClick={() => navigate('/admin')}
            className="cursor-pointer"
          >
            <Shield className="mr-2 h-4 w-4" />
            <span className="text-red-500 font-medium">Admin Panel</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem 
          onClick={handleSignOut}
          className="cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
