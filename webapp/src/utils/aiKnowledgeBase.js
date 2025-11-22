export const SAFE_CONTEXT = `
TonPlaygram is a crypto gaming super-app with daily mining, an in-app wallet,
multiplayer games (Pool Royale, Goal Rush, Free Kick, Snake & Ladder, chess and
others) plus referral and tasks flows. Balances for TPC are tracked off-chain in
the app while TON balances use TonConnect. The codebase is split into a Telegram
bot/API (./bot) and a React webapp (./webapp/src) with feature pages for mining,
wallet, games, store, referrals and account. Frontend routes live in
webapp/src/pages, shared UI in webapp/src/components and API helpers in
webapp/src/utils/api.js. Environment secrets such as mnemonics, API tokens and
private keys are never exposed in the UI and must not be shared.`;

export const KNOWLEDGE_BASE = [
  {
    id: 'overview',
    keywords: ['overview', 'what is', 'platform', 'tonplaygram', 'info'],
    answer:
      'TonPlaygram combines a daily TPC mining loop, casual and competitive games, a wallet that supports TON via TonConnect and off-chain TPC balances, plus referral bonuses and store bundles. Users log in with Telegram (and optionally Google) to keep their profile, balances and game progress tied to their account.'
  },
  {
    id: 'mining',
    keywords: ['mining', 'hash', 'claim', 'speed', 'boost'],
    answer:
      'Mining lets you accumulate TPC over time. Start or stop sessions from the Mining page and claim to move mined TPC into your wallet balance. Speed is influenced by boosts and active status; transactions are recorded under /mining/transactions.'
  },
  {
    id: 'wallet',
    keywords: ['wallet', 'send', 'receive', 'tpc', 'ton'],
    answer:
      'The Wallet page splits TON and TPC. You connect TON via TonConnect (TonConnectButton in the header). TPC transfers happen inside the app: choose Send or Receive from the wallet card on Home to move balances between users. The wallet view also lists recent transfers and mining claims.'
  },
  {
    id: 'games',
    keywords: ['game', 'pool', 'goal rush', 'free kick', 'snake', 'lobby'],
    answer:
      'Games are launched from /games and individual lobby routes like /games/poolroyale/lobby or /games/goalrush/lobby. Titles include Pool Royale, Goal Rush, Free Kick, table tennis, air hockey, chess, ludo, domino and others. Most games support multiplayer lobby setup before starting a match.'
  },
  {
    id: 'referral',
    keywords: ['referral', 'invite', 'bonus', 'friends'],
    answer:
      'The Referral page provides your invite link or code. When friends join through your referral, both you and the new user receive TPC bonuses. Progress is shown alongside tasks and achievements so you can track rewards.'
  },
  {
    id: 'tasks',
    keywords: ['tasks', 'achievements', 'daily', 'check in'],
    answer:
      'Daily check-ins, social quests and seasonal achievements live in the Tasks and Project Achievements cards on Home. Completing them grants TPC or cosmetic rewards; the DailyCheckIn component handles the streak UI.'
  },
  {
    id: 'code-access',
    keywords: ['code', 'repository', 'source', 'structure', 'files', 'develop'],
    answer:
      'Non-sensitive source code is available throughout the repo. Frontend React views are under webapp/src/pages with shared widgets in webapp/src/components. API calls are centralized in webapp/src/utils/api.js. Game-specific logic sits under webapp/public for canvas-based titles and under webapp/src/pages/Games for lobby wrappers. Keep secrets in .env files; the webapp never exposes mnemonics or private keys.'
  }
];

const SENSITIVE_PATTERNS = [
  'mnemonic',
  'seed phrase',
  'private key',
  'password',
  'secret',
  'token',
  '.env',
  'credential'
];

export function detectSensitiveRequest(text = '') {
  const lower = text.toLowerCase();
  return SENSITIVE_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function findKnowledgeMatch(question = '') {
  const lower = question.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const entry of KNOWLEDGE_BASE) {
    const score = entry.keywords.reduce(
      (count, keyword) => count + (lower.includes(keyword) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return { match: bestMatch, score: bestScore };
}
