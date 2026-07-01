'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { classifyHandGesture, Landmark } from '@/gestures/gestureClassifier';
import { Camera, RefreshCw, AlertCircle, Settings, ChevronDown, MonitorPlay } from 'lucide-react';

interface SmoothedPoint {
  x: number;
  y: number;
}

export default function WebcamDetector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingModel, setLoadingModel] = useState<boolean>(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(true); // default true for dev visibility

  // Settings calibration states
  const {
    neutralAngle,
    leftMaxAngle,
    rightMaxAngle,
    isCalibrated,
    gestureSensitivity,
    setActiveCameraId,
    activeCameraId,
    handMode,
  } = useSettingsStore();

  const updateGestureInput = useGameStore((s) => s.updateGestureInput);
  const setCameraPermission = useGameStore((s) => s.setCameraPermission);

  // EMA smoothing & lost-frame recovery refs
  const smoothedSteerRef = useRef(0);
  const lostFramesRef = useRef(0);
  const lastGestureRef = useRef('neutral');

  // Wrist projection history refs for one-hand lost recovery
  const lastLeftWristRef = useRef<SmoothedPoint>({ x: 0.35, y: 0.5 });
  const lastRightWristRef = useRef<SmoothedPoint>({ x: 0.65, y: 0.5 });
  const lastHandDistanceRef = useRef<number>(0.3);
  const lastRelativeAngleRef = useRef<number>(0.0);
  const lastLeftHandRollRef = useRef<number>(0.0);
  const lastRightHandRollRef = useRef<number>(0.0);
  const hasTwoHandsBaselineRef = useRef<boolean>(false);

  // Wrist landmark smoothing refs (jitter prevention)
  const smoothedLeftWristRef = useRef<SmoothedPoint>({ x: 0.35, y: 0.5 });
  const smoothedRightWristRef = useRef<SmoothedPoint>({ x: 0.65, y: 0.5 });

  // Latency & frame counters
  const sendTimeRef = useRef(0);
  const latencyRef = useRef(0);

  // Enumerate video devices
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fetchDevices = async () => {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devs.filter((d) => d.kind === 'videoinput');
        setDevices(videoDevs);
        if (videoDevs.length > 0 && !activeCameraId) {
          setActiveCameraId(videoDevs[0].deviceId);
        }
      } catch (e) {
        console.warn('Failed to enumerate media devices:', e);
      }
    };

    if (permissionState === 'granted') {
      fetchDevices();
    }
  }, [permissionState, activeCameraId, setActiveCameraId]);

  useEffect(() => {
    let active = true;
    let cameraStream: MediaStream | null = null;
    let requestFrameId: number;
    let handsDetector: any = null;

    const loadMediaPipe = async () => {
      try {
        if (!window) return;
        setLoadingModel(true);

        const mpHandsModule = await import('@mediapipe/hands');
        const HandsClass =
          mpHandsModule.Hands ||
          (mpHandsModule as any).default?.Hands ||
          (window as any).Hands;

        if (!HandsClass) {
          throw new Error('Hands class constructor not found in module.');
        }

        if (!active) return;

        handsDetector = new HandsClass({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        handsDetector.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });

        handsDetector.onResults(onResults);
        setLoadingModel(false);
        await startCamera();
      } catch (err: any) {
        console.error('Error initializing MediaPipe:', err);
        setErrorMsg('Failed to initialize tracking models.');
        setLoadingModel(false);
        setPermissionState('denied');
        setCameraPermission('denied');
      }
    };

    const startCamera = async () => {
      try {
        setPermissionState('prompt');

        if (
          typeof navigator === 'undefined' ||
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          throw new Error(
            'Webcam APIs are blocked. Please verify you are on localhost:3001 or using secure HTTPS.'
          );
        }

        let stream: MediaStream;

        try {
          const videoConstraints: any = {
            width: 320,
            height: 240,
            frameRate: { ideal: 30 },
          };
          if (activeCameraId) {
            videoConstraints.deviceId = { exact: activeCameraId };
          }

          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
          });
        } catch (deviceErr) {
          console.warn('Failed to load specific device ID, trying general camera constraints...', deviceErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, frameRate: { ideal: 30 } },
            audio: false,
          });
        }

        if (!active) {
          stream.getTracks().forEach((t) => trackStop(t));
          return;
        }

        cameraStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((playErr) => {
            console.warn('Webcam video playback request was safely interrupted or deferred:', playErr);
          });
        }
        setPermissionState('granted');
        setCameraPermission('granted');
      } catch (err: any) {
        console.warn('Webcam permission access denied:', err);
        setPermissionState('denied');
        setCameraPermission('denied');
        setErrorMsg(
          err.message || 'Webcam access was denied. Please allow camera permissions in your browser address bar.'
        );
      }
    };

    const trackStop = (t: MediaStreamTrack) => {
      try {
        t.stop();
      } catch (e) {}
    };

    // Calculate light quality index
    const checkLighting = (ctx: CanvasRenderingContext2D, w: number, h: number): number => {
      try {
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        let brightnessSum = 0;
        for (let i = 0; i < data.length; i += 40) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          brightnessSum += 0.299 * r + 0.587 * g + 0.114 * b;
        }
        const avgLuminance = brightnessSum / (data.length / 40);
        return Math.min(100, Math.max(0, Math.round((avgLuminance / 128) * 100)));
      } catch (e) {
        return 100;
      }
    };

    // Helper: Palm roll/tilt calculator for one-hand projection
    const getPalmRoll = (landmarks: Landmark[], isLeft: boolean): number => {
      if (!landmarks || landmarks.length < 21) return 0;
      const indexMCP = landmarks[5];
      const pinkyMCP = landmarks[17];
      const dx = pinkyMCP.x - indexMCP.x;
      const dy = pinkyMCP.y - indexMCP.y;
      let angle = Math.atan2(dy, dx);
      return isLeft ? -angle : angle;
    };

    let lastTime = performance.now();
    let frames = 0;
    let fps = 0;

    const processFrame = async () => {
      if (!active || !videoRef.current || !handsDetector) return;

      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const timeNow = performance.now();
        frames++;
        if (timeNow > lastTime + 1000) {
          fps = Math.round((frames * 1000) / (timeNow - lastTime));
          frames = 0;
          lastTime = timeNow;
        }

        try {
          sendTimeRef.current = performance.now();
          await handsDetector.send({ image: videoRef.current });
        } catch (e) {}
      }

      requestFrameId = requestAnimationFrame(processFrame);
    };

    const onResults = (results: any) => {
      if (!canvasRef.current || !active) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      latencyRef.current = Math.round(performance.now() - sendTimeRef.current);

      const w = canvas.width;
      const h = canvas.height;

      // Draw mirrored background video
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(results.image, 0, 0, w, h);
      ctx.restore();

      const lightingScore = checkLighting(ctx, w, h);

      const handsPresent = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

      // 1. Hands Detection and Auto-Identification
      if (handsPresent) {
        lostFramesRef.current = 0;

        const rawClassifications = results.multiHandLandmarks.map(
          (landmarks: Landmark[], index: number) => {
            const isLeft = results.multiHandedness[index].label === 'Left';
            const classification = classifyHandGesture(landmarks, isLeft);
            return {
              landmarks,
              isLeft,
              wrist: landmarks[0],
              gesture: classification.gesture,
              confidence: results.multiHandedness[index].score,
            };
          }
        );

        // Sort screen-left and screen-right wrists by X position
        const sortedClassifications = [...rawClassifications].sort(
          (a, b) => a.wrist.x - b.wrist.x
        );

        let leftHandInfo = null;
        let rightHandInfo = null;

        if (sortedClassifications.length === 1) {
          // Identify single hand based on screen position
          const single = sortedClassifications[0];
          if (single.wrist.x < 0.5) {
            leftHandInfo = single;
          } else {
            rightHandInfo = single;
          }
        } else if (sortedClassifications.length >= 2) {
          leftHandInfo = sortedClassifications[0];
          rightHandInfo = sortedClassifications[1];
        }

        // Apply EMA Landmark smoothing to wrists (jitter removal)
        if (leftHandInfo) {
          smoothedLeftWristRef.current.x =
            0.35 * leftHandInfo.wrist.x + 0.65 * smoothedLeftWristRef.current.x;
          smoothedLeftWristRef.current.y =
            0.35 * leftHandInfo.wrist.y + 0.65 * smoothedLeftWristRef.current.y;
        }
        if (rightHandInfo) {
          smoothedRightWristRef.current.x =
            0.35 * rightHandInfo.wrist.x + 0.65 * smoothedRightWristRef.current.x;
          smoothedRightWristRef.current.y =
            0.35 * rightHandInfo.wrist.y + 0.65 * smoothedRightWristRef.current.y;
        }

        // Determine combined gesture actions
        const actionPriority = ['pause', 'handbrake', 'nitro', 'brake', 'accelerate'];
        let finalGesture = 'neutral';
        let maxPriorityIndex = -1;

        rawClassifications.forEach((c: any) => {
          const pIdx = actionPriority.indexOf(c.gesture);
          if (pIdx > maxPriorityIndex) {
            maxPriorityIndex = pIdx;
            finalGesture = c.gesture;
          }
        });

        // 2. Virtual Steering Wheel Angle Calculation
        let combinedSteer = 0;
        let leftHandConf = leftHandInfo ? leftHandInfo.confidence * 100 : 0;
        let rightHandConf = rightHandInfo ? rightHandInfo.confidence * 100 : 0;
        let currentAngle = 0;

        if (leftHandInfo && rightHandInfo) {
          // Both hands are present: Standard Steering Wheel calculation
          const dx = smoothedRightWristRef.current.x - smoothedLeftWristRef.current.x;
          const dy = smoothedRightWristRef.current.y - smoothedLeftWristRef.current.y;

          // Clockwise tilt -> right hand goes down (dy increases) -> positive angle
          const wheelAngle = Math.atan2(dy, dx);
          currentAngle = wheelAngle;

          // Save baseline calculations for missing-hand projections
          lastHandDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
          lastRelativeAngleRef.current = wheelAngle;
          lastLeftWristRef.current = { ...smoothedLeftWristRef.current };
          lastRightWristRef.current = { ...smoothedRightWristRef.current };
          lastLeftHandRollRef.current = getPalmRoll(leftHandInfo.landmarks, true);
          lastRightHandRollRef.current = getPalmRoll(rightHandInfo.landmarks, false);
          hasTwoHandsBaselineRef.current = true;

          // Normalize steering angle relative to calibration settings
          let steer = 0;
          const relativeAngle = wheelAngle - neutralAngle;

          if (relativeAngle < 0) {
            // Steering left
            const range = Math.abs(leftMaxAngle - neutralAngle) || 0.55;
            steer = relativeAngle / range;
          } else {
            // Steering right
            const range = Math.abs(rightMaxAngle - neutralAngle) || 0.55;
            steer = relativeAngle / range;
          }

          // Apply deadzone around the center position (smooth thresholding)
          if (Math.abs(steer) < 0.08) {
            steer = 0;
          }

          combinedSteer = steer;
        } else if (hasTwoHandsBaselineRef.current && (leftHandInfo || rightHandInfo)) {
          // Stable tracking even when one hand briefly disappears: Wrist offset projection
          let projectedAngle = lastRelativeAngleRef.current;

          if (rightHandInfo) {
            // Left hand disappeared: project left hand coordinates from right hand roll delta
            const currentRoll = getPalmRoll(rightHandInfo.landmarks, false);
            const deltaRoll = currentRoll - lastRightHandRollRef.current;
            projectedAngle = lastRelativeAngleRef.current + deltaRoll;

            const estLeftX =
              smoothedRightWristRef.current.x - lastHandDistanceRef.current * Math.cos(projectedAngle);
            const estLeftY =
              smoothedRightWristRef.current.y - lastHandDistanceRef.current * Math.sin(projectedAngle);

            smoothedLeftWristRef.current = { x: estLeftX, y: estLeftY };
          } else if (leftHandInfo) {
            // Right hand disappeared: project right hand coordinates from left hand roll delta
            const currentRoll = getPalmRoll(leftHandInfo.landmarks, true);
            const deltaRoll = currentRoll - lastLeftHandRollRef.current;
            projectedAngle = lastRelativeAngleRef.current + deltaRoll;

            const estRightX =
              smoothedLeftWristRef.current.x + lastHandDistanceRef.current * Math.cos(projectedAngle);
            const estRightY =
              smoothedLeftWristRef.current.y + lastHandDistanceRef.current * Math.sin(projectedAngle);

            smoothedRightWristRef.current = { x: estRightX, y: estRightY };
          }

          currentAngle = projectedAngle;
          const relativeAngle = projectedAngle - neutralAngle;
          let steer = 0;
          if (relativeAngle < 0) {
            const range = Math.abs(leftMaxAngle - neutralAngle) || 0.55;
            steer = relativeAngle / range;
          } else {
            const range = Math.abs(rightMaxAngle - neutralAngle) || 0.55;
            steer = relativeAngle / range;
          }

          if (Math.abs(steer) < 0.08) steer = 0;
          combinedSteer = steer;
        } else {
          // Single hand startup / fallback (before two-hand baseline is established)
          const activeHand = leftHandInfo || rightHandInfo;
          if (activeHand) {
            const roll = getPalmRoll(activeHand.landmarks, activeHand.isLeft);
            currentAngle = roll;
            let steer = roll / 0.55;
            if (Math.abs(steer) < 0.12) steer = 0;
            combinedSteer = steer;
          }
        }

        // Apply adjustable sensitivity and clamp steering output between -1.0 and +1.0
        combinedSteer = Math.max(-1.0, Math.min(1.0, combinedSteer * gestureSensitivity));

        // Noise reduction & Jitter removal (smoothing = 0.24)
        smoothedSteerRef.current = 0.24 * combinedSteer + 0.76 * smoothedSteerRef.current;
        lastGestureRef.current = finalGesture;

        const avgConfidence = Math.round(
          ((leftHandInfo ? leftHandInfo.confidence : 0) +
            (rightHandInfo ? rightHandInfo.confidence : 0)) *
            50
        );

        updateGestureInput({
          handDetected: true,
          handConfidence: avgConfidence,
          currentGesture: finalGesture,
          steeringAngle: smoothedSteerRef.current,
          webcamFps: fps,
          webcamLighting: lightingScore,
          leftHandConfidence: Math.round(leftHandConf),
          rightHandConfidence: Math.round(rightHandConf),
          handsCount: sortedClassifications.length,
          trackingLatency: latencyRef.current,
          handsLostNotification: false,
          rawWheelAngle: currentAngle,
        });

        // 3. Draw neon skeletal lines inside canvas
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);

        sortedClassifications.forEach((c: any, index: number) => {
          const landmarks = c.landmarks;
          ctx.fillStyle = index === 0 ? '#00f0ff' : '#00ffcc';
          ctx.strokeStyle = index === 0 ? '#ff0055' : '#ff3366';
          ctx.lineWidth = 3;
          ctx.shadowBlur = 10;
          ctx.shadowColor = index === 0 ? '#ff0055' : '#ff3366';

          const drawConnect = (i1: number, i2: number) => {
            ctx.beginPath();
            ctx.moveTo(landmarks[i1].x * w, landmarks[i1].y * h);
            ctx.lineTo(landmarks[i2].x * w, landmarks[i2].y * h);
            ctx.stroke();
          };

          drawConnect(0, 1); drawConnect(1, 2); drawConnect(2, 3); drawConnect(3, 4);
          drawConnect(0, 5); drawConnect(5, 6); drawConnect(6, 7); drawConnect(7, 8);
          drawConnect(5, 9); drawConnect(9, 10); drawConnect(10, 11); drawConnect(11, 12);
          drawConnect(9, 13); drawConnect(13, 14); drawConnect(14, 15); drawConnect(15, 16);
          drawConnect(13, 17); drawConnect(17, 18); drawConnect(18, 19); drawConnect(19, 20);
          drawConnect(0, 17);

          for (let i = 0; i < landmarks.length; i++) {
            ctx.beginPath();
            ctx.arc(landmarks[i].x * w, landmarks[i].y * h, 3.5, 0, 2 * Math.PI);
            ctx.fill();
          }
        });

        ctx.restore();
      } else {
        // Lost Hand Recovery / Extrapolation logic
        // If confidence drops below threshold, maintain last stable steering value (ema slow decay)
        lostFramesRef.current += 1;

        if (lostFramesRef.current < 16) {
          // Slow return to neutral rather than instant snap (extrapolation)
          smoothedSteerRef.current = 0.92 * smoothedSteerRef.current;

          updateGestureInput({
            handDetected: true,
            handConfidence: 20,
            currentGesture: lastGestureRef.current,
            steeringAngle: smoothedSteerRef.current,
            webcamFps: fps,
            webcamLighting: lightingScore,
            leftHandConfidence: 0,
            rightHandConfidence: 0,
            handsCount: 0,
            trackingLatency: latencyRef.current,
            handsLostNotification: false,
          });
        } else {
          // Exceeded timeout (approx 500ms): safely reset to zero and trigger overlay notification
          smoothedSteerRef.current = 0;
          hasTwoHandsBaselineRef.current = false;

          updateGestureInput({
            handDetected: false,
            handConfidence: 0,
            currentGesture: 'neutral',
            steeringAngle: 0,
            webcamFps: fps,
            webcamLighting: lightingScore,
            leftHandConfidence: 0,
            rightHandConfidence: 0,
            handsCount: 0,
            trackingLatency: latencyRef.current,
            handsLostNotification: true, // Display warning popup
          });
        }
      }
    };

    loadMediaPipe().then(() => {
      if (handsDetector) {
        requestFrameId = requestAnimationFrame(processFrame);
      }
    });

    return () => {
      active = false;
      cancelAnimationFrame(requestFrameId);
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      if (handsDetector) {
        handsDetector.close();
      }
    };
  }, [handMode, activeCameraId, updateGestureInput, neutralAngle, leftMaxAngle, rightMaxAngle, gestureSensitivity]);

  // Telemetry properties from the store
  const {
    handDetected,
    handConfidence,
    currentGesture,
    steeringAngle,
    webcamFps,
    webcamLighting,
    leftHandConfidence,
    rightHandConfidence,
    handsCount,
    trackingLatency,
  } = useGameStore();

  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <div className="relative w-full aspect-video rounded-2xl border border-white/10 bg-black/40 overflow-hidden backdrop-blur-md shadow-2xl flex flex-col items-center justify-center">
      <video ref={videoRef} className="hidden" playsInline muted width={320} height={240} />
      <canvas ref={canvasRef} width={320} height={240} className="absolute inset-0 w-full h-full object-cover rounded-2xl" />

      {/* Camera switcher */}
      {permissionState === 'granted' && devices.length > 1 && (
        <div className="absolute top-2 right-2 z-30 pointer-events-auto">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold bg-black/75 border border-white/20 hover:border-cyan-400 text-white/90 hover:text-white rounded-lg transition"
          >
            <Settings className="w-3.5 h-3.5" /> CAMERA <ChevronDown className="w-3 h-3" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-1.5 w-44 bg-black/90 border border-white/10 rounded-lg shadow-xl py-1 flex flex-col text-[10px]">
              {devices.map((d) => (
                <button
                  key={d.deviceId}
                  onClick={() => {
                    setActiveCameraId(d.deviceId);
                    setShowDropdown(false);
                  }}
                  className={`px-3 py-1.5 text-left truncate hover:bg-white/10 ${
                    activeCameraId === d.deviceId ? 'text-cyan-400 font-bold' : 'text-white/60'
                  }`}
                >
                  {d.label || `Camera ${d.deviceId.substring(0, 4)}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Debug panel toggle (dev mode only) */}
      {isDev && permissionState === 'granted' && !loadingModel && (
        <button
          onClick={() => setShowDebugPanel(!showDebugPanel)}
          className="absolute bottom-2 left-2 z-30 pointer-events-auto p-1.5 bg-black/80 border border-white/15 rounded-lg text-white/60 hover:text-white transition"
          title="Toggle CV Telemetry Panel"
        >
          <MonitorPlay className="w-4 h-4" />
        </button>
      )}

      {/* ─── LIVE CV TELEMETRY DEBUG PANEL (Dev Mode only) ─── */}
      {isDev && showDebugPanel && permissionState === 'granted' && !loadingModel && (
        <div className="absolute bottom-1 right-1 left-1 bg-black/80 border border-white/10 rounded-xl p-2.5 font-mono text-[8px] text-white/70 backdrop-blur-md grid grid-cols-2 gap-x-3 gap-y-1 z-35 pointer-events-none select-none">
          <div className="flex justify-between">
            <span>CAM:</span>
            <span className="text-emerald-400 font-bold">CONNECTED</span>
          </div>
          <div className="flex justify-between">
            <span>FPS:</span>
            <span className="text-white">{webcamFps} FPS</span>
          </div>
          <div className="flex justify-between">
            <span>TRACKING:</span>
            <span className={handDetected ? 'text-emerald-400' : 'text-red-400'}>
              {handDetected ? 'DETECTED' : 'LOST'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>HANDS COUNT:</span>
            <span className="text-cyan-400">{handsCount}</span>
          </div>
          <div className="flex justify-between">
            <span>L HAND CONF:</span>
            <span className="text-white">{leftHandConfidence}%</span>
          </div>
          <div className="flex justify-between">
            <span>R HAND CONF:</span>
            <span className="text-white">{rightHandConfidence}%</span>
          </div>
          <div className="flex justify-between col-span-2 border-t border-white/5 pt-1 mt-1">
            <span>WHEEL ANGLE:</span>
            <span className="text-yellow-400 font-bold">
              {neutralAngle ? `${(steeringAngle * 35).toFixed(1)}°` : '0°'}
            </span>
          </div>
          <div className="flex justify-between col-span-2">
            <span>STEER VALUE:</span>
            <span className="text-cyan-400 font-bold">
              {steeringAngle > 0 ? '+' : ''}
              {Math.round(steeringAngle * 100)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>LATENCY:</span>
            <span className="text-white">{trackingLatency}ms</span>
          </div>
          <div className="flex justify-between">
            <span>CALIB:</span>
            <span className={isCalibrated ? 'text-emerald-400' : 'text-amber-400'}>
              {isCalibrated ? 'CALIBRATED' : 'DEFAULT'}
            </span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loadingModel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
          <p className="text-cyan-400 font-mono text-[10px] uppercase tracking-wider animate-pulse">
            LOADING GESTURE ENGINE...
          </p>
        </div>
      )}

      {/* Camera permission prompt */}
      {permissionState === 'prompt' && !loadingModel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10 p-4 text-center">
          <Camera className="w-10 h-10 text-cyan-400 mb-3 animate-bounce" />
          <h3 className="text-white font-semibold text-xs uppercase tracking-wider">Camera Authorization</h3>
          <p className="text-white/50 text-[9px] max-w-xs mt-1">
            Allow camera permissions to control the vehicles via hand gestures.
          </p>
        </div>
      )}

      {/* Camera blocked */}
      {permissionState === 'denied' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 border border-red-500/30 z-10 p-4 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <h3 className="text-red-400 font-semibold text-xs uppercase tracking-wider">Camera Denied</h3>
          <p className="text-red-300/60 text-[9px] max-w-[190px] mt-1 leading-relaxed">
            {errorMsg || 'Permission blocked. Camera access is required to control vehicles.'}
          </p>
        </div>
      )}
    </div>
  );
}
