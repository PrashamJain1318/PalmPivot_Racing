'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NitroMeterProps {
  nitroLevel: number;
  nitroActive: boolean;
}

export default function NitroMeter({ nitroLevel, nitroActive }: NitroMeterProps) {
  // If active, nitroLevel maps to remaining seconds scaled: (timer * 20), so range is 0-100
  const max = 100;
  const pct = Math.max(0, Math.min(100, (nitroLevel / max) * 100));

  // Determine timer seconds if active
  const remainingSeconds = nitroActive ? (nitroLevel / 20).toFixed(1) : null;

  return (
    <div className="flex flex-col gap-1 w-full font-mono text-[9px] relative select-none">
      <div className="flex justify-between items-center text-white/50">
        <span className={`font-bold uppercase tracking-wider flex items-center gap-1.5 ${
          nitroActive ? 'text-amber-400 font-extrabold animate-pulse' : ''
        }`}>
          <span>⚡</span> NITRO
        </span>
        <span className={`font-black tabular-nums ${
          nitroActive ? 'text-amber-400 text-xs' : 'text-white/80'
        }`}>
          {nitroActive ? `${remainingSeconds}s` : `${Math.round(nitroLevel)}%`}
        </span>
      </div>

      {/* Progress Bar Container */}
      <div className="h-[6px] bg-white/10 rounded-full overflow-hidden relative border border-white/5 shadow-inner">
        {/* Glowing boost core */}
        <AnimatePresence>
          {nitroActive && (
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white to-transparent opacity-40"
            />
          )}
        </AnimatePresence>

        {/* Dynamic bar fill */}
        <motion.div
          className={`h-full rounded-full ${
            nitroActive 
              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500' 
              : 'bg-gradient-to-r from-purple-500 to-violet-500'
          }`}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 90, damping: 14 }}
          style={{
            boxShadow: nitroActive 
              ? '0 0 10px #f59e0b, 0 0 4px #ef4444' 
              : '0 0 3px #8b5cf6',
          }}
        />
      </div>

      {/* Boost Active Alert Text */}
      <AnimatePresence>
        {nitroActive && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1.0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-[7px] text-amber-400 font-black uppercase tracking-widest text-center mt-1 animate-pulse"
          >
            ⚡ HYPER WARP BOOST ACTIVE ⚡
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
