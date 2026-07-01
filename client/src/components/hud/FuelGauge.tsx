'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FuelGaugeProps {
  fuel: number;
}

export default function FuelGauge({ fuel }: FuelGaugeProps) {
  const prevFuelRef = useRef(fuel);
  const [showPickupGlow, setShowPickupGlow] = useState(false);

  useEffect(() => {
    if (fuel > prevFuelRef.current + 2) {
      // Fuel collected! Trigger golden glow animation
      setShowPickupGlow(true);
      const timer = setTimeout(() => setShowPickupGlow(false), 1200);
      return () => clearTimeout(timer);
    }
    prevFuelRef.current = fuel;
  }, [fuel]);

  const isLow = fuel < 20;
  const isCritical = fuel < 10;

  const getFuelColor = () => {
    if (isCritical) return 'bg-gradient-to-r from-red-600 to-rose-500';
    if (isLow) return 'bg-gradient-to-r from-amber-500 to-red-500';
    return 'bg-gradient-to-r from-sky-400 to-cyan-400';
  };

  return (
    <div className="flex flex-col gap-1 w-full font-mono text-[9px] relative select-none">
      <div className="flex justify-between items-center text-white/50">
        <span className={`font-bold uppercase tracking-wider flex items-center gap-1.5 ${
          isLow ? 'text-red-400 animate-pulse font-extrabold' : ''
        }`}>
          <span>⛽</span> FUEL LEVEL
        </span>
        <span className={`font-black tabular-nums ${
          isCritical ? 'text-rose-500 text-xs animate-bounce' : isLow ? 'text-amber-400' : 'text-white/80'
        }`}>
          {Math.round(fuel)}%
        </span>
      </div>

      {/* Progress Bar Container */}
      <div className="h-[6px] bg-white/10 rounded-full overflow-hidden relative border border-white/5 shadow-inner">
        {/* Glow effect when picking up canisters */}
        <AnimatePresence>
          {showPickupGlow && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-amber-400 blur-sm mix-blend-screen"
            />
          )}
        </AnimatePresence>

        {/* Dynamic bar fill */}
        <motion.div
          className={`h-full rounded-full ${getFuelColor()}`}
          animate={{ width: `${fuel}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 15 }}
          style={{
            boxShadow: showPickupGlow 
              ? '0 0 12px #f59e0b' 
              : isCritical 
              ? '0 0 8px #ef4444' 
              : isLow 
              ? '0 0 6px #f59e0b' 
              : '0 0 4px #22d3ee',
          }}
        />
      </div>

      {/* Warnings & Alerts */}
      <AnimatePresence>
        {isCritical && (
          <motion.span
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="text-[7px] text-red-500 font-bold uppercase tracking-widest mt-1 animate-pulse"
          >
            ⚠️ CRITICAL FUEL ALERT: REFUEL IMMEDIATELY!
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
