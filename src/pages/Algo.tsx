import React, { useEffect, useState } from 'react';

const GlitchText = ({ text }: { text: string }) => {
  return (
    <div className="relative inline-block group">
      <h1 className="text-6xl md:text-9xl font-black text-white tracking-widest relative z-10 mix-blend-difference select-none">
        {text}
      </h1>

      {/* Glitch Layer 1 - Cyan */}
      <h1 className="absolute top-0 left-0 text-6xl md:text-9xl font-black text-cyan-400 tracking-widest opacity-70 animate-bounce translate-x-[2px] z-0 mix-blend-screen overflow-hidden clip-path-inset pointer-events-none">
        {text}
      </h1>

      {/* Glitch Layer 2 - Magenta */}
      <h1 className="absolute top-0 left-0 text-6xl md:text-9xl font-black text-magenta-500 tracking-widest opacity-70 animate-pulse -translate-x-[2px] translate-y-[1px] z-0 mix-blend-screen overflow-hidden clip-path-inset delay-75 pointer-events-none">
        {text}
      </h1>

      {/* Scanline Effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent h-2 w-full animate-scanline pointer-events-none opacity-50" />

      <style>{`
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .animate-scanline {
          animation: scanline 3s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default function Algo() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center overflow-hidden relative">
      {/* CRT Overlay Effect */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-20" />

      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-1000">
        <GlitchText text="COMING SOON" />

        <div className="flex items-center gap-4 mt-8">
          <div className="h-[1px] w-12 bg-gray-800" />
          <span className="text-gray-500 font-mono text-sm tracking-[0.5em] uppercase text-shadow-glow">System Upgrade In Progress</span>
          <div className="h-[1px] w-12 bg-gray-800" />
        </div>
      </div>
    </div>
  );
}
