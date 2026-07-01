'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onReturnToGarage: () => void;
  onExit: () => void;
  lap: number;
  score: number;
}

export default function PauseMenu({
  onResume,
  onRestart,
  onReturnToGarage,
  onExit,
  lap,
  score
}: PauseMenuProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md">
      {/* Container Card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1.0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-96 bg-white/95 border border-white/60 p-8 rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.15)] flex flex-col gap-6 text-slate-800 text-center font-mono select-none"
      >
        <div>
          <span className="text-[10px] font-black tracking-widest text-cyan-600 uppercase">PALMPIVOT RACING</span>
          <h2 className="text-3xl font-black italic tracking-wide text-slate-800 mt-1">RACE PAUSED</h2>
        </div>

        {/* Current Stats */}
        <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl text-xs flex flex-col gap-2 text-left">
          <div className="flex justify-between">
            <span className="text-slate-400">Current Lap:</span>
            <span className="font-bold text-slate-800">{lap}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2">
            <span className="text-slate-400">Drift Score:</span>
            <span className="font-bold text-cyan-600">{score.toLocaleString()}</span>
          </div>
        </div>

        {/* Buttons List */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onResume}
            className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition pointer-events-auto"
          >
            Resume Race
          </button>
          
          <button
            onClick={onRestart}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest rounded-xl transition pointer-events-auto"
          >
            Restart Route
          </button>

          <button
            onClick={onReturnToGarage}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest rounded-xl transition pointer-events-auto"
          >
            Tune Garage
          </button>

          <button
            onClick={onExit}
            className="w-full py-3 border border-red-200 hover:bg-red-50 text-red-500 font-bold text-xs uppercase tracking-widest rounded-xl transition pointer-events-auto"
          >
            Abandon Race
          </button>
        </div>
      </motion.div>
    </div>
  );
}
