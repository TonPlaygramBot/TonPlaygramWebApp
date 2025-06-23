import { Telegraf } from 'telegraf';
import { proxyAgent } from './utils/proxyAgent.js';


// Commands
import registerStart from './commands/start.js';
import registerMine from './commands/mine.js';
import registerWatch from './commands/watch.js';
import registerTasks from './commands/tasks.js';
import registerReferral from './commands/referral.js';
import registerWallet from './commands/wallet.js';
import registerGrid from './commands/games/grid.js';
import registerHorse from './commands/games/horse.js';
const bot = new Telegraf(process.env.BOT_TOKEN, {
  telegram: { agent: proxyAgent }
});
registerStart(bot);
registerMine(bot);
registerWatch(bot);
registerTasks(bot);
registerReferral(bot);
registerWallet(bot);
registerGrid(bot);
registerHorse(bot);

export default bot;
