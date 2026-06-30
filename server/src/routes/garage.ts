import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../config/clerk';
import { isLocalFallback, getMockDb, saveMockDb } from '../config/db';
import mongoose from 'mongoose';

const router = Router();

// Mongoose schema for production MongoDB
const GarageSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  ownedCars: { type: [String], default: ['starter_car'] },
  currentCar: { type: String, default: 'starter_car' },
  presets: {
    type: Map,
    of: {
      paint: { type: String, default: '#ff0055' },
      wrap: { type: String, default: 'none' },
      spoiler: { type: String, default: 'none' },
      rims: { type: String, default: 'classic' },
      tyres: { type: String, default: 'standard' },
      underglow: { type: String, default: '#00ffff' },
      performance: {
        engine: { type: Number, default: 1 },
        suspension: { type: Number, default: 1 },
        turbo: { type: Number, default: 0 },
        nitro: { type: Number, default: 1 }
      }
    },
    default: {}
  },
  coins: { type: Number, default: 500 },
  diamonds: { type: Number, default: 10 },
  xp: { type: Number, default: 0 }
});

const GarageModel = mongoose.models.Garage || mongoose.model('Garage', GarageSchema);

// Helper to get default preset for a car
const getDefaultPreset = () => ({
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
});

// GET player garage
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;

  if (isLocalFallback()) {
    const db = getMockDb();
    let garage = db.garage.find(g => g.userId === user.id);
    if (!garage) {
      garage = {
        userId: user.id,
        ownedCars: ['starter_car'],
        currentCar: 'starter_car',
        presets: { starter_car: getDefaultPreset() },
        coins: 1000,
        diamonds: 20,
        xp: 0
      };
      db.garage.push(garage);
      saveMockDb({ garage: db.garage });
    }
    return res.json(garage);
  }

  try {
    let garage = await GarageModel.findOne({ userId: user.id });
    if (!garage) {
      garage = new GarageModel({
        userId: user.id,
        presets: { starter_car: getDefaultPreset() }
      });
      await garage.save();
    }
    return res.json(garage);
  } catch (error) {
    console.error('Error fetching garage:', error);
    return res.status(500).json({ error: 'Failed to fetch garage.' });
  }
});

// POST update car customizations / presets
router.post('/save-preset', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { carId, preset } = req.body;

  if (!carId || !preset) {
    return res.status(400).json({ error: 'carId and preset data are required.' });
  }

  if (isLocalFallback()) {
    const db = getMockDb();
    let garage = db.garage.find(g => g.userId === user.id);
    if (!garage) {
      garage = {
        userId: user.id,
        ownedCars: ['starter_car', carId],
        currentCar: carId,
        presets: {},
        coins: 1000,
        diamonds: 20,
        xp: 0
      };
      db.garage.push(garage);
    }
    garage.presets[carId] = preset;
    garage.currentCar = carId;
    if (!garage.ownedCars.includes(carId)) {
      garage.ownedCars.push(carId);
    }
    saveMockDb({ garage: db.garage });
    return res.json({ message: 'Preset saved to local DB.', garage });
  }

  try {
    let garage = await GarageModel.findOne({ userId: user.id });
    if (!garage) {
      garage = new GarageModel({
        userId: user.id,
        presets: {}
      });
    }
    
    // Set preset map key
    garage.presets.set(carId, preset);
    garage.currentCar = carId;
    if (!garage.ownedCars.includes(carId)) {
      garage.ownedCars.push(carId);
    }
    
    await garage.save();
    return res.json({ message: 'Preset saved to MongoDB.', garage });
  } catch (error) {
    console.error('Error saving preset:', error);
    return res.status(500).json({ error: 'Failed to save preset.' });
  }
});

// POST purchase/unlock a car
router.post('/purchase', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { carId, cost, currency } = req.body; // currency = 'coins' | 'diamonds'

  if (!carId || cost === undefined || !currency) {
    return res.status(400).json({ error: 'carId, cost, and currency are required.' });
  }

  if (isLocalFallback()) {
    const db = getMockDb();
    let garage = db.garage.find(g => g.userId === user.id);
    if (!garage) {
      return res.status(404).json({ error: 'Garage not found.' });
    }

    const currentBalance = garage[currency] || 0;
    if (currentBalance < cost) {
      return res.status(400).json({ error: 'Insufficient funds.' });
    }

    if (garage.ownedCars.includes(carId)) {
      return res.status(400).json({ error: 'Car already owned.' });
    }

    garage[currency] -= cost;
    garage.ownedCars.push(carId);
    garage.presets[carId] = getDefaultPreset();
    saveMockDb({ garage: db.garage });
    return res.json({ message: 'Car purchased successfully.', garage });
  }

  try {
    let garage = await GarageModel.findOne({ userId: user.id });
    if (!garage) {
      return res.status(404).json({ error: 'Garage not found.' });
    }

    const currentBalance = garage.get(currency) || 0;
    if (currentBalance < cost) {
      return res.status(400).json({ error: 'Insufficient funds.' });
    }

    if (garage.ownedCars.includes(carId)) {
      return res.status(400).json({ error: 'Car already owned.' });
    }

    garage.set(currency, currentBalance - cost);
    garage.ownedCars.push(carId);
    garage.presets.set(carId, getDefaultPreset());
    
    await garage.save();
    return res.json({ message: 'Car purchased successfully.', garage });
  } catch (error) {
    console.error('Error purchasing car:', error);
    return res.status(500).json({ error: 'Failed to purchase car.' });
  }
});

export default router;
export { GarageModel };
