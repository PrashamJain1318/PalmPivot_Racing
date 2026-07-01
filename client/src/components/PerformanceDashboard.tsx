'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useGameStore } from '@/store/gameStore';

export default function PerformanceDashboard() {
  const { gl } = useThree();
  const trackingLatency = useGameStore((s) => s.trackingLatency);
  const webcamFps = useGameStore((s) => s.webcamFps);

  const [telemetry, setTelemetry] = useState({
    fps: 60,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    jsHeap: 0,
    frameTime: 0,
  });

  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(performance.now());

  useEffect(() => {
    // Only run telemetry dashboard in development mode
    if (process.env.NODE_ENV !== 'development') return;

    let animId: number;
    const tick = () => {
      const now = performance.now();
      
      // Calculate Frame Times
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      frameCountRef.current++;

      // Update FPS counter every 500ms
      if (now >= lastFpsUpdateRef.current + 500) {
        const elapsed = now - lastFpsUpdateRef.current;
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
        
        // Read WebGL statistics directly from GPU context
        const info = gl.info;

        // Get Memory Heap if supported by browser
        let memory = 0;
        if (typeof window !== 'undefined' && (window.performance as any).memory) {
          memory = Math.round((window.performance as any).memory.usedJSHeapSize / 1024 / 1024);
        }

        setTelemetry({
          fps: currentFps,
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
          geometries: info.memory.geometries,
          textures: info.memory.textures,
          jsHeap: memory,
          frameTime: Number(delta.toFixed(1)),
        });

        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [gl]);

  // Completely compile out in production builds
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-950/90 border border-cyan-500/30 rounded-xl px-4 py-2.5 font-mono text-[9px] text-cyan-400 flex gap-4 pointer-events-none select-none shadow-[0_0_20px_rgba(6,182,212,0.25)] backdrop-blur-md">
      <div className="flex flex-col">
        <span className="text-white/40 font-bold uppercase">Engine Telemetry</span>
        <span className="text-xs font-black text-white mt-0.5 tabular-nums">
          ⚡ {telemetry.fps} FPS <span className="text-[8px] font-normal text-white/50">({telemetry.frameTime}ms)</span>
        </span>
      </div>

      <div className="w-px bg-cyan-500/20" />

      <div className="flex flex-col justify-center">
        <div>
          <span className="text-white/40">DRAWS:</span>{' '}
          <span className="text-white font-bold tabular-nums">{telemetry.drawCalls}</span>
        </div>
        <div>
          <span className="text-white/40">TRIS:</span>{' '}
          <span className="text-white font-bold tabular-nums">{(telemetry.triangles / 1000).toFixed(1)}k</span>
        </div>
      </div>

      <div className="w-px bg-cyan-500/20" />

      <div className="flex flex-col justify-center">
        <div>
          <span className="text-white/40">GEOMS:</span>{' '}
          <span className="text-white font-bold tabular-nums">{telemetry.geometries}</span>
        </div>
        <div>
          <span className="text-white/40">TEXS:</span>{' '}
          <span className="text-white font-bold tabular-nums">{telemetry.textures}</span>
        </div>
      </div>

      <div className="w-px bg-cyan-500/20" />

      <div className="flex flex-col justify-center">
        <div>
          <span className="text-white/40">CAMERA FPS:</span>{' '}
          <span className="text-white font-bold tabular-nums">{webcamFps}</span>
        </div>
        <div>
          <span className="text-white/40">LATENCY:</span>{' '}
          <span className="text-amber-400 font-bold tabular-nums">{trackingLatency}ms</span>
        </div>
      </div>

      {telemetry.jsHeap > 0 && (
        <>
          <div className="w-px bg-cyan-500/20" />
          <div className="flex flex-col justify-center">
            <span className="text-white/40">HEAP SIZE</span>
            <span className="text-white font-bold tabular-nums">{telemetry.jsHeap} MB</span>
          </div>
        </>
      )}
    </div>
  );
}
