'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { getProceduralTrackPoints } from '@/utils/trackGenerator';

interface MinimapProps {
  currentTrack: string;
  playerPosition: [number, number];
  coinsCollected: number;
  distance: number;
}

export default function Minimap({ currentTrack, playerPosition, coinsCollected, distance }: MinimapProps) {
  // Compute minimap path and mapped player coordinates
  const { trackPath, mappedX, mappedY, headingAngle } = useMemo(() => {
    const points = getProceduralTrackPoints(currentTrack || 'track_1');
    if (points.length === 0) {
      return { trackPath: '', mappedX: 80, mappedY: 80, headingAngle: 0 };
    }

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    points.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    });

    const wR = maxX - minX || 1;
    const hR = maxZ - minZ || 1;
    const pad = 16;
    const svgS = 160;

    // Build SVG path
    let pathStr = '';
    points.forEach((p, idx) => {
      const tx = pad + ((p.x - minX) / wR) * (svgS - 2 * pad);
      const ty = pad + ((p.z - minZ) / hR) * (svgS - 2 * pad);
      pathStr += `${idx === 0 ? 'M' : 'L'} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
    });
    pathStr += ' Z'; // Close track path

    // Map player position
    const px = playerPosition[0];
    const pz = playerPosition[1];
    const mX = pad + ((px - minX) / wR) * (svgS - 2 * pad);
    const mY = pad + ((pz - minZ) / hR) * (svgS - 2 * pad);

    // Find nearest waypoint to approximate heading rotation
    const carPos3D = new THREE.Vector3(px, 0, pz);
    let nearestDist = Infinity;
    let nearestIdx = 0;
    points.forEach((pt, idx) => {
      const d = carPos3D.distanceTo(pt);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = idx;
      }
    });

    // Heading calculation: direction from current to next waypoint
    const nextIdx = (nearestIdx + 1) % points.length;
    const currentWp = points[nearestIdx];
    const nextWp = points[nextIdx];
    const dir = new THREE.Vector3().subVectors(nextWp, currentWp).normalize();
    const headingRad = Math.atan2(dir.x, dir.z);

    return {
      trackPath: pathStr,
      mappedX: Math.max(pad, Math.min(svgS - pad, mX)),
      mappedY: Math.max(pad, Math.min(svgS - pad, mY)),
      headingAngle: headingRad,
    };
  }, [currentTrack, playerPosition]);

  return (
    <div className="flex flex-col gap-2 p-3.5 bg-black/60 border border-white/10 rounded-2xl backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] w-36 select-none font-mono">
      <div className="flex justify-between items-center border-b border-white/5 pb-1">
        <span className="text-[7px] text-cyan-400 font-black uppercase tracking-widest">GPS RADAR</span>
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
      </div>

      {/* Rotating Map Canvas Container */}
      <div className="relative bg-black/35 rounded-xl border border-white/5 overflow-hidden aspect-square flex items-center justify-center">
        <svg
          viewBox="0 0 160 160"
          className="w-full h-full transition-transform duration-300 ease-out"
          style={{
            transform: `rotate(${-headingAngle * (180 / Math.PI)}deg)`,
            transformOrigin: `${mappedX}px ${mappedY}px`,
          }}
        >
          {/* Static Track Circuit Layout */}
          <path
            d={trackPath}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="8.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={trackPath}
            fill="none"
            stroke="#1e293b"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Player Indicator Dot centered in rotation */}
          <circle
            cx={mappedX}
            cy={mappedY}
            r="5"
            fill="#06b6d4"
            style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }}
          />
          <circle
            cx={mappedX}
            cy={mappedY}
            r="10"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1"
            opacity="0.5"
            className="animate-pulse"
          />
        </svg>
      </div>

      {/* Quick stats footer */}
      <div className="flex justify-between text-[7px] text-white/40 mt-0.5">
        <span>🏁 {Math.round(distance)}m</span>
        <span>🪙 {coinsCollected}</span>
      </div>
    </div>
  );
}
