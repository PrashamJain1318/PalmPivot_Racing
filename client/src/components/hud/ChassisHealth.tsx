'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChassisHealthProps {
  health: number;
}

export default function ChassisHealth({ health }: ChassisHealthProps) {
  const prevHealthRef = useRef(health);
  const [damagedTrigger, setDamagedTrigger] = useState(false);

  useEffect(() => {
    if (health < prevHealthRef.current - 1) {
      // Collision registered!
      setDamagedTrigger(true);
      const timer = setTimeout(() => setDamagedTrigger(false), 800);
      return () => clearTimeout(timer);
    }
    prevHealthRef.current = health;
  }, [health]);

  const segmentsCount = 10;
  const activeSegments = Math.round((health / 100) * segmentsCount);

  return (
    <div className="flex flex-col gap-1 w-full font-mono text-[9px] relative select-none">
      <div className="flex justify-between items-center text-white/50">
        <span className={`font-bold uppercase tracking-wider flex items-center gap-1.5 ${
          damagedTrigger ? 'text-rose-500 animate-pulse font-extrabold' : ''
        }`}>
          <span>❤️</span> CHASSIS HEALTH
        </span>
        <span className={`font-black tabular-nums ${
          health < 30 ? 'text-rose-500 animate-pulse' : 'text-white/80'
        }`}>
          {Math.round(health)}%
        </span>
      </div>

      {/* Segmented bar display */}
      <div className="flex gap-1 h-[6px]">
        {Array.from({ length: segmentsCount }).map((_, idx) => {
          const isActive = idx < activeSegments;
          let segmentColor = 'bg-white/10';
          if (isActive) {
            if (health < 30) segmentColor = 'bg-rose-500 shadow-[0_0_6px_#ef4444]';
            else if (health < 60) segmentColor = 'bg-amber-400 shadow-[0_0_6px_#fbbf24]';
            else segmentColor = 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]';
          }

          return (
            <motion.div
              key={idx}
              className={`flex-1 rounded-sm transition-all duration-300 ${segmentColor}`}
              animate={damagedTrigger && isActive ? { scaleY: [1, 1.4, 1] } : {}}
            />
          );
        })}
      </div>

      {/* Screen flash border overlay on damage collision */}
      <AnimatePresence>
        {damagedTrigger && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 border-8 border-red-600 pointer-events-none z-50 mix-blend-screen"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
