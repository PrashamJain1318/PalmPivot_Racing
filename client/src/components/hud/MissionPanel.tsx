'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Square, Award } from 'lucide-react';

interface MissionPanelProps {
  coinsCollected: number;
  health: number;
}

export default function MissionPanel({ coinsCollected, health }: MissionPanelProps) {
  const coinTarget = 5;
  const isCoinTaskDone = coinsCollected >= coinTarget;
  const isChassisTaskDone = health >= 75;

  return (
    <div className="bg-black/60 border border-white/10 rounded-2xl p-4 backdrop-blur-xl shadow-lg w-52 select-none font-mono text-[9px] text-white">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
        <span className="text-[8px] text-cyan-400 font-black uppercase tracking-widest flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5" /> Race Challenges
        </span>
        <span className="text-[7px] text-white/40 uppercase">BONUS REWARDS</span>
      </div>

      {/* Task List */}
      <div className="space-y-2.5">
        {/* Task 1: Coins */}
        <div className="flex items-start gap-2">
          <div className="mt-0.5">
            {isCoinTaskDone ? (
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Square className="w-3.5 h-3.5 text-white/30" />
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className={`font-bold ${isCoinTaskDone ? 'text-white/40 line-through' : 'text-white/80'}`}>
              Collect {coinTarget} Coins
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-cyan-400"
                  animate={{ width: `${Math.min((coinsCollected / coinTarget) * 100, 100)}%` }}
                />
              </div>
              <span className="text-[7px] text-white/40 font-bold tabular-nums">
                {coinsCollected}/{coinTarget}
              </span>
            </div>
          </div>
        </div>

        {/* Task 2: Health limit */}
        <div className="flex items-start gap-2">
          <div className="mt-0.5">
            {isChassisTaskDone ? (
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Square className="w-3.5 h-3.5 text-rose-500" />
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className={`font-bold ${!isChassisTaskDone ? 'text-rose-400' : 'text-white/80'}`}>
              Keep Chassis Health &gt; 75%
            </span>
            <span className="text-[7px] text-white/40">
              Current Health: <span className={isChassisTaskDone ? 'text-emerald-400 font-bold' : 'text-rose-500 font-bold'}>{health}%</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
