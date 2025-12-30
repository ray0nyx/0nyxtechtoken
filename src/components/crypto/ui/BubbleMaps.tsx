import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Settings, Trash2, Search, ExternalLink } from 'lucide-react';

interface BubbleMapsProps {
  pairSymbol?: string;
  tokenMint?: string;
  theme?: 'dark' | 'light';
}

export default function BubbleMaps({ pairSymbol, tokenMint, theme = 'dark' }: BubbleMapsProps) {
  const [activeProvider, setActiveProvider] = useState<'insightx' | 'faster100x' | 'bubblemaps'>('insightx');
  const isDark = theme === 'dark';

  // Fallback mint if none provided
  const mint = tokenMint || 'So11111111111111111111111111111111111111112';

  // Bubblemaps.io URL
  const bubblemapsUrl = `https://bubblemaps.io/solana/token/${mint}`;

  return (
    <div className={cn(
      "w-full h-full flex flex-col relative",
      isDark ? "bg-[#0a0a0a]" : "bg-white"
    )}>
      {/* Top Toolbar */}
      <div className={cn(
        "flex items-center justify-between px-3 py-1.5 border-b",
        isDark ? "border-neutral-800" : "border-gray-200"
      )}>
        <div className="flex items-center gap-1.5">
          {/* Ignored settings icon at top left per user request, but keeping the space/layout if needed */}
          <div className="w-8" />
        </div>

        <div className="flex items-center bg-neutral-900/50 rounded-lg p-0.5 border border-neutral-800">
          <button
            onClick={() => setActiveProvider('insightx')}
            className={cn(
              "px-3 py-1 text-[10px] uppercase font-bold transition-all rounded",
              activeProvider === 'insightx' ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            InsightX
          </button>
          <button
            onClick={() => setActiveProvider('faster100x')}
            className={cn(
              "px-3 py-1 text-[10px] uppercase font-bold transition-all rounded",
              activeProvider === 'faster100x' ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            Faster100x
          </button>
          <button
            onClick={() => setActiveProvider('bubblemaps')}
            className={cn(
              "px-3 py-1 text-[10px] uppercase font-bold transition-all rounded",
              activeProvider === 'bubblemaps' ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            Bubblemaps.io
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Settings and Trash icons removed per user request */}
          <div className="w-8" />
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {/* Actual Iframe Integration */}
        {tokenMint ? (
          <iframe
            src={bubblemapsUrl}
            className="w-full h-full border-0 grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all duration-700"
            title="Bubble Map"
            allow="clipboard-write"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-4">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-neutral-800 flex items-center justify-center">
              <Search className="w-6 h-6 opacity-20" />
            </div>
            <span className="text-xs uppercase tracking-widest font-medium">Select a token to view bubble map</span>
          </div>
        )}

        {/* Overlay Buttons matching image */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-2 flex flex-col gap-2 shadow-2xl">
            <button className="w-8 h-8 flex items-center justify-center rounded-md bg-neutral-800 text-white">
              <span className="text-xs font-bold">K</span>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-neutral-800 text-neutral-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>

          <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-1.5 flex flex-col gap-2 shadow-2xl">
            <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-neutral-800 text-neutral-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-neutral-800 text-neutral-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        </div>

        {/* Address List Button */}
        <div className="absolute bottom-4 right-4 group">
          <button className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all backdrop-blur-md">
            <span>Address List</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {/* Powered By */}
        <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-[10px] font-bold text-neutral-500 tracking-tighter uppercase">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 19h20L12 2zm0 4.5L18.5 17h-13L12 6.5z" />
          </svg>
          <span>Powered by Bubblemaps</span>
        </div>
      </div>
    </div>
  );
}
