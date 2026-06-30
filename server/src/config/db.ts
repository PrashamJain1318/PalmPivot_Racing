import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const FALLBACK_DB_PATH = path.join(__dirname, '../../data/db_fallback.json');

export interface MockDatabase {
  users: any[];
  garage: any[];
  leaderboard: any[];
  challenges: any[];
}

let isFallbackMode = false;
let mockDbData: MockDatabase = {
  users: [],
  garage: [],
  leaderboard: [],
  challenges: []
};

// Ensure fallback DB directory and file exist
function initFallbackDb() {
  const dir = path.dirname(FALLBACK_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(FALLBACK_DB_PATH)) {
    fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(mockDbData, null, 2));
  } else {
    try {
      const content = fs.readFileSync(FALLBACK_DB_PATH, 'utf-8');
      mockDbData = JSON.parse(content);
    } catch (e) {
      console.error('Failed to read fallback DB, using fresh structure:', e);
      fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(mockDbData, null, 2));
    }
  }
}

export async function connectDB() {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.warn('⚠️ No MONGODB_URI found in environment variables. Switching to local JSON fallback database.');
    isFallbackMode = true;
    initFallbackDb();
    return;
  }

  try {
    await mongoose.connect(mongoURI);
    console.log('🔌 Connected to MongoDB Atlas successfully.');
  } catch (error) {
    console.error('❌ MongoDB Connection failed:', error);
    console.warn('⚠️ Falling back to local JSON database.');
    isFallbackMode = true;
    initFallbackDb();
  }
}

export function isLocalFallback() {
  return isFallbackMode;
}

export function getMockDb() {
  return mockDbData;
}

export function saveMockDb(data: Partial<MockDatabase>) {
  if (!isFallbackMode) return;
  mockDbData = { ...mockDbData, ...data };
  try {
    fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(mockDbData, null, 2));
  } catch (e) {
    console.error('Error writing fallback DB file:', e);
  }
}
