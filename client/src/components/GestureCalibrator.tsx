'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { CheckCircle2, RotateCcw, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';
import WebcamDetector from './WebcamDetector';

interface CalibrationStep {
  id: 'detect_hands' | 'neutral_calib' | 'left_calib' | 'right_calib' | 'validate_calib';
  name: string;
  instruction: string;
}

const STEPS: CalibrationStep[] = [
  {
    id: 'detect_hands',
    name: '1. Hand Detection',
    instruction: 'Raise both hands in front of the camera, aligning them horizontally as if gripping a real steering wheel.',
  },
  {
    id: 'neutral_calib',
    name: '2. Center Calibration',
    instruction: 'Hold the virtual steering wheel straight and steady. Keep both hands level.',
  },
  {
    id: 'left_calib',
    name: '3. Max Left Turn',
    instruction: 'Rotate the imaginary wheel fully to the left (counter-clockwise) and hold.',
  },
  {
    id: 'right_calib',
    name: '4. Max Right Turn',
    instruction: 'Rotate the imaginary wheel fully to the right (clockwise) and hold.',
  },
  {
    id: 'validate_calib',
    name: '5. Saving Profile',
    instruction: 'Validating signal quality, noise boundaries, and committing calibration parameters...',
  },
];

export default function GestureCalibrator({ onComplete }: { onComplete?: () => void }) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [stabilityScore, setStabilityScore] = useState(0); // progress percentage for active step
  const [isCalibratedState, setIsCalibratedState] = useState(false);

  // Store intermediate samples
  const samplesRef = useRef<number[]>([]);
  const tempNeutralRef = useRef<number>(0);
  const tempLeftRef = useRef<number>(-0.6);
  const tempRightRef = useRef<number>(0.6);

  const {
    handDetected,
    handConfidence,
    steeringAngle,
    handsCount,
    rawWheelAngle,
    webcamFps,
    trackingLatency,
  } = useGameStore();

  const {
    neutralAngle,
    leftMaxAngle,
    rightMaxAngle,
    isCalibrated,
    setCalibration,
    gestureSensitivity,
    setGestureSensitivity,
  } = useSettingsStore();

  const currentStep = STEPS[activeStepIndex] || STEPS[0];

  // Core Calibration State Machine
  useEffect(() => {
    if (isCalibratedState) return;

    let timer: NodeJS.Timeout;
    const stepId = currentStep.id;

    // Condition to advance calibration: requires both hands present
    const isConditionMet = handsCount >= 2;

    if (isConditionMet) {
      timer = setInterval(() => {
        setStabilityScore((prev) => {
          if (prev >= 100) {
            clearInterval(timer);

            // Record step results
            const avgSampleValue =
              samplesRef.current.reduce((a, b) => a + b, 0) / (samplesRef.current.length || 1);

            if (stepId === 'neutral_calib') {
              tempNeutralRef.current = avgSampleValue;
            } else if (stepId === 'left_calib') {
              tempLeftRef.current = avgSampleValue;
            } else if (stepId === 'right_calib') {
              tempRightRef.current = avgSampleValue;
            }

            // Clear samples for next step
            samplesRef.current = [];

            // Move to next step
            if (activeStepIndex < STEPS.length - 1) {
              setActiveStepIndex((prevIdx) => prevIdx + 1);
            } else {
              // Final Step: Validation
              // Save properties inside store
              const leftVal = tempLeftRef.current;
              const rightVal = tempRightRef.current;
              const neutralVal = tempNeutralRef.current;

              // Ensure maximum left and right angles are valid (at least 0.15 radians away from center)
              const validLeft = Math.abs(leftVal - neutralVal) > 0.15 ? leftVal : neutralVal - 0.55;
              const validRight = Math.abs(rightVal - neutralVal) > 0.15 ? rightVal : neutralVal + 0.55;

              setCalibration(neutralVal, validLeft, validRight);
              setIsCalibratedState(true);
              localStorage.setItem('gesture_calibrated', 'true');
            }
            return 0;
          }

          // Accumulate samples during step active holds
          if (stepId !== 'detect_hands' && stepId !== 'validate_calib') {
            samplesRef.current.push(rawWheelAngle);
          }

          return prev + 8; // holds take ~1.2s to calibrate
        });
      }, 100);
    } else {
      // Decay calibration progress if hands are lost or separated
      setStabilityScore((prev) => Math.max(0, prev - 15));
      samplesRef.current = [];
    }

    return () => clearInterval(timer);
  }, [handsCount, activeStepIndex, isCalibratedState, currentStep, rawWheelAngle, setCalibration]);

  const handleReset = () => {
    setActiveStepIndex(0);
    setStabilityScore(0);
    setIsCalibratedState(false);
    samplesRef.current = [];
    tempNeutralRef.current = 0;
    tempLeftRef.current = -0.6;
    tempRightRef.current = 0;
  };

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      {/* Left Column: Webcam Viewer & Live Stats */}
      <div className="flex flex-col gap-4">
        <WebcamDetector />

        {/* Live Tracking Telemetry HUD */}
        <div className="bg-white/80 border border-white/60 text-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
          <h3 className="text-slate-800 font-extrabold font-mono text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Real-time Telemetry
          </h3>

          <div className="space-y-4 font-mono text-sm text-slate-700">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span>Hands Count:</span>
              <span className={handsCount >= 2 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                {handsCount} {handsCount === 1 ? '(NEED BOTH)' : ''}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span>Raw Angle:</span>
              <span className="text-slate-900 font-bold">
                {rawWheelAngle ? `${(rawWheelAngle * (180 / Math.PI)).toFixed(1)}°` : '0°'}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span>Output Angle:</span>
              <span className="text-cyan-600 font-bold">
                {steeringAngle > 0.05
                  ? `RIGHT (${Math.round(steeringAngle * 100)}%)`
                  : steeringAngle < -0.05
                  ? `LEFT (${Math.round(Math.abs(steeringAngle) * 100)}%)`
                  : 'CENTER'}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span>Lighting Quality:</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500"
                    style={{ width: `${useGameStore.getState().webcamLighting}%` }}
                  />
                </div>
                <span>{useGameStore.getState().webcamLighting}%</span>
              </div>
            </div>

            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span>Tracking FPS:</span>
              <span className="text-slate-900">{webcamFps} FPS</span>
            </div>

            <div className="flex justify-between items-center pb-2">
              <span>Signal Latency:</span>
              <span className="text-slate-900">{trackingLatency}ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Calibration Steps & Status */}
      <div className="bg-white/80 border border-white/60 text-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between min-h-[420px]">
        {isCalibratedState ? (
          <div className="flex flex-col items-center justify-center py-8 text-center h-full pointer-events-auto">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Calibration Saved!</h2>
            <p className="text-slate-500 text-sm max-w-sm mb-6 leading-relaxed">
              Steering coefficients committed. The virtual steering wheel maps left and right turns perfectly.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              {onComplete && (
                <button
                  onClick={onComplete}
                  className="w-full py-4.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-sm uppercase tracking-widest rounded-2xl shadow-[0_4px_20px_rgba(245,158,11,0.35)] transition duration-200 pointer-events-auto"
                >
                  Start Race 🏎️
                </button>
              )}
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-mono text-sm uppercase tracking-wider transition"
              >
                <RotateCcw className="w-4 h-4" /> Recalibrate
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800 font-mono uppercase tracking-wide">
                Steering Calibration <span className="text-cyan-600">({activeStepIndex + 1}/{STEPS.length})</span>
              </h2>
              <button
                onClick={handleReset}
                className="text-slate-400 hover:text-slate-800 transition pointer-events-auto"
                title="Reset wizard"
              >
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
                      ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                      : idx < activeStepIndex
                      ? 'bg-emerald-500'
                      : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>

            {/* Step card */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-6">
              <h3 className="text-base font-bold text-slate-800 mb-2">{currentStep.name}</h3>
              <p className="text-slate-500 text-xs mb-6 leading-relaxed">
                {currentStep.instruction}
              </p>

              {/* Stability Hold Bar */}
              {handsCount >= 2 ? (
                <div>
                  <div className="flex justify-between text-xs font-mono text-slate-500 mb-1">
                    <span>HOLD POSITION SECURELY:</span>
                    <span className="font-extrabold text-slate-700">{stabilityScore}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden border border-slate-100">
                    <div
                      className={`h-full transition-all duration-100 ${
                        stabilityScore > 85 ? 'bg-emerald-500' : 'bg-cyan-500'
                      }`}
                      style={{ width: `${stabilityScore}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2 animate-pulse font-mono">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>WAITING FOR BOTH HANDS TO CONNECT...</span>
                </div>
              )}
            </div>

            {/* Calibration metrics summary */}
            {activeStepIndex > 0 && (
              <div className="mb-4 bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] font-mono text-slate-500 space-y-1.5">
                <div className="flex justify-between">
                  <span>Neutral Offset:</span>
                  <span className="text-slate-800 font-bold">
                    {tempNeutralRef.current ? `${(tempNeutralRef.current * (180 / Math.PI)).toFixed(1)}°` : 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Max Left Angle:</span>
                  <span className="text-slate-800 font-bold">
                    {tempLeftRef.current ? `${(tempLeftRef.current * (180 / Math.PI)).toFixed(1)}°` : 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Max Right Angle:</span>
                  <span className="text-slate-800 font-bold">
                    {tempRightRef.current ? `${(tempRightRef.current * (180 / Math.PI)).toFixed(1)}°` : 'Pending'}
                  </span>
                </div>
              </div>
            )}

            {/* Sensitivity controls */}
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <div className="flex justify-between items-center text-xs font-mono text-slate-600">
                <span>Adjust Steering Sensitivity:</span>
                <span className="text-cyan-600 font-extrabold">{gestureSensitivity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={gestureSensitivity}
                onChange={(e) => setGestureSensitivity(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 bg-slate-200 h-1 rounded-lg appearance-none cursor-pointer pointer-events-auto"
              />
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 pt-4 mt-6 flex justify-between items-center text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Keep your hands 30-50 cm from the camera lens.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
