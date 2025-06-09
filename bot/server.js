import 'dotenv/config';
import express from 'express';
import bot from './bot.js';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import miningRoutes from './routes/mining.js';
import tasksRoutes from './routes/tasks.js';
import watchRoutes from './routes/watch.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const app = express();
app.use(express.json());
app.use('/api/mining', miningRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/watch', watchRoutes);

// Serve the built React app
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webappPath = path.join(__dirname, '../webapp/dist');

// Build the webapp if the compiled files are missing
if (!existsSync(path.join(webappPath, 'index.html')) ||
    !existsSync(path.join(webappPath, 'assets'))) {
  try {
    console.log('Building webapp...');
    const webappDir = path.join(__dirname, '../webapp');
    execSync('npm install', { cwd: webappDir, stdio: 'inherit' });
    execSync('npm run build', { cwd: webappDir, stdio: 'inherit' });
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

// Support client-side routing by returning index.html for other paths
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).end();
  res.sendFile(path.join(webappPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;

async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri === 'memory') {
    const mongod = await MongoMemoryServer.create();
    const memUri = mongod.getUri();
    console.log(`Using in-memory MongoDB at ${memUri}`);
    await mongoose.connect(memUri);
  } else {
    await mongoose.connect(uri);
  }
  console.log('Connected to MongoDB');
}

connectMongo().catch((err) =>
  console.error('MongoDB connection error', err)
);

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
