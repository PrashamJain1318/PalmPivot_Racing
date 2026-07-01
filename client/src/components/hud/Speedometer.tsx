'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SpeedometerProps {
  speed: number;
  rpm: number;
  gear: number;
  nitroActive: boolean;
}

export default function Speedometer({ speed, rpm, gear, nitroActive }: SpeedometerProps) {
  const maxSpeed = 320;
  const speedPct = Math.min(speed / maxSpeed, 1.0);
  const maxRpm = 8500;
  const rpmPct = Math.min(rpm / maxRpm, 1.0);

  // SVG Gauge Calculations
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  // Arc covers 240 degrees (from 150deg to 390deg)
  const arcLength = circumference * 0.67; 
  const speedOffset = arcLength - speedPct * arcLength;
  const rpmOffset = arcLength - rpmPct * arcLength;

  const getSpeedColor = () => {
    if (nitroActive) return 'text-amber-400';
    if (speedPct > 0.85) return 'text-rose-500';
    if (speedPct > 0.6) return 'text-cyan-400';
    return 'text-white';
  };

  const getGaugeStroke = () => {
    if (nitroActive) return 'url(#nitroGradient)';
    if (speedPct > 0.85) return '#f43f5e';
    return '#06b6d4';
  };

  return (
    <div className="relative w-52 h-52 flex items-center justify-center font-mono">
      {/* SVG Dial */}
      <svg className="absolute w-full h-full transform -rotate-210" viewBox="0 0 180 180">
        <defs>
          <linearGradient id="nitroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="6"
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeLinecap="round"
        />

        {/* RPM dynamic arc (outer thin ring) */}
        <circle
          cx="90"
          cy="90"
          r={radius + 4}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1.5"
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeLinecap="round"
        />
        <circle
          cx="90"
          cy="90"
          r={radius + 4}
          fill="none"
          stroke={nitroActive ? '#f59e0b' : '#38bdf8'}
          strokeWidth="2"
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={rpmOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.08s linear' }}
        />

        {/* Speed primary arc */}
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke={getGaugeStroke()}
          strokeWidth="7"
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={speedOffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.08s linear',
            filter: `drop-shadow(0 0 8px ${nitroActive ? '#f59e0b' : speedPct > 0.85 ? '#ef4444' : '#06b6d4'})`,
          }}
        />

        {/* Major Tick Marks */}
        {Array.from({ length: 9 }).map((_, i) => {
          const angle = (i / 8) * 240 + 150;
          const rad = (angle * Math.PI) / 180;
          const x1 = 90 + (radius - 10) * Math.cos(rad);
          const y1 = 90 + (radius - 10) * Math.sin(rad);
          const x2 = 90 + (radius - 4) * Math.cos(rad);
          const y2 = 90 + (radius - 4) * Math.sin(rad);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1.5"
            />
          );
        })}
      </svg>

      {/* Central Numerical Panel */}
      <div className="z-10 flex flex-col items-center justify-center text-center mt-3 select-none">
        {/* Gear Selector */}
        <span className="text-[10px] text-white/40 uppercase tracking-widest leading-none font-bold">GEAR</span>
        <motion.span
          key={gear}
          initial={{ scale: 0.7, opacity: 0.5 }}
          animate={{ scale: 1.0, opacity: 1 }}
          className="text-2xl font-black text-white leading-none mt-0.5"
        >
          {gear === 0 ? 'N' : gear === -1 ? 'R' : gear}
        </motion.span>

        {/* Digital Speedometer */}
        <div className="flex flex-col items-center mt-2 leading-none">
          <span className={`text-4xl font-extrabold tracking-tight ${getSpeedColor()} tabular-nums`}>
            {speed}
          </span>
          <span className="text-[8px] text-white/45 uppercase tracking-widest font-black mt-1">KM/H</span>
        </div>

        {/* RPM Bar */}
        <div className="w-16 h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-100 ${
              rpmPct > 0.85 ? 'bg-rose-500' : 'bg-cyan-400'
            }`}
            style={{ width: `${rpmPct * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
