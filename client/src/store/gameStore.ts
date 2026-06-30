import { create } from 'zustand';

export type GameStatus = 'menu' | 'garage' | 'calibration' | 'countdown' | 'playing' | 'paused' | 'gameover';

export interface PlayerCarPreset {
  paint: string;
  wrap: string;
  spoiler: string;
  rims: string;
  tyres: string;
  underglow: string;
  performance: {
    engine: number;
    suspension: number;
    turbo: number;
    nitro: number;
  };
}

export interface DailyChallenge {
  id: string;
  name: string;
  target: number;
  current: number;
  completed: boolean;
  reward: number;
}

export interface GameState {
  // Game Loop States
  status: GameStatus;
  currentTrack: string;
  currentCar: string;
  coins: number;
  diamonds: number;
  xp: number;
  level: number;
  xpToNextLevel: number;
  ownedCars: string[];
  presets: { [carId: string]: PlayerCarPreset };
  
  // Real-Time Vehicle Stats (from R3F/Rapier loop)
  speed: number; // km/h
  rpm: number;
  gear: number;
  nitroLevel: number; // 0 to 100
  nitroActive: boolean;
  lap: number;
  totalLaps: number;
  raceTime: number; // ms
  health: number; // 0 to 100
  combo: number;
  driftTime: number; // ms
  isDrifting: boolean;
  fps: number;
  checkpointIndex: number;
  
  // Arcade Gameplay Stats
  fuel: number; // 0 to 100
  coinsCollected: number;
  distance: number; // in meters
  score: number;
  scoreMultiplier: number;
  shieldActive: boolean;
  magnetActive: boolean;
  
  // Real-Time CV Gesture input
  handDetected: boolean;
  handConfidence: number;
  currentGesture: string; // 'neutral' | 'steer_left' | 'steer_right' | 'accelerate' | 'brake' | 'nitro' | 'handbrake' | 'horn' | 'pause' | 'reset_cam'
  steeringAngle: number; // normalized steering input -1 (full left) to +1 (full right)
  webcamFps: number;
  webcamLighting: number; // 0-100 index for lighting quality
  cameraPermission: 'prompt' | 'granted' | 'denied';
  playerPosition: [number, number]; // [x, z] for minimap
  
  // Upgrades features
  achievements: string[];
  dailyChallenges: DailyChallenge[];
  ghostReplayData: [number, number, number][]; // positions list
  
  // Actions
  setStatus: (status: GameStatus) => void;
  setTrack: (trackId: string) => void;
  setCar: (carId: string) => void;
  updateVehicleStats: (stats: Partial<Pick<GameState, 'speed' | 'rpm' | 'gear' | 'nitroLevel' | 'nitroActive' | 'lap' | 'raceTime' | 'health' | 'combo' | 'driftTime' | 'isDrifting' | 'playerPosition' | 'fuel' | 'coinsCollected' | 'distance' | 'score' | 'scoreMultiplier' | 'shieldActive' | 'magnetActive'>>) => void;
  updateGestureInput: (input: Partial<Pick<GameState, 'handDetected' | 'handConfidence' | 'currentGesture' | 'steeringAngle' | 'webcamFps' | 'webcamLighting' | 'cameraPermission'>>) => void;
  setCameraPermission: (perm: 'prompt' | 'granted' | 'denied') => void;
  addCoins: (amount: number) => void;
  addDiamonds: (amount: number) => void;
  addXp: (amount: number) => void;
  purchaseCar: (carId: string, cost: number, currency: 'coins' | 'diamonds') => boolean;
  saveCarPreset: (carId: string, preset: PlayerCarPreset) => void;
  unlockAchievement: (id: string) => void;
  updateChallengeProgress: (id: string, amount: number) => void;
  saveGhostReplay: (data: [number, number, number][]) => void;
  resetProgress: () => void;
  resetRaceStats: () => void;
}

const DEFAULT_PRESET: PlayerCarPreset = {
  paint: '#ff0055',
  wrap: 'none',
  spoiler: 'none',
  rims: 'classic',
  tyres: 'standard',
  underglow: '#00ffff',
  performance: {
    engine: 1,
    suspension: 1,
    turbo: 0,
    nitro: 1
  }
};

const DEFAULT_CHALLENGES: DailyChallenge[] = [
  { id: 'drift_challenge', name: 'Accumulate 8s Drift time', target: 8000, current: 0, completed: false, reward: 250 },
  { id: 'speed_challenge', name: 'Break 180 KM/H on grid', target: 180, current: 0, completed: false, reward: 150 },
  { id: 'finish_race', name: 'Complete 3 complete laps', target: 3, current: 0, completed: false, reward: 200 }
];

export const useGameStore = create<GameState>((set, get) => ({
  status: 'menu',
  currentTrack: 'track_1',
  currentCar: 'starter_car',
  coins: 1000,
  diamonds: 20,
  xp: 0,
  level: 1,
  xpToNextLevel: 1000,
  ownedCars: ['starter_car'],
  presets: {
    starter_car: { ...DEFAULT_PRESET }
  },

  speed: 0,
  rpm: 800,
  gear: 1,
  nitroLevel: 100,
  nitroActive: false,
  lap: 1,
  totalLaps: 3,
  raceTime: 0,
  health: 100,
  combo: 0,
  driftTime: 0,
  isDrifting: false,
  fps: 60,
  checkpointIndex: 0,

  fuel: 100,
  coinsCollected: 0,
  distance: 0,
  score: 0,
  scoreMultiplier: 1,
  shieldActive: false,
  magnetActive: false,

  handDetected: false,
  handConfidence: 0,
  currentGesture: 'neutral',
  steeringAngle: 0,
  webcamFps: 0,
  webcamLighting: 100,
  cameraPermission: 'prompt',
  playerPosition: [0, 0],

  achievements: [],
  dailyChallenges: [...DEFAULT_CHALLENGES],
  ghostReplayData: [],

  setStatus: (status) => set({ status }),
  setTrack: (currentTrack) => set({ currentTrack }),
  setCar: (currentCar) => set({ currentCar }),

  updateVehicleStats: (stats) => {
    set((state) => ({ ...state, ...stats }));
    
    // Check speed milestones for achievements/challenges dynamically
    if (stats.speed && stats.speed >= 200) {
      get().unlockAchievement('speed_demon');
    }
    if (stats.speed) {
      get().updateChallengeProgress('speed_challenge', stats.speed);
    }
    if (stats.driftTime) {
      get().updateChallengeProgress('drift_challenge', stats.driftTime);
    }
  },
  
  updateGestureInput: (input) => set((state) => ({ ...state, ...input })),
  setCameraPermission: (cameraPermission) => set({ cameraPermission }),

  addCoins: (amount) => set((state) => ({ coins: state.coins + amount })),
  addDiamonds: (amount) => set((state) => ({ diamonds: state.diamonds + amount })),
  
  addXp: (amount) => set((state) => {
    let newXp = state.xp + amount;
    let newLevel = state.level;
    let nextThreshold = state.xpToNextLevel;

    if (newXp >= nextThreshold) {
      newXp -= nextThreshold;
      newLevel += 1;
      nextThreshold = Math.round(nextThreshold * 1.5);
      
      // Level Up bonus coins/diamonds
      setTimeout(() => alert(`🎉 LEVEL UP! You reached Level ${newLevel}! Got 5 Diamonds bonus!`), 100);
      return {
        xp: newXp,
        level: newLevel,
        xpToNextLevel: nextThreshold,
        diamonds: state.diamonds + 5
      };
    }
    return { xp: newXp };
  }),

  purchaseCar: (carId, cost, currency) => {
    const state = get();
    if (state.ownedCars.includes(carId)) return false;
    const balance = state[currency];
    if (balance < cost) return false;

    set((s) => ({
      [currency]: balance - cost,
      ownedCars: [...s.ownedCars, carId],
      presets: {
        ...s.presets,
        [carId]: { ...DEFAULT_PRESET }
      }
    }));
    return true;
  },

  saveCarPreset: (carId, preset) => set((state) => ({
    presets: {
      ...state.presets,
      [carId]: preset
    }
  })),

  unlockAchievement: (id) => set((state) => {
    if (state.achievements.includes(id)) return {};
    setTimeout(() => alert(`🏆 ACHIEVEMENT UNLOCKED: ${id.replace('_', ' ').toUpperCase()}!`), 100);
    return {
      achievements: [...state.achievements, id],
      coins: state.coins + 300 // reward 300 coins
    };
  }),

  updateChallengeProgress: (id, amount) => set((state) => {
    const updated = state.dailyChallenges.map((ch) => {
      if (ch.id === id && !ch.completed) {
        let currentVal = ch.current;
        if (id === 'drift_challenge') {
          currentVal += amount; // accumulate drift durations
        } else {
          currentVal = Math.max(currentVal, amount); // maximum speed check
        }

        const isCompleted = currentVal >= ch.target;
        if (isCompleted) {
          setTimeout(() => alert(`🎯 CHALLENGE COMPLETED: ${ch.name}! +${ch.reward} Coins`), 100);
          return { ...ch, current: ch.target, completed: true, reward: ch.reward };
        }
        return { ...ch, current: currentVal };
      }
      return ch;
    });

    const rewardCoins = updated.reduce((sum, ch, idx) => {
      const oldCh = state.dailyChallenges[idx];
      if (ch.completed && !oldCh.completed) {
        return sum + ch.reward;
      }
      return sum;
    }, 0);

    return {
      dailyChallenges: updated,
      coins: state.coins + rewardCoins
    };
  }),

  saveGhostReplay: (ghostReplayData) => set({ ghostReplayData }),

  resetProgress: () => set({
    coins: 1000,
    diamonds: 20,
    xp: 0,
    level: 1,
    xpToNextLevel: 1000,
    ownedCars: ['starter_car'],
    presets: {
      starter_car: { ...DEFAULT_PRESET }
    },
    achievements: [],
    dailyChallenges: [...DEFAULT_CHALLENGES],
    ghostReplayData: [],
    status: 'menu',
    fuel: 100,
    coinsCollected: 0,
    distance: 0,
    score: 0,
    scoreMultiplier: 1,
    shieldActive: false,
    magnetActive: false
  }),

  resetRaceStats: () => set({
    speed: 0,
    rpm: 800,
    gear: 1,
    nitroLevel: 100,
    nitroActive: false,
    lap: 1,
    raceTime: 0,
    health: 100,
    combo: 0,
    driftTime: 0,
    isDrifting: false,
    checkpointIndex: 0,
    fuel: 100,
    coinsCollected: 0,
    distance: 0,
    score: 0,
    scoreMultiplier: 1,
    shieldActive: false,
    magnetActive: false
  })
}));
