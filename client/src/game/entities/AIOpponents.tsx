'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { getProceduralTrackPoints } from '@/utils/trackGenerator';

interface AICarConfig {
  id: string;
  name: string;
  color: string;
  glow: string;
  speedMultiplier: number;
  offset: number; // side offset to avoid stacking
}

const AI_CONFIGS: AICarConfig[] = [
  { id: 'ai_1', name: 'Cyber Phantom', color: '#eab308', glow: '#ffd700', speedMultiplier: 0.95, offset: -2.0 },
  { id: 'ai_2', name: 'Grid Hunter', color: '#a855f7', glow: '#c084fc', speedMultiplier: 1.05, offset: 2.0 },
  { id: 'ai_3', name: 'Apex Predator', color: '#22c55e', glow: '#4ade80', speedMultiplier: 1.12, offset: 0.0 }
];

export default function AIOpponents() {
  const gameStatus = useGameStore((s) => s.status);
  const currentTrackId = useGameStore((s) => s.currentTrack) || 'track_1';
  
  // Track waypoint mechanics inside an array of refs
  const aiRefs = useRef<Array<RapierRigidBody | null>>([]);
  const waypointsIndices = useRef<number[]>([0, 0, 0]);

  // Compute waypoints dynamically based on the current track ID
  const waypoints = useMemo(() => {
    const points = getProceduralTrackPoints(currentTrackId);
    return points.map(p => new THREE.Vector3(p.x, p.y + 0.65, p.z));
  }, [currentTrackId]);

  // Calculate dynamic starting grid positions
  const startingPositions = useMemo(() => {
    if (waypoints.length < 2) {
      return AI_CONFIGS.map((config, idx) => ({
        pos: [config.offset, 0.65, -15 - idx * 10] as [number, number, number],
        rot: [0, 0, 0] as [number, number, number]
      }));
    }
    
    const p0 = waypoints[0];
    const p1 = waypoints[1];
    
    // Direction of travel on start straight
    const forward = new THREE.Vector3().subVectors(p1, p0).normalize();
    // Perpendicular right vector
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    
    return AI_CONFIGS.map((config, idx) => {
      // Spawn behind player (who starts at p0)
      const spawnPos = p0.clone()
        .add(forward.clone().multiplyScalar(-15 - idx * 12))
        .add(right.clone().multiplyScalar(config.offset));
      
      // Face forward along start straight
      const angle = Math.atan2(forward.x, forward.z);
      
      return {
        pos: [spawnPos.x, spawnPos.y + 0.65, spawnPos.z] as [number, number, number],
        rot: [0, angle, 0] as [number, number, number]
      };
    });
  }, [waypoints]);

  // Pre-instantiated vectors to optimize GC
  const targetDir = new THREE.Vector3();
  const currentPos = new THREE.Vector3();

  useFrame((state, delta) => {
    // Only run AI driving when game is playing and waypoints are populated
    if (gameStatus !== 'playing' || waypoints.length === 0) return;

    AI_CONFIGS.forEach((config, idx) => {
      const rb = aiRefs.current[idx];
      if (!rb) return;

      const translation = rb.translation();
      currentPos.set(translation.x, translation.y, translation.z);

      // 1. Get current waypoint target
      let wpIdx = waypointsIndices.current[idx];
      if (wpIdx >= waypoints.length) {
        wpIdx = 0;
        waypointsIndices.current[idx] = 0;
      }
      
      let targetWp = waypoints[wpIdx].clone();
      
      // Add lateral lane offset so AI doesn't bunch up
      // Perpendicular offset along the track direction
      if (wpIdx > 0 && wpIdx < waypoints.length) {
        const prev = waypoints[wpIdx - 1];
        const dir = new THREE.Vector3().subVectors(targetWp, prev).normalize();
        const right = new THREE.Vector3(-dir.z, 0, dir.x);
        targetWp.add(right.multiplyScalar(config.offset));
      }

      // 2. Check if reached waypoint
      const distToTarget = currentPos.distanceTo(targetWp);
      if (distToTarget < 20.0) {
        wpIdx = (wpIdx + 1) % waypoints.length;
        waypointsIndices.current[idx] = wpIdx;
      }

      // 3. Move kinematic body toward target
      targetDir.subVectors(targetWp, currentPos).normalize();
      
      // Calculate rotation quaternion to face target
      const angle = Math.atan2(targetDir.x, targetDir.z);
      const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);

      // Speed configuration: rubber banding based on player speed
      const baseSpeed = 24 * config.speedMultiplier; 
      
      const newPos = currentPos.clone().add(targetDir.multiplyScalar(baseSpeed * delta));
      
      // Apply position updates to Rapier rigid body
      rb.setNextKinematicTranslation(newPos);
      rb.setNextKinematicRotation(targetQuat);
    });
  });

  return (
    <group>
      {AI_CONFIGS.map((config, idx) => (
        <RigidBody
          key={config.id}
          ref={(el) => { aiRefs.current[idx] = el; }}
          type="kinematicPosition"
          colliders="cuboid"
          position={startingPositions[idx].pos}
          rotation={startingPositions[idx].rot}
          name={`ai_${config.id}`}
        >
          {/* AI Car geometry representation */}
          <group>
            {/* Chassis */}
            <mesh castShadow>
              <boxGeometry args={[1.8, 0.7, 4.2]} />
              <meshStandardMaterial color={config.color} roughness={0.15} metalness={0.7} />
            </mesh>
            {/* Cabin */}
            <mesh position={[0, 0.45, -0.4]} rotation={[-0.4, 0, 0]}>
              <boxGeometry args={[1.6, 0.4, 1.2]} />
              <meshStandardMaterial color="#111" transparent opacity={0.6} roughness={0.0} />
            </mesh>
            {/* Glowing underglow */}
            <pointLight
              position={[0, -0.45, 0]}
              color={config.glow}
              intensity={8.0}
              distance={3.5}
            />
            {/* Wheels */}
            <mesh position={[-0.95, -0.3, -1.3]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.42, 0.42, 0.35, 12]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
            </mesh>
            <mesh position={[0.95, -0.3, -1.3]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.42, 0.42, 0.35, 12]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
            </mesh>
            <mesh position={[-0.95, -0.3, 1.3]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.42, 0.42, 0.35, 12]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
            </mesh>
            <mesh position={[0.95, -0.3, 1.3]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.42, 0.42, 0.35, 12]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
            </mesh>
          </group>
        </RigidBody>
      ))}
    </group>
  );
}
