import 'dotenv/config';
import express from 'express';
import bot from './bot.js';
import mongoose from 'mongoose';
import miningRoutes from './routes/mining.js';
import tasksRoutes from './routes/tasks.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(express.json());
app.use('/api/mining', miningRoutes);
app.use('/api/tasks', tasksRoutes);

// Serve the built React app
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webappPath = path.join(__dirname, '../webapp/dist');
app.use(express.static(webappPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(webappPath, 'index.html'));
});

app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error', err));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  bot.launch();
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
