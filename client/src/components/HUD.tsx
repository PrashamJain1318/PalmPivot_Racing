'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Eye, Sun, Moon, Volume2, Sparkles } from 'lucide-react';

// Modular HUD Subcomponents
import Speedometer from './hud/Speedometer';
import FuelGauge from './hud/FuelGauge';
import NitroMeter from './hud/NitroMeter';
import Minimap from './hud/Minimap';
import GestureStatus from './hud/GestureStatus';
import RaceStats from './hud/RaceStats';
import Notifications from './hud/Notifications';
import MissionPanel from './hud/MissionPanel';
import PauseMenu from './hud/PauseMenu';
import ChassisHealth from './hud/ChassisHealth';

// ── FPS Counter hook ──
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

export default function HUD() {
  // Game state selectors
  const {
    speed, rpm, gear, nitroLevel, nitroActive,
    lap, totalLaps, raceTime, health, fuel,
    coinsCollected, distance, score, scoreMultiplier,
    shieldActive, magnetActive, currentGesture, handDetected,
    handConfidence, steeringAngle, webcamLighting, webcamFps,
    leftHandConfidence, rightHandConfidence, handsCount,
    trackingLatency, currentTrack, status, setStatus, resetRaceStats
  } = useGameStore();

  // Settings state selectors
  const {
    cameraMode, setCameraMode,
    theme, setTheme
  } = useSettingsStore();

  const fps = useFPS();

  // Camera Switch labels
  const cameraModeLabel: Record<string, string> = {
    thirdPerson: 'CHASE',
    farChase: 'FAR',
    cockpit: 'COCKPIT',
    hood: 'HOOD',
    orbit: 'ORBIT',
    replay: 'REPLAY',
  };

  const cycleCamera = () => {
    const modes = ['thirdPerson', 'farChase', 'cockpit', 'hood', 'orbit', 'replay'] as const;
    const i = modes.indexOf(cameraMode as any);
    setCameraMode(modes[(i + 1) % modes.length]);
  };

  // Toggle Theme helper
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('settings_theme', nextTheme);
  };

  // Glassmorphic styling base class based on active theme
  const glass = theme === 'dark'
    ? 'bg-black/60 border-white/10 text-white shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl border'
    : 'bg-white/80 border-slate-200/50 text-slate-800 shadow-[0_8px_32px_rgba(15,23,42,0.15)] backdrop-blur-xl border';

  return (
    <div className="absolute inset-0 pointer-events-none z-10 select-none overflow-hidden font-sans">
      
      {/* ══ TOP LEFT: Race Stats ══ */}
      <div className="absolute top-5 left-5">
        <RaceStats
          lap={lap}
          totalLaps={totalLaps}
          raceTime={raceTime}
          score={score}
          scoreMultiplier={scoreMultiplier}
        />
      </div>

      {/* ══ TOP RIGHT: Camera Control, FPS & Light/Dark Theme Toggle ══ */}
      <div className="absolute top-5 right-5 flex items-center gap-3">
        {/* Toggle Theme button */}
        <button
          onClick={toggleTheme}
          className={`${glass} p-2.5 rounded-xl pointer-events-auto hover:scale-105 active:scale-95 transition-all`}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
        </button>

        {/* Camera switch button */}
        <button
          onClick={cycleCamera}
          className={`${glass} rounded-xl px-3 py-2 flex items-center gap-2 pointer-events-auto hover:bg-white/10 transition active:scale-95`}
        >
          <Eye className={`w-4 h-4 ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'}`} />
          <span className="text-[9px] font-black uppercase tracking-wider">
            {cameraModeLabel[cameraMode] || 'CAM'}
          </span>
        </button>

        {/* FPS Indicator Panel */}
        <div className={`${glass} rounded-xl px-3.5 py-2 font-mono text-[9px] flex items-center gap-1.5`}>
          <span className="text-white/40 uppercase">FPS</span>
          <span className={`font-black ${fps >= 55 ? 'text-emerald-400' : fps >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
            {fps}
          </span>
        </div>
      </div>

      {/* ══ MIDDLE TOP: Dynamic HUD Event Notifications ══ */}
      <Notifications
        lap={lap}
        fuel={fuel}
        health={health}
        nitroActive={nitroActive}
        scoreMultiplier={scoreMultiplier}
      />

      {/* ══ BOTTOM LEFT: Minimap & Gesture Tracking Panel ══ */}
      <div className="absolute bottom-5 left-5 flex flex-col gap-3">
        <Minimap
          currentTrack={currentTrack}
          playerPosition={useGameStore.getState().playerPosition}
          coinsCollected={coinsCollected}
          distance={distance}
        />
        <GestureStatus
          handDetected={handDetected}
          handConfidence={handConfidence}
          steeringAngle={steeringAngle}
          webcamFps={webcamFps}
          webcamLighting={webcamLighting}
          leftHandConfidence={leftHandConfidence}
          rightHandConfidence={rightHandConfidence}
          handsCount={handsCount}
          trackingLatency={trackingLatency}
        />
      </div>

      {/* ══ BOTTOM CENTER: Circular Speedometer ══ */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2">
        <Speedometer
          speed={speed}
          rpm={rpm}
          gear={gear}
          nitroActive={nitroActive}
        />
      </div>

      {/* ══ BOTTOM RIGHT: Vehicle Status Gauges & Challenges ══ */}
      <div className="absolute bottom-5 right-5 flex flex-col gap-3 items-end">
        <MissionPanel
          coinsCollected={coinsCollected}
          health={health}
        />

        {/* Gauges card */}
        <div className={`${glass} rounded-2xl px-5 py-4 w-52 flex flex-col gap-3.5`}>
          <ChassisHealth health={health} />
          <FuelGauge fuel={fuel} />
          <div className="h-px bg-white/10" />
          <NitroMeter nitroLevel={nitroLevel} nitroActive={nitroActive} />
        </div>
      </div>

      {/* ══ MIDDLE RIGHT: Active Powerup Badges ══ */}
      {(shieldActive || magnetActive) && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col gap-2.5">
          {shieldActive && (
            <div className={`${glass} rounded-xl px-3.5 py-2.5 flex items-center gap-2 border-cyan-500/20`}>
              <span className="text-base animate-pulse">🛡️</span>
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest animate-pulse font-mono">SHIELD ACTIVE</span>
            </div>
          )}
          {magnetActive && (
            <div className={`${glass} rounded-xl px-3.5 py-2.5 flex items-center gap-2 border-amber-500/20`}>
              <span className="text-base animate-pulse">🧲</span>
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest animate-pulse font-mono">COIN ATTRACT</span>
            </div>
          )}
        </div>
      )}

      {/* ══ OVERLAY: Pause Menu ══ */}
      {status === 'paused' && (
        <PauseMenu
          onResume={() => setStatus('playing')}
          onRestart={() => {
            resetRaceStats();
            setStatus('countdown');
          }}
          onReturnToGarage={() => {
            resetRaceStats();
            setStatus('menu');
          }}
          onExit={() => {
            resetRaceStats();
            setStatus('menu');
          }}
          lap={lap}
          score={score}
        />
      )}
    </div>
  );
}
