'use client';

import React, { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ShowroomCarProps {
  paintColor: string;
  underglowColor: string;
}

function ShowroomCar({ paintColor, underglowColor }: ShowroomCarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const leftDoorRef = useRef<THREE.Mesh>(null);
  const rightDoorRef = useRef<THREE.Mesh>(null);
  
  const [hovered, setHovered] = useState(false);
  const doorAngle = useRef(0);

  // Slow rotation on showroom platform + hover suspension float
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.16;
      groupRef.current.position.y = 0.45 + Math.sin(state.clock.elapsedTime * 1.8) * 0.02;
    }

    const targetAngle = hovered ? Math.PI / 4.5 : 0;
    doorAngle.current = THREE.MathUtils.lerp(doorAngle.current, targetAngle, 0.08);
    
    if (leftDoorRef.current) leftDoorRef.current.rotation.z = -doorAngle.current;
    if (rightDoorRef.current) rightDoorRef.current.rotation.z = doorAngle.current;
  });

  return (
    <group 
      ref={groupRef} 
      position={[0, 0.45, 0]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Platform Stage */}
      <mesh position={[0, -0.45, 0]} receiveShadow>
        <cylinderGeometry args={[4.2, 4.4, 0.2, 32]} />
        <meshStandardMaterial color="#f3f4f6" roughness={0.1} metalness={0.9} />
      </mesh>
      
      {/* Gold Stage Rim */}
      <mesh position={[0, -0.34, 0]}>
        <cylinderGeometry args={[4.22, 4.22, 0.04, 32, 1, true]} />
        <meshBasicMaterial color="#ffd700" side={THREE.DoubleSide} />
      </mesh>

      {/* DETAILED WHITE SPORTS CAR BODY ASSEMBLY */}
      {/* 1. Carbon Splitter Bottom */}
      <mesh position={[0, -0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.12, 4.4]} />
        <meshStandardMaterial color="#2d3748" roughness={0.8} metalness={0.8} />
      </mesh>

      {/* 2. Main Body Chassis (Brilliant White Metallic Paint) */}
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.86, 0.42, 4.1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.03} metalness={0.95} />
      </mesh>

      {/* 3. Front Nose Splitter Slope (White Metallic) */}
      <mesh position={[0, -0.06, -1.8]} rotation={[-0.18, 0, 0]} castShadow>
        <boxGeometry args={[1.8, 0.24, 0.8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.03} metalness={0.95} />
      </mesh>

      {/* 4. Rear Engine Cover */}
      <mesh position={[0, 0.16, 1.4]} rotation={[0.08, 0, 0]} castShadow>
        <boxGeometry args={[1.76, 0.24, 1.2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.03} metalness={0.95} />
      </mesh>

      {/* 5. Scissor Door Left */}
      <mesh ref={leftDoorRef} position={[-0.93, 0.15, -0.2]} castShadow>
        <boxGeometry args={[0.08, 0.38, 1.3]} />
        <meshStandardMaterial color="#ffffff" roughness={0.03} metalness={0.95} />
      </mesh>

      {/* 6. Scissor Door Right */}
      <mesh ref={rightDoorRef} position={[0.93, 0.15, -0.2]} castShadow>
        <boxGeometry args={[0.08, 0.38, 1.3]} />
        <meshStandardMaterial color="#ffffff" roughness={0.03} metalness={0.95} />
      </mesh>

      {/* 7. Glass Canopy Cabin */}
      <mesh position={[0, 0.4, -0.3]} rotation={[-0.32, 0, 0]} castShadow>
        <boxGeometry args={[1.5, 0.44, 1.4]} />
        <meshStandardMaterial color="#e0f2fe" transparent opacity={0.65} roughness={0.0} metalness={0.95} />
      </mesh>

      {/* 8. Glowing Headlights */}
      <mesh position={[-0.72, -0.05, -2.15]}>
        <boxGeometry args={[0.26, 0.08, 0.08]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.72, -0.05, -2.15]}>
        <boxGeometry args={[0.26, 0.08, 0.08]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* 9. Glowing Tail Lights */}
      <mesh position={[-0.72, 0.12, 2.06]}>
        <boxGeometry args={[0.3, 0.06, 0.06]} />
        <meshBasicMaterial color="#ff2200" />
      </mesh>
      <mesh position={[0.72, 0.12, 2.06]}>
        <boxGeometry args={[0.3, 0.06, 0.06]} />
        <meshBasicMaterial color="#ff2200" />
      </mesh>

      {/* 10. Rear Wing Spoiler (Brilliant White) */}
      <group position={[0, 0.62, 1.7]}>
        <mesh castShadow>
          <boxGeometry args={[1.98, 0.06, 0.54]} />
          <meshStandardMaterial color="#ffffff" metalness={0.95} roughness={0.03} />
        </mesh>
        <mesh position={[-0.8, -0.28, 0]}>
          <boxGeometry args={[0.06, 0.56, 0.12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.8, -0.28, 0]}>
          <boxGeometry args={[0.06, 0.56, 0.12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* Underglow light projection */}
      <pointLight
        position={[0, -0.4, 0]}
        color={underglowColor}
        intensity={15.0}
        distance={6.0}
        decay={1.2}
      />

      {/* 11. Chrome Wheel Alloys & Tires */}
      <group position={[-0.96, -0.26, -1.25]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow><cylinderGeometry args={[0.45, 0.45, 0.38, 24]} /><meshStandardMaterial color="#1f2937" roughness={0.8} /></mesh>
        <mesh><cylinderGeometry args={[0.32, 0.32, 0.4, 16]} /><meshStandardMaterial color="#f3f4f6" metalness={0.99} roughness={0.02} /></mesh>
      </group>
      <group position={[0.96, -0.26, -1.25]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow><cylinderGeometry args={[0.45, 0.45, 0.38, 24]} /><meshStandardMaterial color="#1f2937" roughness={0.8} /></mesh>
        <mesh><cylinderGeometry args={[0.32, 0.32, 0.4, 16]} /><meshStandardMaterial color="#f3f4f6" metalness={0.99} roughness={0.02} /></mesh>
      </group>
      <group position={[-0.96, -0.26, 1.25]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow><cylinderGeometry args={[0.45, 0.45, 0.38, 24]} /><meshStandardMaterial color="#1f2937" roughness={0.8} /></mesh>
        <mesh><cylinderGeometry args={[0.32, 0.32, 0.4, 16]} /><meshStandardMaterial color="#f3f4f6" metalness={0.99} roughness={0.02} /></mesh>
      </group>
      <group position={[0.96, -0.26, 1.25]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow><cylinderGeometry args={[0.45, 0.45, 0.38, 24]} /><meshStandardMaterial color="#1f2937" roughness={0.8} /></mesh>
        <mesh><cylinderGeometry args={[0.32, 0.32, 0.4, 16]} /><meshStandardMaterial color="#f3f4f6" metalness={0.99} roughness={0.02} /></mesh>
      </group>
    </group>
  );
}

function InfiniteCoastalHighway() {
  const gridRef = useRef<THREE.GridHelper>(null);

  useFrame((state) => {
    if (gridRef.current) {
      gridRef.current.position.z = (state.clock.elapsedTime * 3.6) % 3.0;
    }
  });

  return (
    <group position={[0, -0.45, 0]}>
      {/* Light Concrete Road Surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 100]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Road Markers */}
      <gridHelper
        ref={gridRef}
        args={[40, 20, '#3b82f6', '#ffd700']}
        position={[0, 0.01, 0]}
      />
    </group>
  );
}

// Procedural Sapphire Ocean Water
function OceanWater() {
  const oceanRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (oceanRef.current) {
      oceanRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.12) * 0.015;
    }
  });

  return (
    <mesh ref={oceanRef} position={[0, -4.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial color="#1d4ed8" roughness={0.04} metalness={0.7} />
    </mesh>
  );
}

// Procedural Forest Mountains
function Mountains() {
  return (
    <group>
      {/* Left Coastal Cliff */}
      <mesh position={[-85, 12, -140]}>
        <coneGeometry args={[40, 80, 5]} />
        <meshStandardMaterial color="#2d6a4f" roughness={0.9} metalness={0.2} />
      </mesh>
      {/* Right Coastal Cliff */}
      <mesh position={[95, 18, -170]}>
        <coneGeometry args={[50, 100, 6]} />
        <meshStandardMaterial color="#2d6a4f" roughness={0.9} metalness={0.2} />
      </mesh>
    </group>
  );
}

// Drifting Clouds in Daytime Sky
function DriftingClouds() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.01;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[-50, 32, -100]}>
        <sphereGeometry args={[16, 12, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
      </mesh>
      <mesh position={[70, 40, -150]}>
        <sphereGeometry args={[22, 12, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

function InteractiveCamera() {
  useFrame((state) => {
    const targetX = state.pointer.x * 2.8;
    const targetY = 2.4 + state.pointer.y * 1.5;
    
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetX, 0.05);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, 0.05);
    state.camera.lookAt(0, 0.5, 0);
  });

  return null;
}

interface GarageShowroomProps {
  paintColor: string;
  underglowColor: string;
}

export default function GarageShowroom({ paintColor, underglowColor }: GarageShowroomProps) {
  return (
    <div className="w-full h-full bg-sky-200 relative">
      <Canvas
        shadows
        camera={{ position: [0, 2.5, 7.8], fov: 42 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#bae6fd']} />
        
        <ambientLight intensity={0.85} />
        
        {/* Warm Golden Midday Sun */}
        <directionalLight
          castShadow
          position={[35, 60, -25]}
          intensity={3.2}
          color="#fffbeb"
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        <Suspense fallback={null}>
          <ShowroomCar paintColor={paintColor} underglowColor={underglowColor} />
          <InfiniteCoastalHighway />
          <OceanWater />
          <Mountains />
          <DriftingClouds />
          <InteractiveCamera />
        </Suspense>
      </Canvas>
    </div>
  );
}
