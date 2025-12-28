import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  Smile, 
  Frown, 
  Meh, 
  Heart, 
  Zap, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Brain
} from 'lucide-react';

export interface MoodOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  description: string;
}

const moodOptions: MoodOption[] = [
  {
    id: 'excited',
    label: 'Excited',
    icon: Zap,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    description: 'Feeling confident and energized'
  },
  {
    id: 'confident',
    label: 'Confident',
    icon: Target,
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    description: 'Clear strategy and good setup'
  },
  {
    id: 'happy',
    label: 'Happy',
    icon: Smile,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    description: 'Satisfied with trading performance'
  },
  {
    id: 'focused',
    label: 'Focused',
    icon: Brain,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    description: 'Concentrated and analytical'
  },
  {
    id: 'neutral',
    label: 'Neutral',
    icon: Meh,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800',
    description: 'Calm and balanced'
  },
  {
    id: 'frustrated',
    label: 'Frustrated',
    icon: Frown,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    description: 'Challenging market conditions'
  },
  {
    id: 'anxious',
    label: 'Anxious',
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    description: 'Feeling uncertain or worried'
  },
  {
    id: 'disappointed',
    label: 'Disappointed',
    icon: TrendingDown,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    description: 'Disappointed with results'
  },
  {
    id: 'grateful',
    label: 'Grateful',
    icon: Heart,
    color: 'text-pink-500',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800',
    description: 'Grateful for learning opportunities'
  }
];

interface MoodSelectorProps {
  selectedMood?: string;
  onMoodSelect: (moodId: string) => void;
  className?: string;
}

export function MoodSelector({ selectedMood, onMoodSelect, className }: MoodSelectorProps) {
  return (
    <Card className={cn("border-0 shadow-none bg-transparent", className)}>
      <CardContent className="p-0">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-muted-foreground">Trading Mood</h3>
            <div className="h-px bg-border flex-1" />
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {moodOptions.map((mood) => {
              const Icon = mood.icon;
              const isSelected = selectedMood === mood.id;
              
              return (
                <Button
                  key={mood.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => onMoodSelect(mood.id)}
                  className={cn(
                    "h-auto p-3 flex flex-col items-center space-y-2 transition-all duration-200 hover:scale-105",
                    isSelected 
                      ? `${mood.bgColor} ${mood.color} border-2 shadow-md` 
                      : "hover:bg-muted/50 border border-transparent"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isSelected ? mood.color : "text-muted-foreground")} />
                  <span className={cn(
                    "text-xs font-medium",
                    isSelected ? mood.color : "text-muted-foreground"
                  )}>
                    {mood.label}
                  </span>
                </Button>
              );
            })}
          </div>
          
          {selectedMood && (
            <div className="mt-3 p-3 rounded-lg bg-muted/30 border">
              <p className="text-sm text-muted-foreground">
                {moodOptions.find(m => m.id === selectedMood)?.description}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
