'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { RigidBody } from '@react-three/rapier';
import { useGameStore } from '@/store/gameStore';
import { getProceduralTrackPoints } from '@/utils/trackGenerator';
import * as THREE from 'three';

interface TrackProps {
  weather?: 'sunny' | 'rain' | 'snow' | 'fog' | 'storm';
}

export default function Track({ weather = 'sunny' }: TrackProps) {
  const currentTrackId = useGameStore((s) => s.currentTrack);
  const setTrackLoaded = useGameStore((s) => s.setTrackLoaded);

  useEffect(() => {
    setTrackLoaded(true);
    return () => {
      setTrackLoaded(false);
    };
  }, [setTrackLoaded]);

  // 1. Generate road segments and positions from waypoints
  const { roadPanels, finishLinePos, finishLineRot } = useMemo(() => {
    const points = getProceduralTrackPoints(currentTrackId || 'track_1');
    const panels: {
      pos: [number, number, number];
      size: [number, number, number];
      rotY: number;
    }[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const P1 = points[i];
      const P2 = points[i + 1];
      const pos: [number, number, number] = [
        (P1.x + P2.x) / 2,
        0.2,
        (P1.z + P2.z) / 2,
      ];
      const distance = P1.distanceTo(P2);
      const rotY = Math.atan2(P2.x - P1.x, P2.z - P1.z);
      panels.push({ pos, size: [22, 0.4, distance + 1.5], rotY });
    }

    const finishP = points[1] || new THREE.Vector3(0, 0, -20);
    const finishP2 = points[2] || new THREE.Vector3(0, 0, -40);
    const finishRot = Math.atan2(finishP2.x - finishP.x, finishP2.z - finishP.z);

    return {
      roadPanels: panels,
      finishLinePos: [finishP.x, 4, finishP.z] as [number, number, number],
      finishLineRot: finishRot,
    };
  }, [currentTrackId]);

  // Road surface color depends on weather
  const roadColor = weather === 'snow' ? '#d4dde6' : '#2b2d32';
  const roadRoughness = weather === 'rain' ? 0.05 : 0.85;
  const roadMetalness = weather === 'rain' ? 0.35 : 0.02;
  const isDarkWeather = weather === 'fog' || weather === 'storm' || currentTrackId.includes('night') || currentTrackId.includes('sunset');

  // 2. Generate decoration coordinates arrays once
  const decorations = useMemo(() => {
    const trees: [number, number, number][] = [];
    const boulders: { pos: [number, number, number]; scale: number }[] = [];
    const lights: { pos: [number, number, number]; rotY: number }[] = [];
    const flags: { pos: [number, number, number]; rotY: number; color: string }[] = [];
    const billboards: { pos: [number, number, number]; rotY: number }[] = [];
    const arches: { pos: [number, number, number]; rotY: number }[] = [];

    // Environmental instanced segments
    const curbs: { pos: [number, number, number]; rotY: number; size: [number, number, number] }[] = [];
    const laneLines: { pos: [number, number, number]; rotY: number; size: [number, number, number] }[] = [];

    roadPanels.forEach((panel, idx) => {
      const s = Math.sin(panel.rotY);
      const c = Math.cos(panel.rotY);

      // Curbs (both sides)
      if (idx % 2 === 0) {
        curbs.push({
          pos: [panel.pos[0] - c * 11.5, panel.pos[1] + 0.1, panel.pos[2] + s * 11.5],
          rotY: panel.rotY,
          size: [1.6, 0.25, panel.size[2]]
        });
        curbs.push({
          pos: [panel.pos[0] + c * 11.5, panel.pos[1] + 0.1, panel.pos[2] - s * 11.5],
          rotY: panel.rotY,
          size: [1.6, 0.25, panel.size[2]]
        });
      }

      // Lane dashed lines
      if (idx % 3 === 0) {
        laneLines.push({
          pos: [panel.pos[0], panel.pos[1] + 0.03, panel.pos[2]],
          rotY: panel.rotY,
          size: [0.25, 0.01, panel.size[2] * 0.4]
        });
      }

      // 1. Pine Trees
      if (idx % 5 === 0) {
        trees.push([
          panel.pos[0] - c * (panel.size[0] / 2 + 5.0) + (Math.sin(idx) * 2.0),
          panel.pos[1] - 0.2,
          panel.pos[2] + s * (panel.size[0] / 2 + 5.0) + (Math.cos(idx) * 2.0),
        ]);
        trees.push([
          panel.pos[0] + c * (panel.size[0] / 2 + 6.0) + (Math.cos(idx) * 2.0),
          panel.pos[1] - 0.2,
          panel.pos[2] - s * (panel.size[0] / 2 + 6.0) + (Math.sin(idx) * 2.0),
        ]);
      }

      // 2. Boulders
      if (idx % 8 === 2) {
        boulders.push({
          pos: [
            panel.pos[0] - c * (panel.size[0] / 2 + 3.8),
            panel.pos[1] + 0.2,
            panel.pos[2] + s * (panel.size[0] / 2 + 3.8),
          ],
          scale: 0.9 + (idx % 4) * 0.35,
        });
      }

      // 3. Streetlights
      if (idx % 12 === 0) {
        lights.push({
          pos: [
            panel.pos[0] - c * (panel.size[0] / 2 + 1.2),
            panel.pos[1],
            panel.pos[2] + s * (panel.size[0] / 2 + 1.2),
          ],
          rotY: panel.rotY + Math.PI
        });
      }

      // 4. Sponsor Billboards
      if (idx % 20 === 10) {
        billboards.push({
          pos: [
            panel.pos[0] + c * (panel.size[0] / 2 + 4.5),
            panel.pos[1],
            panel.pos[2] - s * (panel.size[0] / 2 + 4.5),
          ],
          rotY: panel.rotY - Math.PI / 2
        });
      }

      // 5. Sponsor Waving Flags
      if (idx % 16 === 4) {
        flags.push({
          pos: [
            panel.pos[0] - c * (panel.size[0] / 2 + 3.2),
            panel.pos[1],
            panel.pos[2] + s * (panel.size[0] / 2 + 3.2),
          ],
          rotY: panel.rotY,
          color: idx % 32 === 4 ? '#00cfff' : '#ff0055'
        });
      }

      // 6. Arch Tunnels
      if (idx % 25 === 0 && idx > 5) {
        arches.push({
          pos: panel.pos,
          rotY: panel.rotY
        });
      }
    });

    return { trees, boulders, lights, flags, billboards, arches, curbs, laneLines };
  }, [roadPanels]);

  // 3. Refs for Instanced Meshes
  const treeTrunksRef = useRef<THREE.InstancedMesh>(null);
  const treeFoliageRef = useRef<THREE.InstancedMesh>(null);
  const boulderRef = useRef<THREE.InstancedMesh>(null);
  const lightPolesRef = useRef<THREE.InstancedMesh>(null);
  const lightHeadsRef = useRef<THREE.InstancedMesh>(null);
  const lightBulbsRef = useRef<THREE.InstancedMesh>(null);
  const flagPolesRef = useRef<THREE.InstancedMesh>(null);
  const flagSheetsRef = useRef<THREE.InstancedMesh>(null);
  const billboardFramesRef = useRef<THREE.InstancedMesh>(null);
  const billboardScreensRef = useRef<THREE.InstancedMesh>(null);
  const archTunnelsRef = useRef<THREE.InstancedMesh>(null);
  const curbsRef = useRef<THREE.InstancedMesh>(null);
  const laneLinesRef = useRef<THREE.InstancedMesh>(null);

  // 4. Update Instanced Mesh Matrices on load
  useEffect(() => {
    const temp = new THREE.Object3D();

    // Instanced Trees
    if (treeTrunksRef.current && treeFoliageRef.current) {
      decorations.trees.forEach((pos, i) => {
        // Trunk
        temp.position.set(pos[0], pos[1] + 0.6, pos[2]);
        temp.rotation.set(0, 0, 0);
        temp.scale.set(1, 1, 1);
        temp.updateMatrix();
        treeTrunksRef.current!.setMatrixAt(i, temp.matrix);

        // Foliage cone
        temp.position.set(pos[0], pos[1] + 2.1, pos[2]);
        temp.scale.set(1.2, 1.2, 1.2);
        temp.updateMatrix();
        treeFoliageRef.current!.setMatrixAt(i, temp.matrix);
      });
      treeTrunksRef.current.instanceMatrix.needsUpdate = true;
      treeFoliageRef.current.instanceMatrix.needsUpdate = true;
    }

    // Instanced Boulders
    if (boulderRef.current) {
      decorations.boulders.forEach((item, i) => {
        temp.position.set(item.pos[0], item.pos[1], item.pos[2]);
        temp.rotation.set(Math.sin(i) * 0.5, Math.cos(i) * 0.5, 0);
        temp.scale.set(item.scale, item.scale * 0.8, item.scale);
        temp.updateMatrix();
        boulderRef.current!.setMatrixAt(i, temp.matrix);
      });
      boulderRef.current.instanceMatrix.needsUpdate = true;
    }

    // Instanced Streetlights
    if (lightPolesRef.current && lightHeadsRef.current && lightBulbsRef.current) {
      decorations.lights.forEach((item, i) => {
        const rad = item.rotY;

        // Pole
        temp.position.set(item.pos[0], item.pos[1] + 4.0, item.pos[2]);
        temp.rotation.set(0, rad, 0);
        temp.scale.set(1, 1, 1);
        temp.updateMatrix();
        lightPolesRef.current!.setMatrixAt(i, temp.matrix);

        // Head box
        temp.position.set(
          item.pos[0] + Math.sin(rad) * 1.6,
          item.pos[1] + 8.0,
          item.pos[2] + Math.cos(rad) * 1.6
        );
        temp.updateMatrix();
        lightHeadsRef.current!.setMatrixAt(i, temp.matrix);

        // Bulb emissive slab
        temp.position.set(
          item.pos[0] + Math.sin(rad) * 1.6,
          item.pos[1] + 7.85,
          item.pos[2] + Math.cos(rad) * 1.6
        );
        temp.updateMatrix();
        lightBulbsRef.current!.setMatrixAt(i, temp.matrix);
      });
      lightPolesRef.current.instanceMatrix.needsUpdate = true;
      lightHeadsRef.current.instanceMatrix.needsUpdate = true;
      lightBulbsRef.current.instanceMatrix.needsUpdate = true;
    }

    // Instanced Flags
    if (flagPolesRef.current && flagSheetsRef.current) {
      decorations.flags.forEach((item, i) => {
        // Pole
        temp.position.set(item.pos[0], item.pos[1] + 2.0, item.pos[2]);
        temp.rotation.set(0, item.rotY, 0);
        temp.scale.set(1, 1, 1);
        temp.updateMatrix();
        flagPolesRef.current!.setMatrixAt(i, temp.matrix);

        // Flag sheet
        temp.position.set(
          item.pos[0] + Math.sin(item.rotY) * 0.6,
          item.pos[1] + 3.4,
          item.pos[2] + Math.cos(item.rotY) * 0.6
        );
        temp.updateMatrix();
        flagSheetsRef.current!.setMatrixAt(i, temp.matrix);
      });
      flagPolesRef.current.instanceMatrix.needsUpdate = true;
      flagSheetsRef.current.instanceMatrix.needsUpdate = true;
    }

    // Instanced Billboards
    if (billboardFramesRef.current && billboardScreensRef.current) {
      decorations.billboards.forEach((item, i) => {
        // Main support frame & post
        temp.position.set(item.pos[0], item.pos[1] + 3.0, item.pos[2]);
        temp.rotation.set(0, item.rotY, 0);
        temp.scale.set(1, 1, 1);
        temp.updateMatrix();
        billboardFramesRef.current!.setMatrixAt(i, temp.matrix);

        // Neon Screen
        temp.position.set(item.pos[0], item.pos[1] + 5.0, item.pos[2]);
        temp.updateMatrix();
        billboardScreensRef.current!.setMatrixAt(i, temp.matrix);
      });
      billboardFramesRef.current.instanceMatrix.needsUpdate = true;
      billboardScreensRef.current.instanceMatrix.needsUpdate = true;
    }

    // Instanced Tunnels
    if (archTunnelsRef.current) {
      decorations.arches.forEach((item, i) => {
        temp.position.set(item.pos[0], item.pos[1] + 3.5, item.pos[2]);
        temp.rotation.set(0, item.rotY, 0);
        temp.scale.set(1.1, 1.1, 1.1);
        temp.updateMatrix();
        archTunnelsRef.current!.setMatrixAt(i, temp.matrix);
      });
      archTunnelsRef.current.instanceMatrix.needsUpdate = true;
    }

    // Instanced Curbs
    if (curbsRef.current) {
      decorations.curbs.forEach((item, i) => {
        temp.position.set(item.pos[0], item.pos[1], item.pos[2]);
        temp.rotation.set(0, item.rotY, 0);
        temp.scale.set(1, 1, 1);
        temp.updateMatrix();
        curbsRef.current!.setMatrixAt(i, temp.matrix);
      });
      curbsRef.current.instanceMatrix.needsUpdate = true;
    }

    // Instanced Center lane lines
    if (laneLinesRef.current) {
      decorations.laneLines.forEach((item, i) => {
        temp.position.set(item.pos[0], item.pos[1], item.pos[2]);
        temp.rotation.set(0, item.rotY, 0);
        temp.scale.set(1, 1, 1);
        temp.updateMatrix();
        laneLinesRef.current!.setMatrixAt(i, temp.matrix);
      });
      laneLinesRef.current.instanceMatrix.needsUpdate = true;
    }

  }, [decorations]);

  return (
    <group>
      {/* ── Road Panels (Fixed colliders + visual tarmac segments) ── */}
      {roadPanels.map((panel, idx) => {
        const s = Math.sin(panel.rotY);
        const c = Math.cos(panel.rotY);

        return (
          <group key={idx}>
            {/* RigidBody colliders only on main tarmac and barriers to optimize performance */}
            <RigidBody type="fixed" colliders="cuboid">
              {/* Main tarmac surface */}
              <mesh
                position={panel.pos}
                rotation={[0, panel.rotY, 0]}
                receiveShadow
              >
                <boxGeometry args={panel.size} />
                <meshStandardMaterial
                  color={roadColor}
                  roughness={roadRoughness}
                  metalness={roadMetalness}
                />
              </mesh>

              {/* Concrete barrier walls (left and right) */}
              <mesh
                position={[
                  panel.pos[0] - c * (panel.size[0] / 2 + 0.9),
                  panel.pos[1] + 0.55,
                  panel.pos[2] + s * (panel.size[0] / 2 + 0.9),
                ]}
                rotation={[0, panel.rotY, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[1.4, 1.5, panel.size[2]]} />
                <meshStandardMaterial color="#b8c0c8" roughness={0.95} metalness={0.0} />
              </mesh>

              <mesh
                position={[
                  panel.pos[0] + c * (panel.size[0] / 2 + 0.9),
                  panel.pos[1] + 0.55,
                  panel.pos[2] - s * (panel.size[0] / 2 + 0.9),
                ]}
                rotation={[0, panel.rotY, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[1.4, 1.5, panel.size[2]]} />
                <meshStandardMaterial color="#b8c0c8" roughness={0.95} metalness={0.0} />
              </mesh>
            </RigidBody>
          </group>
        );
      })}

      {/* ══ GPU INSTANCED MESHES: Renders repeated scenery in single draw calls ══ */}

      {/* 1. Road markings & Curbs */}
      <instancedMesh ref={laneLinesRef} args={[null as any, null as any, decorations.laneLines.length]}>
        <boxGeometry args={[0.25, 0.02, 3.5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </instancedMesh>

      <instancedMesh ref={curbsRef} args={[null as any, null as any, decorations.curbs.length]} receiveShadow>
        <boxGeometry args={[1.6, 0.2, 5.0]} />
        <meshStandardMaterial color="#cc2200" roughness={0.7} />
      </instancedMesh>

      {/* 2. Trees */}
      <instancedMesh ref={treeTrunksRef} args={[null as any, null as any, decorations.trees.length]} castShadow>
        <cylinderGeometry args={[0.15, 0.22, 1.2, 5]} />
        <meshStandardMaterial color="#5c4033" roughness={0.9} />
      </instancedMesh>

      <instancedMesh ref={treeFoliageRef} args={[null as any, null as any, decorations.trees.length]} castShadow>
        <coneGeometry args={[0.9, 2.5, 6]} />
        <meshStandardMaterial color="#224d32" roughness={0.85} />
      </instancedMesh>

      {/* 3. Boulders */}
      <instancedMesh ref={boulderRef} args={[null as any, null as any, decorations.boulders.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1.2, 1]} />
        <meshStandardMaterial color="#64748b" roughness={0.9} metalness={0.1} />
      </instancedMesh>

      {/* 4. Streetlights */}
      <instancedMesh ref={lightPolesRef} args={[null as any, null as any, decorations.lights.length]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 8.0, 6]} />
        <meshStandardMaterial color="#333" metalness={0.7} roughness={0.2} />
      </instancedMesh>

      <instancedMesh ref={lightHeadsRef} args={[null as any, null as any, decorations.lights.length]}>
        <boxGeometry args={[0.6, 0.2, 0.4]} />
        <meshStandardMaterial color="#222" />
      </instancedMesh>

      <instancedMesh ref={lightBulbsRef} args={[null as any, null as any, decorations.lights.length]}>
        <boxGeometry args={[0.45, 0.02, 0.28]} />
        <meshStandardMaterial
          color="#ffd890"
          emissive="#ffd890"
          emissiveIntensity={isDarkWeather ? 3.0 : 0}
        />
      </instancedMesh>

      {/* 5. Flags */}
      <instancedMesh ref={flagPolesRef} args={[null as any, null as any, decorations.flags.length]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 4.0, 5]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.1} />
      </instancedMesh>

      <instancedMesh ref={flagSheetsRef} args={[null as any, null as any, decorations.flags.length]}>
        <boxGeometry args={[1.2, 0.6, 0.05]} />
        <meshStandardMaterial color="#ff0055" roughness={0.6} />
      </instancedMesh>

      {/* 6. Billboards */}
      <instancedMesh ref={billboardFramesRef} args={[null as any, null as any, decorations.billboards.length]} castShadow>
        <boxGeometry args={[0.15, 6.0, 0.15]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
      </instancedMesh>

      <instancedMesh ref={billboardScreensRef} args={[null as any, null as any, decorations.billboards.length]}>
        <boxGeometry args={[3.2, 1.8, 0.25]} />
        <meshStandardMaterial color="#0f172a" emissive="#00f0ff" emissiveIntensity={isDarkWeather ? 1.5 : 0.2} />
      </instancedMesh>

      {/* 7. Arch Tunnels */}
      <instancedMesh ref={archTunnelsRef} args={[null as any, null as any, decorations.arches.length]} castShadow receiveShadow>
        <torusGeometry args={[12.5, 0.8, 8, 18]} />
        <meshStandardMaterial color="#475569" roughness={0.8} />
      </instancedMesh>

      {/* ── Finish Line Gantry ── */}
      <group position={finishLinePos} rotation={[0, finishLineRot, 0]}>
        {/* Left pillar */}
        <mesh position={[-12, -1, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 10, 1.2]} />
          <meshStandardMaterial color="#e0e0e0" roughness={0.7} metalness={0.4} />
        </mesh>
        {/* Right pillar */}
        <mesh position={[12, -1, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 10, 1.2]} />
          <meshStandardMaterial color="#e0e0e0" roughness={0.7} metalness={0.4} />
        </mesh>
        {/* Crossbar */}
        <mesh position={[0, 5, 0]} castShadow>
          <boxGeometry args={[25, 0.8, 1.4]} />
          <meshStandardMaterial color="#1a1a2a" roughness={0.5} metalness={0.7} />
        </mesh>
        {/* Checkered tarmac lane indicator */}
        <mesh position={[0, -3.78, 1.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[22, 4]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </mesh>
        {/* START / FINISH panel */}
        <mesh position={[0, 4.2, 0.8]}>
          <boxGeometry args={[14, 1.6, 0.1]} />
          <meshStandardMaterial color="#e8ff00" roughness={0.5} emissive="#aacc00" emissiveIntensity={0.3} />
        </mesh>
      </group>
    </group>
  );
}
