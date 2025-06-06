import { Telegraf } from 'telegraf';
import { HttpsProxyAgent } from 'https-proxy-agent';

const options = {};
const proxy = process.env.https_proxy || process.env.HTTPS_PROXY;
if (proxy) {
  options.telegram = { agent: new HttpsProxyAgent(proxy) };
}
const bot = new Telegraf(process.env.BOT_TOKEN, options);

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
