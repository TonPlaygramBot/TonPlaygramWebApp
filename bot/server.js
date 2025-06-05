import 'dotenv/config';
import express from 'express';
import bot from './bot.js';

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('TonPlaygram Bot running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  bot.launch();
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
