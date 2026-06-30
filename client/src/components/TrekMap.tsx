'use client';

import React, { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { ZoomIn, ZoomOut, RotateCw, Map, Compass } from 'lucide-react';
import { getProceduralTrackPoints } from '@/utils/trackGenerator';
import * as THREE from 'three';

export default function TrekMap() {
  const currentTrackId = useGameStore((s) => s.currentTrack) || 'track_1';
  const playerPosition = useGameStore((s) => s.playerPosition) || [0, 0];
  const speed = useGameStore((s) => s.speed);
  const lap = useGameStore((s) => s.lap);
  const totalLaps = useGameStore((s) => s.totalLaps);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [terrainMode, setTerrainMode] = useState<'neon' | 'contour'>('neon');

  // Compute SVG elements from procedural points dynamically
  const { trackPath, checkpoints, playerSvgX, playerSvgY, totalDistance } = useMemo(() => {
    const points = getProceduralTrackPoints(currentTrackId);
    
    // Find min/max bounds to fit path inside the SVG box [0, 200]
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    });

    const wRange = maxX - minX || 1;
    const hRange = maxZ - minZ || 1;
    const padding = 22;
    const svgSize = 200;

    const svgPoints = points.map((p) => {
      const x = padding + ((p.x - minX) / wRange) * (svgSize - 2 * padding);
      const y = padding + ((p.z - minZ) / hRange) * (svgSize - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const path = `M ${svgPoints.join(' L ')} Z`;

    // Place checkpoints at index: 0 (START), N/4, N/2, 3N/4
    const N = points.length - 1;
    const cpIndices = [0, Math.floor(N / 4), Math.floor(N / 2), Math.floor((3 * N) / 4)];
    
    const cpList = cpIndices.map((idx, index) => {
      const p = points[idx];
      const x = padding + ((p.x - minX) / wRange) * (svgSize - 2 * padding);
      const y = padding + ((p.z - minZ) / hRange) * (svgSize - 2 * padding);
      return {
        x,
        y,
        label: index === 0 ? 'START/FINISH' : `CHECKPOINT ${index}`,
        distKm: parseFloat(((idx / N) * 4.2).toFixed(1))
      };
    });

    // Map player position (constrain player pointer coordinates to fit bounds gracefully)
    const playerX = padding + ((playerPosition[0] - minX) / wRange) * (svgSize - 2 * padding);
    const playerY = padding + ((playerPosition[1] - minZ) / hRange) * (svgSize - 2 * padding);

    return {
      trackPath: path,
      checkpoints: cpList,
      playerSvgX: playerX,
      playerSvgY: playerY,
      totalDistance: 12.5
    };
  }, [currentTrackId, playerPosition]);

  const handleZoomIn = () => setZoom(z => Math.min(2.0, z + 0.25));
  const handleZoomOut = () => setZoom(z => Math.max(0.75, z - 0.25));
  const handleRotate = () => setRotation(r => (r + 90) % 360);

  // Compute race completion metrics
  // Assume each lap is 4.2 KM.
  const lapProgress = Math.min(1.0, Math.max(0.0, playerPosition[1] / 800));
  const totalCompleted = (((lap - 1) + lapProgress) / totalLaps) * totalDistance;

  return (
    <div className="w-full bg-black/85 border border-white/10 rounded-3xl p-6 backdrop-blur-md shadow-2xl flex flex-col gap-6 text-white font-mono select-none">
      
      {/* Header Info */}
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <div>
          <h2 className="text-base font-extrabold tracking-widest text-cyan-400 uppercase flex items-center gap-2">
            <Map className="w-4 h-4" /> LIVE CIRCUIT RADAR
          </h2>
          <p className="text-[9px] text-white/40 uppercase mt-0.5">Topological Position & Route Navigation</p>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button
            onClick={() => setTerrainMode(terrainMode === 'neon' ? 'contour' : 'neon')}
            className={`px-3 py-1.5 rounded-lg border text-[10px] uppercase font-bold flex items-center gap-1.5 transition ${
              terrainMode === 'contour' 
                ? 'border-cyan-400 bg-cyan-950/20 text-cyan-400' 
                : 'border-white/10 text-white/50 hover:bg-white/5'
            }`}
          >
            Terrain View
          </button>
        </div>
      </div>

      {/* Main Grid: Interactive Map & Telemetry Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        
        {/* Left Column: Stats & Profile */}
        <div className="space-y-4 flex flex-col justify-center">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-2">
            <span className="text-[9px] text-white/40 block uppercase">ROUTE METRICS</span>
            <div className="flex justify-between text-xs">
              <span>Total Distance:</span>
              <span className="font-bold text-cyan-400">{totalDistance} KM</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Completed Route:</span>
              <span className="font-bold text-white/90">{totalCompleted.toFixed(2)} KM ({((totalCompleted / totalDistance) * 100).toFixed(0)}%)</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Altitude Offset:</span>
              <span className="font-bold text-pink-500">1,850 M</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Circuit Category:</span>
              <span className="font-bold text-red-400 uppercase">PRO</span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-2">
            <span className="text-[9px] text-white/40 block uppercase">LAP PROGRESSION</span>
            <div className="flex justify-between items-center text-xs">
              <span>Active Lap:</span>
              <span className="font-bold text-white">{lap} / {totalLaps}</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400" style={{ width: `${lapProgress * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Center SVG Interactive Map Canvas */}
        <div className="relative aspect-square border border-white/10 bg-black/60 rounded-2xl overflow-hidden flex items-center justify-center p-4">
          
          {/* Zoom/Rotate Map Toolbar */}
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10 pointer-events-auto">
            <button onClick={handleZoomIn} className="p-1.5 bg-black/80 border border-white/15 hover:border-cyan-400 text-white rounded-md transition">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleZoomOut} className="p-1.5 bg-black/80 border border-white/15 hover:border-cyan-400 text-white rounded-md transition">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleRotate} className="p-1.5 bg-black/80 border border-white/15 hover:border-cyan-400 text-white rounded-md transition">
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[8px] text-white/40 uppercase">
            <Compass className="w-3 h-3 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} /> Compass Locked
          </div>

          {/* SVG Map Path */}
          <div 
            className="w-full h-full transition-transform duration-300 flex items-center justify-center"
            style={{ 
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-full max-w-[170px] max-h-[170px]">
              {/* Topological Grid Background (for Contour Terrain mode) */}
              {terrainMode === 'contour' && (
                <>
                  <circle cx="100" cy="100" r="85" stroke="rgba(255,255,255,0.03)" strokeWidth="1" fill="none" />
                  <circle cx="100" cy="100" r="65" stroke="rgba(255,255,255,0.03)" strokeWidth="1" fill="none" />
                  <circle cx="100" cy="100" r="45" stroke="rgba(255,255,255,0.03)" strokeWidth="1" fill="none" />
                </>
              )}

              {/* Racetrack Route line */}
              <path
                d={trackPath}
                fill="none"
                stroke={terrainMode === 'neon' ? '#ff0055' : 'rgba(255,255,255,0.2)'}
                strokeWidth="4"
                className={terrainMode === 'neon' ? "filter drop-shadow-[0_0_6px_#ff0055]" : ""}
              />

              {/* Checkpoint nodes */}
              {checkpoints.map((cp, idx) => (
                <g key={idx}>
                  <circle
                    cx={cp.x}
                    cy={cp.y}
                    r="4"
                    fill={idx === 0 ? '#10b981' : '#00f0ff'}
                    className="filter drop-shadow-[0_0_4px_#00f0ff]"
                  />
                </g>
              ))}

              {/* Active Player marker */}
              {playerSvgX >= 0 && playerSvgY >= 0 && (
                <g>
                  {/* Glowing ring */}
                  <circle cx={playerSvgX} cy={playerSvgY} r="8" fill="none" stroke="#00f0ff" strokeWidth="1.5" className="animate-ping" />
                  {/* Pointer */}
                  <circle cx={playerSvgX} cy={playerSvgY} r="4" fill="#00f0ff" />
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Right Column: Checkpoints Route List */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3 self-stretch flex flex-col justify-center">
          <span className="text-[9px] text-white/40 block uppercase">STATION SCHEDULES</span>
          <div className="space-y-2 text-[10px]">
            {checkpoints.map((cp, idx) => (
              <div key={idx} className="flex items-center justify-between border-b border-white/5 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-green-400' : 'bg-cyan-400'}`} />
                  <span className="font-bold text-white">{cp.label}</span>
                </div>
                <span className="text-white/40">{cp.distKm.toFixed(1)} KM</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Elevation Profile widget */}
      <div className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
        <span className="text-[9px] text-white/40 block uppercase">ELEVATION ANGLE PROFILE</span>
        <div className="h-10 flex items-end gap-1.5 w-full justify-between">
          {[20, 25, 45, 60, 50, 40, 30, 25, 45, 75, 80, 60, 40, 20, 35, 55, 65, 30, 15, 20].map((h, i) => (
            <div
              key={i}
              className={`h-full flex-1 rounded-t ${
                i === Math.floor(lapProgress * 20) ? 'bg-cyan-400 shadow-[0_0_8px_#00f0ff]' : 'bg-white/10'
              }`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
