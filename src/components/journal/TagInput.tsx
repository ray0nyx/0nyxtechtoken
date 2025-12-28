import React, { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { X, Plus, Tag } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  className?: string;
  placeholder?: string;
  maxTags?: number;
}

const predefinedTags = [
  'Breakout', 'Reversal', 'Support', 'Resistance', 'Trend Following',
  'Scalping', 'Swing Trading', 'Day Trading', 'Risk Management',
  'Psychology', 'Market Analysis', 'News Trading', 'Technical Analysis',
  'Fundamental Analysis', 'Backtesting', 'Strategy', 'Mistake',
  'Learning', 'Success', 'Loss', 'Win', 'Patience', 'Discipline'
];

export function TagInput({ 
  tags, 
  onTagsChange, 
  className, 
  placeholder = "Add tags...",
  maxTags = 10 
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < maxTags) {
      onTagsChange([...tags, trimmedTag]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const filteredSuggestions = predefinedTags.filter(
    tag => 
      tag.toLowerCase().includes(inputValue.toLowerCase()) && 
      !tags.includes(tag.toLowerCase())
  );

  return (
    <Card className={cn("border-0 shadow-none bg-transparent", className)}>
      <CardContent className="p-0">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-muted-foreground">Tags</h3>
            <div className="h-px bg-border flex-1" />
          </div>
          
          {/* Tags Display */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors duration-200"
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-2 hover:bg-destructive/20 hover:text-destructive"
                    onClick={() => removeTag(tag)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
          
          {/* Input and Suggestions */}
          <div className="relative">
            <div className="flex space-x-2">
              <Input
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setShowSuggestions(e.target.value.length > 0);
                }}
                onKeyDown={handleKeyPress}
                onFocus={() => setShowSuggestions(inputValue.length > 0)}
                placeholder={tags.length >= maxTags ? `Max ${maxTags} tags reached` : placeholder}
                disabled={tags.length >= maxTags}
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => addTag(inputValue)}
                disabled={!inputValue.trim() || tags.length >= maxTags}
                className="px-3"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Suggestions Dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                {filteredSuggestions.slice(0, 8).map((suggestion) => (
                  <button
                    key={suggestion}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors duration-150 flex items-center space-x-2"
                    onClick={() => addTag(suggestion)}
                  >
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Predefined Tags Quick Add */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Quick add:</p>
            <div className="flex flex-wrap gap-1">
              {predefinedTags.slice(0, 8).map((tag) => (
                <Button
                  key={tag}
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => addTag(tag)}
                  disabled={tags.includes(tag.toLowerCase()) || tags.length >= maxTags}
                >
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
