'use client';

import React, { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';

export default function SoundController() {
  const { speed, rpm, isDrifting, nitroActive, currentGesture } = useGameStore();
  const { soundVolume } = useSettingsStore();

  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // Engine oscillators & gain nodes
  const osc1Ref = useRef<OscillatorNode | null>(null);
  const osc2Ref = useRef<OscillatorNode | null>(null);
  const engineFilterRef = useRef<BiquadFilterNode | null>(null);
  const engineVolumeRef = useRef<GainNode | null>(null);
  
  // Drift / Tire squeal node
  const driftOscRef = useRef<OscillatorNode | null>(null);
  const driftVolumeRef = useRef<GainNode | null>(null);

  // Initialize Audio Nodes
  useEffect(() => {
    // We defer creation until the user interacts with the app
    const initAudio = () => {
      if (audioCtxRef.current) return;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      // 1. ENGINE SYNTH CONFIG
      // Create twin saw-tooth oscillators for thick sound
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, ctx.currentTime);
      filter.Q.setValueAtTime(4.0, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0, ctx.currentTime); // start silent

      // Chain engine
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      osc1Ref.current = osc1;
      osc2Ref.current = osc2;
      engineFilterRef.current = filter;
      engineVolumeRef.current = gain;

      // 2. DRIFT SQUEAL CONFIG
      const driftOsc = ctx.createOscillator();
      driftOsc.type = 'sine';
      driftOsc.frequency.setValueAtTime(800, ctx.currentTime);

      const driftFilter = ctx.createBiquadFilter();
      driftFilter.type = 'bandpass';
      driftFilter.frequency.setValueAtTime(1200, ctx.currentTime);
      
      const driftGain = ctx.createGain();
      driftGain.gain.setValueAtTime(0.0, ctx.currentTime);

      driftOsc.connect(driftFilter);
      driftFilter.connect(driftGain);
      driftGain.connect(ctx.destination);
      driftOsc.start();

      driftOscRef.current = driftOsc;
      driftVolumeRef.current = driftGain;
    };

    // Auto trigger on first gesture detection or change
    if (speed > 1 || currentGesture !== 'neutral') {
      initAudio();
    }

    return () => {
      // Clean up sound loops on unmount safely
      if (audioCtxRef.current) {
        try {
          if (audioCtxRef.current.state !== 'closed') {
            audioCtxRef.current.close();
          }
        } catch (e) {
          // Swallow context closed errors
        }
      }
    };
  }, [speed, currentGesture]);

  // Adjust pitch & volume in real-time based on R3F telemetry
  useEffect(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'suspended') return;
    
    const ctx = audioCtxRef.current;
    
    // Scale sound volume
    const masterVolume = soundVolume;

    // 1. Scale Engine pitch with RPM
    if (osc1Ref.current && osc2Ref.current && engineFilterRef.current && engineVolumeRef.current) {
      // Map RPM (800 - 8500) to oscillator frequencies (30Hz to 280Hz)
      const baseFreq = 25 + (rpm / 8500) * 140;
      
      osc1Ref.current.frequency.setTargetAtTime(baseFreq, ctx.currentTime, 0.05);
      osc2Ref.current.frequency.setTargetAtTime(baseFreq * 1.51, ctx.currentTime, 0.05); // harmonic offset

      // Filter cutoff opens up at higher RPM
      const filterCutoff = 180 + (rpm / 8500) * 1200;
      engineFilterRef.current.frequency.setTargetAtTime(filterCutoff, ctx.currentTime, 0.08);

      // Volume adjusts based on throttle/nitro
      const targetVolume = (0.15 + (rpm / 8500) * 0.22) * (nitroActive ? 1.4 : 1.0) * masterVolume;
      engineVolumeRef.current.gain.setTargetAtTime(targetVolume, ctx.currentTime, 0.05);
    }

    // 2. Play drift tire squeals
    if (driftVolumeRef.current && driftOscRef.current) {
      if (isDrifting) {
        // High pitched fluctuating squeal
        const driftPitch = 700 + Math.sin(ctx.currentTime * 30) * 80 + (speed / 100) * 200;
        driftOscRef.current.frequency.setTargetAtTime(driftPitch, ctx.currentTime, 0.02);
        
        const driftVol = 0.18 * masterVolume;
        driftVolumeRef.current.gain.setTargetAtTime(driftVol, ctx.currentTime, 0.05);
      } else {
        driftVolumeRef.current.gain.setTargetAtTime(0.0, ctx.currentTime, 0.1);
      }
    }
  }, [rpm, speed, isDrifting, nitroActive, soundVolume]);

  return null; // Silent logic manager
}
