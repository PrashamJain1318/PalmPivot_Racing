'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface LoadingScreenProps {
  trackId: string;
  weather: string;
}

const TIPS = [
  'Keep both hands horizontally aligned in front of your camera to drive straight.',
  'Rotate your hands counter-clockwise to turn left, and clockwise to turn right.',
  'If one hand leaves the camera view, the engine projects your steering based on palm roll!',
  'Warp boosts (Nitro canisters) give you maximum torque for 5 seconds.',
  'Fuel is consumed during the race. Collect fuel canisters along the track to avoid DNF.',
  'Drifting increases your combo multiplier, earning you more coins at the finish line.',
  'Stay clear of barrier walls - impacts reduce chassis health and drop cruising speeds!'
];

export default function LoadingScreen({ trackId, weather }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  // Cycle tips every 3 seconds
  useEffect(() => {
    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 3200);

    // Simulate progress loading bar dynamically
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) {
          clearInterval(progressTimer);
          return 98;
        }
        return prev + Math.floor(Math.random() * 8) + 1;
      });
    }, 150);

    return () => {
      clearInterval(tipTimer);
      clearInterval(progressTimer);
    };
  }, []);

  // Determine category gradients matching selection screen
  let catGradient = 'from-slate-800 to-slate-950';
  if (trackId === 'suzuka') catGradient = 'from-amber-500 via-red-600 to-rose-950';
  else if (trackId.includes('city')) catGradient = 'from-blue-900 to-slate-950';
  else if (trackId.includes('highway')) catGradient = 'from-indigo-900 to-slate-950';
  else if (trackId.includes('desert') || trackId.includes('canyon')) catGradient = 'from-amber-800 via-orange-900 to-slate-950';
  else if (trackId.includes('mountain') || trackId.includes('volcano')) catGradient = 'from-red-900 via-orange-950 to-slate-950';
  else if (trackId.includes('snow')) catGradient = 'from-sky-900 via-slate-900 to-blue-950';
  else if (trackId.includes('forest') || trackId.includes('jungle')) catGradient = 'from-emerald-900 to-slate-950';
  else if (trackId.includes('beach') || trackId.includes('island')) catGradient = 'from-teal-900 via-slate-900 to-sky-950';
  else if (trackId.includes('cyberpunk')) catGradient = 'from-fuchsia-950 via-purple-950 to-slate-950';
  else if (trackId.includes('space')) catGradient = 'from-indigo-950 via-purple-950 to-black';

  return (
    <div className={`absolute inset-0 z-50 flex flex-col items-center justify-between p-12 bg-gradient-to-b ${catGradient} text-white font-mono select-none`}>
      {/* Top Header */}
      <div className="flex flex-col items-center mt-6">
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[11px] font-black tracking-[0.25em] text-cyan-400"
        >
          GEMINI INTELLIGENT RACING
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1.0 }}
          className="text-4xl font-black italic tracking-widest text-white mt-1 drop-shadow-[0_0_20px_rgba(6,182,212,0.45)]"
        >
          PALMPIVOT RACING
        </motion.h1>
      </div>

      {/* Middle Content: Loading details & tips */}
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        {/* Rotating Circular Neon spinner */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-cyan-500/10 border-t-cyan-400 rounded-full animate-spin shadow-[0_0_20px_rgba(6,182,212,0.3)]" />
          <span className="text-xs font-black text-white/80">{progress}%</span>
        </div>

        {/* Track Loading Details Card */}
        <div className="bg-black/45 border border-white/5 p-5 rounded-2xl backdrop-blur-md w-80 text-left space-y-2">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-white/40 uppercase">Circuit ID:</span>
            <span className="text-white font-bold uppercase">{trackId.replace('_', ' ')}</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-white/40 uppercase">Environment Presets:</span>
            <span className="text-cyan-400 font-bold uppercase">{weather} condition</span>
          </div>
        </div>

        {/* Dynamic tips panels */}
        <div className="h-16 flex items-center justify-center px-4">
          <motion.p
            key={tipIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-[10px] text-white/60 leading-relaxed font-sans"
          >
            💡 <span className="font-bold text-white/80">Pro Tip:</span> {TIPS[tipIndex]}
          </motion.p>
        </div>
      </div>

      {/* Bottom Loading Progress Bar */}
      <div className="w-full max-w-md flex flex-col gap-2 mb-6">
        <div className="flex justify-between items-center text-[9px] text-white/40">
          <span>CONNECTING MEDIA-PIPE DETECTORS...</span>
          <span className="font-bold">ESTABLISHING COLLIDERS</span>
        </div>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 to-[#00CFFF] rounded-full shadow-[0_0_8px_#06b6d4]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
