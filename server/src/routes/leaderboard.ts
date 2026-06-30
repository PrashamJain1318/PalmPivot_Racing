import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../config/clerk';
import { isLocalFallback, getMockDb, saveMockDb } from '../config/db';
import mongoose from 'mongoose';

const router = Router();

// Mongoose schema for production MongoDB
const LeaderboardSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  country: { type: String, default: 'Global' },
  score: { type: Number, required: true },
  trackId: { type: String, required: true },
  time: { type: Number, required: true }, // duration in ms
  carId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const LeaderboardModel = mongoose.models.Leaderboard || mongoose.model('Leaderboard', LeaderboardSchema);

// GET leaderboard entries
router.get('/:trackId', async (req, res) => {
  const { trackId } = req.params;
  const limit = parseInt(req.query.limit as string) || 10;
  const country = req.query.country as string;

  if (isLocalFallback()) {
    const db = getMockDb();
    let entries = db.leaderboard.filter(e => e.trackId === trackId);
    if (country && country !== 'Global') {
      entries = entries.filter(e => e.country === country);
    }
    entries.sort((a, b) => a.time - b.time); // ASC order (faster time is better)
    return res.json(entries.slice(0, limit));
  }

  try {
    const query: any = { trackId };
    if (country && country !== 'Global') {
      query.country = country;
    }
    const entries = await LeaderboardModel.find(query)
      .sort({ time: 1 })
      .limit(limit);
    return res.json(entries);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

// POST a new run score/time (requires authentication)
router.post('/:trackId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { trackId } = req.params;
  const { time, score, carId, country } = req.body;
  const user = req.user!;

  if (!time || !score || !carId) {
    return res.status(400).json({ error: 'Missing run details: time, score, and carId are required.' });
  }

  const newEntry = {
    userId: user.id,
    username: user.username,
    country: country || 'Global',
    score: Number(score),
    trackId,
    time: Number(time),
    carId,
    createdAt: new Date().toISOString()
  };

  if (isLocalFallback()) {
    const db = getMockDb();
    db.leaderboard.push(newEntry);
    saveMockDb({ leaderboard: db.leaderboard });
    return res.status(201).json({ message: 'Score saved to local DB.', entry: newEntry });
  }

  try {
    const entry = new LeaderboardModel(newEntry);
    await entry.save();
    return res.status(201).json({ message: 'Score saved to MongoDB.', entry });
  } catch (error) {
    console.error('Error saving score:', error);
    return res.status(500).json({ error: 'Failed to save score.' });
  }
});

export default router;
export { LeaderboardModel };
