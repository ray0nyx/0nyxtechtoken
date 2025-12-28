import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  DollarSign, 
  Edit, 
  Trash2, 
  Clock,
  Tag,
  Smile,
  Frown,
  Meh,
  Zap,
  Heart,
  AlertTriangle,
  Target,
  Brain,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  note_content: string;
  pnl?: number;
  created_at: string;
  updated_at: string;
  emotion?: string;
  tags?: string[];
  images?: any[];
}

interface EnhancedJournalEntryCardProps {
  entry: JournalEntry;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  isSelected?: boolean;
  className?: string;
}

const moodIcons = {
  excited: Zap,
  confident: Target,
  happy: Smile,
  focused: Brain,
  neutral: Meh,
  frustrated: Frown,
  anxious: AlertTriangle,
  disappointed: TrendingDown,
  grateful: Heart
};

export function EnhancedJournalEntryCard({ 
  entry, 
  onSelect, 
  onDelete, 
  isSelected = false,
  className 
}: EnhancedJournalEntryCardProps) {
  const MoodIcon = entry.emotion ? moodIcons[entry.emotion as keyof typeof moodIcons] : null;
  
  const getMoodColor = (emotion?: string) => {
    const colors = {
      excited: 'text-yellow-500',
      confident: 'text-green-500',
      happy: 'text-emerald-500',
      focused: 'text-blue-500',
      neutral: 'text-gray-500',
      frustrated: 'text-orange-500',
      anxious: 'text-red-500',
      disappointed: 'text-purple-500',
      grateful: 'text-pink-500'
    };
    return colors[emotion as keyof typeof colors] || 'text-muted-foreground';
  };

  const getPnLColor = (pnl?: number) => {
    if (pnl === null || pnl === undefined) return 'text-muted-foreground';
    return pnl >= 0 ? 'text-green-500' : 'text-red-500';
  };

  const getPnLBackground = (pnl?: number) => {
    if (pnl === null || pnl === undefined) return 'bg-muted/50';
    return pnl >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20';
  };

  const getPnLBorder = (pnl?: number) => {
    if (pnl === null || pnl === undefined) return 'border-muted';
    return pnl >= 0 ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800';
  };

  const truncateContent = (content: string, maxLength: number = 120) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md border",
        isSelected 
          ? "ring-2 ring-primary shadow-md bg-primary/5" 
          : "hover:shadow-sm",
        className
      )}
      onClick={() => onSelect(entry.id)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {format(parseISO(entry.date), 'MMM d')}
            </span>
            <Clock className="h-3 w-3 text-muted-foreground ml-2" />
            <span className="text-xs text-muted-foreground">
              {format(parseISO(entry.created_at), 'h:mm a')}
            </span>
          </div>
          
          <div className="flex items-center space-x-1">
            {MoodIcon && (
              <MoodIcon className={cn("h-4 w-4", getMoodColor(entry.emotion))} />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(entry.id);
              }}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* P&L Display */}
        {entry.pnl !== null && entry.pnl !== undefined && (
          <div className={cn(
            "mb-3 p-2 rounded-lg border text-center",
            getPnLBackground(entry.pnl),
            getPnLBorder(entry.pnl)
          )}>
            <div className="flex items-center justify-center space-x-1">
              <DollarSign className="h-4 w-4" />
              <span className={cn("font-semibold text-sm", getPnLColor(entry.pnl))}>
                {entry.pnl >= 0 ? '+' : ''}{entry.pnl.toFixed(2)}
              </span>
            </div>
          </div>
        )}
        
        {/* Content Preview */}
        <div className="mb-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {truncateContent(stripHtml(entry.note_content))}
          </p>
        </div>
        
        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {entry.tags.slice(0, 3).map((tag, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="text-xs px-2 py-0.5 bg-primary/10 text-primary hover:bg-primary/20"
              >
                <Tag className="h-2 w-2 mr-1" />
                {tag}
              </Badge>
            ))}
            {entry.tags.length > 3 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                +{entry.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}
        
        {/* Images Indicator */}
        {entry.images && entry.images.length > 0 && (
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <span>{entry.images.length} image{entry.images.length !== 1 ? 's' : ''}</span>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(entry.id);
            }}
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
          
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <span>Updated {format(parseISO(entry.updated_at), 'MMM d')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
