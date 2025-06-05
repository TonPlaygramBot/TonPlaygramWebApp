import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN);

// Commands
import registerStart from './commands/start.js';
import registerMine from './commands/mine.js';
import registerWatch from './commands/watch.js';
import registerTasks from './commands/tasks.js';
import registerReferral from './commands/referral.js';
import registerWallet from './commands/wallet.js';
import registerDice from './commands/games/dice.js';
import registerLudo from './commands/games/ludo.js';
import registerHorse from './commands/games/horse.js';
import registerSnake from './commands/games/snake.js';

registerStart(bot);
registerMine(bot);
registerWatch(bot);
registerTasks(bot);
registerReferral(bot);
registerWallet(bot);
registerDice(bot);
registerLudo(bot);
registerHorse(bot);
registerSnake(bot);

export default bot;
