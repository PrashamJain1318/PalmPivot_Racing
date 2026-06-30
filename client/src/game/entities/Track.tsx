'use client';

import React, { useMemo } from 'react';
import { RigidBody } from '@react-three/rapier';
import { useGameStore } from '@/store/gameStore';
import { getProceduralTrackPoints } from '@/utils/trackGenerator';
import * as THREE from 'three';

interface TrackProps {
  weather?: 'sunny' | 'rain' | 'snow';
}

// Road stripe geometry configs for road markings
function RoadMarkings({ pos, rotY, length }: { pos: [number,number,number], rotY: number, length: number }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {/* Center dashed line */}
      <mesh position={[0, 0.22, 0]} receiveShadow>
        <boxGeometry args={[0.3, 0.02, length * 0.4]} />
        <meshStandardMaterial color="#fffde7" roughness={0.8} />
      </mesh>
      {/* Left white lane edge */}
      <mesh position={[-9.5, 0.22, 0]} receiveShadow>
        <boxGeometry args={[0.4, 0.02, length]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>
      {/* Right white lane edge */}
      <mesh position={[9.5, 0.22, 0]} receiveShadow>
        <boxGeometry args={[0.4, 0.02, length]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>
    </group>
  );
}

// Curb block for visual racing edge
function Curb({ pos, rotY, length }: { pos: [number,number,number], rotY: number, length: number }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {/* Left curb */}
      <mesh position={[-11.5, 0.25, 0]} receiveShadow castShadow>
        <boxGeometry args={[2.0, 0.3, length]} />
        <meshStandardMaterial color="#ff3333" roughness={0.7} />
      </mesh>
      {/* Right curb */}
      <mesh position={[11.5, 0.25, 0]} receiveShadow castShadow>
        <boxGeometry args={[2.0, 0.3, length]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>
    </group>
  );
}

export default function Track({ weather = 'sunny' }: TrackProps) {
  const currentTrackId = useGameStore((s) => s.currentTrack);

  const { roadPanels, finishLinePos, finishLineRot } = useMemo(() => {
    const points = getProceduralTrackPoints(currentTrackId || 'track_1');
    const panels: {
      pos: [number,number,number];
      size: [number,number,number];
      rotY: number;
    }[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const P1 = points[i];
      const P2 = points[i + 1];
      const pos: [number,number,number] = [
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
      finishLinePos: [finishP.x, 4, finishP.z] as [number,number,number],
      finishLineRot: finishRot,
    };
  }, [currentTrackId]);

  // Road surface color depends on weather
  const roadColor = weather === 'snow' ? '#d4dde6' : '#3a3d45';
  const roadRoughness = weather === 'rain' ? 0.05 : 0.85;
  const roadMetalness = weather === 'rain' ? 0.35 : 0.02;

  return (
    <group>
      {/* ── Road Panels ── */}
      {roadPanels.map((panel, idx) => (
        <RigidBody key={idx} type="fixed" colliders="cuboid">
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

          {/* Road markings */}
          {idx % 3 === 0 && (
            <RoadMarkings pos={panel.pos} rotY={panel.rotY} length={panel.size[2]} />
          )}

          {/* Racing curbs on every 4th panel */}
          {idx % 4 === 0 && (
            <Curb pos={panel.pos} rotY={panel.rotY} length={panel.size[2]} />
          )}

          {/* ── Concrete barrier walls ── */}
          {/* Left barrier */}
          <mesh
            position={[
              panel.pos[0] - Math.cos(panel.rotY) * (panel.size[0] / 2 + 0.9),
              panel.pos[1] + 0.55,
              panel.pos[2] + Math.sin(panel.rotY) * (panel.size[0] / 2 + 0.9),
            ]}
            rotation={[0, panel.rotY, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1.4, 1.5, panel.size[2]]} />
            <meshStandardMaterial color="#c0c8d0" roughness={0.95} metalness={0.0} />
          </mesh>

          {/* Right barrier */}
          <mesh
            position={[
              panel.pos[0] + Math.cos(panel.rotY) * (panel.size[0] / 2 + 0.9),
              panel.pos[1] + 0.55,
              panel.pos[2] - Math.sin(panel.rotY) * (panel.size[0] / 2 + 0.9),
            ]}
            rotation={[0, panel.rotY, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1.4, 1.5, panel.size[2]]} />
            <meshStandardMaterial color="#c0c8d0" roughness={0.95} metalness={0.0} />
          </mesh>

          {/* Red/white barrier stripes (every 5th panel) */}
          {idx % 5 === 0 && (
            <>
              <mesh
                position={[
                  panel.pos[0] - Math.cos(panel.rotY) * (panel.size[0] / 2 + 0.9),
                  panel.pos[1] + 0.8,
                  panel.pos[2] + Math.sin(panel.rotY) * (panel.size[0] / 2 + 0.9),
                ]}
                rotation={[0, panel.rotY, 0]}
              >
                <boxGeometry args={[1.42, 0.25, panel.size[2]]} />
                <meshStandardMaterial color="#cc2200" roughness={0.9} />
              </mesh>
            </>
          )}
        </RigidBody>
      ))}

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
        {/* Finish line checkered on road */}
        <mesh position={[0, -3.78, 1.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[22, 4]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </mesh>
        {/* START / FINISH text panel */}
        <mesh position={[0, 4.2, 0.8]}>
          <boxGeometry args={[14, 1.6, 0.1]} />
          <meshStandardMaterial color="#e8ff00" roughness={0.5} emissive="#aacc00" emissiveIntensity={0.3} />
        </mesh>
      </group>
    </group>
  );
}
