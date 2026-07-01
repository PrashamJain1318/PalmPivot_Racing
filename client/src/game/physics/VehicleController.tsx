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

  // Visual Wheel Refs
  const frontLeftWheelRef = useRef<THREE.Group>(null);
  const frontRightWheelRef = useRef<THREE.Group>(null);
  const rearLeftWheelRef = useRef<THREE.Group>(null);
  const rearRightWheelRef = useRef<THREE.Group>(null);

  const { camera } = useThree();
  const { rapier, world } = useRapier();

  // TV Replay camera tracking refs
  const lastCameraSwitchRef = useRef(0);
  const replayCameraPosRef = useRef(new THREE.Vector3());
  
  // Custom refs for smoothing steering and wheel roll
  const steerAngleRef = useRef(0);
  const wheelRollRef = useRef(0);
  const headlightLeftTargetRef = useRef<THREE.Object3D>(null);
  const headlightRightTargetRef = useRef<THREE.Object3D>(null);
  const displaySpeedRef = useRef(0);
  const stuckTimeRef = useRef(0);
  const flippedTimeRef = useRef(0);

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
    nitroActive,
    photoModeActive
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
    } catch (e) {}
  };

  // Helper trigger to reset player to the last valid checkpoint (closest waypoint)
  const triggerCheckpointRecovery = () => {
    if (!rbRef.current) return;
    const rb = rbRef.current;
    const translation = rb.translation();
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

    rb.setTranslation({ x: nearestPt.x, y: nearestPt.y + 0.75, z: nearestPt.z }, true);
    
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
    
    stuckTimeRef.current = 0;
    flippedTimeRef.current = 0;
    steerAngleRef.current = 0;

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
  };

  useFrame((state, delta) => {
    if (!rbRef.current || !chassisRef.current) return;

    const rb = rbRef.current;
    const translation = rb.translation();
    const rotation = rb.rotation();
    const carQuat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);

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

    // 1. Auto-Respawn if fallen below map boundaries
    if (translation.y < -10.0) {
      triggerCheckpointRecovery();
      return;
    }

    // 2. Read Euler rotations for Roll & Pitch stabilization (prevent flips)
    const euler = new THREE.Euler().setFromQuaternion(carQuat, 'YXZ');
    const angVel = rb.angvel();

    // Stuck check: If car speed is near zero during race play, start stuck recovery timer
    const linVel = rb.linvel();
    velocityVec.set(linVel.x, linVel.y, linVel.z);
    forwardVec.set(0, 0, -1).applyQuaternion(carQuat).normalize();
    rightVec.set(1, 0, 0).applyQuaternion(carQuat).normalize();
    const rawSpeedKmh = Math.max(0, velocityVec.dot(forwardVec) * 3.6);
    
    if (rawSpeedKmh < 4) {
      stuckTimeRef.current += delta;
      if (stuckTimeRef.current > 3.0) {
        triggerCheckpointRecovery();
        return;
      }
    } else {
      stuckTimeRef.current = 0;
    }

    // Flipped check: if rollover tilt > 55 degrees, increment flipped timer
    const isFlipped = Math.abs(euler.z) > 1.0 || Math.abs(euler.x) > 1.0;
    if (isFlipped) {
      flippedTimeRef.current += delta;
      if (flippedTimeRef.current > 1.5) {
        triggerCheckpointRecovery();
        return;
      }
    } else {
      flippedTimeRef.current = 0;
    }

    // Active Roll & Pitch Stabilizer (arcade spring torques)
    const pitchCorrection = -euler.x * 24.0;
    const rollCorrection = -euler.z * 24.0;

    rb.setAngvel({
      x: THREE.MathUtils.lerp(angVel.x, pitchCorrection, 0.15),
      y: angVel.y,
      z: THREE.MathUtils.lerp(angVel.z, rollCorrection, 0.15)
    }, true);

    // 3. Speedometer velocity calculations
    displaySpeedRef.current = THREE.MathUtils.lerp(displaySpeedRef.current, rawSpeedKmh, 0.08);
    const speedKmh = Math.round(displaySpeedRef.current);
    statsRef.current.speed = speedKmh;

    // Increment race timer
    if (status === 'playing') {
      statsRef.current.raceTime += delta * 1000;
    }

    // 4. Progressive speed-sensitive steering
    const kbLeft = debugKeyboard && (keysPressed.current.KeyA || keysPressed.current.ArrowLeft);
    const kbRight = debugKeyboard && (keysPressed.current.KeyD || keysPressed.current.ArrowRight);
    
    let steerInput = steeringAngle;
    if (debugKeyboard && (kbLeft || kbRight)) {
      steerInput = kbLeft ? -1.0 : 1.0;
      useGameStore.getState().updateGestureInput({
        steeringAngle: steerInput,
        handDetected: true,
        handConfidence: 100
      });
    }

    // High speed lock reduction: decrease maximum steer angle at higher speeds to improve stability
    const maxSteerLimit = 0.52 * Math.max(0.25, 1.0 - speedKmh / 280);
    const targetSteerAngle = steerInput * maxSteerLimit;

    // Smooth Progressive steer response (returns to neutral smoothly when hands return to center)
    steerAngleRef.current = THREE.MathUtils.lerp(steerAngleRef.current, targetSteerAngle, 0.14);

    // 5. Fuel Drain logic
    let currentFuel = fuel;
    if (status === 'playing') {
      currentFuel = Math.max(0, fuel - delta * 2.8);
      if (currentFuel <= 0 && speedKmh === 0) {
        setStatus('gameover');
      }
    }

    // Detect collisions / resets via health drops
    if (health < prevHealthRef.current) {
      cleanDrivingTimeRef.current = 0;
      prevHealthRef.current = health;
    } else if (status === 'playing' && health > prevHealthRef.current) {
      prevHealthRef.current = health;
    }

    if (status === 'playing' && currentFuel > 0 && health > 0) {
      cleanDrivingTimeRef.current += delta;
    }

    // Cruising speeds target
    let targetSpeed = 0;
    if (currentFuel <= 0 || health <= 0) {
      targetSpeed = 0;
    } else if (nitroActive) {
      targetSpeed = 320;
    } else {
      targetSpeed = 160 + Math.min(80, cleanDrivingTimeRef.current * 10);
    }

    // Automatic acceleration and braking values
    let throttle = 0;
    if (status === 'playing') {
      if (speedKmh < targetSpeed) {
        throttle = 1.2;
      } else if (speedKmh > targetSpeed + 5) {
        throttle = -0.6;
      }
    }

    if (nitroActive) {
      if (nitroTimerRef.current === 0) {
        nitroTimerRef.current = 5.0;
      } else {
        nitroTimerRef.current = Math.max(0, nitroTimerRef.current - delta);
        if (nitroTimerRef.current === 0) {
          updateVehicleStats({ nitroActive: false });
        }
      }
    } else {
      nitroTimerRef.current = 0;
    }

    // Distance and score metrics
    let currentDistance = distance;
    let currentScore = score;
    if (status === 'playing') {
      const speedMps = speedKmh / 3.6;
      currentDistance += speedMps * delta;
      currentScore += speedMps * delta * 5 * scoreMultiplier;
    }

    // Apply linear forces
    let gripLateral = 0.88;
    if (weather === 'rain') gripLateral = 0.58;
    else if (weather === 'snow') gripLateral = 0.38;
    else if (weather === 'fog') gripLateral = 0.78;

    const dragCoeff = 0.005;
    const accelerationForce = throttle * 22.0;
    const forceVec = forwardVec.clone().multiplyScalar(accelerationForce);

    // Apply drag
    const dragForce = velocityVec.clone().multiplyScalar(-dragCoeff * speedKmh);
    forceVec.add(dragForce);

    // Side friction (suppress lateral sliding entirely for stable arcade handling)
    const lateralSpeed = velocityVec.dot(rightVec);
    const lateralFrictionForce = rightVec.clone().multiplyScalar(-lateralSpeed * gripLateral * 12.0);
    forceVec.add(lateralFrictionForce);

    rb.applyImpulse(forceVec, true);

    // Steering torque (progressive and stabilized)
    const steerTorque = -steerAngleRef.current * 5.2;
    rb.applyTorqueImpulse({ x: 0, y: steerTorque, z: 0 }, true);

    // Dynamic Gear and RPM
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

    // Finish Line crossed logic
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
      nitroLevel: nitroActive ? Math.round(nitroTimerRef.current * 20) : 100,
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

    // Ghost Replay coordinates interpolation
    if (ghostReplayData && ghostReplayData.length > 0) {
      const idx = Math.floor(statsRef.current.raceTime / 100);
      if (idx < ghostReplayData.length) {
        const pt = ghostReplayData[idx];
        setGhostPos(new THREE.Vector3(pt[0], pt[1], pt[2]));
      } else {
        setGhostPos(null);
      }
    }

    // 6. Visual front wheels steering & roll rotations
    wheelRollRef.current += (speedKmh / 3.6) * delta * 2.5;

    if (frontLeftWheelRef.current) {
      frontLeftWheelRef.current.rotation.y = steerAngleRef.current * 0.6;
      frontLeftWheelRef.current.children[0].rotation.x = wheelRollRef.current;
    }
    if (frontRightWheelRef.current) {
      frontRightWheelRef.current.rotation.y = steerAngleRef.current * 0.6;
      frontRightWheelRef.current.children[0].rotation.x = wheelRollRef.current;
    }
    if (rearLeftWheelRef.current) {
      rearLeftWheelRef.current.children[0].rotation.x = wheelRollRef.current;
    }
    if (rearRightWheelRef.current) {
      rearRightWheelRef.current.children[0].rotation.x = wheelRollRef.current;
    }

    // 7. Rebuild Dynamic Chase Follow Camera
    const pCamera = camera as THREE.PerspectiveCamera;
    if (pCamera.isPerspectiveCamera) {
      const targetFov = nitroActive ? 82 : 68;
      pCamera.fov = THREE.MathUtils.lerp(pCamera.fov, targetFov, 0.08);
      pCamera.updateProjectionMatrix();
    }

    const carCenter = new THREE.Vector3(translation.x, translation.y + 0.6, translation.z);

    // ─── PHOTO MODE AUTOMATIC ORBIT CAMERA ───
    if (photoModeActive) {
      const orbitAngle = state.clock.elapsedTime * 0.15;
      const orbitRadius = 7.2;
      const orbitHeight = 1.8;
      
      cameraTargetPos.set(
        carCenter.x + Math.sin(orbitAngle) * orbitRadius,
        carCenter.y + orbitHeight,
        carCenter.z + Math.cos(orbitAngle) * orbitRadius
      );
      
      camera.position.lerp(cameraTargetPos, 0.08);
      camera.lookAt(carCenter);
      return;
    }

    if (cameraMode === 'thirdPerson' || cameraMode === 'farChase') {
      const offsetDist = cameraMode === 'thirdPerson' ? 7.6 : 11.2;
      const offsetHeight = cameraMode === 'thirdPerson' ? 2.8 : 4.4;
      const lookDist = cameraMode === 'thirdPerson' ? 4.8 : 6.8;
      const lerpFactor = cameraMode === 'thirdPerson' ? 0.12 : 0.08;

      // Camera drift lag swing: base target position on current velocity direction rather than static heading
      let cameraHeading = forwardVec.clone();
      if (speedKmh > 12) {
        const horizontalVelocity = velocityVec.clone();
        horizontalVelocity.y = 0;
        if (horizontalVelocity.lengthSq() > 1.0) {
          cameraHeading.copy(horizontalVelocity.normalize());
        }
      }

      cameraTargetPos.copy(cameraHeading).multiplyScalar(-offsetDist).add(new THREE.Vector3(0, offsetHeight, 0)).add(carCenter);
      cameraLookAtPos.copy(carCenter).add(cameraHeading.clone().multiplyScalar(lookDist));

      // Prevent camera from going below car floor level or ground level
      cameraTargetPos.y = Math.max(carCenter.y + 0.6, cameraTargetPos.y);

      // Raycast from carCenter to cameraTargetPos to resolve collision blocks
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
        const safeDist = Math.max(1.8, hit.timeOfImpact - 0.5);
        const safeTargetPos = carCenter.clone().add(rayDir.clone().multiplyScalar(safeDist));
        
        const currentDist = camera.position.distanceTo(carCenter);
        if (currentDist > safeDist) {
          camera.position.copy(safeTargetPos);
        } else {
          camera.position.lerp(safeTargetPos, 0.25);
        }
      } else {
        camera.position.lerp(cameraTargetPos, lerpFactor);
      }

      // Camera vibration shake during nitro boost
      if (nitroActive) {
        const intensity = cameraMode === 'thirdPerson' ? 0.12 : 0.16;
        camera.position.x += (Math.random() - 0.5) * intensity;
        camera.position.y += (Math.random() - 0.5) * intensity;
      }

      camera.lookAt(cameraLookAtPos);

    } else if (cameraMode === 'cockpit') {
      cameraTargetPos.copy(forwardVec).multiplyScalar(0.25).add(new THREE.Vector3(0, 0.22, 0)).add(carCenter);
      cameraLookAtPos.copy(forwardVec).multiplyScalar(20.0).add(cameraTargetPos);
      
      camera.position.lerp(cameraTargetPos, 0.45);
      
      if (nitroActive) {
        camera.position.x += (Math.random() - 0.5) * 0.05;
        camera.position.y += (Math.random() - 0.5) * 0.05;
      }
      camera.lookAt(cameraLookAtPos);

    } else if (cameraMode === 'hood') {
      cameraTargetPos.copy(forwardVec).multiplyScalar(1.6).add(new THREE.Vector3(0, 0.08, 0)).add(carCenter);
      cameraLookAtPos.copy(forwardVec).multiplyScalar(25.0).add(cameraTargetPos);
      
      camera.position.copy(cameraTargetPos);
      
      if (nitroActive) {
        camera.position.x += (Math.random() - 0.5) * 0.05;
        camera.position.y += (Math.random() - 0.5) * 0.05;
      }
      camera.lookAt(cameraLookAtPos);

    } else if (cameraMode === 'orbit') {
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
      const points = waypointsRef.current;
      if (points.length >= 10) {
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
        cameraTargetPos.copy(forwardVec).multiplyScalar(-7.2).add(new THREE.Vector3(0, 2.6, 0)).add(carCenter);
        camera.position.lerp(cameraTargetPos, 0.12);
        camera.lookAt(carCenter);
      }
    }

    if (speedLinesRef.current && nitroActive && status === 'playing') {
      speedLinesRef.current.children.forEach((line) => {
        line.position.z += 0.8;
        if (line.position.z > 5.0) {
          line.position.z = -15.0 - Math.random() * 10.0;
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
        angularDamping={2.0} // High damping for arcade stability
        linearDamping={0.4}   // High damping for chassis stiffness
        onCollisionEnter={handleCollision}
        name="player_car"
      >
        <CuboidCollider args={[0.9, 0.35, 2.1]} position={[0, -0.02, 0]} restitution={0.05} friction={0.3} />
        
        <group ref={chassisRef}>
          {/* Headlight targets for spotlight beams */}
          <object3D ref={headlightLeftTargetRef} position={[-0.75, 0.1, -10]} />
          <object3D ref={headlightRightTargetRef} position={[0.75, 0.1, -10]} />

          {/* Active Headlights (illuminate road at night, fog or storm) */}
          {(weather === 'night' || weather === 'fog' || weather === 'storm' || (currentTrack && currentTrack.toLowerCase().includes('night'))) && (
            <>
              <spotLight
                position={[-0.75, 0.1, -2.1]}
                target={headlightLeftTargetRef.current || undefined}
                angle={0.38}
                penumbra={0.6}
                intensity={18.0}
                distance={35.0}
                color="#fffdf2"
                castShadow
              />
              <spotLight
                position={[0.75, 0.1, -2.1]}
                target={headlightRightTargetRef.current || undefined}
                angle={0.38}
                penumbra={0.6}
                intensity={18.0}
                distance={35.0}
                color="#fffdf2"
                castShadow
              />
            </>
          )}

          {/* Chassis PBR metallic paint */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.8, 0.7, 4.2]} />
            <meshStandardMaterial color={paintColor} roughness={0.08} metalness={0.92} envMapIntensity={1.8} />
          </mesh>
          
          {/* Windshield */}
          <mesh position={[0, 0.45, -0.4]} rotation={[-0.4, 0, 0]}>
            <boxGeometry args={[1.6, 0.4, 1.2]} />
            <meshStandardMaterial color="#111" transparent opacity={0.7} roughness={0.0} metalness={1.0} />
          </mesh>

          {/* Lights */}
          <mesh position={[-0.7, -0.1, -2.1]}>
            <boxGeometry args={[0.2, 0.1, 0.1]} />
            <meshBasicMaterial color="#e0f7fa" />
          </mesh>
          <mesh position={[0.7, -0.1, -2.1]}>
            <boxGeometry args={[0.2, 0.1, 0.1]} />
            <meshBasicMaterial color="#e0f7fa" />
          </mesh>

          {/* Taillights */}
          <mesh position={[-0.7, 0.1, 2.11]}>
            <boxGeometry args={[0.3, 0.08, 0.05]} />
            <meshBasicMaterial color={currentGesture === 'brake' ? '#ff1111' : '#660000'} />
          </mesh>
          <mesh position={[0.7, 0.1, 2.11]}>
            <boxGeometry args={[0.3, 0.08, 0.05]} />
            <meshBasicMaterial color={currentGesture === 'brake' ? '#ff1111' : '#660000'} />
          </mesh>

          {/* Active red glow on braking */}
          {currentGesture === 'brake' && (
            <pointLight position={[0, 0.1, 2.3]} color="#ff0000" intensity={6.0} distance={5.0} />
          )}

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

          {/* Nitro exhaust flames & pointLight glow */}
          {nitroActive && (
            <>
              <mesh position={[-0.4, -0.3, 2.18]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.15, 0.9, 8]} />
                <meshBasicMaterial color="#00d4ff" transparent opacity={0.8} />
              </mesh>
              <mesh position={[0.4, -0.3, 2.18]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.15, 0.9, 8]} />
                <meshBasicMaterial color="#00d4ff" transparent opacity={0.8} />
              </mesh>
              <pointLight position={[0, -0.3, 2.3]} color="#00d4ff" intensity={8.0} distance={5.0} />
            </>
          )}

          {/* Neon Underglow light */}
          <pointLight
            position={[0, -0.4, 0]}
            color={underglowColor}
            intensity={12.0}
            distance={4.0}
            decay={1.8}
          />

          {/* Front Left Wheel */}
          <group position={[-0.95, -0.3, -1.3]} ref={frontLeftWheelRef}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.42, 0.42, 0.35, 16]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.15} />
            </mesh>
            {/* Shiny alloy center rim */}
            <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.05, 0, 0]}>
              <cylinderGeometry args={[0.26, 0.26, 0.36, 12]} />
              <meshStandardMaterial color="#d1d5db" roughness={0.1} metalness={0.9} />
            </mesh>
          </group>

          {/* Front Right Wheel */}
          <group position={[0.95, -0.3, -1.3]} ref={frontRightWheelRef}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.42, 0.42, 0.35, 16]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.15} />
            </mesh>
            {/* Shiny alloy center rim */}
            <mesh rotation={[0, 0, Math.PI / 2]} position={[0.05, 0, 0]}>
              <cylinderGeometry args={[0.26, 0.26, 0.36, 12]} />
              <meshStandardMaterial color="#d1d5db" roughness={0.1} metalness={0.9} />
            </mesh>
          </group>

          {/* Rear Left Wheel */}
          <group position={[-0.95, -0.3, 1.3]} ref={rearLeftWheelRef}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.42, 0.42, 0.35, 16]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.15} />
            </mesh>
            {/* Shiny alloy center rim */}
            <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.05, 0, 0]}>
              <cylinderGeometry args={[0.26, 0.26, 0.36, 12]} />
              <meshStandardMaterial color="#d1d5db" roughness={0.1} metalness={0.9} />
            </mesh>
          </group>

          {/* Rear Right Wheel */}
          <group position={[0.95, -0.3, 1.3]} ref={rearRightWheelRef}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.42, 0.42, 0.35, 16]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.15} />
            </mesh>
            {/* Shiny alloy center rim */}
            <mesh rotation={[0, 0, Math.PI / 2]} position={[0.05, 0, 0]}>
              <cylinderGeometry args={[0.26, 0.26, 0.36, 12]} />
              <meshStandardMaterial color="#d1d5db" roughness={0.1} metalness={0.9} />
            </mesh>
          </group>
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
