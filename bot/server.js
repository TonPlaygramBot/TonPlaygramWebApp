import 'dotenv/config';
import express from 'express';
import bot from './bot.js';
import mongoose from 'mongoose';
import miningRoutes from './routes/mining.js';

const app = express();
app.use(express.json());
app.use('/api/mining', miningRoutes);

app.get('/', (req, res) => {
  res.send('TonPlaygram Bot running');
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
