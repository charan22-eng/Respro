import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import pulseRoutes from './routes/pulse.js';
import playbookRoutes from './routes/playbook.js';
import webhookRoutes from './routes/webhook.js';
import authRoutes from './routes/auth.js';
import collisionRoutes from './routes/collision.js';
import { startPolling } from './services/pollingService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: CLIENT_URL,
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

// Session middleware (before routes)
app.use(session({
  secret: process.env.SESSION_SECRET || 'projectpulse-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax',
    secure: false // set to true in production with HTTPS
  }
}));

// Routes
app.use('/api', authRoutes);
app.use('/api', pulseRoutes);
app.use('/api', playbookRoutes);
app.use('/api', webhookRoutes);
app.use('/api', collisionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR'
  });
});

const server = app.listen(PORT, () => {
  console.log(`ProjectPulse server running on http://localhost:${PORT}`);
  
  // Start background polling for real-time updates
  startPolling();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Error: Port ${PORT} is already in use.`);
    console.error(`Try one of these solutions:`);
    console.error(`  1. Stop the other process using port ${PORT}`);
    console.error(`  2. Set a different port: PORT=3002 npm run dev`);
    process.exit(1);
  } else {
    throw err;
  }
});
