'use client';

import React, { useMemo } from 'react';
import { RigidBody } from '@react-three/rapier';
import { useGameStore } from '@/store/gameStore';
import { getProceduralTrackPoints } from '@/utils/trackGenerator';
import * as THREE from 'three';

interface TrackProps {
  weather?: 'sunny' | 'rain' | 'snow' | 'fog' | 'storm';
}

// ─── Environment Details Components ───

// Procedural Pine Tree
function PineTree({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      {/* Trunk */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.25, 1.6, 6]} />
        <meshStandardMaterial color="#5c4033" roughness={0.9} />
      </mesh>
      {/* Foliage - LOD simplified */}
      <mesh position={[0, 2.2, 0]} castShadow>
        <coneGeometry args={[1.0, 2.2, 6]} />
        <meshStandardMaterial color="#1b4d3e" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.4, 0]}>
        <coneGeometry args={[0.7, 1.4, 6]} />
        <meshStandardMaterial color="#225c48" roughness={0.8} />
      </mesh>
    </group>
  );
}

// Decorative Rock Boulder
function RockBoulder({ pos, scale }: { pos: [number, number, number]; scale: number }) {
  return (
    <mesh position={pos} scale={scale} castShadow receiveShadow>
      <dodecahedronGeometry args={[1.0, 1]} />
      <meshStandardMaterial color="#808080" roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

// Sponsor Billboard
function Billboard({ pos, rotY, text = 'PALMPIVOT' }: { pos: [number, number, number]; rotY: number; text?: string }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {/* Left post */}
      <mesh position={[-2.5, 2.0, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 4.0, 8]} />
        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Right post */}
      <mesh position={[2.5, 2.0, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 4.0, 8]} />
        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Board screen */}
      <mesh position={[0, 4.0, 0]} castShadow>
        <boxGeometry args={[6.2, 2.2, 0.25]} />
        <meshStandardMaterial color="#111" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Neon glowing screen face */}
      <mesh position={[0, 4.0, 0.13]}>
        <planeGeometry args={[5.9, 1.9]} />
        <meshStandardMaterial color="#00ffcc" emissive="#00ccaa" emissiveIntensity={0.6} roughness={0.1} />
      </mesh>
    </group>
  );
}

// Animated Sponsor Waving Flag
function WavingFlag({ pos, rotY, color = '#ff0055' }: { pos: [number, number, number]; rotY: number; color?: string }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {/* Flag pole */}
      <mesh position={[0, 3.2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 6.4, 8]} />
        <meshStandardMaterial color="#dddddd" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Flag cloth */}
      <mesh position={[0.7, 5.6, 0]}>
        <boxGeometry args={[1.4, 0.8, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  );
}

// Concrete Arch Tunnel
function ArchTunnel({ pos, rotY }: { pos: [number, number, number]; rotY: number }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {/* Left pillar */}
      <mesh position={[-12.2, 5.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 10.0, 8.0]} />
        <meshStandardMaterial color="#505560" roughness={0.9} />
      </mesh>
      {/* Right pillar */}
      <mesh position={[12.2, 5.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 10.0, 8.0]} />
        <meshStandardMaterial color="#505560" roughness={0.9} />
      </mesh>
      {/* Arch roof span */}
      <mesh position={[0, 10.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[26.0, 2.2, 8.0]} />
        <meshStandardMaterial color="#424650" roughness={0.9} />
      </mesh>
    </group>
  );
}

// Streetlight
function Streetlight({ pos, rotY, isGlowing = true }: { pos: [number, number, number]; rotY: number; isGlowing?: boolean }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {/* Pole */}
      <mesh position={[0, 4.0, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 8.0, 8]} />
        <meshStandardMaterial color="#333" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Arm extension */}
      <mesh position={[1.2, 8.0, 0]} rotation={[0, 0, -0.4]}>
        <boxGeometry args={[2.5, 0.12, 0.12]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Light head */}
      <mesh position={[2.3, 7.6, 0]}>
        <boxGeometry args={[0.5, 0.2, 0.35]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Emissive light source */}
      <mesh position={[2.3, 7.48, 0]}>
        <boxGeometry args={[0.4, 0.02, 0.28]} />
        <meshStandardMaterial
          color="#ffd890"
          emissive="#ffd890"
          emissiveIntensity={isGlowing ? 2.5 : 0}
        />
      </mesh>
    </group>
  );
}

// Road stripe geometry configs for road markings
function RoadMarkings({ pos, rotY, length }: { pos: [number, number, number]; rotY: number; length: number }) {
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
function Curb({ pos, rotY, length }: { pos: [number, number, number]; rotY: number; length: number }) {
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
  const setTrackLoaded = useGameStore((s) => s.setTrackLoaded);

  React.useEffect(() => {
    setTrackLoaded(true);
    return () => {
      setTrackLoaded(false);
    };
  }, [setTrackLoaded]);

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
  const roadColor = weather === 'snow' ? '#d4dde6' : '#3a3d45';
  const roadRoughness = weather === 'rain' ? 0.05 : 0.85;
  const roadMetalness = weather === 'rain' ? 0.35 : 0.02;

  // Determine if streetlights should glow (Night, Sunset, Fog, Storm)
  const isDarkWeather = weather === 'fog' || weather === 'storm' || currentTrackId.includes('night') || currentTrackId.includes('sunset');

  return (
    <group>
      {/* ── Road Panels & Environment Grid ── */}
      {roadPanels.map((panel, idx) => {
        // Calculate tangent vector for offsets
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

              {/* Concrete barrier walls */}
              {/* Left barrier */}
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
                <meshStandardMaterial color="#c0c8d0" roughness={0.95} metalness={0.0} />
              </mesh>

              {/* Right barrier */}
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
                <meshStandardMaterial color="#c0c8d0" roughness={0.95} metalness={0.0} />
              </mesh>

              {/* Red/white barrier warning stripe overlay (every 5th panel) */}
              {idx % 5 === 0 && (
                <>
                  <mesh
                    position={[
                      panel.pos[0] - c * (panel.size[0] / 2 + 0.9),
                      panel.pos[1] + 0.8,
                      panel.pos[2] + s * (panel.size[0] / 2 + 0.9),
                    ]}
                    rotation={[0, panel.rotY, 0]}
                  >
                    <boxGeometry args={[1.42, 0.25, panel.size[2]]} />
                    <meshStandardMaterial color="#cc2200" roughness={0.9} />
                  </mesh>
                  <mesh
                    position={[
                      panel.pos[0] + c * (panel.size[0] / 2 + 0.9),
                      panel.pos[1] + 0.8,
                      panel.pos[2] - s * (panel.size[0] / 2 + 0.9),
                    ]}
                    rotation={[0, panel.rotY, 0]}
                  >
                    <boxGeometry args={[1.42, 0.25, panel.size[2]]} />
                    <meshStandardMaterial color="#cc2200" roughness={0.9} />
                  </mesh>
                </>
              )}
            </RigidBody>

            {/* Road markings */}
            {idx % 3 === 0 && (
              <RoadMarkings pos={panel.pos} rotY={panel.rotY} length={panel.size[2]} />
            )}

            {/* Racing curbs on every 4th panel */}
            {idx % 4 === 0 && (
              <Curb pos={panel.pos} rotY={panel.rotY} length={panel.size[2]} />
            )}

            {/* ── Procedural Environment Decor (outside barrier walls) ── */}

            {/* 1. Pine Trees (placed outside barriers on the left and right) */}
            {idx % 6 === 0 && (
              <>
                <PineTree
                  pos={[
                    panel.pos[0] - c * (panel.size[0] / 2 + 5.0) + (Math.random() - 0.5) * 2.0,
                    panel.pos[1] - 0.2,
                    panel.pos[2] + s * (panel.size[0] / 2 + 5.0) + (Math.random() - 0.5) * 2.0,
                  ]}
                />
                <PineTree
                  pos={[
                    panel.pos[0] + c * (panel.size[0] / 2 + 6.0) + (Math.random() - 0.5) * 2.0,
                    panel.pos[1] - 0.2,
                    panel.pos[2] - s * (panel.size[0] / 2 + 6.0) + (Math.random() - 0.5) * 2.0,
                  ]}
                />
              </>
            )}

            {/* 2. Rock Boulders */}
            {idx % 8 === 2 && (
              <RockBoulder
                pos={[
                  panel.pos[0] - c * (panel.size[0] / 2 + 3.8),
                  panel.pos[1] + 0.2,
                  panel.pos[2] + s * (panel.size[0] / 2 + 3.8),
                ]}
                scale={0.8 + Math.random() * 0.8}
              />
            )}

            {/* 3. Streetlights */}
            {idx % 12 === 0 && (
              <Streetlight
                pos={[
                  panel.pos[0] - c * (panel.size[0] / 2 + 1.2),
                  panel.pos[1],
                  panel.pos[2] + s * (panel.size[0] / 2 + 1.2),
                ]}
                rotY={panel.rotY + Math.PI}
                isGlowing={isDarkWeather}
              />
            )}

            {/* 4. Sponsor Billboards */}
            {idx % 20 === 10 && (
              <Billboard
                pos={[
                  panel.pos[0] + c * (panel.size[0] / 2 + 4.5),
                  panel.pos[1],
                  panel.pos[2] - s * (panel.size[0] / 2 + 4.5),
                ]}
                rotY={panel.rotY - Math.PI / 2}
              />
            )}

            {/* 5. Sponsor Waving Flags */}
            {idx % 16 === 4 && (
              <WavingFlag
                pos={[
                  panel.pos[0] - c * (panel.size[0] / 2 + 3.2),
                  panel.pos[1],
                  panel.pos[2] + s * (panel.size[0] / 2 + 3.2),
                ]}
                rotY={panel.rotY}
                color={idx % 32 === 4 ? '#00cfff' : '#ff0055'}
              />
            )}

            {/* 6. Arch Tunnels (Concrete Ring Arches spans over track) */}
            {idx % 25 === 0 && idx > 5 && (
              <ArchTunnel pos={panel.pos} rotY={panel.rotY} />
            )}
          </group>
        );
      })}

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
