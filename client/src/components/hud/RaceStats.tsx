'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface RaceStatsProps {
  lap: number;
  totalLaps: number;
  raceTime: number;
  score: number;
  scoreMultiplier: number;
}

export default function RaceStats({
  lap,
  totalLaps,
  raceTime,
  score,
  scoreMultiplier
}: RaceStatsProps) {

  // Helper to format raceTime ms into MM:SS.CC
  const formatTime = (timeMs: number) => {
    const minutes = Math.floor(timeMs / 60000);
    const seconds = Math.floor((timeMs % 60000) / 1000);
    const centiseconds = Math.floor((timeMs % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex gap-3 font-mono select-none">
      {/* Lap Counter Panel */}
      <div className="bg-black/60 border border-white/10 rounded-2xl px-4 py-3 flex flex-col items-center min-w-[76px] backdrop-blur-xl shadow-lg">
        <span className="text-[7px] text-white/40 uppercase tracking-widest font-black">LAP</span>
        <motion.span
          key={lap}
          initial={{ scale: 0.7, opacity: 0.4 }}
          animate={{ scale: 1.0, opacity: 1 }}
          className="text-2xl font-black text-white leading-none mt-1 tabular-nums"
        >
          {lap}
        </motion.span>
        <span className="text-[8px] text-white/35 font-medium mt-1">OF {totalLaps}</span>
      </div>

      {/* Race Timer Panel */}
      <div className="bg-black/60 border border-white/10 rounded-2xl px-5 py-3 flex flex-col min-w-[100px] backdrop-blur-xl shadow-lg">
        <span className="text-[7px] text-white/40 uppercase tracking-widest font-black">LAP TIME</span>
        <span className="text-base font-black text-cyan-400 leading-tight mt-1 tabular-nums tracking-wide">
          {formatTime(raceTime)}
        </span>
        <span className="text-[7px] text-white/30 uppercase mt-0.5">ELAPSED</span>
      </div>

      {/* Score and Multiplier Panel */}
      <div className="bg-black/60 border border-white/10 rounded-2xl px-5 py-3 flex flex-col min-w-[100px] backdrop-blur-xl shadow-lg">
        <span className="text-[7px] text-white/40 uppercase tracking-widest font-black">DRIFT SCORE</span>
        <span className="text-base font-black text-amber-400 leading-tight mt-1 tabular-nums">
          {score.toLocaleString()}
        </span>
        <motion.span
          key={scoreMultiplier}
          animate={{ scale: [1, 1.25, 1] }}
          className="text-[7px] text-amber-500 font-extrabold uppercase mt-0.5"
        >
          ×{scoreMultiplier} MULTIPLIER
        </motion.span>
      </div>
    </div>
  );
}
