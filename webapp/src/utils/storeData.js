// Unverified legacy treasury is disabled; no replacement is approved.
export const STORE_ADDRESS = null;

export const STORE_CATEGORIES = [
  'Bundles',
  'Spin & Win',
  'Virtual Friends',
  'Bonus Bundles'
];

export const STORE_BUNDLES = [
  { id: 'newbie', name: 'Newbie Pack', icon: '🌱', tpc: 20000, ton: 0.2, boost: 0, category: 'Bundles' },
  { id: 'rookie', name: 'Rookie', icon: '🎯', tpc: 40000, ton: 0.35, boost: 0, category: 'Bundles' },
  { id: 'starter', name: 'Starter', icon: '🚀', tpc: 80000, ton: 0.6, boost: 0, category: 'Bundles' },
  { id: 'miner', name: 'Miner Pack', icon: '⛏️', tpc: 160000, ton: 1.2, boost: 0.03, category: 'Bundles' },
  { id: 'grinder', name: 'Grinder', icon: '⚙️', tpc: 300000, ton: 2.0, boost: 0.05, category: 'Bundles' },
  { id: 'pro', name: 'Pro Bundle', icon: '🏆', tpc: 600000, ton: 3.8, boost: 0.08, category: 'Bundles' },
  { id: 'whale', name: 'Whale Bundle', icon: '🐋', tpc: 1600000, ton: 9.0, boost: 0.12, category: 'Bundles' },
  { id: 'max', name: 'Max Bundle', icon: '👑', tpc: 3200000, ton: 18.0, boost: 0.15, category: 'Bundles' },

  // Spin & Win Bundles
  { id: 'luckyStarter', name: 'Lucky Starter', icon: '🎁', tpc: 2400, ton: 0.15, spins: 3, category: 'Spin & Win' },
  { id: 'spinx3', name: 'Spin x3 Pack', icon: '🔁', tpc: 4800, ton: 0.25, spins: 5, category: 'Spin & Win' },
  { id: 'megaSpin', name: 'Mega Spin Pack', icon: '💎', tpc: 12000, ton: 0.7, spins: 15, category: 'Spin & Win' },

  // Virtual Friends (Mining Boosters)
  { id: 'lazyLarry', name: 'Lazy Larry', icon: '🐣', tpc: 0, ton: 0.1, boost: 0.25, duration: 7, category: 'Virtual Friends' },
  { id: 'smartSia', name: 'Smart Sia', icon: '🧠', tpc: 0, ton: 0.2, boost: 0.5, duration: 7, category: 'Virtual Friends' },
  { id: 'grindBot', name: 'GrindBot3000', icon: '🤖', tpc: 0, ton: 0.5, boost: 1.25, duration: 14, category: 'Virtual Friends' },

  // Bonus Bundles
  { id: 'powerPack', name: 'Power Pack', icon: '⚡', tpc: 4000, ton: 0.25, boost: 0.5, duration: 3, category: 'Bonus Bundles' },
  { id: 'proPack', name: 'Pro Pack', icon: '🎯', tpc: 10000, ton: 0.4, spins: 3, boost: 0.5, duration: 7, category: 'Bonus Bundles' },
  { id: 'galaxyPack', name: 'Galaxy Pack', icon: '🚀', tpc: 24000, ton: 1.0, spins: 5, boost: 1.25, duration: 7, category: 'Bonus Bundles' }
];
