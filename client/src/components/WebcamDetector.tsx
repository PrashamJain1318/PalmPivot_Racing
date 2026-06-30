'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { classifyHandGesture, Landmark } from '@/gestures/gestureClassifier';
import { Camera, RefreshCw, AlertCircle, Settings, ChevronDown } from 'lucide-react';

export default function WebcamDetector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingModel, setLoadingModel] = useState<boolean>(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const updateGestureInput = useGameStore((s) => s.updateGestureInput);
  const setCameraPermission = useGameStore((s) => s.setCameraPermission);
  const handMode = useSettingsStore((s) => s.handMode);
  const activeCameraId = useSettingsStore((s) => s.activeCameraId);
  const setActiveCameraId = useSettingsStore((s) => s.setActiveCameraId);

  // EMA smoothing & lost-frame recovery refs
  const smoothedSteerRef = useRef(0);
  const lostFramesRef = useRef(0);
  const lastGestureRef = useRef('neutral');

  // Enumerate video devices
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fetchDevices = async () => {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devs.filter(d => d.kind === 'videoinput');
        setDevices(videoDevs);
        // Default to first camera if not set
        if (videoDevs.length > 0 && !activeCameraId) {
          setActiveCameraId(videoDevs[0].deviceId);
        }
      } catch (e) {
        console.warn('Failed to enumerate media devices:', e);
      }
    };
    
    // Request permission once, then enumerate
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

        // Dynamic local import to solve Next.js SSR and UMD collisions
        const mpHandsModule = await import('@mediapipe/hands');
        const HandsClass = mpHandsModule.Hands || (mpHandsModule as any).default?.Hands || (window as any).Hands;

        if (!HandsClass) {
          throw new Error('Hands class constructor not found in module.');
        }

        if (!active) return;

        handsDetector = new HandsClass({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        handsDetector.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
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
        
        if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Webcam APIs are blocked. Please verify you are on localhost:3001 or using secure HTTPS.');
        }

        let stream: MediaStream;

        try {
          const videoConstraints: any = {
            width: 320,
            height: 240,
            frameRate: { ideal: 30 }
          };
          if (activeCameraId) {
            videoConstraints.deviceId = { exact: activeCameraId };
          }
          
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false
          });
        } catch (deviceErr) {
          console.warn('Failed to load specific device ID, trying general camera constraints...', deviceErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, frameRate: { ideal: 30 } },
            audio: false
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
        setErrorMsg(err.message || 'Webcam access was denied. Please allow camera permissions in your browser address bar.');
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
          brightnessSum += (0.299 * r + 0.587 * g + 0.114 * b);
        }
        const avgLuminance = brightnessSum / (data.length / 40);
        return Math.min(100, Math.max(0, Math.round((avgLuminance / 128) * 100)));
      } catch (e) {
        return 100;
      }
    };

    // Frame processing loop
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
          await handsDetector.send({ image: videoRef.current });
        } catch (e) {
          // Ignore transient capture errors
        }
      }
      
      requestFrameId = requestAnimationFrame(processFrame);
    };

    const onResults = (results: any) => {
      if (!canvasRef.current || !active) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

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

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // Reset lost frames counter
        lostFramesRef.current = 0;

        // Process all detected hands (up to 2)
        const classifications = results.multiHandLandmarks.map((landmarks: Landmark[], index: number) => {
          const isLeftHand = results.multiHandedness[index].label === 'Left';
          const classification = classifyHandGesture(landmarks, isLeftHand);
          return {
            landmarks,
            isLeftHand,
            gesture: classification.gesture,
            steeringAngle: classification.steeringAngle,
            confidence: results.multiHandedness[index].score
          };
        });

        // Determine combined gesture
        // Priority list for action gestures: pause > handbrake > nitro > brake > accelerate
        const actionPriority = ['pause', 'handbrake', 'nitro', 'brake', 'accelerate'];
        let finalGesture = 'neutral';
        let maxPriorityIndex = -1;

        classifications.forEach((c: any) => {
          const pIdx = actionPriority.indexOf(c.gesture);
          if (pIdx > maxPriorityIndex) {
            maxPriorityIndex = pIdx;
            finalGesture = c.gesture;
          }
        });

        // If no action gesture is detected, look for steering
        if (finalGesture === 'neutral') {
          const steerGesture = classifications.find((c: any) => c.gesture === 'steer_left' || c.gesture === 'steer_right');
          if (steerGesture) {
            finalGesture = steerGesture.gesture;
          }
        }

        // Determine combined steering angle (Virtual Steering Wheel)
        let combinedSteer = 0;
        if (classifications.length === 1) {
          // Single hand fallback: use the roll/tilt angle
          combinedSteer = classifications[0].steeringAngle;
        } else if (classifications.length >= 2) {
          // Both hands are present: calculate angle between the two wrists
          const hand0 = classifications[0];
          const hand1 = classifications[1];
          
          const wrist0 = hand0.landmarks[0];
          const wrist1 = hand1.landmarks[0];
          
          // Sort left and right wrists by X coordinate in screen space
          const leftWrist = wrist0.x < wrist1.x ? wrist0 : wrist1;
          const rightWrist = wrist0.x < wrist1.x ? wrist1 : wrist0;
          
          const dx = rightWrist.x - leftWrist.x;
          const dy = rightWrist.y - leftWrist.y;
          
          // Calculate angle: rotating right (clockwise) makes right hand go down (dy increases), left hand go up (dy increases)
          const wheelAngle = Math.atan2(dy, dx);
          
          // Normalize: tilt of ~35 degrees (0.6 radians) represents full lock
          let steer = wheelAngle / 0.6;
          
          // Deadzone
          if (Math.abs(steer) < 0.08) steer = 0;
          
          combinedSteer = Math.max(-1, Math.min(1, steer));
        }

        // Apply Exponential Moving Average (EMA) steering filter (smoothing = 0.28)
        smoothedSteerRef.current = 0.28 * combinedSteer + 0.72 * smoothedSteerRef.current;
        lastGestureRef.current = finalGesture;

        // Average confidence score
        const avgConfidence = Math.round(
          (classifications.reduce((sum: number, c: any) => sum + c.confidence, 0) / classifications.length) * 100
        );

        updateGestureInput({
          handDetected: true,
          handConfidence: avgConfidence,
          currentGesture: finalGesture,
          steeringAngle: smoothedSteerRef.current,
          webcamFps: fps,
          webcamLighting: lightingScore
        });

        // Draw neon skeletal lines for all detected hands
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);

        classifications.forEach((c: any, index: number) => {
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
            ctx.arc(landmarks[i].x * w, landmarks[i].y * h, 4, 0, 2 * Math.PI);
            ctx.fill();
          }
        });

        ctx.restore();
      } else {
        // Lost Hand Recovery logic (preserve state if lost < 6 frames ~200ms)
        lostFramesRef.current += 1;
        if (lostFramesRef.current < 6) {
          // Slow return to zero for steering angle
          smoothedSteerRef.current = 0.82 * smoothedSteerRef.current;
          
          updateGestureInput({
            handDetected: true,
            handConfidence: 30,
            currentGesture: lastGestureRef.current,
            steeringAngle: smoothedSteerRef.current,
            webcamFps: fps,
            webcamLighting: lightingScore
          });
        } else {
          smoothedSteerRef.current = 0;
          updateGestureInput({
            handDetected: false,
            handConfidence: 0,
            currentGesture: 'neutral',
            steeringAngle: 0,
            webcamFps: fps,
            webcamLighting: lightingScore
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
  }, [handMode, activeCameraId, updateGestureInput]);

  return (
    <div className="relative w-full aspect-video rounded-2xl border border-white/10 bg-black/40 overflow-hidden backdrop-blur-md shadow-2xl flex flex-col items-center justify-center">
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        width={320}
        height={240}
      />
      <canvas
        ref={canvasRef}
        width={320}
        height={240}
        className="absolute inset-0 w-full h-full object-cover rounded-2xl"
      />

      {/* Floating Camera Device Switcher */}
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

      {/* States Overlays */}
      {loadingModel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
          <p className="text-cyan-400 font-mono text-[10px] uppercase tracking-wider animate-pulse">
            LOADING GESTURE ENGINE...
          </p>
        </div>
      )}

      {permissionState === 'prompt' && !loadingModel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10 p-4 text-center">
          <Camera className="w-10 h-10 text-cyan-400 mb-3 animate-bounce" />
          <h3 className="text-white font-semibold text-xs uppercase tracking-wider">Camera Authorization</h3>
          <p className="text-white/50 text-[9px] max-w-xs mt-1">
            Allow camera permissions to control the vehicles via hand gestures.
          </p>
        </div>
      )}

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
