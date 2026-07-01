'use client';

import React, { Suspense, useRef, useEffect, Component, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Sky, Environment } from '@react-three/drei';
import Track from '../entities/Track';
import SuzukaTrack from '../entities/SuzukaTrack';
import TrackItems from '../entities/TrackItems';
import VehicleController from '../physics/VehicleController';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import * as THREE from 'three';

// ─── Error Boundary: prevents any child error from collapsing the canvas ───
interface ErrorBoundaryState { hasError: boolean; error?: string }
class SceneErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, ErrorBoundaryState> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error('[PalmPivot] Scene error caught by boundary:', error.message);
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('[PalmPivot] Scene render error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

// ─── Tone Mapping and renderer config (runs inside Canvas context) ───
function RendererConfig() {
  const { gl, camera } = useThree();
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.15;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    // Ensure camera is set up correctly
    (camera as THREE.PerspectiveCamera).near = 0.1;
    (camera as THREE.PerspectiveCamera).far = 3000;
    camera.updateProjectionMatrix();
  }, [gl, camera]);
  return null;
}

// ─── Axis Helper so we can confirm the scene is actually rendering ───
function SceneOriginMarker() {
  // Invisible in production but confirms the scene graph is alive
  return (
    <mesh position={[0, 0.1, 0]} visible={false}>
      <sphereGeometry args={[0.5, 8, 8]} />
      <meshBasicMaterial color="red" />
    </mesh>
  );
}

// ─── Dynamic Real-Time Shadow Sun ───
function DynamicSun() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetObj = useRef(new THREE.Object3D());
  const playerPosition = useGameStore((s) => s.playerPosition);
  const { scene } = useThree();

  useEffect(() => {
    scene.add(targetObj.current);
    return () => { scene.remove(targetObj.current); };
  }, [scene]);

  useFrame(() => {
    const px = playerPosition[0];
    const pz = playerPosition[1];
    targetObj.current.position.set(px, 0, pz);
    if (lightRef.current) {
      lightRef.current.position.set(px + 80, 120, pz - 60);
      lightRef.current.target = targetObj.current;
      lightRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <directionalLight
      ref={lightRef}
      castShadow
      intensity={2.8}
      color="#fff8e7"
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-far={400}
      shadow-camera-left={-80}
      shadow-camera-right={80}
      shadow-camera-top={80}
      shadow-camera-bottom={-80}
      shadow-bias={-0.0003}
      shadow-normalBias={0.02}
    />
  );
}

// ─── Ground Plane (always present so scene isn't empty) ───
function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow>
      <planeGeometry args={[4000, 4000]} />
      <meshStandardMaterial color="#4a7c59" roughness={0.95} metalness={0.0} />
    </mesh>
  );
}

// ─── Distant Mountain Range ───
function MountainRange() {
  const mountains = [
    { pos: [400, 0, -600] as [number,number,number], r: 220, h: 250, color: '#6b8cba' },
    { pos: [-300, 0, -700] as [number,number,number], r: 180, h: 200, color: '#7a9bc8' },
    { pos: [700, 0, -400] as [number,number,number], r: 260, h: 280, color: '#5d7fa6' },
    { pos: [-500, 0, -500] as [number,number,number], r: 200, h: 220, color: '#6b8cba' },
    { pos: [150, 0, -800] as [number,number,number], r: 300, h: 180, color: '#8aa4c0' },
    { pos: [-700, 0, -300] as [number,number,number], r: 240, h: 230, color: '#6b8cba' },
  ];

  return (
    <group>
      {mountains.map((m, i) => (
        <group key={i}>
          <mesh position={[m.pos[0], m.h / 2, m.pos[2]]}>
            <coneGeometry args={[m.r, m.h, 7]} />
            <meshStandardMaterial color={m.color} roughness={0.9} metalness={0.0} />
          </mesh>
          <mesh position={[m.pos[0], m.h * 0.72, m.pos[2]]}>
            <coneGeometry args={[m.r * 0.28, m.h * 0.32, 7]} />
            <meshStandardMaterial color="#f0f8ff" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Rain particles ───
function RainParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = React.useMemo(() => {
    const arr = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500 * 3; i += 3) {
      arr[i] = (Math.random() - 0.5) * 200;
      arr[i + 1] = Math.random() * 60;
      arr[i + 2] = (Math.random() - 0.5) * 200;
    }
    return arr;
  }, []);
  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i);
      y -= delta * 40;
      if (y < 0) y = 60;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#a0d8ef" size={0.06} transparent opacity={0.55} />
    </points>
  );
}

// ─── Procedural fallback track (plain geometry, always renders) ───
function FallbackTrack() {
  return (
    <mesh position={[0, 0, 0]} receiveShadow>
      <boxGeometry args={[22, 0.4, 400]} />
      <meshStandardMaterial color="#3a3d45" roughness={0.85} metalness={0.02} />
    </mesh>
  );
}

// ─── Loading billboard (3D text in scene) ───
function LoadingBillboard({ text }: { text: string }) {
  return (
    <mesh position={[0, 3, -15]}>
      <boxGeometry args={[12, 2, 0.1]} />
      <meshStandardMaterial color="#1a1a2e" emissive="#00d4ff" emissiveIntensity={0.4} />
    </mesh>
  );
}

// ─── The main physics world (isolated so its Suspense doesn't block sky/ground) ───
function PhysicsWorld({ 
  currentTrack, 
  weather,
  paintColor,
  underglowColor,
}: { 
  currentTrack: string;
  weather: string;
  paintColor: string;
  underglowColor: string;
}) {
  const weatherVal = weather as 'sunny' | 'rain' | 'snow' | 'fog' | 'storm';

  return (
    <Physics gravity={[0, -28, 0]}>
      {/* Track: SuzukaTrack wraps itself in its own Suspense, falls back to FallbackTrack */}
      {currentTrack === 'suzuka' ? (
        <SceneErrorBoundary fallback={<Track weather={weatherVal} />}>
          <SuzukaTrack weather={weatherVal} />
        </SceneErrorBoundary>
      ) : (
        <Track weather={weatherVal} />
      )}

      {/* Arcade items */}
      <SceneErrorBoundary fallback={null}>
        <TrackItems />
      </SceneErrorBoundary>

      {/* Vehicle */}
      <SceneErrorBoundary fallback={null}>
        <VehicleController
          paintColor={paintColor}
          underglowColor={underglowColor}
          onCollision={() => {}}
        />
      </SceneErrorBoundary>
    </Physics>
  );
}

// ─── Storm Lightning Flash Simulator ───
function Lightning() {
  const [intensity, setIntensity] = React.useState(0);

  useFrame(() => {
    if (Math.random() > 0.985) {
      setIntensity(5.0);
    } else {
      setIntensity((prev) => Math.max(0, prev * 0.85));
    }
  });

  if (intensity === 0) return null;
  return <directionalLight intensity={intensity} color="#e8f0ff" position={[20, 120, 20]} />;
}

export default function GameCanvas() {
  const currentCar = useGameStore((s) => s.currentCar);
  const presets = useGameStore((s) => s.presets);
  const currentTrack = useGameStore((s) => s.currentTrack);
  const weather = useSettingsStore((s) => s.weather);

  const activeCarPreset = presets[currentCar] || {
    paint: '#1a56db',
    underglow: '#00ffcc'
  };

  // Sky parameters by weather
  const skyConfig = {
    sunny:  { turbidity: 4,  rayleigh: 0.8, mieCoefficient: 0.003, mieDirectionalG: 0.92, sunPosition: [100, 80, -100] as [number,number,number] },
    cloudy: { turbidity: 14, rayleigh: 2.0, mieCoefficient: 0.015, mieDirectionalG: 0.72, sunPosition: [60,  45, -60]  as [number,number,number] },
    sunset: { turbidity: 8,  rayleigh: 3.5, mieCoefficient: 0.01,  mieDirectionalG: 0.82, sunPosition: [90,  6,   -90]  as [number,number,number] },
    night:  { turbidity: 20, rayleigh: 5.0, mieCoefficient: 0.05,  mieDirectionalG: 0.4,  sunPosition: [10,  -60, -10]  as [number,number,number] },
    rain:   { turbidity: 14, rayleigh: 2.5, mieCoefficient: 0.02,  mieDirectionalG: 0.7,  sunPosition: [60,  30, -80]  as [number,number,number] },
    snow:   { turbidity: 10, rayleigh: 1.5, mieCoefficient: 0.01,  mieDirectionalG: 0.8,  sunPosition: [80,  50, -60]  as [number,number,number] },
    fog:    { turbidity: 20, rayleigh: 3.0, mieCoefficient: 0.04,  mieDirectionalG: 0.6,  sunPosition: [40,  20, -60]  as [number,number,number] },
    storm:  { turbidity: 25, rayleigh: 4.5, mieCoefficient: 0.05,  mieDirectionalG: 0.5,  sunPosition: [30,  15, -40]  as [number,number,number] },
  };
  const sky = skyConfig[weather as keyof typeof skyConfig] ?? skyConfig.sunny;

  // Ambient & hemisphere light colors and intensities matched to weather
  const ambientIntensity = weather === 'night' ? 0.35 : weather === 'storm' ? 0.55 : weather === 'fog' ? 0.9 : weather === 'sunset' ? 1.1 : 1.4;
  const ambientColor = weather === 'sunset' ? '#ffccaa' : weather === 'night' ? '#111530' : weather === 'storm' ? '#8899a8' : '#d4e8ff';
  const hemisphereIntensity = weather === 'night' ? 0.4 : weather === 'storm' ? 0.6 : 1.6;

  // Dynamic fog configuration based on weather
  let fogColor = '#c8e0f5';
  let fogNear = 500;
  let fogFar = 2500;

  if (weather === 'fog') {
    fogColor = '#c8d8e8';
    fogNear = 20;
    fogFar = 180;
  } else if (weather === 'night') {
    fogColor = '#050714';
    fogNear = 45;
    fogFar = 380;
  } else if (weather === 'storm') {
    fogColor = '#2b303a';
    fogNear = 35;
    fogFar = 280;
  } else if (weather === 'sunset') {
    fogColor = '#e8a080';
    fogNear = 120;
    fogFar = 1100;
  } else if (weather === 'rain' || weather === 'cloudy') {
    fogColor = '#a8b8c8';
    fogNear = 140;
    fogFar = 1400;
  }

  return (
    // !! Critical: explicit 100vw/100vh with absolute positioning ensures canvas fills viewport !!
    <div 
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      className="overflow-hidden"
    >
      <Canvas
        shadows
        camera={{ position: [0, 8, 20], fov: 72, near: 0.1, far: 3000 }}
        gl={{ 
          antialias: true, 
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false,
        }}
        dpr={[1, Math.min(window.devicePixelRatio, 2)]}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl }) => {
          // Force renderer to know the correct canvas size
          gl.setSize(window.innerWidth, window.innerHeight);
        }}
      >
        {/* Renderer configuration — runs inside Canvas */}
        <RendererConfig />

        {/* Confirms scene graph is alive even if all content fails */}
        <SceneOriginMarker />

        {/* ─── Sky (never suspends, always renders) ─── */}
        <Sky
          turbidity={sky.turbidity}
          rayleigh={sky.rayleigh}
          mieCoefficient={sky.mieCoefficient}
          mieDirectionalG={sky.mieDirectionalG}
          sunPosition={sky.sunPosition}
          distance={4500}
        />

        {/* ─── IBL Environment (isolated suspense — sky remains even if this fails) ─── */}
        <SceneErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <Environment preset="park" background={false} blur={0.8} />
          </Suspense>
        </SceneErrorBoundary>

        {/* ─── Lighting (never suspends) ─── */}
        <ambientLight intensity={ambientIntensity} color={ambientColor} />
        <hemisphereLight intensity={hemisphereIntensity} color="#87ceeb" groundColor="#6b8c5a" />
        <DynamicSun />
        {weather === 'storm' && <Lightning />}

        {/* ─── Atmospheric fog ─── */}
        <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

        {/* ─── Weather particles ─── */}
        {(weather === 'rain' || weather === 'storm') && <RainParticles />}

        {/* ─── Static environment (always renders, no asset dependencies) ─── */}
        <GroundPlane />
        <MountainRange />

        {/* ─── Physics world wrapped in isolated Suspense ─── */}
        {/* If it suspends, ground + sky + mountains remain visible */}
        <SceneErrorBoundary 
          fallback={
            <>
              <FallbackTrack />
              <LoadingBillboard text="Loading track..." />
            </>
          }
        >
          <Suspense 
            fallback={
              <>
                <FallbackTrack />
                <LoadingBillboard text="Loading..." />
              </>
            }
          >
            <PhysicsWorld
              currentTrack={currentTrack}
              weather={weather}
              paintColor={activeCarPreset.paint}
              underglowColor={activeCarPreset.underglow}
            />
          </Suspense>
        </SceneErrorBoundary>
      </Canvas>
    </div>
  );
}
