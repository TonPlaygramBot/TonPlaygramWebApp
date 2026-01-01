const gamesCatalog = [
  {
    slug: 'poolroyale-8-uk',
    name: 'Pool Royale · 8 Pool UK',
    category: 'Billiards',
    thumbnail: '/assets/icons/pool-royale.svg',
    tagline: 'Classic UK pub rules with quick races to the black and mobile-friendly aim assist.',
    lobbyRoute: '/games/poolroyale/lobby?variant=uk',
    playRoute: '/games/poolroyale?variant=uk',
    badge: 'New layout',
    stats: [
      { label: 'Modes', value: 'AI, Online, Tournament' },
      { label: 'Avg match', value: '4–6 min' },
      { label: 'Skill', value: 'Intermediate' }
    ],
    tags: ['8 Ball', 'Mobile aim', 'TPC stakes']
  },
  {
    slug: 'poolroyale-american',
    name: 'Pool Royale · American Billiards',
    category: 'Billiards',
    thumbnail: '/assets/icons/pool-royale.svg',
    tagline: 'Solids & stripes visuals with American pacing, powered by the Pool Royale physics.',
    lobbyRoute: '/games/poolroyale/lobby?variant=american',
    playRoute: '/games/poolroyale?variant=american',
    stats: [
      { label: 'Modes', value: 'AI & online' },
      { label: 'Pace', value: 'Fast breaks' },
      { label: 'Stake', value: 'TPC or free training' }
    ],
    tags: ['Solids & stripes', '1v1', 'Tournament ready']
  },
  {
    slug: 'poolroyale-9ball',
    name: 'Pool Royale · 9-Ball',
    category: 'Billiards',
    thumbnail: '/assets/icons/pool-royale.svg',
    tagline: '9-ball race with call-the-9 finishes and streamlined controls for touch players.',
    lobbyRoute: '/games/poolroyale/lobby?variant=9ball',
    playRoute: '/games/poolroyale?variant=9ball',
    stats: [
      { label: 'Modes', value: 'AI & online' },
      { label: 'Avg match', value: '3–5 min' },
      { label: 'Focus', value: 'Run-outs & safety' }
    ],
    tags: ['9-Ball', 'Speedy racks', 'Mobile friendly']
  },
  {
    slug: 'snooker-club',
    name: 'Snooker Club',
    category: 'Billiards',
    thumbnail: '/assets/icons/WhiteBall.webp',
    tagline: 'Precision snooker tables with atmospheric lighting and training-friendly pacing.',
    lobbyRoute: '/games/snookerclub/lobby',
    playRoute: '/games/snookerclub',
    stats: [
      { label: 'Modes', value: 'Practice & online' },
      { label: 'Table', value: 'Full & club sizes' },
      { label: 'Focus', value: 'Positional play' }
    ],
    tags: ['Snooker', 'Table control', 'Chalk system']
  },
  {
    slug: 'texas-holdem',
    name: "Texas Hold'em",
    category: 'Card',
    thumbnail: '/assets/icons/texas-holdem.svg',
    tagline: 'Sit-n-go poker with crisp chip animations and clean HUDs built for portrait play.',
    lobbyRoute: '/games/texasholdem/lobby',
    playRoute: '/games/texasholdem',
    stats: [
      { label: 'Modes', value: 'Cash & sit-n-go' },
      { label: 'Hands', value: 'Fast dealing' },
      { label: 'Stake', value: 'TPC blinds' }
    ],
    tags: ['Poker', 'Multiplayer', 'HUD lite']
  },
  {
    slug: 'domino-royal',
    name: 'Domino Royal 3D',
    category: 'Board',
    thumbnail: '/assets/icons/domino-royal.svg',
    tagline: 'Animated domino sets with smooth drag-and-drop and spectator-friendly cameras.',
    lobbyRoute: '/games/domino-royal/lobby',
    playRoute: '/games/domino-royal',
    stats: [
      { label: 'Modes', value: '1v1 & tables' },
      { label: 'Pace', value: 'Short rounds' },
      { label: 'Stake', value: 'TPC pots' }
    ],
    tags: ['Dominoes', 'Table games', 'Spectator view']
  },
  {
    slug: 'goal-rush',
    name: 'Goal Rush',
    category: 'Sports',
    thumbnail: '/assets/icons/goal_rush_card_1200x675.webp',
    tagline: 'Arcade free-kicks with curve control, live scoreboards, and quick rematches.',
    lobbyRoute: '/games/goalrush/lobby',
    playRoute: '/games/goalrush',
    stats: [
      { label: 'Modes', value: 'AI & PvP' },
      { label: 'Avg match', value: '90s drills' },
      { label: 'Focus', value: 'Curve & timing' }
    ],
    tags: ['Football', 'Skill shots', 'Quickplay']
  },
  {
    slug: 'air-hockey',
    name: 'Air Hockey',
    category: 'Arcade',
    thumbnail: '/assets/icons/ezgif-6ae76a227b5720.webp',
    tagline: 'Responsive mallet physics, glow trails, and tournament ladders sized for phones.',
    lobbyRoute: '/games/airhockey/lobby',
    playRoute: '/games/airhockey',
    stats: [
      { label: 'Modes', value: 'AI, Online, Tournament' },
      { label: 'Target', value: '11 / 21 / 31 goals' },
      { label: 'Pace', value: 'Ultra fast' }
    ],
    tags: ['Arcade', 'Physics', 'Glow FX']
  },
  {
    slug: 'snake-ladder',
    name: 'Snake & Ladder',
    category: 'Board',
    thumbnail: '/assets/icons/snakes_and_ladders.webp',
    tagline: 'Family-friendly races with animated dice, ladders, and an optional multiplayer room.',
    lobbyRoute: '/games/snake/lobby',
    playRoute: '/games/snake',
    stats: [
      { label: 'Modes', value: 'Solo & multiplayer' },
      { label: 'Length', value: '3–8 min' },
      { label: 'Focus', value: 'Luck & boosts' }
    ],
    tags: ['Casual', 'Board', 'Multiplayer']
  },
  {
    slug: 'chess-battle-royal',
    name: 'Chess Battle Royal',
    category: 'Board',
    thumbnail: '/assets/icons/WhiteBall.webp',
    tagline: 'Rapid chess arena with survival brackets and clean piece readability.',
    lobbyRoute: '/games/chessbattleroyal/lobby',
    playRoute: '/games/chessbattleroyal',
    stats: [
      { label: 'Modes', value: 'Arena & lobby' },
      { label: 'Clock', value: 'Blitz tempo' },
      { label: 'Focus', value: 'Tactics first' }
    ],
    tags: ['Chess', 'Tournament', 'Blitz']
  },
  {
    slug: 'ludo-battle-royal',
    name: 'Ludo Battle Royal',
    category: 'Board',
    thumbnail: '/assets/icons/tetris.svg',
    tagline: 'Colorful ludo with animated tokens, sudden-death finals, and mobile-safe dice zones.',
    lobbyRoute: '/games/ludobattleroyal/lobby',
    playRoute: '/games/ludobattleroyal',
    stats: [
      { label: 'Modes', value: 'Quickplay & brackets' },
      { label: 'Avg match', value: '5–10 min' },
      { label: 'Players', value: '2–4' }
    ],
    tags: ['Casual', 'Party', 'Board']
  },
  {
    slug: 'murlan-royale',
    name: 'Murlan Royale',
    category: 'Card',
    thumbnail: '/assets/icons/murlan-royale.svg',
    tagline: 'Dynamic card ladders with crisp combos, emojis, and quick rematch prompts.',
    lobbyRoute: '/games/murlanroyale/lobby',
    playRoute: '/games/murlanroyale',
    stats: [
      { label: 'Modes', value: '1v1 & rooms' },
      { label: 'Pace', value: 'Combo-driven' },
      { label: 'Stake', value: 'Friendly or TPC' }
    ],
    tags: ['Cards', 'Combos', 'Multiplayer']
  }
];

export default gamesCatalog;

export const catalogWithSlugs = gamesCatalog.map((game) => ({
  ...game,
  slug: game.slug,
}));
