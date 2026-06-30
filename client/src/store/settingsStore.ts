import { create } from 'zustand';

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type CameraMode = 'thirdPerson' | 'farChase' | 'cockpit' | 'hood' | 'orbit' | 'replay';
export type HandMode = 'left' | 'right';
export type GameTheme = 'light' | 'dark';
export type GameWeather = 'sunny' | 'rain' | 'snow' | 'fog';
export type UIScale = 'normal' | 'large';

export interface SettingsState {
  graphicsQuality: GraphicsQuality;
  soundVolume: number; // 0 to 1
  musicVolume: number; // 0 to 1
  cameraMode: CameraMode;
  handMode: HandMode;
  gestureSensitivity: number; // 0.1 to 2.0
  autoAccelerate: boolean;
  highContrast: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  language: string;
  
  // Master upgrades states
  debugKeyboard: boolean;
  theme: GameTheme;
  weather: GameWeather;
  uiScale: UIScale;
  activeCameraId: string;
  
  // Actions
  setGraphicsQuality: (quality: GraphicsQuality) => void;
  setSoundVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setCameraMode: (mode: CameraMode) => void;
  setHandMode: (mode: HandMode) => void;
  setGestureSensitivity: (sensitivity: number) => void;
  setAutoAccelerate: (accel: boolean) => void;
  setHighContrast: (contrast: boolean) => void;
  setColorBlindMode: (mode: SettingsState['colorBlindMode']) => void;
  setLanguage: (lang: string) => void;
  
  setDebugKeyboard: (val: boolean) => void;
  setTheme: (theme: GameTheme) => void;
  setWeather: (weather: GameWeather) => void;
  setUiScale: (scale: UIScale) => void;
  setActiveCameraId: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  graphicsQuality: 'high',
  soundVolume: 0.8,
  musicVolume: 0.5,
  cameraMode: 'thirdPerson',
  handMode: 'right',
  gestureSensitivity: 1.0,
  autoAccelerate: false,
  highContrast: false,
  colorBlindMode: 'none',
  language: 'en',
  
  debugKeyboard: false,
  theme: 'light',  // Default to bright daytime racing
  weather: 'sunny',
  uiScale: 'normal',
  activeCameraId: '',

  setGraphicsQuality: (graphicsQuality) => set({ graphicsQuality }),
  setSoundVolume: (soundVolume) => set({ soundVolume }),
  setMusicVolume: (musicVolume) => set({ musicVolume }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setHandMode: (handMode) => set({ handMode }),
  setGestureSensitivity: (gestureSensitivity) => set({ gestureSensitivity }),
  setAutoAccelerate: (autoAccelerate) => set({ autoAccelerate }),
  setHighContrast: (highContrast) => set({ highContrast }),
  setColorBlindMode: (colorBlindMode) => set({ colorBlindMode }),
  setLanguage: (language) => set({ language }),
  
  setDebugKeyboard: (debugKeyboard) => set({ debugKeyboard }),
  setTheme: (theme) => set({ theme }),
  setWeather: (weather) => set({ weather }),
  setUiScale: (uiScale) => set({ uiScale }),
  setActiveCameraId: (activeCameraId) => set({ activeCameraId }),
}));
