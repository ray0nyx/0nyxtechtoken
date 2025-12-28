import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Filter, 
  X, 
  Calendar,
  DollarSign,
  Tag,
  Smile,
  SortAsc,
  SortDesc
} from 'lucide-react';

interface JournalEntry {
  id: string;
  date: string;
  note_content: string;
  pnl?: number;
  emotion?: string;
  tags?: string[];
  created_at: string;
}

interface JournalSearchProps {
  entries: JournalEntry[];
  onFilteredEntries: (entries: JournalEntry[]) => void;
  className?: string;
}

type SortField = 'date' | 'pnl' | 'created_at';
type SortOrder = 'asc' | 'desc';
type EmotionFilter = 'all' | 'excited' | 'confident' | 'happy' | 'focused' | 'neutral' | 'frustrated' | 'anxious' | 'disappointed' | 'grateful';
type PnLFilter = 'all' | 'profitable' | 'loss' | 'neutral';

export function JournalSearch({ entries, onFilteredEntries, className }: JournalSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [emotionFilter, setEmotionFilter] = useState<EmotionFilter>('all');
  const [pnlFilter, setPnlFilter] = useState<PnLFilter>('all');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Get all unique tags from entries
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    entries.forEach(entry => {
      entry.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [entries]);

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let filtered = entries.filter(entry => {
      // Text search
      const searchMatch = searchTerm === '' || 
        entry.note_content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

      // Emotion filter
      const emotionMatch = emotionFilter === 'all' || entry.emotion === emotionFilter;

      // P&L filter
      const pnlMatch = pnlFilter === 'all' || 
        (pnlFilter === 'profitable' && (entry.pnl || 0) > 0) ||
        (pnlFilter === 'loss' && (entry.pnl || 0) < 0) ||
        (pnlFilter === 'neutral' && (entry.pnl || 0) === 0);

      // Tag filter
      const tagMatch = tagFilter.length === 0 || 
        tagFilter.every(filterTag => entry.tags?.includes(filterTag));

      return searchMatch && emotionMatch && pnlMatch && tagMatch;
    });

    // Sort entries
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'pnl':
          aValue = a.pnl || 0;
          bValue = b.pnl || 0;
          break;
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [entries, searchTerm, emotionFilter, pnlFilter, tagFilter, sortField, sortOrder]);

  // Update filtered entries when filters change
  React.useEffect(() => {
    onFilteredEntries(filteredEntries);
  }, [filteredEntries, onFilteredEntries]);

  const clearFilters = () => {
    setSearchTerm('');
    setEmotionFilter('all');
    setPnlFilter('all');
    setTagFilter([]);
    setSortField('date');
    setSortOrder('desc');
  };

  const addTagFilter = (tag: string) => {
    if (!tagFilter.includes(tag)) {
      setTagFilter([...tagFilter, tag]);
    }
  };

  const removeTagFilter = (tag: string) => {
    setTagFilter(tagFilter.filter(t => t !== tag));
  };

  const toggleSort = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <Card className={cn("border shadow-sm", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center">
            <Search className="h-5 w-5 mr-2 text-primary" />
            Search & Filter
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-xs"
          >
            <Filter className="h-3 w-3 mr-1" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search journal entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Active Filters */}
        {(searchTerm || emotionFilter !== 'all' || pnlFilter !== 'all' || tagFilter.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {searchTerm && (
              <Badge variant="secondary" className="text-xs">
                Search: "{searchTerm}"
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            
            {emotionFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                <Smile className="h-3 w-3 mr-1" />
                {emotionFilter}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1"
                  onClick={() => setEmotionFilter('all')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            
            {pnlFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                <DollarSign className="h-3 w-3 mr-1" />
                {pnlFilter}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1"
                  onClick={() => setPnlFilter('all')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            
            {tagFilter.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                <Tag className="h-3 w-3 mr-1" />
                {tag}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1"
                  onClick={() => removeTagFilter(tag)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          </div>
        )}

        {/* Advanced Filters */}
        {showFilters && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Emotion Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center">
                  <Smile className="h-4 w-4 mr-1" />
                  Emotion
                </label>
                <Select value={emotionFilter} onValueChange={(value: EmotionFilter) => setEmotionFilter(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Emotions</SelectItem>
                    <SelectItem value="excited">Excited</SelectItem>
                    <SelectItem value="confident">Confident</SelectItem>
                    <SelectItem value="happy">Happy</SelectItem>
                    <SelectItem value="focused">Focused</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="frustrated">Frustrated</SelectItem>
                    <SelectItem value="anxious">Anxious</SelectItem>
                    <SelectItem value="disappointed">Disappointed</SelectItem>
                    <SelectItem value="grateful">Grateful</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* P&L Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  P&L
                </label>
                <Select value={pnlFilter} onValueChange={(value: PnLFilter) => setPnlFilter(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All P&L</SelectItem>
                    <SelectItem value="profitable">Profitable</SelectItem>
                    <SelectItem value="loss">Loss</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tag Filter */}
            {allTags.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center">
                  <Tag className="h-4 w-4 mr-1" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => (
                    <Button
                      key={tag}
                      variant={tagFilter.includes(tag) ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      onClick={() => 
                        tagFilter.includes(tag) 
                          ? removeTagFilter(tag)
                          : addTagFilter(tag)
                      }
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Sort Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select value={sortField} onValueChange={(value: SortField) => setSortField(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="pnl">P&L</SelectItem>
                    <SelectItem value="created_at">Created Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Order</label>
                <Button
                  variant="outline"
                  onClick={toggleSort}
                  className="w-full justify-start"
                >
                  {sortOrder === 'asc' ? (
                    <SortAsc className="h-4 w-4 mr-2" />
                  ) : (
                    <SortDesc className="h-4 w-4 mr-2" />
                  )}
                  {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="text-sm text-muted-foreground text-center pt-2 border-t">
          Showing {filteredEntries.length} of {entries.length} entries
        </div>
      </CardContent>
    </Card>
  );
}
