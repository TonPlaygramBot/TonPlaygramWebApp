import { Telegraf } from 'telegraf';


// Commands
import registerStart from './commands/start.js';
import registerMine from './commands/mine.js';
import registerWatch from './commands/watch.js';
import registerTasks from './commands/tasks.js';
import registerReferral from './commands/referral.js';
import registerWallet from './commands/wallet.js';
import registerLudo from './commands/games/ludo.js';
import registerHorse from './commands/games/horse.js';
const bot = new Telegraf(process.env.BOT_TOKEN);
registerStart(bot);
registerMine(bot);
registerWatch(bot);
registerTasks(bot);
registerReferral(bot);
registerWallet(bot);
registerLudo(bot);
registerHorse(bot);

export default bot;
