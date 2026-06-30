import * as THREE from 'three';

export interface TrackMaterialConfig {
  color: string;
  emissive: string;
  leftBarrier: string;
  rightBarrier: string;
}

const N_SEGMENTS = 40; // 40 panels form a smooth detailed loop

// ─── Suzuka International Racing Course ───
// 80 hand-crafted waypoints tracing the real figure-8 layout
// Scaled to ~300m radius for the game world (~5.8km real → ~1800m game perimeter)
// Origin = start/finish straight, facing +Z
const SUZUKA_WAYPOINTS: [number, number, number][] = [
  [500.00, -4.80, 350.00],
  [496.79, -2.35, 389.91],
  [481.81, -4.53, 453.12],
  [481.81, -6.71, 518.90],
  [485.97, -8.94, 588.25],
  [495.15, -11.31, 659.07],
  [506.16, -13.37, 720.62],
  [504.94, -15.37, 779.85],
  [505.31, -17.40, 839.56],
  [498.47, -18.64, 871.29],
  [484.88, -21.28, 933.04],
  [443.02, -22.29, 982.82],
  [378.05, -21.42, 998.44],
  [335.27, -19.69, 957.94],
  [340.59, -18.34, 898.29],
  [347.28, -17.26, 824.53],
  [356.21, -16.15, 763.26],
  [331.18, -14.64, 707.85],
  [300.57, -13.28, 685.77],
  [275.70, -9.93, 630.05],
  [298.54, -6.37, 572.09],
  [324.60, -2.10, 510.13],
  [299.39, 1.11, 451.93],
  [243.93, 3.76, 402.90],
  [229.20, 4.26, 344.94],
  [257.83, 2.18, 288.64],
  [315.66, 1.92, 255.45],
  [343.49, 4.28, 238.08],
  [369.64, 10.26, 180.28],
  [346.72, 15.35, 119.17],
  [312.23, 18.06, 62.28],
  [256.53, 18.77, 26.15],
  [194.96, 17.99, -0.09],
  [135.95, 18.31, -29.88],
  [88.31, 19.14, -69.56],
  [14.92, 18.00, -59.26],
  [-14.95, 17.85, -58.38],
  [-79.17, 17.42, -84.75],
  [-128.86, 17.22, -124.74],
  [-161.03, 16.81, -181.31],
  [-193.93, 16.81, -240.40],
  [-226.77, 16.81, -298.77],
  [-259.62, 16.81, -357.38],
  [-291.95, 16.81, -413.29],
  [-338.08, 16.79, -457.20],
  [-358.08, 16.41, -481.84],
  [-391.58, 14.93, -539.89],
  [-415.82, 13.14, -601.32],
  [-443.37, 11.05, -666.09],
  [-464.41, 10.09, -735.37],
  [-488.35, 11.49, -799.20],
  [-497.59, 16.38, -869.80],
  [-502.29, 22.14, -935.00],
  [-476.00, 25.74, -999.92],
  [-435.74, 25.53, -1003.88],
  [-373.74, 25.55, -976.52],
  [-332.79, 25.63, -929.56],
  [-343.33, 25.77, -869.29],
  [-359.49, 25.59, -809.67],
  [-382.61, 24.41, -742.67],
  [-385.12, 21.98, -674.80],
  [-364.80, 19.60, -613.68],
  [-334.29, 19.01, -551.74],
  [-317.01, 19.71, -521.33],
  [-283.07, 22.75, -466.77],
  [-228.39, 25.01, -430.37],
  [-166.31, 25.13, -400.33],
  [-105.10, 24.92, -393.06],
  [-43.94, 24.46, -415.86],
  [21.50, 23.99, -442.81],
  [84.50, 23.85, -445.04],
  [57.68, 21.93, -395.38],
  [27.13, 19.77, -380.52],
  [-30.67, 15.75, -346.19],
  [-64.32, 12.78, -286.91],
  [-95.33, 10.36, -227.85],
  [-125.86, 9.43, -168.54],
  [-156.40, 9.13, -111.09],
  [-175.17, 10.35, -49.59],
  [-120.00, 11.95, -14.40]
]

export function getSuzukaWaypoints(): THREE.Vector3[] {
  return SUZUKA_WAYPOINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
}

export function getProceduralTrackPoints(trackId: string): THREE.Vector3[] {
  // ─── Special case: Suzuka Circuit uses hand-crafted waypoints ───
  if (trackId === 'suzuka') {
    return getSuzukaWaypoints();
  }

  // Extract number from track ID (e.g. track_15 -> 15, default to 1)
  const num = parseInt(trackId.replace(/^\D+/g, ''), 10);
  const seed = isNaN(num) ? 1 : num;

  const lcg = (s: number) => {
    let state = s;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  };

  const rand = lcg(seed);
  // Scale size based on seed (140 to 260 meters)
  const scale = 140 + (seed % 5) * 30;

  // Track loop shape harmonics parameters
  const xAmp1 = 1.0 + rand() * 0.35;
  const xAmp2 = 0.18 + rand() * 0.38;
  const zAmp1 = 1.0 + rand() * 0.35;
  const zAmp2 = 0.18 + rand() * 0.38;
  
  const xFreq = Math.floor(rand() * 2) + 2; // 2 or 3
  const zFreq = Math.floor(rand() * 2) + 1; // 1 or 2

  const rawPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= N_SEGMENTS; i++) {
    const t = (i / N_SEGMENTS) * 2 * Math.PI;
    const x = (Math.sin(t) * xAmp1 + Math.cos(t * xFreq) * xAmp2) * scale;
    const z = (Math.cos(t) * zAmp1 + Math.sin(t * zFreq) * zAmp2) * scale;
    rawPoints.push(new THREE.Vector3(x, 0, z));
  }

  // Shift track loop coordinates so P0 is exactly at [0, 0, 0]
  const P0 = rawPoints[0].clone();
  rawPoints.forEach((p) => p.sub(P0));

  // Rotate entire loop so the first segment points forward (along Z axis)
  const P1 = rawPoints[1];
  const startHeading = Math.atan2(P1.x, P1.z);
  const rotationDiff = -startHeading;

  const cos = Math.cos(rotationDiff);
  const sin = Math.sin(rotationDiff);

  return rawPoints.map((p) => {
    const rx = p.x * cos - p.z * sin;
    const rz = p.x * sin + p.z * cos;
    return new THREE.Vector3(rx, 0, rz);
  });
}

export function getTrackMaterialConfig(category: string, isLight: boolean): TrackMaterialConfig {
  switch (category) {
    case 'City':
    case 'Countryside':
    case 'Highway':
      return {
        color: isLight ? '#475569' : '#1a1a2e',
        emissive: isLight ? '#0f172a' : '#0c001c',
        leftBarrier: '#00f0ff',
        rightBarrier: '#ff0055'
      };
    case 'Desert':
    case 'Canyon':
      return {
        color: '#6e3e15',
        emissive: '#2e1201',
        leftBarrier: '#ff8800',
        rightBarrier: '#ffaa00'
      };
    case 'Snow':
    case 'Mountain':
      return {
        color: '#cbd5e1',
        emissive: '#1e293b',
        leftBarrier: '#38bdf8',
        rightBarrier: '#ec4899'
      };
    case 'Cyberpunk':
    case 'Floating Islands':
    case 'Night':
      return {
        color: '#070114',
        emissive: '#020005',
        leftBarrier: '#a855f7',
        rightBarrier: '#f43f5e'
      };
    case 'Space':
      return {
        color: '#020617',
        emissive: '#000000',
        leftBarrier: '#06b6d4',
        rightBarrier: '#10b981'
      };
    case 'Circuit':
      return {
        color: isLight ? '#4b5563' : '#1e293b',
        emissive: isLight ? '#111827' : '#0f172a',
        leftBarrier: '#ef4444',
        rightBarrier: '#ffffff'
      };
    case 'Forest':
    case 'Jungle':
    case 'Island':
    case 'Beach':
    default:
      return {
        color: '#064e3b',
        emissive: '#022c22',
        leftBarrier: '#10b981',
        rightBarrier: '#3b82f6'
      };
  }
}

