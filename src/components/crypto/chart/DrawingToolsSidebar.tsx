import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Pointer,
    TrendingUp,
    ArrowUpRight,
    Minus,
    Crosshair,
    ZoomIn,
    ZoomOut,
    Trash2,
} from 'lucide-react';
import type { DrawingTool } from '@/lib/chart-drawing-manager';

interface DrawingToolsSidebarProps {
    selectedTool: DrawingTool;
    onToolSelect: (tool: DrawingTool) => void;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onClearDrawings?: () => void;
    className?: string;
}

interface ToolButtonConfig {
    id: DrawingTool;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
}

const DRAWING_TOOLS: ToolButtonConfig[] = [
    { id: 'cursor', icon: <Pointer className="h-4 w-4" />, label: 'Cursor (Esc)' },
    { id: 'crosshair', icon: <Crosshair className="h-4 w-4" />, label: 'Crosshair' },
    { id: 'horizontal', icon: <Minus className="h-4 w-4" />, label: 'Horizontal Line (H)' },
    { id: 'trendline', icon: <TrendingUp className="h-4 w-4" />, label: 'Trend Line (T)' },
    { id: 'ray', icon: <ArrowUpRight className="h-4 w-4" />, label: 'Ray (R)' },
];

export default function DrawingToolsSidebar({
    selectedTool,
    onToolSelect,
    onZoomIn,
    onZoomOut,
    onClearDrawings,
    className,
}: DrawingToolsSidebarProps) {
    // Keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'escape':
                    onToolSelect('cursor');
                    break;
                case 'h':
                    onToolSelect('horizontal');
                    break;
                case 't':
                    onToolSelect('trendline');
                    break;
                case 'r':
                    onToolSelect('ray');
                    break;
                case '+':
                case '=':
                    onZoomIn?.();
                    break;
                case '-':
                    onZoomOut?.();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onToolSelect, onZoomIn, onZoomOut]);

    return (
        <div
            className={cn(
                'flex flex-col items-center py-2 px-1 bg-[#0d0d12] border-r border-white/5 gap-0.5 w-10',
                className
            )}
        >
            {/* Drawing Tools */}
            {DRAWING_TOOLS.map((tool) => (
                <Button
                    key={tool.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => !tool.disabled && onToolSelect(tool.id)}
                    disabled={tool.disabled}
                    title={tool.label}
                    className={cn(
                        'h-8 w-8 p-0 transition-colors',
                        selectedTool === tool.id
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : tool.disabled
                                ? 'text-white/20 cursor-not-allowed'
                                : 'text-white/50 hover:text-white hover:bg-white/10'
                    )}
                >
                    {tool.icon}
                </Button>
            ))}

            {/* Divider */}
            <div className="w-6 h-px bg-white/10 my-2" />

            {/* Zoom Controls */}
            <Button
                variant="ghost"
                size="sm"
                onClick={onZoomIn}
                title="Zoom In (+)"
                className="h-8 w-8 p-0 text-white/50 hover:text-white hover:bg-white/10"
            >
                <ZoomIn className="h-4 w-4" />
            </Button>

            <Button
                variant="ghost"
                size="sm"
                onClick={onZoomOut}
                title="Zoom Out (-)"
                className="h-8 w-8 p-0 text-white/50 hover:text-white hover:bg-white/10"
            >
                <ZoomOut className="h-4 w-4" />
            </Button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Clear All Drawings */}
            {onClearDrawings && (
                <>
                    <div className="w-6 h-px bg-white/10 my-2" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearDrawings}
                        title="Clear All Drawings"
                        className="h-8 w-8 p-0 text-red-400/50 hover:text-red-400 hover:bg-red-400/10"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </>
            )}

            {/* TradingView Logo */}
            <div className="w-6 h-px bg-white/10 my-2" />
            <div
                className="h-8 w-8 flex items-center justify-center text-white/20"
                title="Powered by TradingView"
            >
                <svg viewBox="0 0 36 28" className="h-4 w-4" fill="currentColor">
                    <path d="M14 22H7V6h7v16zm8 0h-7V6h7v16zm8 0h-7V6h7v16z" />
                </svg>
            </div>
        </div>
    );
}
