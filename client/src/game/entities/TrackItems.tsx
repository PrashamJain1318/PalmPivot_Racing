'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { getProceduralTrackPoints } from '@/utils/trackGenerator';

interface ItemConfig {
  id: string;
  type: 'coin' | 'fuel' | 'repair' | 'shield' | 'obstacle' | 'boost_pad';
  pos: [number, number, number];
  rotY: number;
  lane: number; // -1, 0, 1
}

// Sound synthesizer node helper for item collections
const playPickupSound = (type: 'coin' | 'fuel' | 'powerup' | 'crash' | 'boost') => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    if (type === 'coin') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'fuel') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'powerup') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'boost') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'crash') {
      // Noise buffer for crash sounds
      const bufferSize = ctx.sampleRate * 0.4; // 0.4 seconds
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    }
  } catch (e) {
    // Audio Context block
  }
};

export default function TrackItems() {
  const currentTrack = useGameStore((s) => s.currentTrack);
  const status = useGameStore((s) => s.status);
  const health = useGameStore((s) => s.health);
  const fuel = useGameStore((s) => s.fuel);
  const coinsCollected = useGameStore((s) => s.coinsCollected);
  const shieldActive = useGameStore((s) => s.shieldActive);
  const updateVehicleStats = useGameStore((s) => s.updateVehicleStats);
  const addCoins = useGameStore((s) => s.addCoins);

  const [collectedMap, setCollectedMap] = useState<{ [id: string]: boolean }>({});
  const itemsRef = useRef<THREE.Group>(null);

  // Generate track items on track change
  const trackItems = useMemo(() => {
    const points = getProceduralTrackPoints(currentTrack || 'track_1');
    const items: ItemConfig[] = [];
    if (points.length < 10) return [];

    const isSuzuka = currentTrack === 'suzuka';
    const laneWidth = isSuzuka ? 5.2 : 7.2;

    // Start placing items after waypoint 6 (start straight clearance)
    for (let i = 6; i < points.length - 3; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      const right = new THREE.Vector3(-dir.z, 0, dir.x);
      const rotY = Math.atan2(dir.x, dir.z);

      const centerPos = new THREE.Vector3((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (p1.z + p2.z) / 2);

      // Lanes: -1 (Left), 0 (Center), 1 (Right)
      // Deterministic layout seeding based on waypoint index
      const seedLane = ((i * 7) % 3) - 1; // -1, 0, 1

      // 1. Spawning Fuel Cans (every 12 waypoints)
      if (i % 12 === 0) {
        const posOffset = right.clone().multiplyScalar(seedLane * laneWidth);
        const itemPos = centerPos.clone().add(posOffset);
        items.push({
          id: `fuel_${i}`,
          type: 'fuel',
          pos: [itemPos.x, itemPos.y + 0.8, itemPos.z],
          rotY,
          lane: seedLane
        });
      }

      // 2. Spawning Power-ups (Shield/Repair Kit alternating every 16 waypoints)
      else if (i % 16 === 0) {
        const powerupType = i % 32 === 0 ? 'shield' : 'repair';
        const posOffset = right.clone().multiplyScalar(seedLane * laneWidth);
        const itemPos = centerPos.clone().add(posOffset);
        items.push({
          id: `${powerupType}_${i}`,
          type: powerupType,
          pos: [itemPos.x, itemPos.y + 0.8, itemPos.z],
          rotY,
          lane: seedLane
        });
      }

      // 3. Spawning Boost Pads (every 10 waypoints, always in the center lane)
      else if (i % 10 === 0) {
        items.push({
          id: `boost_pad_${i}`,
          type: 'boost_pad',
          pos: [centerPos.x, centerPos.y + 0.05, centerPos.z], // flat on road
          rotY,
          lane: 0
        });
      }

      // 4. Spawning Roadblock Obstacles (every 6 waypoints)
      else if (i % 6 === 0) {
        // Place roadblock in a random lane
        const obstacleLane = ((i * 13) % 3) - 1;
        const posOffset = right.clone().multiplyScalar(obstacleLane * laneWidth);
        const itemPos = centerPos.clone().add(posOffset);
        items.push({
          id: `obstacle_${i}`,
          type: 'obstacle',
          pos: [itemPos.x, itemPos.y + 0.6, itemPos.z],
          rotY,
          lane: obstacleLane
        });
      }

      // 5. Spawning groups of Coins (every 4 waypoints)
      else if (i % 4 === 0) {
        // Spawn 3 coins in a row along the track segment
        const coinLane = ((i * 19) % 3) - 1;
        const dist = p1.distanceTo(p2);
        
        for (let j = 0; j < 3; j++) {
          const t = (j + 1) / 4; // 0.25, 0.5, 0.75 along segment
          const coinPos = p1.clone().lerp(p2, t);
          const laneOffset = right.clone().multiplyScalar(coinLane * laneWidth);
          coinPos.add(laneOffset);
          
          items.push({
            id: `coin_${i}_${j}`,
            type: 'coin',
            pos: [coinPos.x, coinPos.y + 0.65, coinPos.z],
            rotY,
            lane: coinLane
          });
        }
      }
    }
    return items;
  }, [currentTrack]);

  // Generate decorative trackside environment items (trees, guardrails, animated flags)
  const sceneryObjects = useMemo(() => {
    const points = getProceduralTrackPoints(currentTrack || 'track_1');
    if (points.length < 10) return [];
    
    const scenery: {
      id: string;
      type: 'tree' | 'flag' | 'guardrail';
      pos: [number, number, number];
      rotY: number;
      scale?: number;
      flagColor?: string;
    }[] = [];
    
    const isSuzuka = currentTrack === 'suzuka';
    const roadWidth = isSuzuka ? 9.0 : 12.0;
    
    // Spawns items along the track margins (left/right)
    for (let i = 0; i < points.length; i += 3) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      const right = new THREE.Vector3(-dir.z, 0, dir.x);
      const rotY = Math.atan2(dir.x, dir.z);
      
      const centerPos = new THREE.Vector3(p1.x, p1.y, p1.z);
      
      const leftPos = centerPos.clone().sub(right.clone().multiplyScalar(roadWidth + 2.2));
      const rightPos = centerPos.clone().add(right.clone().multiplyScalar(roadWidth + 2.2));
      
      const seed = (i * 17) % 100;
      
      if (seed < 40) {
        // Spawns pine/foliage trees
        scenery.push({
          id: `tree_l_${i}`,
          type: 'tree',
          pos: [leftPos.x, leftPos.y, leftPos.z],
          rotY: Math.random() * Math.PI,
          scale: 0.85 + Math.random() * 0.5
        });
        scenery.push({
          id: `tree_r_${i}`,
          type: 'tree',
          pos: [rightPos.x, rightPos.y, rightPos.z],
          rotY: Math.random() * Math.PI,
          scale: 0.85 + Math.random() * 0.5
        });
      } else if (seed < 72) {
        // Spawns side protective guardrails
        scenery.push({
          id: `guardrail_l_${i}`,
          type: 'guardrail',
          pos: [leftPos.x, leftPos.y + 0.35, leftPos.z],
          rotY
        });
        scenery.push({
          id: `guardrail_r_${i}`,
          type: 'guardrail',
          pos: [rightPos.x, rightPos.y + 0.35, rightPos.z],
          rotY
        });
      } else {
        // Spawns colored spectator sponsor flags
        const colors = ['#00CFFF', '#FF0055', '#FFD700', '#10B981'];
        const flagColor = colors[(i % colors.length)];
        
        scenery.push({
          id: `flag_l_${i}`,
          type: 'flag',
          pos: [leftPos.x, leftPos.y, leftPos.z],
          rotY: rotY + Math.PI / 2,
          flagColor
        });
        scenery.push({
          id: `flag_r_${i}`,
          type: 'flag',
          pos: [rightPos.x, rightPos.y, rightPos.z],
          rotY: rotY - Math.PI / 2,
          flagColor
        });
      }
    }
    return scenery;
  }, [currentTrack]);

  // Reset collections on track start
  useEffect(() => {
    setCollectedMap({});
  }, [currentTrack]);

  // Rotate items and animate flags in useFrame
  useFrame((state) => {
    if (itemsRef.current) {
      itemsRef.current.traverse((child) => {
        // Collectibles rotation & hover bobbing
        if ((child as THREE.Mesh).isMesh && child.name.includes('collectible')) {
          child.rotation.y = state.clock.elapsedTime * 2.8;
          child.position.y = (child.userData.baseY || 0.8) + Math.sin(state.clock.elapsedTime * 3.5 + child.userData.offset) * 0.12;
        }
        // Animated spectator flags waving in the wind
        if (child.name === 'flag_fabric') {
          const offset = child.userData.offset || 0;
          child.rotation.y = Math.sin(state.clock.elapsedTime * 4.5 + offset) * 0.18;
          child.position.x = 0.65 + Math.sin(state.clock.elapsedTime * 4.5 + offset) * 0.05;
        }
      });
    }
  });

  const handleCollection = (itemId: string, type: 'coin' | 'fuel' | 'repair' | 'shield' | 'boost_pad' | 'obstacle') => {
    if (collectedMap[itemId]) return;
    
    // Set collected state
    setCollectedMap(prev => ({ ...prev, [itemId]: true }));

    if (type === 'coin') {
      playPickupSound('coin');
      updateVehicleStats({
        coinsCollected: coinsCollected + 1,
        score: useGameStore.getState().score + 10 * useGameStore.getState().scoreMultiplier
      });
      addCoins(1); // Profile coins
    } else if (type === 'fuel') {
      playPickupSound('fuel');
      updateVehicleStats({
        fuel: Math.min(100, fuel + 25)
      });
    } else if (type === 'repair') {
      playPickupSound('powerup');
      updateVehicleStats({
        health: Math.min(100, health + 20)
      });
    } else if (type === 'shield') {
      playPickupSound('powerup');
      updateVehicleStats({
        shieldActive: true
      });
    } else if (type === 'boost_pad') {
      playPickupSound('boost');
      // Trigger a 3.5 second speed boost in VehicleController
      updateVehicleStats({
        nitroActive: true,
        nitroLevel: 100 // Refill nitro fully
      });
    } else if (type === 'obstacle') {
      // Deactivate/hide roadblock
      if (shieldActive) {
        playPickupSound('powerup'); // Shield absorption sound
        updateVehicleStats({
          shieldActive: false
        });
      } else {
        playPickupSound('crash');
        updateVehicleStats({
          health: Math.max(0, health - 25)
        });
      }
    }
  };

  return (
    <group ref={itemsRef}>
      {trackItems.map((item) => {
        if (collectedMap[item.id]) return null;

        // Render Coins
        if (item.type === 'coin') {
          return (
            <RigidBody
              key={item.id}
              type="fixed"
              position={item.pos}
              rotation={[0, item.rotY, 0]}
              sensor
              onIntersectionEnter={(event) => {
                if (event.other.rigidBodyObject?.name === 'player_car') {
                  handleCollection(item.id, 'coin');
                }
              }}
            >
              <mesh
                name="collectible_coin"
                userData={{ baseY: item.pos[1], offset: item.pos[0] }}
                castShadow
              >
                <torusGeometry args={[0.36, 0.1, 8, 16]} />
                <meshStandardMaterial
                  color="#fbbf24"
                  metalness={0.9}
                  roughness={0.1}
                  emissive="#d97706"
                  emissiveIntensity={0.5}
                />
              </mesh>
            </RigidBody>
          );
        }

        // Render Fuel Cans
        if (item.type === 'fuel') {
          return (
            <RigidBody
              key={item.id}
              type="fixed"
              position={item.pos}
              rotation={[0, item.rotY, 0]}
              sensor
              onIntersectionEnter={(event) => {
                if (event.other.rigidBodyObject?.name === 'player_car') {
                  handleCollection(item.id, 'fuel');
                }
              }}
            >
              <mesh
                name="collectible_fuel"
                userData={{ baseY: item.pos[1], offset: item.pos[2] }}
                castShadow
              >
                <cylinderGeometry args={[0.3, 0.3, 0.9, 8]} />
                <meshStandardMaterial
                  color="#ef4444"
                  roughness={0.2}
                  metalness={0.6}
                  emissive="#b91c1c"
                  emissiveIntensity={0.8}
                />
              </mesh>
            </RigidBody>
          );
        }

        // Render Repair Kits
        if (item.type === 'repair') {
          return (
            <RigidBody
              key={item.id}
              type="fixed"
              position={item.pos}
              rotation={[0, item.rotY, 0]}
              sensor
              onIntersectionEnter={(event) => {
                if (event.other.rigidBodyObject?.name === 'player_car') {
                  handleCollection(item.id, 'repair');
                }
              }}
            >
              <mesh
                name="collectible_repair"
                userData={{ baseY: item.pos[1], offset: item.pos[0] + item.pos[2] }}
                castShadow
              >
                <boxGeometry args={[0.6, 0.6, 0.6]} />
                <meshStandardMaterial
                  color="#22c55e"
                  roughness={0.3}
                  metalness={0.5}
                  emissive="#15803d"
                  emissiveIntensity={0.8}
                />
              </mesh>
            </RigidBody>
          );
        }

        // Render Shields
        if (item.type === 'shield') {
          return (
            <RigidBody
              key={item.id}
              type="fixed"
              position={item.pos}
              rotation={[0, item.rotY, 0]}
              sensor
              onIntersectionEnter={(event) => {
                if (event.other.rigidBodyObject?.name === 'player_car') {
                  handleCollection(item.id, 'shield');
                }
              }}
            >
              <mesh
                name="collectible_shield"
                userData={{ baseY: item.pos[1], offset: item.pos[0] * 2 }}
                castShadow
              >
                <sphereGeometry args={[0.42, 16, 16]} />
                <meshStandardMaterial
                  color="#3b82f6"
                  roughness={0.1}
                  metalness={0.9}
                  transparent
                  opacity={0.7}
                  emissive="#1d4ed8"
                  emissiveIntensity={0.9}
                />
              </mesh>
            </RigidBody>
          );
        }

        // Render Boost Pads
        if (item.type === 'boost_pad') {
          return (
            <RigidBody
              key={item.id}
              type="fixed"
              position={item.pos}
              rotation={[0, item.rotY, 0]}
              sensor
              onIntersectionEnter={(event) => {
                if (event.other.rigidBodyObject?.name === 'player_car') {
                  handleCollection(item.id, 'boost_pad');
                }
              }}
            >
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[5, 2.5]} />
                <meshStandardMaterial
                  color="#10b981"
                  emissive="#10b981"
                  emissiveIntensity={1.8}
                  transparent
                  opacity={0.8}
                />
              </mesh>
            </RigidBody>
          );
        }

        // Render Obstacles (Roadblocks)
        if (item.type === 'obstacle') {
          return (
            <RigidBody
              key={item.id}
              type="fixed"
              position={item.pos}
              rotation={[0, item.rotY, 0]}
              colliders="cuboid"
              onCollisionEnter={(event) => {
                if (event.other.rigidBodyObject?.name === 'player_car') {
                  handleCollection(item.id, 'obstacle');
                }
              }}
            >
              <mesh castShadow receiveShadow>
                <boxGeometry args={[4.2, 0.8, 0.6]} />
                <meshStandardMaterial
                  color="#7f1d1d"
                  roughness={0.8}
                  metalness={0.2}
                />
              </mesh>
              {/* Warning sign indicator */}
              <mesh position={[0, 0.8, 0]}>
                <boxGeometry args={[1.5, 0.6, 0.1]} />
                <meshStandardMaterial
                  color="#ea580c"
                  emissive="#ea580c"
                  emissiveIntensity={0.5}
                />
              </mesh>
            </RigidBody>
          );
        }

        return null;
      })}

      {/* Render Trackside Environment Scenery */}
      {sceneryObjects.map((obj) => {
        if (obj.type === 'tree') {
          const sc = obj.scale || 1.0;
          return (
            <group key={obj.id} position={obj.pos} rotation={[0, obj.rotY, 0]}>
              {/* Trunk */}
              <mesh position={[0, 0.65 * sc, 0]} castShadow>
                <cylinderGeometry args={[0.16 * sc, 0.24 * sc, 1.3 * sc, 8]} />
                <meshStandardMaterial color="#5c4033" roughness={0.9} />
              </mesh>
              {/* Leaves */}
              <mesh position={[0, 1.95 * sc, 0]} castShadow>
                <coneGeometry args={[1.05 * sc, 2.1 * sc, 8]} />
                <meshStandardMaterial color="#1b4332" roughness={0.8} />
              </mesh>
              <mesh position={[0, 2.7 * sc, 0]} castShadow>
                <coneGeometry args={[0.75 * sc, 1.5 * sc, 8]} />
                <meshStandardMaterial color="#2d6a4f" roughness={0.8} />
              </mesh>
            </group>
          );
        }
        
        if (obj.type === 'guardrail') {
          return (
            <group key={obj.id} position={obj.pos} rotation={[0, obj.rotY, 0]}>
              {/* Horizontal metal beam */}
              <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.08, 0.28, 4.2]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
              </mesh>
              {/* Rail posts */}
              <mesh position={[0, -0.2, -1.8]} castShadow>
                <cylinderGeometry args={[0.08, 0.08, 0.6, 6]} />
                <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.4} />
              </mesh>
              <mesh position={[0, -0.2, 1.8]} castShadow>
                <cylinderGeometry args={[0.08, 0.08, 0.6, 6]} />
                <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.4} />
              </mesh>
            </group>
          );
        }
        
        if (obj.type === 'flag') {
          return (
            <group key={obj.id} position={obj.pos} rotation={[0, obj.rotY, 0]}>
              {/* flagpole */}
              <mesh position={[0, 1.8, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.07, 3.6, 6]} />
                <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
              </mesh>
              {/* flag fabric */}
              <mesh
                name="flag_fabric"
                position={[0.65, 3.1, 0]}
                userData={{ offset: Math.random() * 50 }}
                castShadow
              >
                <boxGeometry args={[1.3, 0.75, 0.03]} />
                <meshStandardMaterial color={obj.flagColor} roughness={0.6} />
              </mesh>
            </group>
          );
        }
        return null;
      })}
    </group>
  );
}
