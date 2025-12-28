declare module 'lucide-react' {
  import * as React from 'react';

  export interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    stroke?: string | number;
  }

  export type Icon = React.FC<IconProps>;

  // Define all the icons used in the project
  export const Timer: Icon;
  export const RefreshCw: Icon;
  export const Zap: Icon;
  export const BarChart2: Icon;
  export const Clock: Icon;
  export const Check: Icon;
  export const CheckCircle: Icon;
  export const AlertTriangle: Icon;
  export const User: Icon;
  export const Settings: Icon;
  export const LogOut: Icon;
  export const Home: Icon;
  export const ArrowLeft: Icon;
  export const Save: Icon;
  export const Edit: Icon;
  export const Trash2: Icon;
  export const ArrowUpRight: Icon;
  export const ArrowDownRight: Icon;
  export const Plus: Icon;
  export const PlusCircle: Icon;
  export const Calendar: Icon;
  export const ChevronLeft: Icon;
  export const ChevronRight: Icon;
  export const Moon: Icon;
  export const Sun: Icon;
  export const Search: Icon;
  export const FileText: Icon;
  export const Upload: Icon;
  export const Download: Icon;
  export const HelpCircle: Icon;
  export const Loader2: Icon;
  export const TrendingUp: Icon;
  export const TrendingDown: Icon;
  export const DollarSign: Icon;
  export const X: Icon;
  export const AlertCircle: Icon;
  export const Wifi: Icon;
  export const WifiOff: Icon;
  export const Cloud: Icon;
  export const Lightbulb: Icon;
  export const Info: Icon;
  export const MoreHorizontal: Icon;
  export const ChevronDown: Icon;
  export const ChevronUp: Icon;
  export const Circle: Icon;
  export const Play: Icon;
  export const Pause: Icon;
  export const RotateCcw: Icon;
  export const FastForward: Icon;
  export const Rewind: Icon;
  export const Share2: Icon;
  export const CheckCircle2: Icon;
  export const PanelLeft: Icon;
  export const Layout: Icon;
  export const LayoutTemplate: Icon;
  export const Dot: Icon;
  export const GripVertical: Icon;
  export const RefreshCcw: Icon;

  // Additional icons used in Sidebar and other components
  export const BarChart3: Icon;
  export const BookOpen: Icon;
  export const LineChart: Icon;
  export const Trophy: Icon;
  export const Shield: Icon;
  export const Copy: Icon;
  export const Link2: Icon;
  export const Target: Icon;
  export const Brain: Icon;
  export const Activity: Icon;
  export const PieChart: Icon;
  export const Square: Icon;
  export const Bitcoin: Icon;
  export const Wallet: Icon;
  export const Key: Icon;
  export const Menu: Icon;
  export const Users: Icon;
  export const ExternalLink: Icon;
} 