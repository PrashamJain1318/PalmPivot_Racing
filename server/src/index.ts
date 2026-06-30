import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import leaderboardRouter from './routes/leaderboard';
import garageRouter from './routes/garage';
import { initGameSockets } from './sockets/gameSocket';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // For development flexibility
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-guest-username']
}));
app.use(express.json());

// Rate limiting to secure API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', apiLimiter);

// Connect to Database
connectDB().then(() => {
  console.log('📦 Database initialized.');
});

// Mount Routes
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/garage', garageRouter);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Initialize Socket.io Game Telemetry
initGameSockets(io);

// Start listening
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 GestureDrive Server is roaring on port ${PORT}`);
});
