import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Settings, 
  User, 
  Globe,
  Zap,
  Shield,
  Activity,
  Target
} from 'lucide-react';

interface ProfessionalHeaderProps {
  title: string;
  subtitle?: string;
  showLiveIndicator?: boolean;
  showNotifications?: boolean;
  className?: string;
}

export const ProfessionalHeader: React.FC<ProfessionalHeaderProps> = ({
  title,
  subtitle,
  showLiveIndicator = true,
  showNotifications = true,
  className = ''
}) => {
  return (
    <div className={`institutional-theme border-b border-gray-700 bg-gray-800 ${className}`}>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{title}</h1>
              {subtitle && (
                <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
              )}
            </div>
            
            {showLiveIndicator && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-400">Live</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Market Status */}
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-gray-300">Markets Open</span>
            </div>
            
            {/* Risk Status */}
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-500" />
              <Badge className="risk-indicator low">NORMAL</Badge>
            </div>
            
            {/* Performance Indicator */}
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-gray-300">+2.4%</span>
            </div>
            
            {showNotifications && (
              <Button variant="outline" size="sm" className="institutional-btn">
                <Bell className="h-4 w-4 mr-2" />
                Alerts
              </Button>
            )}
            
            <Button variant="outline" size="sm" className="institutional-btn">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            
            <Button variant="outline" size="sm" className="institutional-btn">
              <User className="h-4 w-4 mr-2" />
              Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
