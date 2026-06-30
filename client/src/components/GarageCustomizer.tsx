'use client';

import React, { useState } from 'react';
import { useGameStore, PlayerCarPreset } from '@/store/gameStore';
import { Palette, Zap, Gauge, Settings, ShieldCheck, ArrowLeft } from 'lucide-react';

const PAINT_PRESETS = [
  { name: 'Cyber Red', color: '#ff0055' },
  { name: 'Grid Cyan', color: '#00f0ff' },
  { name: 'Acid Green', color: '#39ff14' },
  { name: 'Grid Violet', color: '#8b5cf6' },
  { name: 'Carbon Black', color: '#111111' },
  { name: 'Solar Gold', color: '#eab308' },
];

const GLOW_PRESETS = [
  { name: 'Neon Aqua', color: '#00f0ff' },
  { name: 'Toxic Pink', color: '#ff0055' },
  { name: 'Lime Glow', color: '#22c55e' },
  { name: 'Plasma Amber', color: '#f97316' },
  { name: 'Zero White', color: '#ffffff' },
];

export default function GarageCustomizer({ onBack }: { onBack: () => void }) {
  const currentCar = useGameStore((s) => s.currentCar);
  const presets = useGameStore((s) => s.presets);
  const saveCarPreset = useGameStore((s) => s.saveCarPreset);

  const activePreset = presets[currentCar] || {
    paint: '#ff0055',
    wrap: 'none',
    spoiler: 'none',
    rims: 'classic',
    tyres: 'standard',
    underglow: '#00ffff',
    performance: { engine: 1, suspension: 1, turbo: 0, nitro: 1 }
  };

  const [paintColor, setPaintColor] = useState(activePreset.paint);
  const [underglow, setUnderglow] = useState(activePreset.underglow);
  const [engineLevel, setEngineLevel] = useState(activePreset.performance.engine);
  const [turboLevel, setTurboLevel] = useState(activePreset.performance.turbo);
  const [nitroLevel, setNitroLevel] = useState(activePreset.performance.nitro);

  const handleSave = () => {
    const updatedPreset: PlayerCarPreset = {
      ...activePreset,
      paint: paintColor,
      underglow: underglow,
      performance: {
        engine: engineLevel,
        suspension: activePreset.performance.suspension,
        turbo: turboLevel,
        nitro: nitroLevel
      }
    };
    saveCarPreset(currentCar, updatedPreset);
    
    // Sync with local storage
    localStorage.setItem(`preset_${currentCar}`, JSON.stringify(updatedPreset));
    
    alert('Presets Saved to Profile! 🚗');
  };

  // Mock specs calculation based on upgrades
  const topSpeed = 240 + engineLevel * 15 + turboLevel * 25;
  const acceleration = 60 + engineLevel * 8 + turboLevel * 12;
  const handling = 70 + nitroLevel * 5;

  return (
    <div className="w-full max-w-md bg-black/75 border border-white/10 rounded-2xl p-6 backdrop-blur-md text-white font-mono flex flex-col justify-between min-h-[580px] shadow-2xl pointer-events-auto">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition border border-white/5"
          >
            <ArrowLeft className="w-4 h-4 text-white/70" />
          </button>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-wider text-cyan-400">Tuning & Customization</h2>
            <span className="text-[10px] text-white/40 uppercase">Hypercar: {currentCar.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Specs HUD */}
        <div className="bg-white/5 border border-white/5 rounded-xl p-4 mb-6 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-white/50">TOP SPEED:</span>
            <span className="text-white font-bold">{topSpeed} KM/H</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-pink-500" style={{ width: `${(topSpeed / 350) * 100}%` }} />
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-white/50">ACCELERATION (0-100):</span>
            <span className="text-white font-bold">{(10 - acceleration / 15).toFixed(2)} SEC</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400" style={{ width: `${(acceleration / 120) * 100}%` }} />
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-white/50">HANDLING / GRIP:</span>
            <span className="text-white font-bold">{handling}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-green-400" style={{ width: `${handling}%` }} />
          </div>
        </div>

        {/* Paint Presets */}
        <div className="mb-6">
          <label className="text-xs text-white/40 block mb-2 uppercase tracking-wide">Metallic Paint Presets</label>
          <div className="grid grid-cols-6 gap-2">
            {PAINT_PRESETS.map((p) => (
              <button
                key={p.color}
                onClick={() => setPaintColor(p.color)}
                style={{ backgroundColor: p.color }}
                className={`w-full aspect-square rounded-lg border-2 transition ${
                  paintColor === p.color ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'border-transparent hover:border-white/30'
                }`}
                title={p.name}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-white/60">Custom Hex:</span>
            <input
              type="color"
              value={paintColor}
              onChange={(e) => setPaintColor(e.target.value)}
              className="bg-transparent border border-white/10 rounded cursor-pointer w-8 h-8"
            />
            <span className="text-xs font-bold text-white/80">{paintColor.toUpperCase()}</span>
          </div>
        </div>

        {/* Underglow Presets */}
        <div className="mb-6">
          <label className="text-xs text-white/40 block mb-2 uppercase tracking-wide">Neon Underglow Presets</label>
          <div className="grid grid-cols-5 gap-2">
            {GLOW_PRESETS.map((g) => (
              <button
                key={g.color}
                onClick={() => setUnderglow(g.color)}
                style={{ backgroundColor: g.color }}
                className={`w-full h-8 rounded-lg border-2 transition ${
                  underglow === g.color ? 'border-white scale-105 shadow-[0_0_10px_rgba(255,255,255,0.4)]' : 'border-transparent hover:border-white/20'
                }`}
                title={g.name}
              />
            ))}
          </div>
        </div>

        {/* Performance Upgrades */}
        <div className="space-y-4 border-t border-white/5 pt-4">
          <span className="text-xs text-white/40 block uppercase tracking-wide">Engine Tuning</span>
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/70">Engine Block:</span>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setEngineLevel(lvl)}
                  className={`w-7 py-1 text-xs border font-bold rounded transition ${
                    engineLevel >= lvl
                      ? 'border-pink-500 bg-pink-500/20 text-pink-400'
                      : 'border-white/10 hover:border-white/30 text-white/30'
                  }`}
                >
                  L{lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-white/70">Turbo Charger:</span>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setTurboLevel(lvl)}
                  className={`w-7 py-1 text-xs border font-bold rounded transition ${
                    turboLevel >= lvl
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                      : 'border-white/10 hover:border-white/30 text-white/30'
                  }`}
                >
                  {lvl === 0 ? 'Off' : `T${lvl}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-white/70">Nitro Tanks:</span>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setNitroLevel(lvl)}
                  className={`w-7 py-1 text-xs border font-bold rounded transition ${
                    nitroLevel >= lvl
                      ? 'border-green-500 bg-green-500/20 text-green-400'
                      : 'border-white/10 hover:border-white/30 text-white/30'
                  }`}
                >
                  x{lvl}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="border-t border-white/5 pt-4 mt-6">
        <button
          onClick={handleSave}
          className="w-full py-3 bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:scale-[1.01]"
        >
          <Palette className="w-4 h-4" /> Apply Customizations
        </button>
      </div>

    </div>
  );
}
