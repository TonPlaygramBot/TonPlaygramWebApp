export const STORE_ADDRESS = 'UQAPwsGyKzA4MuBnCflTVwEcTLcGS9yV6okJWQGzO5VxVYD1';

export const STORE_CATEGORIES = [
  'Presale',
  'Spin & Win',
  'Virtual Friends',
  'Bonus Bundles'
];

export const STORE_BUNDLES = [
  { id: 'newbie', name: 'Newbie Pack', icon: '🌱', tpc: 50000, ton: 0.2, boost: 0, category: 'Presale' },
  { id: 'rookie', name: 'Rookie', icon: '🎯', tpc: 100000, ton: 0.35, boost: 0, category: 'Presale' },
  { id: 'starter', name: 'Starter', icon: '🚀', tpc: 200000, ton: 0.6, boost: 0, category: 'Presale' },
  { id: 'miner', name: 'Miner Pack', icon: '⛏️', tpc: 400000, ton: 1.2, boost: 0.03, category: 'Presale' },
  { id: 'grinder', name: 'Grinder', icon: '⚙️', tpc: 750000, ton: 2.0, boost: 0.05, category: 'Presale' },
  { id: 'pro', name: 'Pro Bundle', icon: '🏆', tpc: 1500000, ton: 3.8, boost: 0.08, category: 'Presale' },
  { id: 'whale', name: 'Whale Bundle', icon: '🐋', tpc: 4000000, ton: 9.0, boost: 0.12, category: 'Presale' },
  { id: 'max', name: 'Max Presale', icon: '👑', tpc: 8000000, ton: 18.0, boost: 0.15, category: 'Presale' },

  // Spin & Win Bundles
  { id: 'luckyStarter', name: 'Lucky Starter', icon: '🎁', tpc: 6000, ton: 0.15, spins: 3, category: 'Spin & Win' },
  { id: 'spinx3', name: 'Spin x3 Pack', icon: '🔁', tpc: 12000, ton: 0.25, spins: 5, category: 'Spin & Win' },
  { id: 'megaSpin', name: 'Mega Spin Pack', icon: '💎', tpc: 30000, ton: 0.7, spins: 15, category: 'Spin & Win' },

  // Virtual Friends (Mining Boosters)
  { id: 'lazyLarry', name: 'Lazy Larry', icon: '🐣', tpc: 0, ton: 0.1, boost: 0.25, duration: 7, category: 'Virtual Friends' },
  { id: 'smartSia', name: 'Smart Sia', icon: '🧠', tpc: 0, ton: 0.2, boost: 0.5, duration: 7, category: 'Virtual Friends' },
  { id: 'grindBot', name: 'GrindBot3000', icon: '🤖', tpc: 0, ton: 0.5, boost: 1.25, duration: 14, category: 'Virtual Friends' },

  // Bonus Bundles
  { id: 'powerPack', name: 'Power Pack', icon: '⚡', tpc: 10000, ton: 0.25, boost: 0.5, duration: 3, category: 'Bonus Bundles' },
  { id: 'proPack', name: 'Pro Pack', icon: '🎯', tpc: 25000, ton: 0.4, spins: 3, boost: 0.5, duration: 7, category: 'Bonus Bundles' },
  { id: 'galaxyPack', name: 'Galaxy Pack', icon: '🚀', tpc: 60000, ton: 1.0, spins: 5, boost: 1.25, duration: 7, category: 'Bonus Bundles' }
];
