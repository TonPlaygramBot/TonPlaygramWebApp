import dotenv from 'dotenv';
import express from 'express';
import bot from './bot.js';
import mongoose from 'mongoose';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import miningRoutes from './routes/mining.js';
import tasksRoutes from './routes/tasks.js';
import watchRoutes from './routes/watch.js';
import referralRoutes from './routes/referral.js';
import walletRoutes from './routes/wallet.js';
import profileRoutes from './routes/profile.js';
import User from './models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 3000;
const app = express();

// Middleware and routes
app.use(express.json());
app.use(passport.initialize());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/profile/google/callback'
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const user = await User.findOneAndUpdate(
          { telegramId: profile.id },
          {
            $set: { 'social.googleId': profile.id },
            $setOnInsert: { referralCode: profile.id.toString() }
          },
          { upsert: true, new: true }
        );
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);
app.use('/api/mining', miningRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/watch', watchRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/profile', profileRoutes);

// Serve the built React app
const webappPath = path.join(__dirname, '../webapp/dist');

if (
    !existsSync(path.join(webappPath, 'index.html')) ||
    !existsSync(path.join(webappPath, 'assets'))
) {
  try {
    console.log('Building webapp...');
    const webappDir = path.join(__dirname, '../webapp');
    execSync('npm install', { cwd: webappDir, stdio: 'inherit' });

    const apiBase = process.env.WEBAPP_API_BASE_URL || '';
    const displayBase = apiBase || '(same origin)';
    console.log(`Using API base URL ${displayBase} for webapp build`);

    execSync('npm run build', {
      cwd: webappDir,
      stdio: 'inherit',
      env: { ...process.env, VITE_API_BASE_URL: apiBase }
    });
  } catch (err) {
    console.error('Failed to build webapp:', err.message);
  }
}

app.use(express.static(webappPath));
app.get('/', (req, res) => {
  res.sendFile(path.join(webappPath, 'index.html'));
});
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).end();
  res.sendFile(path.join(webappPath, 'index.html'));
});

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI;

if (mongoUri) {
  mongoose
      .connect(mongoUri)
      .then(() => console.log('Connected to MongoDB'))
      .catch((err) => console.error('MongoDB connection error:', err));
} else {
  console.log('No MongoDB URI configured, continuing without database');
}

// Start the server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.SKIP_BOT_LAUNCH || !process.env.BOT_TOKEN) {
    console.log('Skipping Telegram bot launch');
    return;
  }

  try {
    await bot.launch();
  } catch (err) {
    console.error('Failed to launch Telegram bot:', err.message);
  }
});

if (!process.env.SKIP_BOT_LAUNCH && process.env.BOT_TOKEN) {
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
