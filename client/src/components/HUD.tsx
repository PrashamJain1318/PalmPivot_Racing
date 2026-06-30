'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Eye } from 'lucide-react';
import { getProceduralTrackPoints } from '@/utils/trackGenerator';

// ── Animated SVG Speedometer Dial ──
function SpeedometerDial({ speed, maxSpeed = 320 }: { speed: number; maxSpeed?: number }) {
  const clampedSpeed = Math.min(speed, maxSpeed);
  const pct = clampedSpeed / maxSpeed;
  
  // Arc spans 240 degrees, from 210° to 330° (clockwise)
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.667; // 240/360
  const arcLength = circumference * arcFraction;
  const dashOffset = arcLength - pct * arcLength;

  const speedColor = pct > 0.85 ? '#ef4444' : pct > 0.65 ? '#f59e0b' : '#00d4ff';

  return (
    <svg viewBox="0 0 180 180" className="w-full h-full" style={{ transform: 'rotate(150deg)' }}>
      {/* Background track */}
      <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10"
        strokeDasharray={`${arcLength} ${circumference - arcLength}`} strokeLinecap="round" />
      {/* Speed arc */}
      <circle cx="90" cy="90" r={radius} fill="none" stroke={speedColor} strokeWidth="10"
        strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.08s linear, stroke 0.3s ease', filter: `drop-shadow(0 0 8px ${speedColor})` }}
      />
      {/* Tick marks */}
      {Array.from({ length: 13 }).map((_, i) => {
        const angle = (i / 12) * 240 - 120;
        const rad = (angle * Math.PI) / 180;
        const isMajor = i % 3 === 0;
        const len = isMajor ? 10 : 6;
        const x1 = 90 + (radius - 14) * Math.cos(rad);
        const y1 = 90 + (radius - 14) * Math.sin(rad);
        const x2 = 90 + (radius - 14 - len) * Math.cos(rad);
        const y2 = 90 + (radius - 14 - len) * Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={isMajor ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)'} strokeWidth={isMajor ? 2 : 1} />;
      })}
    </svg>
  );
}

// ── FPS Counter ──
function useFPS() {
  const [fps, setFps] = useState(60);
  const fpsRef = useRef({ frames: 0, last: performance.now() });
  useEffect(() => {
    let id: number;
    const tick = () => {
      fpsRef.current.frames++;
      const now = performance.now();
      if (now >= fpsRef.current.last + 1000) {
        setFps(Math.round((fpsRef.current.frames * 1000) / (now - fpsRef.current.last)));
        fpsRef.current.frames = 0;
        fpsRef.current.last = now;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  return fps;
}

// ── Bar Gauge ──
function BarGauge({ label, value, max = 100, color, icon, warn }: {
  label: string; value: number; max?: number; color: string; icon: string; warn?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className={`text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${warn ? 'text-red-400 animate-pulse' : 'text-white/50'}`}>
          <span>{icon}</span>{label}
        </span>
        <span className={`text-[9px] font-black tabular-nums ${warn ? 'text-red-400' : 'text-white/80'}`}>
          {Math.round(value)}{max === 100 ? '%' : ''}
        </span>
      </div>
      <div className="h-[5px] bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{
            width: `${pct}%`,
            background: warn ? 'linear-gradient(90deg, #ef4444, #f97316)' : color,
            boxShadow: `0 0 6px ${warn ? '#ef4444' : color.split(',')[0].replace('linear-gradient(90deg,', '')}`,
          }}
        />
      </div>
    </div>
  );
}

export default function HUD() {
  const {
    speed, rpm, gear, nitroLevel, nitroActive,
    lap, totalLaps, raceTime, health, fuel,
    coinsCollected, distance, score, scoreMultiplier,
    shieldActive, currentGesture, handDetected,
    handConfidence, steeringAngle, webcamLighting,
    playerPosition, currentTrack, status,
  } = useGameStore();

  const { cameraMode, setCameraMode } = useSettingsStore();
  const fps = useFPS();

  // Minimap path computation
  const { trackPath, mappedX, mappedY } = useMemo(() => {
    const points = getProceduralTrackPoints(currentTrack || 'track_1');
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    points.forEach((p) => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); });
    const wR = maxX - minX || 1, hR = maxZ - minZ || 1, pad = 12, svgS = 160;
    const svgPts = points.map((p) => `${(pad + ((p.x - minX) / wR) * (svgS - 2 * pad)).toFixed(1)},${(pad + ((p.z - minZ) / hR) * (svgS - 2 * pad)).toFixed(1)}`);
    return {
      trackPath: `M ${svgPts.join(' L ')} Z`,
      mappedX: pad + ((playerPosition[0] - minX) / wR) * (svgS - 2 * pad),
      mappedY: pad + ((playerPosition[1] - minZ) / hR) * (svgS - 2 * pad),
    };
  }, [currentTrack, playerPosition]);

  // Fuel alarm
  useEffect(() => {
    if (fuel < 20 && fuel > 0 && status === 'playing') {
      const id = setInterval(() => {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.type = 'sine'; osc.frequency.setValueAtTime(fuel < 10 ? 880 : 580, ctx.currentTime);
          gain.gain.setValueAtTime(0.025, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
          osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.12);
        } catch {}
      }, fuel < 10 ? 350 : 750);
      return () => clearInterval(id);
    }
  }, [fuel, status]);

  const formatTime = (ms: number) => {
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), cs = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
  };

  const cycleCamera = () => {
    const modes = ['thirdPerson', 'farChase', 'cockpit', 'hood', 'orbit', 'replay'] as const;
    const i = modes.indexOf(cameraMode as any);
    setCameraMode(modes[(i + 1) % modes.length]);
  };

  const cameraModeLabel: Record<string, string> = {
    thirdPerson: 'CHASE', farChase: 'FAR', cockpit: 'COCKPIT', hood: 'HOOD', orbit: 'ORBIT', replay: 'REPLAY',
  };

  const lightQuality = webcamLighting > 75 ? { text: 'EXCELLENT', c: 'text-emerald-400' }
    : webcamLighting > 45 ? { text: 'GOOD', c: 'text-amber-400' }
    : { text: 'LOW', c: 'text-red-400' };

  // Glass panel base class
  const glass = 'bg-black/60 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]';

  return (
    <div className="absolute inset-0 pointer-events-none z-10 select-none font-['Inter',system-ui,sans-serif] overflow-hidden">

      {/* ══ TOP LEFT — Race Info & Minimap ══ */}
      <div className="absolute top-5 left-5 flex flex-col gap-2.5">

        {/* Race stats row */}
        <div className="flex gap-2">
          {/* Lap counter */}
          <div className={`${glass} rounded-2xl px-4 py-3 flex flex-col items-center min-w-[72px]`}>
            <span className="text-[8px] text-white/40 uppercase tracking-widest font-semibold">LAP</span>
            <span className="text-2xl font-black text-white leading-tight tabular-nums">{lap}</span>
            <span className="text-[8px] text-white/35 font-medium">of {totalLaps}</span>
          </div>

          {/* Race timer */}
          <div className={`${glass} rounded-2xl px-4 py-3 flex flex-col`}>
            <span className="text-[8px] text-white/40 uppercase tracking-widest font-semibold">TIME</span>
            <span className="text-base font-black text-[#00d4ff] leading-tight tabular-nums tracking-wide">{formatTime(raceTime)}</span>
            <span className="text-[8px] text-white/35">ELAPSED</span>
          </div>

          {/* Position / Score */}
          <div className={`${glass} rounded-2xl px-4 py-3 flex flex-col`}>
            <span className="text-[8px] text-white/40 uppercase tracking-widest font-semibold">SCORE</span>
            <span className="text-base font-black text-amber-400 leading-tight tabular-nums">{score.toLocaleString()}</span>
            <span className="text-[8px] text-amber-500/70">×{scoreMultiplier} MULT</span>
          </div>
        </div>

        {/* Minimap */}
        <div className={`${glass} rounded-2xl p-3 w-[140px]`}>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[7px] text-white/40 uppercase tracking-widest font-bold">GPS RADAR</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-ping" />
          </div>
          <div className="relative bg-black/40 rounded-xl overflow-hidden aspect-square">
            <svg viewBox="0 0 160 160" className="w-full h-full">
              <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="6" />
              <circle cx={mappedX} cy={mappedY} r="7" fill="#00d4ff" style={{ filter: 'drop-shadow(0 0 4px #00d4ff)' }} />
              <circle cx={mappedX} cy={mappedY} r="12" fill="none" stroke="#00d4ff" strokeWidth="1.5" opacity="0.4" />
            </svg>
          </div>
          <div className="mt-1.5 flex justify-between text-[7px] text-white/30">
            <span>{distance}m</span>
            <span>🪙{coinsCollected}</span>
          </div>
        </div>
      </div>

      {/* ══ TOP CENTER — Low Fuel Warning ══ */}
      {fuel < 20 && fuel > 0 && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2">
          <div className="bg-red-600/25 border border-red-500/60 rounded-2xl px-6 py-3 backdrop-blur-xl flex items-center gap-3 animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.3)]">
            <span className="text-2xl">⛽</span>
            <div>
              <div className="text-red-400 font-black text-xs uppercase tracking-widest">Low Fuel Warning</div>
              <div className="text-white/70 text-[10px]">Collect fuel canisters to continue</div>
            </div>
          </div>
        </div>
      )}

      {/* ══ TOP RIGHT — System Info ══ */}
      <div className="absolute top-5 right-5 flex flex-col gap-2 items-end">
        {/* Camera cycle button */}
        <button
          onClick={cycleCamera}
          className={`${glass} rounded-xl px-3 py-2.5 pointer-events-auto flex items-center gap-2 hover:bg-white/10 transition-colors active:scale-95`}
        >
          <Eye className="w-4 h-4 text-white/60" />
          <span className="text-[9px] font-bold text-white/60 uppercase tracking-wide">{cameraModeLabel[cameraMode] || 'CAM'}</span>
        </button>

        {/* FPS + Cam light quality */}
        <div className={`${glass} rounded-xl px-3 py-2 flex flex-col gap-0.5 items-end`}>
          <span className="text-[8px] text-white/35 uppercase tracking-wide">
            FPS <span className={`font-black ${fps >= 55 ? 'text-emerald-400' : fps >= 30 ? 'text-amber-400' : 'text-red-400'}`}>{fps}</span>
          </span>
          <span className={`text-[8px] uppercase tracking-wide ${lightQuality.c} font-bold`}>
            CAM {lightQuality.text}
          </span>
          {shieldActive && (
            <span className="text-[8px] text-blue-400 font-black uppercase animate-pulse">🛡 SHIELD ON</span>
          )}
        </div>
      </div>

      {/* ══ BOTTOM LEFT — Speedometer ══ */}
      <div className="absolute bottom-5 left-5">
        <div className={`${glass} rounded-3xl p-3 w-44 h-44 relative flex items-center justify-center`}>
          {/* Dial */}
          <div className="absolute inset-3">
            <SpeedometerDial speed={speed} />
          </div>
          {/* Digital readout */}
          <div className="flex flex-col items-center z-10 mt-2">
            <span className="text-[8px] text-white/35 uppercase tracking-widest font-semibold">KM/H</span>
            <span
              className="text-5xl font-black tabular-nums leading-none"
              style={{ color: speed > 270 ? '#ef4444' : speed > 180 ? '#f59e0b' : 'white' }}
            >
              {speed}
            </span>
            <div className={`mt-1.5 px-2.5 py-0.5 rounded text-[9px] font-black border ${
              rpm > 7600 ? 'border-red-500 text-red-400 animate-pulse' : 'border-white/20 text-white/50'
            }`}>
              G{gear}
            </div>
          </div>

          {/* RPM arc thin ring */}
          <svg className="absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)] opacity-40" viewBox="0 0 140 140" style={{ transform: 'rotate(-210deg)' }}>
            <circle cx="70" cy="70" r="64" fill="none" stroke={rpm > 7600 ? '#ef4444' : '#ffffff'}
              strokeWidth="3" strokeDasharray={`${(rpm / 8500) * 402} 402`} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.1s linear' }} />
          </svg>
        </div>
      </div>

      {/* ══ BOTTOM CENTER — Gesture Steering Indicator ══ */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
        <div className={`${glass} rounded-2xl px-6 py-4 flex items-center gap-5 min-w-[280px]`}>
          {/* Animated steering wheel */}
          <div
            className="w-14 h-14 flex-shrink-0 transition-transform duration-75"
            style={{ transform: `rotate(${steeringAngle * 85}deg)` }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="44" stroke={handDetected ? '#00d4ff' : 'rgba(255,255,255,0.2)'} strokeWidth="6" fill="none"
                style={{ filter: handDetected ? 'drop-shadow(0 0 6px #00d4ff)' : 'none', transition: 'stroke 0.3s' }} />
              <circle cx="50" cy="50" r="9" fill={handDetected ? '#00d4ff' : 'rgba(255,255,255,0.2)'} style={{ transition: 'fill 0.3s' }} />
              <line x1="50" y1="50" x2="50" y2="9" stroke={handDetected ? '#00d4ff' : 'rgba(255,255,255,0.2)'} strokeWidth="5.5" strokeLinecap="round" />
              <line x1="50" y1="50" x2="14" y2="70" stroke={handDetected ? '#00d4ff' : 'rgba(255,255,255,0.2)'} strokeWidth="5.5" strokeLinecap="round" />
              <line x1="50" y1="50" x2="86" y2="70" stroke={handDetected ? '#00d4ff' : 'rgba(255,255,255,0.2)'} strokeWidth="5.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Status text */}
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${handDetected ? 'bg-emerald-400 animate-ping' : 'bg-red-400'}`} />
              <span className={`text-xs font-black uppercase tracking-wide ${handDetected ? 'text-white' : 'text-white/40'}`}>
                {handDetected
                  ? Math.abs(steeringAngle) > 0.12
                    ? steeringAngle > 0 ? '▶ STEERING RIGHT' : '◀ STEERING LEFT'
                    : '● CENTERED'
                  : 'NO HANDS DETECTED'
                }
              </span>
            </div>
            {handDetected && (
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full transition-all duration-150" style={{ width: `${handConfidence}%` }} />
                </div>
                <span className="text-[8px] text-white/35 font-bold">{handConfidence}%</span>
              </div>
            )}
            <span className="text-[8px] text-white/30 uppercase tracking-wider">
              🤲 Rotate hands to steer · Auto-accel active
            </span>
          </div>
        </div>
      </div>

      {/* ══ BOTTOM RIGHT — Status Gauges ══ */}
      <div className="absolute bottom-5 right-5">
        <div className={`${glass} rounded-2xl px-4 py-4 w-52 flex flex-col gap-3`}>
          <BarGauge
            label="Chassis" value={health} icon="❤️"
            color="linear-gradient(90deg, #10b981, #34d399)"
            warn={health < 30}
          />
          <BarGauge
            label="Fuel" value={fuel} icon="⛽"
            color="linear-gradient(90deg, #0ea5e9, #22d3ee)"
            warn={fuel < 20}
          />
          <div className="h-px bg-white/8" />
          <BarGauge
            label="Nitro" value={nitroLevel} icon="⚡"
            color={nitroActive ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, #7c3aed, #a855f7)'}
          />
          {nitroActive && (
            <div className="text-center text-[8px] text-amber-400 font-black uppercase tracking-widest animate-pulse">
              ⚡ BOOST ACTIVE
            </div>
          )}
        </div>
      </div>

      {/* ══ ACTIVE POWERUP CENTER RIGHT ══ */}
      {(shieldActive || nitroActive) && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col gap-2">
          {shieldActive && (
            <div className={`${glass} rounded-xl px-3 py-2 flex items-center gap-2`}>
              <span className="text-lg">🛡️</span>
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-wide animate-pulse">SHIELD</span>
            </div>
          )}
          {nitroActive && (
            <div className={`${glass} rounded-xl px-3 py-2 flex items-center gap-2`}>
              <span className="text-lg">⚡</span>
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-wide animate-pulse">WARP</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
