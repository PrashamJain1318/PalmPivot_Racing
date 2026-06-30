'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, useRapier, CuboidCollider } from '@react-three/rapier';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import * as THREE from 'three';
import { getProceduralTrackPoints } from '@/utils/trackGenerator';

interface VehicleControllerProps {
  paintColor?: string;
  underglowColor?: string;
  onCollision?: (force: number, point: [number, number, number]) => void;
}

export default function VehicleController({
  paintColor = '#ff0055',
  underglowColor = '#00ffff',
  onCollision
}: VehicleControllerProps) {
  const rbRef = useRef<RapierRigidBody>(null);
  const chassisRef = useRef<THREE.Group>(null);
  
  const { camera } = useThree();
  const { rapier, world } = useRapier();

  // Replay trackside camera tracking refs
  const lastCameraSwitchRef = useRef(0);
  const replayCameraWpIndexRef = useRef(0);
  const replayCameraPosRef = useRef(new THREE.Vector3());
  const displaySpeedRef = useRef(0);
  const speedLinesRef = useRef<THREE.Group>(null);

  // Zustand state selectors
  const {
    status,
    currentGesture,
    steeringAngle,
    handDetected,
    lap,
    totalLaps,
    ghostReplayData,
    updateVehicleStats,
    saveGhostReplay,
    addCoins,
    addXp,
    setStatus,
    
    // New arcade states
    fuel,
    coinsCollected,
    distance,
    score,
    scoreMultiplier,
    shieldActive,
    magnetActive,
    health,
    nitroActive
  } = useGameStore();

  const currentTrack = useGameStore((s) => s.currentTrack);

  const {
    cameraMode,
    gestureSensitivity,
    debugKeyboard,
    weather
  } = useSettingsStore();

  // Temporary physics vectors
  const forwardVec = new THREE.Vector3();
  const rightVec = new THREE.Vector3();
  const upVec = new THREE.Vector3(0, 1, 0);
  const velocityVec = new THREE.Vector3();
  const cameraTargetPos = new THREE.Vector3();
  const cameraLookAtPos = new THREE.Vector3();

  // Ghost Car position state
  const [ghostPos, setGhostPos] = useState<THREE.Vector3 | null>(null);

  // Dynamic start spawn position and rotation
  const startTransform = useMemo(() => {
    const points = getProceduralTrackPoints(currentTrack || 'track_1');
    if (points.length >= 2) {
      const p0 = points[0];
      const p1 = points[1];
      const forward = new THREE.Vector3().subVectors(p1, p0).normalize();
      const angle = Math.atan2(forward.x, forward.z);
      return {
        position: [p0.x, p0.y + 0.72, p0.z] as [number, number, number],
        rotation: [0, angle, 0] as [number, number, number]
      };
    }
    return {
      position: [0, 0.72, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number]
    };
  }, [currentTrack]);

  // Arcade local references
  const prevHealthRef = useRef(100);
  const cleanDrivingTimeRef = useRef(0);
  const nitroTimerRef = useRef(0);

  // Active driving stats & Ghost recording buffer
  const statsRef = useRef({
    speed: 0,
    rpm: 800,
    gear: 1,
    nitroLevel: 100,
    driftTime: 0,
    isDrifting: false,
    combo: 0,
    raceTime: 0,
    recordingTimer: 0,
    lastFinishCross: 0
  });

  // Compute waypoints and finish zone for dynamic lap detection
  const waypointsRef = useRef<THREE.Vector3[]>([]);
  const finishZoneRef = useRef<{ center: THREE.Vector3; radius: number }>({ center: new THREE.Vector3(0, 0, 10), radius: 12 });

  const recordingBuffer = useRef<[number, number, number][]>([]);

  // Keyboard controls listener (strictly for debugging, disabled by default)
  const keysPressed = useRef({
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    Space: false,
    ShiftLeft: false,
    ShiftRight: false
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (debugKeyboard && e.code in keysPressed.current) {
        keysPressed.current[e.code as keyof typeof keysPressed.current] = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (debugKeyboard && e.code in keysPressed.current) {
        keysPressed.current[e.code as keyof typeof keysPressed.current] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [debugKeyboard]);

  // Compute waypoints for respawn and lap detection when track changes
  useEffect(() => {
    const points = getProceduralTrackPoints(currentTrack || 'track_1');
    waypointsRef.current = points;
    if (points.length >= 2) {
      // Finish line is at the midpoint of waypoints 0-1
      const fCenter = new THREE.Vector3(
        (points[0].x + points[1].x) / 2,
        (points[0].y + points[1].y) / 2,
        (points[0].z + points[1].z) / 2
      );
      finishZoneRef.current = { center: fCenter, radius: 14 };
    }
  }, [currentTrack]);

  // Handle collision events
  const handleCollision = (event: any) => {
    if (!rbRef.current) return;
    try {
      const impulse = event.totalImpulse;
      const force = Math.sqrt(impulse.x ** 2 + impulse.y ** 2 + impulse.z ** 2);
      
      if (force > 3.0 && onCollision) {
        const translation = rbRef.current.translation();
        onCollision(force, [translation.x, translation.y, translation.z]);
      }
    } catch (e) {
      // Catch empty rapier impulses
    }
  };

  useFrame((state, delta) => {
    if (!rbRef.current || !chassisRef.current) return;

    const rb = rbRef.current;
    const translation = rb.translation();
    const rotation = rb.rotation();

    // Lock vehicle physics if game is paused, finished, or during loading/countdown
    if (status !== 'playing') {
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      
      if (status === 'countdown' || status === 'calibration' || status === 'menu' || status === 'garage') {
        rb.setTranslation({ x: startTransform.position[0], y: startTransform.position[1], z: startTransform.position[2] }, true);
        const yaw = startTransform.rotation[1];
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        rb.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      }
      
      statsRef.current.speed = 0;
      statsRef.current.rpm = 800;
      statsRef.current.isDrifting = false;
      statsRef.current.combo = 0;
      
      updateVehicleStats({
        speed: 0,
        rpm: 800,
        isDrifting: false,
        combo: 0
      });
      
      // Update camera follow positioning even while locked (keeps camera behind car)
      const carCenter = new THREE.Vector3(translation.x, translation.y + 0.6, translation.z);
      const startYaw = startTransform.rotation[1];
      const startQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), startYaw);
      const startForward = new THREE.Vector3(0, 0, -1).applyQuaternion(startQuat).normalize();
      
      if (cameraMode === 'thirdPerson' || cameraMode === 'farChase') {
        const offsetDist = cameraMode === 'thirdPerson' ? 7.5 : 11.0;
        const offsetHeight = cameraMode === 'thirdPerson' ? 2.6 : 4.2;
        const lookDist = cameraMode === 'thirdPerson' ? 4.5 : 6.5;
        
        cameraTargetPos.copy(startForward).multiplyScalar(-offsetDist).add(new THREE.Vector3(0, offsetHeight, 0)).add(carCenter);
        cameraLookAtPos.copy(carCenter).add(startForward.clone().multiplyScalar(lookDist));
        camera.position.copy(cameraTargetPos);
        camera.lookAt(cameraLookAtPos);
      }
      
      return;
    }

    // 1. Auto-Respawn if fallen off elevated grid
    if (translation.y < -10.0) {
      // Smart respawn: find nearest waypoint
      const carPos = new THREE.Vector3(translation.x, translation.y, translation.z);
      let nearestDist = Infinity;
      let nearestPt = new THREE.Vector3(0, 1.2, 0);
      let nearestIdx = 0;
      
      const points = waypointsRef.current;
      for (let i = 0; i < points.length; i++) {
        const wp = points[i];
        const d = carPos.distanceTo(wp);
        if (d < nearestDist) {
          nearestDist = d;
          nearestPt = wp;
          nearestIdx = i;
        }
      }

      rb.setTranslation({ x: nearestPt.x, y: nearestPt.y + 1.5, z: nearestPt.z }, true);
      
      // Face forward along the track direction at that waypoint
      if (points.length >= 2) {
        const nextWp = points[(nearestIdx + 1) % points.length];
        const forward = new THREE.Vector3().subVectors(nextWp, nearestPt).normalize();
        const angle = Math.atan2(forward.x, forward.z);
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        rb.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      } else {
        rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      }
      
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      
      statsRef.current.speed = 0;
      statsRef.current.rpm = 800;
      statsRef.current.isDrifting = false;
      statsRef.current.combo = 0;
      
      updateVehicleStats({
        speed: 0,
        rpm: 800,
        isDrifting: false,
        combo: 0
      });
      return;
    }

    // 2. Convert Rapier quaternion to Three.js Object
    const carQuat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Get directions
    forwardVec.set(0, 0, -1).applyQuaternion(carQuat).normalize();
    rightVec.set(1, 0, 0).applyQuaternion(carQuat).normalize();

    // Get linear velocity and speed in km/h
    const linVel = rb.linvel();
    velocityVec.set(linVel.x, linVel.y, linVel.z);
    
    const rawSpeedKmh = Math.max(0, velocityVec.dot(forwardVec) * 3.6);
    // Smooth the speedometer readout (low-pass filter) to eliminate high frequency frame-to-frame fluctuations
    displaySpeedRef.current = THREE.MathUtils.lerp(displaySpeedRef.current, rawSpeedKmh, 0.12);
    const speedKmh = Math.round(displaySpeedRef.current);
    statsRef.current.speed = speedKmh;

    // Increment race timer
    if (status === 'playing') {
      statsRef.current.raceTime += delta * 1000;
    }

    // ─── Arcade Physics & Controls Redesign ───
    // Steering is the only manual control (either from keys or webcam)
    const kbLeft = debugKeyboard && (keysPressed.current.KeyA || keysPressed.current.ArrowLeft);
    const kbRight = debugKeyboard && (keysPressed.current.KeyD || keysPressed.current.ArrowRight);
    
    let steerInput = steeringAngle * gestureSensitivity;
    if (debugKeyboard && (kbLeft || kbRight)) {
      steerInput = kbLeft ? -1.0 : 1.0;
      useGameStore.getState().updateGestureInput({
        steeringAngle: steerInput,
        handDetected: true,
        handConfidence: 100
      });
    }

    // A. Fuel Consumption
    let currentFuel = fuel;
    if (status === 'playing') {
      currentFuel = Math.max(0, fuel - delta * 2.8); // Drains completely in ~35 seconds
      if (currentFuel <= 0 && speedKmh === 0) {
        setStatus('gameover');
      }
    }

    // B. Detect collisions / crashes via health drop
    if (health < prevHealthRef.current) {
      // Impact crash: reset clean driving timer to zero to drop max cruising speed
      cleanDrivingTimeRef.current = 0;
      prevHealthRef.current = health;
    } else if (status === 'playing' && health > prevHealthRef.current) {
      // Health restored via repair kit
      prevHealthRef.current = health;
    }

    // C. Increment clean driving time
    if (status === 'playing' && currentFuel > 0 && health > 0) {
      cleanDrivingTimeRef.current += delta;
    }

    // D. Dynamic speed target builder
    let targetSpeed = 0;
    if (currentFuel <= 0 || health <= 0) {
      targetSpeed = 0; // Engine cutoff
    } else if (nitroActive) {
      targetSpeed = 320; // Turbo boost pad / Nitro pickup active
    } else {
      // Cruising speed starts at 160 km/h and slowly climbs to 240 km/h top speed
      targetSpeed = 160 + Math.min(80, cleanDrivingTimeRef.current * 10);
    }

    // E. Automated Throttle & Brake force application
    let throttle = 0;
    if (status === 'playing') {
      if (speedKmh < targetSpeed) {
        throttle = 1.2; // Accelerate automatically
      } else if (speedKmh > targetSpeed + 5) {
        throttle = -0.6; // Brake automatically to slow down
      }
    }

    // F. Nitro Boost Cooldown Timer
    if (nitroActive) {
      if (nitroTimerRef.current === 0) {
        nitroTimerRef.current = 5.0; // Boost lasts 5 seconds
      } else {
        nitroTimerRef.current = Math.max(0, nitroTimerRef.current - delta);
        if (nitroTimerRef.current === 0) {
          updateVehicleStats({ nitroActive: false });
        }
      }
    } else {
      nitroTimerRef.current = 0;
    }

    // G. Distance & Score accumulation
    let currentDistance = distance;
    let currentScore = score;
    if (status === 'playing') {
      const speedMps = speedKmh / 3.6;
      currentDistance += speedMps * delta;
      currentScore += speedMps * delta * 5 * scoreMultiplier;
    }

    // Apply forces
    let gripLateral = 0.82;
    if (weather === 'rain') gripLateral = 0.52;
    else if (weather === 'snow') gripLateral = 0.35;
    else if (weather === 'fog') gripLateral = 0.72;

    const dragCoeff = 0.005;
    const accelerationForce = throttle * 22.0; // Boosted arcade acceleration
    const forceVec = forwardVec.clone().multiplyScalar(accelerationForce);

    // Apply drag
    const dragForce = velocityVec.clone().multiplyScalar(-dragCoeff * speedKmh);
    forceVec.add(dragForce);

    // Side friction (stabilizer)
    const lateralSpeed = velocityVec.dot(rightVec);
    const lateralFrictionForce = rightVec.clone().multiplyScalar(-lateralSpeed * gripLateral * 8.0);
    forceVec.add(lateralFrictionForce);

    rb.applyImpulse(forceVec, true);

    // Steering torque
    const steerSpeedScale = Math.max(0.2, 1.0 - speedKmh / 280);
    const steerTorque = -steerInput * 2.2 * steerSpeedScale; // Responsive arcade steering
    rb.applyTorqueImpulse({ x: 0, y: steerTorque, z: 0 }, true);

    // Roll stabilization
    const angVel = rb.angvel();
    rb.setAngvel({ x: angVel.x * 0.9, y: angVel.y, z: angVel.z * 0.8 }, true);

    // Gear & RPM calculations
    let gear = 1;
    if (speedKmh > 220) gear = 6;
    else if (speedKmh > 170) gear = 5;
    else if (speedKmh > 120) gear = 4;
    else if (speedKmh > 80) gear = 3;
    else if (speedKmh > 35) gear = 2;

    const idleRpm = 800;
    const maxRpm = 8500;
    let rpm = idleRpm;
    if (gear === 1) rpm = idleRpm + (speedKmh / 35) * (maxRpm - idleRpm);
    else if (gear === 2) rpm = idleRpm + ((speedKmh - 35) / 45) * (maxRpm - 2000);
    else if (gear === 3) rpm = idleRpm + ((speedKmh - 80) / 40) * (maxRpm - 2500);
    else if (gear === 4) rpm = idleRpm + ((speedKmh - 120) / 50) * (maxRpm - 2500);
    else if (gear === 5) rpm = idleRpm + ((speedKmh - 170) / 50) * (maxRpm - 2500);
    else rpm = idleRpm + ((speedKmh - 220) / 100) * (maxRpm - 2500);
    rpm = Math.min(maxRpm, Math.max(idleRpm, Math.round(rpm)));

    // Record ghost coordinates
    if (status === 'playing') {
      statsRef.current.recordingTimer += delta * 1000;
      if (statsRef.current.recordingTimer >= 100) {
        statsRef.current.recordingTimer = 0;
        recordingBuffer.current.push([translation.x, translation.y, translation.z]);
      }
    }

    // Dynamic Finish Line crossing
    const carPos3D = new THREE.Vector3(translation.x, translation.y, translation.z);
    const fz = finishZoneRef.current;
    const distToFinish = carPos3D.distanceTo(fz.center);
    if (distToFinish < fz.radius) {
      const timeSinceLastCross = statsRef.current.raceTime - statsRef.current.lastFinishCross;
      if (timeSinceLastCross > 15000) {
        statsRef.current.lastFinishCross = statsRef.current.raceTime;
        if (lap >= totalLaps) {
          saveGhostReplay(recordingBuffer.current);
          addCoins(500);
          addXp(350);
          setStatus('gameover');
        } else {
          updateVehicleStats({ lap: lap + 1 });
        }
      }
    }

    // Update state store
    updateVehicleStats({
      speed: speedKmh,
      rpm: rpm,
      gear: gear,
      nitroLevel: nitroActive ? Math.round(nitroTimerRef.current * 20) : 100, // Show boost timer on HUD nitro gauge
      nitroActive: nitroActive,
      isDrifting: false,
      driftTime: 0,
      combo: 0,
      raceTime: Math.round(statsRef.current.raceTime),
      playerPosition: [translation.x, translation.z],
      fuel: Math.round(currentFuel),
      distance: Math.round(currentDistance),
      score: Math.round(currentScore)
    });

    // Ghost Replay interpolation
    if (ghostReplayData && ghostReplayData.length > 0) {
      const idx = Math.floor(statsRef.current.raceTime / 100);
      if (idx < ghostReplayData.length) {
        const pt = ghostReplayData[idx];
        setGhostPos(new THREE.Vector3(pt[0], pt[1], pt[2]));
      } else {
        setGhostPos(null);
      }
    }

    // ─── Dynamic FOV & Camera Shake Visual Effects ───
    const pCamera = camera as THREE.PerspectiveCamera;
    if (pCamera.isPerspectiveCamera) {
      const targetFov = nitroActive ? 82 : 60;
      pCamera.fov = THREE.MathUtils.lerp(pCamera.fov, targetFov, 0.08);
      pCamera.updateProjectionMatrix();
    }

    // ─── Camera Modes Tracking ───
    const carCenter = new THREE.Vector3(translation.x, translation.y + 0.6, translation.z);

    if (cameraMode === 'thirdPerson' || cameraMode === 'farChase') {
      const offsetDist = cameraMode === 'thirdPerson' ? 7.5 : 11.0;
      const offsetHeight = cameraMode === 'thirdPerson' ? 2.6 : 4.2;
      const lookDist = cameraMode === 'thirdPerson' ? 4.5 : 6.5;
      const lerpFactor = cameraMode === 'thirdPerson' ? 0.12 : 0.07;
      
      cameraTargetPos.copy(forwardVec).multiplyScalar(-offsetDist).add(new THREE.Vector3(0, offsetHeight, 0)).add(carCenter);
      cameraLookAtPos.copy(carCenter).add(forwardVec.clone().multiplyScalar(lookDist));
      
      // Raycast from carCenter to cameraTargetPos to resolve collisions
      const rayDir = cameraTargetPos.clone().sub(carCenter).normalize();
      const maxDistance = cameraTargetPos.distanceTo(carCenter);
      
      const ray = new rapier.Ray(
        { x: carCenter.x, y: carCenter.y, z: carCenter.z },
        { x: rayDir.x, y: rayDir.y, z: rayDir.z }
      );
      
      const hit = world.castRay(
        ray,
        maxDistance,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        (collider: any) => {
          const name = collider.parent()?.userData?.name || '';
          return !name.includes('player_car') && !name.includes('ai_');
        }
      );
      
      if (hit) {
        // Enforce safe distance cushion (1.8m minimum behind)
        const safeDist = Math.max(1.8, hit.timeOfImpact - 0.5);
        const safeTargetPos = carCenter.clone().add(rayDir.clone().multiplyScalar(safeDist));
        
        // If current camera is further away than safe position, pull it in instantly to avoid clipping
        const currentDist = camera.position.distanceTo(carCenter);
        if (currentDist > safeDist) {
          camera.position.copy(safeTargetPos);
        } else {
          camera.position.lerp(safeTargetPos, 0.25);
        }
      } else {
        // No obstacle: smooth lerp to target
        camera.position.lerp(cameraTargetPos, lerpFactor);
      }
      
      // Screen shake offset during Nitro hyper boost
      if (nitroActive) {
        const intensity = cameraMode === 'thirdPerson' ? 0.12 : 0.16;
        camera.position.x += (Math.random() - 0.5) * intensity;
        camera.position.y += (Math.random() - 0.5) * intensity;
      }
      
      camera.lookAt(cameraLookAtPos);
      
    } else if (cameraMode === 'cockpit') {
      // 3. COCKPIT CAMERA
      cameraTargetPos.copy(forwardVec).multiplyScalar(0.25).add(new THREE.Vector3(0, 0.22, 0)).add(carCenter);
      cameraLookAtPos.copy(forwardVec).multiplyScalar(20.0).add(cameraTargetPos);
      
      camera.position.lerp(cameraTargetPos, 0.45);
      
      if (nitroActive) {
        camera.position.x += (Math.random() - 0.5) * 0.05;
        camera.position.y += (Math.random() - 0.5) * 0.05;
      }
      
      camera.lookAt(cameraLookAtPos);
      
    } else if (cameraMode === 'hood') {
      // 4. HOOD CAMERA
      cameraTargetPos.copy(forwardVec).multiplyScalar(1.6).add(new THREE.Vector3(0, 0.08, 0)).add(carCenter);
      cameraLookAtPos.copy(forwardVec).multiplyScalar(25.0).add(cameraTargetPos);
      
      camera.position.copy(cameraTargetPos);
      
      if (nitroActive) {
        camera.position.x += (Math.random() - 0.5) * 0.05;
        camera.position.y += (Math.random() - 0.5) * 0.05;
      }
      
      camera.lookAt(cameraLookAtPos);
      
    } else if (cameraMode === 'orbit') {
      // 5. ORBIT CAMERA (Showroom / Idle spin)
      const angle = state.clock.elapsedTime * 0.25;
      const radius = 8.5;
      const height = 2.2;
      
      cameraTargetPos.set(
        carCenter.x + Math.sin(angle) * radius,
        carCenter.y + height,
        carCenter.z + Math.cos(angle) * radius
      );
      
      camera.position.lerp(cameraTargetPos, 0.08);
      camera.lookAt(carCenter);
      
    } else if (cameraMode === 'replay') {
      // 6. CINEMATIC TV REPLAY TRACKSIDE CAMERA
      const points = waypointsRef.current;
      if (points.length >= 10) {
        // Find nearest waypoint to player
        let nearestWpIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < points.length; i++) {
          const d = carCenter.distanceTo(points[i]);
          if (d < minDist) {
            minDist = d;
            nearestWpIdx = i;
          }
        }
        
        const currentCamPos = replayCameraPosRef.current;
        const distToCam = carCenter.distanceTo(currentCamPos);
        const timeNow = state.clock.elapsedTime;
        
        // Switch camera positions based on timing or distance
        if (timeNow - lastCameraSwitchRef.current > 4.5 || distToCam > 80.0 || distToCam < 6.0 || currentCamPos.lengthSq() === 0) {
          const targetWpIdx = (nearestWpIdx + 14) % points.length;
          const side = (targetWpIdx % 2 === 0) ? 1.0 : -1.0;
          
          replayCameraPosRef.current.set(
            points[targetWpIdx].x + 13 * side,
            points[targetWpIdx].y + 6.0,
            points[targetWpIdx].z + 13 * side
          );
          
          lastCameraSwitchRef.current = timeNow;
        }
        
        camera.position.lerp(replayCameraPosRef.current, 0.09);
        camera.lookAt(carCenter);
      } else {
        // Fallback to thirdPerson if waypoints not loaded
        cameraTargetPos.copy(forwardVec).multiplyScalar(-7.2).add(new THREE.Vector3(0, 2.6, 0)).add(carCenter);
        camera.position.lerp(cameraTargetPos, 0.12);
        camera.lookAt(carCenter);
      }
    }

    // ─── Speed boost wind lines particle animation ───
    if (speedLinesRef.current && nitroActive && status === 'playing') {
      speedLinesRef.current.children.forEach((line) => {
        line.position.z += 0.8; // Move past the car at warp speed
        if (line.position.z > 5.0) {
          line.position.z = -15.0 - Math.random() * 10.0; // Respawn far ahead
          line.position.x = (Math.random() - 0.5) * 4.5;
          line.position.y = (Math.random() - 0.5) * 2.0 + 0.4;
        }
      });
    }
  });

  return (
    <group>
      {/* Active Player Vehicle */}
      <RigidBody
        ref={rbRef}
        colliders={false}
        position={startTransform.position}
        rotation={startTransform.rotation}
        angularDamping={1.6}
        linearDamping={0.12}
        onCollisionEnter={handleCollision}
        name="player_car"
      >
        <CuboidCollider args={[0.9, 0.35, 2.1]} position={[0, -0.02, 0]} restitution={0.05} friction={0.3} />
        <group ref={chassisRef}>
          {/* Chassis */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.8, 0.7, 4.2]} />
            <meshStandardMaterial color={paintColor} roughness={0.1} metalness={0.8} />
          </mesh>
          
          {/* Windshield */}
          <mesh position={[0, 0.45, -0.4]} rotation={[-0.4, 0, 0]}>
            <boxGeometry args={[1.6, 0.4, 1.2]} />
            <meshStandardMaterial color="#111" transparent opacity={0.6} roughness={0.0} />
          </mesh>

          {/* Lights */}
          <mesh position={[-0.7, -0.1, -2.1]}>
            <boxGeometry args={[0.2, 0.1, 0.1]} />
            <meshBasicMaterial color="#00ffff" />
          </mesh>
          <mesh position={[0.7, -0.1, -2.1]}>
            <boxGeometry args={[0.2, 0.1, 0.1]} />
            <meshBasicMaterial color="#00ffff" />
          </mesh>

          {/* Taillights */}
          <mesh position={[-0.7, 0.1, 2.11]}>
            <boxGeometry args={[0.3, 0.08, 0.05]} />
            <meshBasicMaterial color={currentGesture === 'brake' ? '#ff0000' : '#880000'} />
          </mesh>
          <mesh position={[0.7, 0.1, 2.11]}>
            <boxGeometry args={[0.3, 0.08, 0.05]} />
            <meshBasicMaterial color={currentGesture === 'brake' ? '#ff0000' : '#880000'} />
          </mesh>

          {/* Spoiler */}
          <group position={[0, 0.6, 1.8]}>
            <mesh castShadow>
              <boxGeometry args={[1.9, 0.08, 0.5]} />
              <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[-0.7, -0.25, 0]}>
              <boxGeometry args={[0.08, 0.5, 0.1]} />
              <meshStandardMaterial color="#111111" />
            </mesh>
            <mesh position={[0.7, -0.25, 0]}>
              <boxGeometry args={[0.08, 0.5, 0.1]} />
              <meshStandardMaterial color="#111111" />
            </mesh>
          </group>

          {/* Speed boost wind lines particle group */}
          <group ref={speedLinesRef}>
            {Array.from({ length: 12 }).map((_, idx) => (
              <mesh key={idx} position={[
                (Math.random() - 0.5) * 4.5,
                (Math.random() - 0.5) * 2.0 + 0.4,
                -Math.random() * 18.0
              ]}>
                <boxGeometry args={[0.02, 0.02, 2.2]} />
                <meshBasicMaterial color="#00CFFF" transparent opacity={0.6} />
              </mesh>
            ))}
          </group>

          {/* Neon Underglow light */}
          <pointLight
            position={[0, -0.4, 0]}
            color={underglowColor}
            intensity={12.0}
            distance={4.0}
            decay={1.8}
          />

          {/* Wheels */}
          <mesh position={[-0.95, -0.3, -1.3]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.42, 0.42, 0.35, 16]} />
            <meshStandardMaterial color="#111" roughness={0.9} />
          </mesh>
          <mesh position={[0.95, -0.3, -1.3]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.42, 0.42, 0.35, 16]} />
            <meshStandardMaterial color="#111" roughness={0.9} />
          </mesh>
          <mesh position={[-0.95, -0.3, 1.3]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.42, 0.42, 0.35, 16]} />
            <meshStandardMaterial color="#111" roughness={0.9} />
          </mesh>
          <mesh position={[0.95, -0.3, 1.3]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.42, 0.42, 0.35, 16]} />
            <meshStandardMaterial color="#111" roughness={0.9} />
          </mesh>
        </group>
      </RigidBody>

      {/* Holographic Ghost Replay Car */}
      {ghostPos && (
        <mesh position={ghostPos}>
          <boxGeometry args={[1.78, 0.68, 4.18]} />
          <meshStandardMaterial
            color="#00f0ff"
            transparent
            opacity={0.35}
            roughness={0.0}
            metalness={1.0}
            emissive="#00ffff"
            emissiveIntensity={1.0}
          />
        </mesh>
      )}
    </group>
  );
}
