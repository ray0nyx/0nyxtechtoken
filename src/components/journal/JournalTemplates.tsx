import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  FileText, 
  Target, 
  TrendingUp, 
  Brain, 
  AlertTriangle,
  Lightbulb,
  BookOpen,
  Zap
} from 'lucide-react';

export interface JournalTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  content: string;
  tags: string[];
  category: 'pre-trade' | 'post-trade' | 'reflection' | 'analysis' | 'learning';
}

const journalTemplates: JournalTemplate[] = [
  {
    id: 'pre-trade-plan',
    name: 'Pre-Trade Plan',
    description: 'Plan your trade before execution',
    icon: Target,
    color: 'text-blue-500',
    content: `## Pre-Trade Analysis

**Market Setup:**
- Market condition: 
- Timeframe: 
- Key levels: 

**Trade Plan:**
- Entry: 
- Stop loss: 
- Take profit: 
- Position size: 
- Risk/Reward ratio: 

**Confidence Level:** /10
**Reasoning:** `,
    tags: ['planning', 'strategy', 'risk-management'],
    category: 'pre-trade'
  },
  {
    id: 'post-trade-review',
    name: 'Post-Trade Review',
    description: 'Analyze completed trades',
    icon: TrendingUp,
    color: 'text-green-500',
    content: `## Post-Trade Review

**Trade Summary:**
- Entry: 
- Exit: 
- P&L: 
- Duration: 

**What Went Well:**
- 

**What Could Be Improved:**
- 

**Key Learnings:**
- 

**Next Steps:**
- `,
    tags: ['review', 'analysis', 'learning'],
    category: 'post-trade'
  },
  {
    id: 'market-analysis',
    name: 'Market Analysis',
    description: 'Deep dive into market conditions',
    icon: Brain,
    color: 'text-purple-500',
    content: `## Market Analysis

**Current Market State:**
- Trend: 
- Volatility: 
- Volume: 
- Key news/events: 

**Technical Analysis:**
- Support levels: 
- Resistance levels: 
- Indicators: 
- Chart patterns: 

**Fundamental Analysis:**
- Economic data: 
- Sector performance: 
- Market sentiment: 

**Trading Opportunities:**
- `,
    tags: ['analysis', 'technical', 'fundamental'],
    category: 'analysis'
  },
  {
    id: 'psychology-check',
    name: 'Psychology Check',
    description: 'Reflect on trading psychology',
    icon: AlertTriangle,
    color: 'text-orange-500',
    content: `## Trading Psychology Check

**Current State:**
- Emotional state: 
- Stress level: /10
- Confidence level: /10
- Energy level: /10

**Recent Triggers:**
- What caused stress: 
- What caused excitement: 
- What caused fear: 

**Mindset Assessment:**
- Am I following my plan? 
- Am I being disciplined? 
- Am I managing risk properly? 

**Action Items:**
- `,
    tags: ['psychology', 'emotions', 'mindset'],
    category: 'reflection'
  },
  {
    id: 'learning-notes',
    name: 'Learning Notes',
    description: 'Document new insights and knowledge',
    icon: BookOpen,
    color: 'text-indigo-500',
    content: `## Learning Notes

**Today's Learning:**
- New concept: 
- Source: 
- Key takeaway: 

**Practical Application:**
- How to apply: 
- When to use: 
- Expected outcome: 

**Questions to Research:**
- 
- 
- 

**Resources:**
- Books: 
- Videos: 
- Articles: `,
    tags: ['learning', 'education', 'research'],
    category: 'learning'
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    description: 'Comprehensive weekly assessment',
    icon: FileText,
    color: 'text-cyan-500',
    content: `## Weekly Trading Review

**Performance Summary:**
- Total P&L: 
- Win rate: 
- Number of trades: 
- Best trade: 
- Worst trade: 

**Goals Progress:**
- Weekly goal: 
- Achievement: 
- What helped: 
- What hindered: 

**Key Insights:**
- Market observations: 
- Strategy effectiveness: 
- Personal growth: 

**Next Week's Focus:**
- Primary goal: 
- Areas to improve: 
- New strategies to test: `,
    tags: ['review', 'weekly', 'goals'],
    category: 'reflection'
  }
];

interface JournalTemplatesProps {
  onTemplateSelect: (template: JournalTemplate) => void;
  className?: string;
}

export function JournalTemplates({ onTemplateSelect, className }: JournalTemplatesProps) {
  const getCategoryColor = (category: string) => {
    const colors = {
      'pre-trade': 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
      'post-trade': 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
      'reflection': 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
      'analysis': 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
      'learning': 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300';
  };

  return (
    <Card className={cn("border shadow-sm", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center">
          <Lightbulb className="h-5 w-5 mr-2 text-primary" />
          Journal Templates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {journalTemplates.map((template) => {
            const Icon = template.icon;
            return (
              <Button
                key={template.id}
                variant="ghost"
                className="h-auto p-4 text-left justify-start hover:bg-muted/50 transition-all duration-200"
                onClick={() => onTemplateSelect(template)}
              >
                <div className="flex items-start space-x-3 w-full">
                  <div className={cn("p-2 rounded-lg", template.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-medium text-sm">{template.name}</h3>
                      <Badge 
                        variant="secondary" 
                        className={cn("text-xs", getCategoryColor(template.category))}
                      >
                        {template.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {template.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {template.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
        
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Select a template to get started with structured journaling
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
