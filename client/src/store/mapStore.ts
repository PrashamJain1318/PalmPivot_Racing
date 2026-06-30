import { create } from 'zustand';

export interface TrackConfig {
  id: string;
  name: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert' | 'nightmare';
  distance: number; // KM
  estTime: string;
  weather: 'sunny' | 'rain' | 'snow' | 'fog' | 'storm';
  terrain: string;
  thumbnail: string;
  bestLap: number | null; // ms
  favorite: boolean;
}

interface MapState {
  tracks: TrackConfig[];
  searchQuery: string;
  selectedCategory: string;
  selectedDifficulty: string;
  selectedWeather: string;
  
  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  setSelectedDifficulty: (difficulty: string) => void;
  setSelectedWeather: (weather: string) => void;
  toggleFavorite: (id: string) => void;
  updateBestLap: (id: string, timeMs: number) => void;
}

// 20 Categories list
const CATEGORIES = [
  'City', 'Highway', 'Desert', 'Mountain', 'Snow', 'Forest', 'Beach', 'Canyon', 
  'Volcano', 'Jungle', 'Countryside', 'Cyberpunk', 'Space', 'Island', 'Rain', 
  'Night', 'Sunset', 'Sunrise', 'Ancient Ruins', 'Floating Islands'
];

const DIFFICULTIES: ('easy' | 'medium' | 'hard' | 'expert' | 'nightmare')[] = [
  'easy', 'medium', 'hard', 'expert', 'nightmare'
];

const WEATHERS: ('sunny' | 'rain' | 'snow' | 'fog' | 'storm')[] = [
  'sunny', 'rain', 'snow', 'fog', 'storm'
];

const TERRAINS = [
  'Asphalt Highway', 'Neon Grid Gridway', 'Packed Snow Ice', 'Sludge Mud Trail', 'Sand Dunes'
];

// Procedural 100 Tracks Seeder + Premium Circuits
const generateTracks = (): TrackConfig[] => {
  const list: TrackConfig[] = [];

  // ─── Premium Featured Circuit: Suzuka ───
  list.push({
    id: 'suzuka',
    name: 'Suzuka International Racing Course',
    category: 'Circuit',
    difficulty: 'expert',
    distance: 5.807,
    estTime: '02:10',
    weather: 'sunny',
    terrain: 'Asphalt Grand Prix',
    thumbnail: '/models/tracks/suzuka/textures/road01_255.png',
    bestLap: null,
    favorite: true
  });

  let idCounter = 1;

  CATEGORIES.forEach((cat) => {
    // Generate 5 tracks for each category (20 * 5 = 100 tracks)
    for (let i = 1; i <= 5; i++) {
      const distance = parseFloat((2.5 + Math.random() * 12.5).toFixed(1));
      const speedKmh = 120 + (i * 20);
      const estSeconds = Math.round((distance / speedKmh) * 3600);
      const estMin = Math.floor(estSeconds / 60);
      const estSec = estSeconds % 60;
      const estTime = `${estMin.toString().padStart(2, '0')}:${estSec.toString().padStart(2, '0')}`;

      const difficulty = DIFFICULTIES[(i - 1) % DIFFICULTIES.length];
      const weather = WEATHERS[(i - 1) % WEATHERS.length];
      const terrain = TERRAINS[(i - 1) % TERRAINS.length];

      list.push({
        id: `track_${idCounter}`,
        name: `${cat} Circuit ${'I'.repeat(i)}`,
        category: cat,
        difficulty,
        distance,
        estTime,
        weather,
        terrain,
        thumbnail: `/thumbnails/${cat.toLowerCase().replace(' ', '_')}_${i}.jpg`,
        bestLap: null,
        favorite: false
      });
      idCounter++;
    }
  });

  return list;
};

export const useMapStore = create<MapState>((set) => ({
  tracks: generateTracks(),
  searchQuery: '',
  selectedCategory: 'All',
  selectedDifficulty: 'All',
  selectedWeather: 'All',

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setSelectedDifficulty: (selectedDifficulty) => set({ selectedDifficulty }),
  setSelectedWeather: (selectedWeather) => set({ selectedWeather }),

  toggleFavorite: (id) => set((state) => ({
    tracks: state.tracks.map((t) => 
      t.id === id ? { ...t, favorite: !t.favorite } : t
    )
  })),

  updateBestLap: (id, timeMs) => set((state) => ({
    tracks: state.tracks.map((t) => 
      t.id === id ? { ...t, bestLap: t.bestLap === null ? timeMs : Math.min(t.bestLap, timeMs) } : t
    )
  }))
}));
