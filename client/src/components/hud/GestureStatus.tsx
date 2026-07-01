'use client';

import React from 'react';
import { Shield, ShieldAlert, Sparkles, Activity } from 'lucide-react';

interface GestureStatusProps {
  handDetected: boolean;
  handConfidence: number;
  steeringAngle: number;
  webcamFps: number;
  webcamLighting: number;
  leftHandConfidence: number;
  rightHandConfidence: number;
  handsCount: number;
  trackingLatency: number;
}

export default function GestureStatus({
  handDetected,
  handConfidence,
  steeringAngle,
  webcamFps,
  webcamLighting,
  leftHandConfidence,
  rightHandConfidence,
  handsCount,
  trackingLatency,
}: GestureStatusProps) {

  const getStatusColor = () => {
    if (!handDetected || handsCount < 2) return 'bg-rose-500 shadow-[0_0_10px_#f43f5e]';
    if (handConfidence < 65 || webcamLighting < 45) return 'bg-amber-500 shadow-[0_0_10px_#f59e0b]';
    return 'bg-emerald-500 shadow-[0_0_10px_#10b981]';
  };

  const getStatusLabel = () => {
    if (!handDetected) return 'NO HANDS';
    if (handsCount < 2) return '1 HAND CONNECTED (NEED 2)';
    if (handConfidence < 65) return 'WEAK SIGNAL';
    return 'OPTIMAL TRACKING';
  };

  // Convert steering to degrees
  const steerDegrees = Math.round(steeringAngle * 35); // Max wheel rotation degrees represented visually

  return (
    <div className="flex flex-col gap-2 p-3 bg-black/60 border border-white/10 rounded-2xl backdrop-blur-xl shadow-lg w-52 select-none font-mono text-[9px] text-white">
      {/* Header with Connection Pill */}
      <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
        <span className="text-[7px] text-white/40 uppercase tracking-widest font-bold flex items-center gap-1">
          <Activity className="w-3 h-3 text-cyan-400" /> Gesture Engine
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[7px] text-white/50">{webcamFps} FPS</span>
          <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor()}`} />
        </div>
      </div>

      {/* Main Status Text */}
      <div className="flex items-center gap-1.5 text-white/80 font-bold tracking-wide">
        {handDetected && handsCount >= 2 ? (
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
        )}
        <span className={handDetected && handsCount >= 2 ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}>
          {getStatusLabel()}
        </span>
      </div>

      {/* Stats list */}
      <div className="space-y-1 text-white/60">
        <div className="flex justify-between border-b border-white/5 pb-0.5">
          <span>Hands Tracked:</span>
          <span className="text-white font-bold">{handsCount}/2</span>
        </div>

        <div className="flex justify-between border-b border-white/5 pb-0.5">
          <span>Left/Right Conf:</span>
          <span className="text-white font-bold">
            {Math.round(leftHandConfidence)}% / {Math.round(rightHandConfidence)}%
          </span>
        </div>

        <div className="flex justify-between border-b border-white/5 pb-0.5">
          <span>Signal Latency:</span>
          <span className="text-white font-bold">{trackingLatency}ms</span>
        </div>

        <div className="flex justify-between border-b border-white/5 pb-0.5">
          <span>Camera Lighting:</span>
          <span className={webcamLighting > 50 ? 'text-emerald-400' : 'text-amber-400'}>
            {webcamLighting}%
          </span>
        </div>

        <div className="flex justify-between">
          <span>Steering Angle:</span>
          <span className="text-cyan-400 font-extrabold">
            {steerDegrees > 0 ? `👉 ${steerDegrees}° R` : steerDegrees < 0 ? `👈 ${Math.abs(steerDegrees)}° L` : '● CENTER'}
          </span>
        </div>
      </div>
    </div>
  );
}
