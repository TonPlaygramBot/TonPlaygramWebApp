const gamesCatalog = [
  {
    name: 'Pool Royale',
    slug: 'poolroyale',
    route: '/games/poolroyale/lobby',
    icon: '/assets/icons/pool-royale.svg',
    genre: 'Cue sports • 1v1 / tournaments',
    summary: 'Three billiards rule-sets with precision physics, touch-friendly aim and optional stakes.',
    meta: [
      { label: 'Modes', value: 'AI, Online, Tournament' },
      { label: 'Average rack', value: '5–7 minutes' },
      { label: 'Variants', value: '8 Pool UK, American, 9-Ball' }
    ],
    features: [
      'TPC escrow for online stakes with anti-tilt timers.',
      'Training tables, cloth presets, and cue personalization.',
      'Supports left/right handed cueing with auto camera assist.'
    ]
  },
  {
    name: "Texas Hold'em",
    slug: 'texasholdem',
    route: '/games/texasholdem/lobby',
    icon: '/assets/icons/texas-holdem.svg',
    genre: 'Cards • 2-6 players',
    summary: 'Fast-paced poker with sit & go style stacks and table cosmetics.',
    meta: [
      { label: 'Stakes', value: 'TPC blinds or practice chips' },
      { label: 'Playstyle', value: 'Turbo hands, emoji tells' }
    ],
    features: [
      'Supports avatars and emotes per hand.',
      'Table selector keeps lobbies balanced by blinds.',
      'Designed for portrait play with one-hand controls.'
    ]
  },
  {
    name: 'Domino Royal 3D',
    slug: 'domino-royal',
    route: '/games/domino-royal/lobby',
    icon: '/assets/icons/domino-royal.svg',
    genre: 'Board • Up to 4 players',
    summary: 'Immersive double-six domino tables with local, AI, and online seats.',
    meta: [
      { label: 'Pot', value: 'Up to TPC stake you set' },
      { label: 'Modes', value: 'Local pass & play, AI, Online' }
    ],
    features: [
      'Save and reuse your avatar, flags, and frame rate presets.',
      'Quick seat fills for AI opponents to keep tables active.',
      'Optimized camera for portrait taps and drags.'
    ]
  },
  {
    name: 'Snooker Club',
    slug: 'snookerclub',
    route: '/games/snookerclub/lobby',
    icon: '/assets/icons/pool-royale.svg',
    genre: 'Cue sports • Tactical',
    summary: 'Long-table snooker with touch safeties and crisp physics.',
    meta: [
      { label: 'Frames', value: 'Race-to formats' },
      { label: 'Focus', value: 'Safety play + long pots' }
    ],
    features: [
      'Best for players who enjoy methodical cue sports.',
      'Practice-friendly pacing tuned for mobile accuracy.',
      'Shared cue/cloth unlocks with Pool Royale.'
    ]
  },
  {
    name: 'Goal Rush',
    slug: 'goalrush',
    route: '/games/goalrush/lobby',
    icon: '/assets/icons/goal_rush_card_1200x675.webp',
    genre: 'Sports • Football skill shots',
    summary: 'Arcade free-kicks with curved shots, walls, and tournaments.',
    meta: [
      { label: 'Modes', value: 'Solo training & brackets' },
      { label: 'Avg run', value: '3–5 minutes' }
    ],
    features: [
      'Swipe-to-curve shooting tuned for portrait play.',
      'Bracket view for multi-round play.',
      'Works with controller-like touch regions.'
    ]
  },
  {
    name: 'Air Hockey',
    slug: 'airhockey',
    route: '/games/airhockey/lobby',
    icon: '/assets/icons/pool-royale.svg',
    genre: 'Arcade • 1v1',
    summary: 'Lightning-fast air hockey with tactile rebounds.',
    meta: [
      { label: 'Pacing', value: 'First to 7 goals' },
      { label: 'Modes', value: 'AI & Online' }
    ],
    features: [
      'Lag-tolerant input for quick swipes.',
      'Compact rink sizing for portrait reachability.',
      'Glow trails for clearer puck tracking.'
    ]
  },
  {
    name: 'Snake & Ladder',
    slug: 'snake',
    route: '/games/snake/lobby',
    icon: '/assets/icons/snakes_and_ladders.webp',
    genre: 'Board • Casual',
    summary: 'Family-friendly rolls with animated ladders and snakes.',
    meta: [
      { label: 'Players', value: '1–4 (AI or friends)' },
      { label: 'Session', value: '5–10 minutes' }
    ],
    features: [
      'Online matchmaking plus pass-and-play.',
      'Tilted 3D board with simple tap controls.',
      'Clear turn indicators to keep things moving.'
    ]
  },
  {
    name: 'Murlan Royale',
    slug: 'murlanroyale',
    route: '/games/murlanroyale/lobby',
    icon: '/assets/icons/murlan-royale.svg',
    genre: 'Cards • Set progression',
    summary: 'Classic Murlan flow with simultaneous drops and combo scoring.',
    meta: [
      { label: 'Room sizes', value: '2–4 players' },
      { label: 'Modes', value: 'AI & Online' }
    ],
    features: [
      'Smart hints help onboard new players.',
      'Quick rematch flow to keep friends together.',
      'Supports TPC stakes with escrow when online.'
    ]
  },
  {
    name: 'Chess Battle Royal',
    slug: 'chessbattleroyal',
    route: '/games/chessbattleroyal/lobby',
    icon: '/assets/icons/pool-royale.svg',
    genre: 'Board • 1v1 / survival',
    summary: 'Arcade chess with power-ups and arena-style eliminations.',
    meta: [
      { label: 'Pacing', value: 'Rapid timers' },
      { label: 'Mode', value: 'Battle royale twist' }
    ],
    features: [
      'Friendly for both chess vets and arcade players.',
      'Power-ups surface clearly for mobile screens.',
      'Tournament-friendly brackets for streams.'
    ]
  },
  {
    name: 'Ludo Battle Royal',
    slug: 'ludobattleroyal',
    route: '/games/ludobattleroyal/lobby',
    icon: '/assets/icons/pool-royale.svg',
    genre: 'Board • Party',
    summary: 'Fast Ludo with arena visuals and easy invites.',
    meta: [
      { label: 'Players', value: '2–4' },
      { label: 'Session', value: '6–10 minutes' }
    ],
    features: [
      'Auto-roll timers to keep turns moving.',
      'Invite flow built for Telegram groups.',
      'Vibrant board skin tuned for mobile contrast.'
    ]
  }
];

export default gamesCatalog;

export const catalogWithSlugs = gamesCatalog.map((game) => ({
  ...game,
  slug: game.slug || game.route.split('/').filter(Boolean).pop()
}));
