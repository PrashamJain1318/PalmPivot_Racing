'use client';

import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { CheckCircle2, ChevronRight, Play, RotateCcw, AlertTriangle } from 'lucide-react';
import WebcamDetector from './WebcamDetector';

interface CalibrationStep {
  id: string;
  name: string;
  gestureKey: string;
  instruction: string;
}

const STEPS: CalibrationStep[] = [
  { id: 'find_hands', name: 'Find Hands', gestureKey: 'neutral', instruction: 'Place both hands up in front of the camera as if holding a virtual steering wheel to connect.' },
  { id: 'steer_left', name: 'Steer Left', gestureKey: 'steer_left', instruction: 'Rotate both hands to the left (counter-clockwise) to calibrate left steering.' },
  { id: 'steer_right', name: 'Steer Right', gestureKey: 'steer_right', instruction: 'Rotate both hands to the right (clockwise) to calibrate right steering.' },
];

export default function GestureCalibrator({ onComplete }: { onComplete?: () => void }) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [calibrationProgress, setCalibrationProgress] = useState<{ [key: string]: boolean }>({});
  const [stabilityScore, setStabilityScore] = useState(0); // 0 to 100
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  
  const { currentGesture, handDetected, handConfidence, steeringAngle } = useGameStore();
  const { gestureSensitivity, setGestureSensitivity } = useSettingsStore();

  const currentStep = STEPS[activeStepIndex] || STEPS[0];

  // Capture gesture history feed
  useEffect(() => {
    if (handDetected && currentGesture !== 'neutral') {
      setHistory(prev => [currentGesture, ...prev.slice(0, 7)]);
    }
  }, [currentGesture, handDetected]);

  // Monitor gesture stability
  useEffect(() => {
    if (isCalibrated) return;

    let timer: NodeJS.Timeout;
    const targetGesture = currentStep.gestureKey;

    if (handDetected && (targetGesture === 'neutral' ? true : currentGesture === targetGesture)) {
      // Increase stability meter
      timer = setInterval(() => {
        setStabilityScore(prev => {
          if (prev >= 100) {
            clearInterval(timer);
            // Mark step as completed
            setCalibrationProgress(p => ({ ...p, [targetGesture]: true }));
            // Move to next step
            if (activeStepIndex < STEPS.length - 1) {
              setActiveStepIndex(prevIdx => Math.min(STEPS.length - 1, prevIdx + 1));
            } else {
              setIsCalibrated(true);
              // Auto save settings
              localStorage.setItem('gesture_calibrated', 'true');
            }
            return 0;
          }
          return prev + 15; // Calibration speed booster
        });
      }, 100);
    } else {
      // Decay stability
      setStabilityScore(prev => Math.max(0, prev - 15));
    }

    return () => clearInterval(timer);
  }, [handDetected, currentGesture, activeStepIndex, isCalibrated, currentStep]);

  const handleReset = () => {
    setActiveStepIndex(0);
    setCalibrationProgress({});
    setStabilityScore(0);
    setIsCalibrated(false);
  };

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      {/* Left Column: Webcam Viewer & Live Stats */}
      <div className="flex flex-col gap-4">
        <WebcamDetector />

        {/* Live Tracking Telemetry HUD */}
        <div className="bg-black/60 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
          <h3 className="text-cyan-400 font-mono text-xs uppercase tracking-widest mb-4">Live Telemetry</h3>
          
          <div className="space-y-4 font-mono text-sm text-white/80">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span>Hand Detected:</span>
              <span className={handDetected ? "text-green-400" : "text-red-400"}>
                {handDetected ? "YES" : "NO"}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span>Steer Input:</span>
              <span className="text-cyan-400">
                {steeringAngle > 0.1 ? `RIGHT (${Math.round(steeringAngle * 100)}%)` : 
                 steeringAngle < -0.1 ? `LEFT (${Math.round(Math.abs(steeringAngle) * 100)}%)` : 
                 "CENTER"}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span>Active Gesture:</span>
              <span className="text-pink-500 uppercase font-bold">{handDetected ? currentGesture : 'NONE'}</span>
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span>Detection Confidence:</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 transition-all duration-300" style={{ width: `${handConfidence}%` }} />
                </div>
                <span>{handConfidence}%</span>
              </div>
            </div>

            {/* Gesture History */}
            <div>
              <span className="text-xs text-white/40 block mb-2">GESTURE LOG:</span>
              <div className="flex gap-1 flex-wrap">
                {history.length === 0 ? (
                  <span className="text-white/20 text-xs">Waiting for detections...</span>
                ) : (
                  history.map((g, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded text-[10px] bg-white/10 text-white/80 uppercase">
                      {g}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Calibration Steps & Status */}
      <div className="bg-black/60 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between min-h-[380px]">
        {isCalibrated ? (
          <div className="flex flex-col items-center justify-center py-8 text-center h-full pointer-events-auto">
            <CheckCircle2 className="w-16 h-16 text-green-400 mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-white mb-2">Calibration Successful!</h2>
            <p className="text-white/60 text-sm max-w-sm mb-6">
              AI hand gestures are locked in. You are fully authorized to race.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              {onComplete && (
                <button
                  onClick={onComplete}
                  className="w-full py-3 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-lg transition duration-200 animate-pulse"
                >
                  Launch Race 🏎️
                </button>
              )}
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg border border-white/20 text-white hover:bg-white/5 font-mono text-sm uppercase tracking-wider transition"
              >
                <RotateCcw className="w-4 h-4" /> Recalibrate
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white font-mono uppercase tracking-wide">
                Gesture Wizard <span className="text-cyan-400">({activeStepIndex + 1}/{STEPS.length})</span>
              </h2>
              <button onClick={handleReset} className="text-white/40 hover:text-white transition" title="Reset wizard">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Progress dots */}
            <div className="flex gap-2 mb-6">
              {STEPS.map((s, idx) => (
                <div
                  key={s.id}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    idx === activeStepIndex
                      ? 'bg-cyan-400 shadow-[0_0_10px_#00f0ff]'
                      : calibrationProgress[s.gestureKey]
                      ? 'bg-green-400'
                      : 'bg-white/10'
                  }`}
                />
              ))}
            </div>

            {/* Step card */}
            <div className="bg-white/5 border border-white/5 rounded-xl p-5 mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">{currentStep.name}</h3>
              <p className="text-white/70 text-sm mb-6 leading-relaxed">
                {currentStep.instruction}
              </p>

              {/* Stability Hold Bar */}
              <div>
                <div className="flex justify-between text-xs font-mono text-white/50 mb-1">
                  <span>HOLD GESTURE STABLE:</span>
                  <span>{stabilityScore}%</span>
                </div>
                <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                  <div
                    className={`h-full transition-all duration-100 ${
                      stabilityScore > 80 ? 'bg-green-400' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${stabilityScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Sensitivity controls */}
            <div className="space-y-2 border-t border-white/5 pt-4">
              <div className="flex justify-between items-center text-xs font-mono text-white/60">
                <span>Steering Sensitivity:</span>
                <span className="text-cyan-400">{gestureSensitivity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={gestureSensitivity}
                onChange={(e) => setGestureSensitivity(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-white/10 h-1 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}

        <div className="border-t border-white/5 pt-4 mt-6 flex justify-between items-center text-xs text-white/40">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
            <span>Ensure good room lighting for high accuracy</span>
          </div>
          {!isCalibrated && (
            <button
              onClick={() => {
                if (activeStepIndex < STEPS.length - 1) {
                  setActiveStepIndex(prev => Math.min(STEPS.length - 1, prev + 1));
                } else {
                  setIsCalibrated(true);
                }
              }}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-mono uppercase font-semibold transition"
            >
              Skip <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
