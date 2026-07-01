'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationsProps {
  lap: number;
  fuel: number;
  health: number;
  nitroActive: boolean;
  scoreMultiplier: number;
}

interface NotificationItem {
  id: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  title: string;
  subtitle: string;
}

export default function Notifications({
  lap,
  fuel,
  health,
  nitroActive,
  scoreMultiplier
}: NotificationsProps) {
  const [list, setList] = useState<NotificationItem[]>([]);

  // Refs to monitor state changes
  const prevLap = useRef(lap);
  const prevFuel = useRef(fuel);
  const prevHealth = useRef(health);
  const prevNitro = useRef(nitroActive);
  const prevMult = useRef(scoreMultiplier);
  const warnedLowFuel = useRef(false);

  const addNotification = (type: NotificationItem['type'], title: string, subtitle: string) => {
    const newId = Math.random().toString(36).substring(2, 9);
    const item = { id: newId, type, title, subtitle };
    
    setList((prev) => [...prev, item]);
    
    // Automatically clear notification after 2.8 seconds
    setTimeout(() => {
      setList((prev) => prev.filter((n) => n.id !== newId));
    }, 2800);
  };

  useEffect(() => {
    // 1. Lap completed
    if (lap > prevLap.current) {
      addNotification('success', `LAP ${prevLap.current} COMPLETED`, 'Keep pushing for the record! 🏁');
    }
    prevLap.current = lap;

    // 2. Fuel collected
    if (fuel > prevFuel.current + 3) {
      addNotification('info', 'FUEL CANISTER COLLECTED', 'Engine energy restored +30% ⛽');
    }
    // Low fuel warning
    if (fuel < 20 && !warnedLowFuel.current) {
      addNotification('warning', 'LOW FUEL WARNING', 'Locate fuel containers quickly! ⛽');
      warnedLowFuel.current = true;
    } else if (fuel >= 20) {
      warnedLowFuel.current = false;
    }
    prevFuel.current = fuel;

    // 3. Collision damage
    if (health < prevHealth.current - 2) {
      const damage = Math.round(prevHealth.current - health);
      addNotification('alert', 'COLLISION DAMAGE DETECTED', `Chassis strength reduced by -${damage}% 💥`);
    }
    prevHealth.current = health;

    // 4. Nitro Boost
    if (nitroActive && !prevNitro.current) {
      addNotification('success', 'NITRO WARP CORE INITIATED', 'Warp speed active! ⚡');
    }
    prevNitro.current = nitroActive;

    // 5. Score multiplier increase
    if (scoreMultiplier > prevMult.current) {
      addNotification('info', `DRIFT COMBO ×${scoreMultiplier}`, 'Bonus speed multiplier upgraded! 🔥');
    }
    prevMult.current = scoreMultiplier;

  }, [lap, fuel, health, nitroActive, scoreMultiplier]);

  const getTypeStyle = (type: NotificationItem['type']) => {
    switch (type) {
      case 'success': return 'border-emerald-500/30 bg-emerald-950/75 text-emerald-400';
      case 'warning': return 'border-amber-500/30 bg-amber-950/75 text-amber-400';
      case 'alert': return 'border-rose-500/30 bg-rose-950/75 text-rose-400';
      default: return 'border-cyan-500/30 bg-cyan-950/75 text-cyan-400';
    }
  };

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-40 select-none font-mono text-center pointer-events-none w-80 max-w-xs">
      <AnimatePresence>
        {list.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1.0 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            className={`border rounded-2xl px-5 py-3 backdrop-blur-xl shadow-lg flex flex-col gap-0.5 items-center justify-center ${getTypeStyle(item.type)}`}
          >
            <span className="text-[9px] font-black tracking-widest uppercase">
              {item.title}
            </span>
            <span className="text-[8px] text-white/60 font-sans mt-0.5">
              {item.subtitle}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
