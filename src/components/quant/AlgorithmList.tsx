import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Play, Trash2, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface Algorithm {
  id: string;
  name: string;
  language: 'Python' | 'C#';
  status: 'Running' | 'Stopped' | 'Draft';
  createdAt: string;
  lastModified: string;
  description?: string;
}

interface AlgorithmListProps {
  algorithms: Algorithm[];
  onEdit: (id: string) => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function AlgorithmList({
  algorithms,
  onEdit,
  onRun,
  onDelete,
}: AlgorithmListProps) {
  const getStatusColor = (status: Algorithm['status']) => {
    switch (status) {
      case 'Running':
        return 'bg-[#10b981] text-white';
      case 'Stopped':
        return 'bg-[#6b7280] text-white';
      case 'Draft':
        return 'bg-[#f59e0b] text-white';
      default:
        return 'bg-[#6b7280] text-white';
    }
  };

  const getLanguageColor = (language: Algorithm['language']) => {
    return language === 'Python' ? 'bg-[#0ea5e9] text-white' : 'bg-[#8b5cf6] text-white';
  };

  return (
    <div className="space-y-3">
      {algorithms.map((algorithm) => (
        <div
          key={algorithm.id}
          className="flex items-center justify-between p-4 rounded-lg bg-[#1a1f2e] border border-[#1f2937] hover:border-[#0ea5e9] transition-colors"
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 rounded-lg bg-[#0f1419] flex items-center justify-center border border-[#1f2937]">
              <span className="text-xs font-mono text-[#0ea5e9]">
                {algorithm.language === 'Python' ? 'PY' : 'C#'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-medium text-white truncate">{algorithm.name}</h3>
                <Badge className={getLanguageColor(algorithm.language)}>
                  {algorithm.language}
                </Badge>
                <Badge className={getStatusColor(algorithm.status)}>
                  {algorithm.status}
                </Badge>
              </div>
              {algorithm.description && (
                <p className="text-xs text-[#6b7280] truncate">{algorithm.description}</p>
              )}
              <p className="text-xs text-[#6b7280] mt-1">
                Created {new Date(algorithm.createdAt).toLocaleDateString()} • 
                Modified {new Date(algorithm.lastModified).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(algorithm.id)}
              className="text-[#9ca3af] hover:text-white"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRun(algorithm.id)}
              className="text-[#0ea5e9] hover:text-[#0284c7]"
            >
              <Play className="w-4 h-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#9ca3af] hover:text-white"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#1a1f2e] border-[#1f2937]">
                <DropdownMenuItem
                  onClick={() => onDelete(algorithm.id)}
                  className="text-[#ef4444] focus:text-[#ef4444] focus:bg-[#0f1419]"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );
}

