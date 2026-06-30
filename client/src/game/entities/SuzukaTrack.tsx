'use client';

import React, { useMemo, useRef, Suspense, Component, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { getProceduralTrackPoints } from '@/utils/trackGenerator';
import Track from './Track';

interface SuzukaTrackProps {
  weather?: 'sunny' | 'rain' | 'snow';
}

// ─── Error Boundary: falls back to procedural track if GLB fails ───
interface EBState { hasError: boolean }
class GLBErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, EBState> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): EBState {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error('[SuzukaTrack] GLB load error - falling back to procedural track:', error.message);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ─── GLB Scene Renderer ───
function SuzukaModel() {
  const { scene } = useGLTF('/models/tracks/suzuka/suzukibananini.glb');

  useMemo(() => {
    if (!scene) return;
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.receiveShadow = true;
        mesh.castShadow = true;

        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial) {
              if (mat.map) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
                mat.map.needsUpdate = true;
              }
              if ((mat as THREE.MeshStandardMaterial).normalMap) {
                (mat as THREE.MeshStandardMaterial).normalMap!.colorSpace = THREE.LinearSRGBColorSpace;
              }
              if ((mat as THREE.MeshStandardMaterial).roughnessMap) {
                (mat as THREE.MeshStandardMaterial).roughnessMap!.colorSpace = THREE.LinearSRGBColorSpace;
              }
              mat.needsUpdate = true;
            }
          });
        }
      }
    });
  }, [scene]);

  // Compute bounding box and auto-center the model
  const { normalizedScene, offset } = useMemo(() => {
    if (!scene) return { normalizedScene: scene, offset: new THREE.Vector3() };
    
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    console.log('[SuzukaTrack] GLB loaded. Bounding box:', {
      size: { x: size.x.toFixed(1), y: size.y.toFixed(1), z: size.z.toFixed(1) },
      center: { x: center.x.toFixed(1), y: center.y.toFixed(1), z: center.z.toFixed(1) },
    });
    
    // Center the model at origin Y=0
    return { normalizedScene: scene, offset: center };
  }, [scene]);

  return (
    <primitive
      object={scene}
      scale={[1, 1, 1]}
      position={[0, 0, 0]}
      rotation={[0, 0, 0]}
    />
  );
}

// ─── Invisible Physics Colliders (generated from waypoints) ───
function SuzukaColliders() {
  const points = useMemo(() => getProceduralTrackPoints('suzuka'), []);

  const colliderPanels = useMemo(() => {
    const panels: { pos: [number,number,number]; size: [number,number,number]; rotY: number }[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const P1 = points[i];
      const P2 = points[i + 1];
      const pos: [number,number,number] = [
        (P1.x + P2.x) / 2,
        (P1.y + P2.y) / 2 + 0.1,
        (P1.z + P2.z) / 2,
      ];
      const distance = P1.distanceTo(P2);
      const rotY = Math.atan2(P2.x - P1.x, P2.z - P1.z);
      panels.push({ pos, size: [18, 0.4, distance + 2.0], rotY });
    }
    return panels;
  }, [points]);

  return (
    <group>
      {colliderPanels.map((panel, idx) => (
        <RigidBody key={`suzuka_road_${idx}`} type="fixed" colliders="cuboid">
          <mesh position={panel.pos} rotation={[0, panel.rotY, 0]} visible={false}>
            <boxGeometry args={panel.size} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}

// ─── Loading placeholder (visible while GLB loads) ───
function SuzukaLoadingPlaceholder() {
  return (
    <group>
      {/* Simple flat track placeholder so car has something to drive on */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[22, 0.4, 500]} />
          <meshStandardMaterial color="#3a3d45" roughness={0.85} />
        </mesh>
      </RigidBody>
      <mesh position={[0, 1.5, -20]}>
        <boxGeometry args={[8, 1.5, 0.1]} />
        <meshStandardMaterial color="#1a1a2e" emissive="#00d4ff" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

// ─── Finish Line Arch ───
function SuzukaFinishLine() {
  const points = useMemo(() => getProceduralTrackPoints('suzuka'), []);
  const P1 = points[0];
  const P2 = points[1];
  const finishPos: [number,number,number] = [(P1.x + P2.x) / 2, 4, (P1.z + P2.z) / 2];
  const finishRot = Math.atan2(P2.x - P1.x, P2.z - P1.z);

  return (
    <group position={finishPos} rotation={[0, finishRot, 0]}>
      <mesh position={[-9, 0, 0]} castShadow>
        <boxGeometry args={[0.8, 10, 0.8]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[9, 0, 0]} castShadow>
        <boxGeometry args={[0.8, 10, 0.8]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0, 5, 0]} castShadow>
        <boxGeometry args={[19, 0.8, 1.5]} />
        <meshStandardMaterial color="#111" emissive="#ef4444" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 3.5, 0.15]}>
        <planeGeometry args={[14, 2]} />
        <meshStandardMaterial color="#ffffff" emissive="#fbbf24" emissiveIntensity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─── Dust particles ───
function SuzukaDust() {
  const dustRef = useRef<THREE.Points>(null);
  const dustPositions = useMemo(() => {
    const arr = new Float32Array(200 * 3);
    for (let i = 0; i < 200 * 3; i += 3) {
      arr[i] = (Math.random() - 0.5) * 400;
      arr[i + 1] = Math.random() * 50;
      arr[i + 2] = (Math.random() - 0.5) * 400;
    }
    return arr;
  }, []);
  useFrame(() => {
    if (!dustRef.current) return;
    const positions = dustRef.current.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      let y = positions.getY(i);
      y -= 0.02;
      if (y < 0) y = 30 + Math.random() * 20;
      positions.setY(i, y);
    }
    positions.needsUpdate = true;
  });
  return (
    <points ref={dustRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[dustPositions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#d4a574" size={0.15} transparent opacity={0.3} />
    </points>
  );
}

// ─── Main Suzuka Track Component ───
export default function SuzukaTrack({ weather = 'sunny' }: SuzukaTrackProps) {
  return (
    <group>
      {/* GLB 3D model — loads asynchronously, falls back to procedural track on error */}
      <GLBErrorBoundary fallback={<Track weather={weather} />}>
        <Suspense fallback={<SuzukaLoadingPlaceholder />}>
          <SuzukaModel />
          {/* Physics colliders always render regardless of GLB load state */}
          <SuzukaColliders />
          <SuzukaFinishLine />
          <SuzukaDust />
        </Suspense>
      </GLBErrorBoundary>

      {/* Secondary fill light */}
      <directionalLight position={[-30, 40, 30]} intensity={0.9} color="#fef3c7" />
      <spotLight position={[0, 25, 12]} angle={0.6} penumbra={0.8} intensity={1.2} color="#fffbeb" castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} />
    </group>
  );
}

// Pre-load the GLB model — but don't let it block rendering
try {
  useGLTF.preload('/models/tracks/suzuka/suzukibananini.glb');
} catch (e) {
  console.warn('[SuzukaTrack] GLB preload warning:', e);
}
