const gamesCatalog = [
  {
    id: 'pool-uk',
    name: 'Pool Royale',
    variant: '8 Pool UK',
    slug: 'poolroyale',
    lobbyPath: '/games/poolroyale/lobby',
    playPath: '/games/poolroyale',
    params: { variant: 'uk' },
    tagline: 'Classic pub rules with compact tables for mobile touch play.',
    tags: ['AI & Online', 'TPC stakes', 'Table size presets'],
    accent: 'from-emerald-400/25 via-cyan-400/20 to-blue-500/10',
    stats: [
      { label: 'Mode', value: 'AI & 1v1 Online' },
      { label: 'Visuals', value: 'Yellow/Red or Solids' }
    ],
    emoji: '🎱'
  },
  {
    id: 'pool-american',
    name: 'Pool Royale',
    variant: 'American Billiards',
    slug: 'poolroyale',
    lobbyPath: '/games/poolroyale/lobby',
    playPath: '/games/poolroyale',
    params: { variant: 'american' },
    tagline: 'Solids & Stripes physics tuned for U.S. table specs.',
    tags: ['TPC stakes', 'Ranked-ready', 'Cinematic intro'],
    accent: 'from-purple-500/25 via-fuchsia-500/20 to-sky-500/10',
    stats: [
      { label: 'Mode', value: 'AI & 1v1 Online' },
      { label: 'Skill', value: 'American break & run' }
    ],
    emoji: '🎱'
  },
  {
    id: 'pool-9ball',
    name: 'Pool Royale',
    variant: '9-Ball',
    slug: 'poolroyale',
    lobbyPath: '/games/poolroyale/lobby',
    playPath: '/games/poolroyale',
    params: { variant: '9ball' },
    tagline: 'Fast racks with 9-ball order, ideal for speedruns.',
    tags: ['Race format', 'Pro cue ball', 'TPC optional'],
    accent: 'from-amber-400/25 via-orange-500/20 to-rose-500/10',
    stats: [
      { label: 'Mode', value: 'AI practice' },
      { label: 'Focus', value: 'Call shots, combos' }
    ],
    emoji: '🎱'
  },
  {
    id: 'domino-royal',
    name: 'Domino Royal 3D',
    slug: 'domino-royal',
    lobbyPath: '/games/domino-royal/lobby',
    playPath: '/games/domino-royal',
    tagline: 'Double-six domino arena with cinematic lighting and AI seats.',
    tags: ['2-4 players', 'Flag avatars', 'TPC stakes'],
    accent: 'from-cyan-500/20 via-sky-500/10 to-indigo-500/10',
    stats: [
      { label: 'Mode', value: 'Local AI & stake' },
      { label: 'Seats', value: 'Up to 4' }
    ],
    emoji: '🁫'
  },
  {
    id: 'texas-holdem',
    name: "Texas Hold'em",
    slug: 'texasholdem',
    lobbyPath: '/games/texasholdem/lobby',
    playPath: '/games/texasholdem',
    tagline: 'Tournament-ready poker tables with crisp card animations.',
    tags: ['Stake ready', 'Fast hands'],
    accent: 'from-red-500/25 via-rose-500/20 to-orange-500/10',
    stats: [
      { label: 'Mode', value: 'Online-ready' },
      { label: 'Pace', value: 'Turbo hands' }
    ],
    emoji: '🃏'
  },
  {
    id: 'snooker-club',
    name: 'Snooker Club',
    slug: 'snookerclub',
    lobbyPath: '/games/snookerclub/lobby',
    playPath: '/games/snookerclub',
    tagline: 'Precision snooker tables with aim training overlays.',
    tags: ['Practice', 'Cinematic'],
    accent: 'from-green-500/25 via-emerald-500/15 to-slate-600/10',
    stats: [
      { label: 'Mode', value: 'Cue training' },
      { label: 'Tables', value: 'Full-size cloth' }
    ],
    emoji: '🎱'
  },
  {
    id: 'goal-rush',
    name: 'Goal Rush',
    slug: 'goalrush',
    lobbyPath: '/games/goalrush/lobby',
    playPath: '/games/goalrush',
    tagline: 'Arcade football flicks with lobby-based matchmaking.',
    tags: ['Arcade', 'Skill shots'],
    accent: 'from-emerald-400/25 via-lime-400/20 to-sky-400/10',
    stats: [
      { label: 'Mode', value: 'Lobby to pitch' },
      { label: 'Pace', value: 'Quick kicks' }
    ],
    emoji: '⚽'
  },
  {
    id: 'air-hockey',
    name: 'Air Hockey',
    slug: 'airhockey',
    lobbyPath: '/games/airhockey/lobby',
    playPath: '/games/airhockey',
    tagline: 'Slick air hockey duels with neon rails.',
    tags: ['1v1', 'Reflex'],
    accent: 'from-sky-500/25 via-blue-500/15 to-indigo-500/10',
    stats: [
      { label: 'Mode', value: 'Arcade duel' },
      { label: 'Physics', value: 'Glide-tuned' }
    ],
    emoji: '🥅'
  },
  {
    id: 'snake-ladder',
    name: 'Snake & Ladder',
    slug: 'snake',
    lobbyPath: '/games/snake',
    playPath: '/games/snake',
    tagline: 'Instant board start with multiplayer and results views.',
    tags: ['Board', 'Multiplayer'],
    accent: 'from-yellow-400/25 via-orange-400/20 to-rose-500/10',
    stats: [
      { label: 'Mode', value: 'Solo & MP' },
      { label: 'Scene', value: '3D board' }
    ],
    emoji: '🎲'
  },
  {
    id: 'murlan-royale',
    name: 'Murlan Royale',
    slug: 'murlanroyale',
    lobbyPath: '/games/murlanroyale/lobby',
    playPath: '/games/murlanroyale',
    tagline: 'Card climbing battles with Royale pacing.',
    tags: ['Cards', 'Quick rounds'],
    accent: 'from-indigo-500/20 via-purple-500/15 to-fuchsia-500/10',
    stats: [
      { label: 'Mode', value: 'Lobby linked' },
      { label: 'Pace', value: 'Royale turns' }
    ],
    emoji: '🂮'
  },
  {
    id: 'chess-battle-royal',
    name: 'Chess Battle Royal',
    slug: 'chessbattleroyal',
    lobbyPath: '/games/chessbattleroyal/lobby',
    playPath: '/games/chessbattleroyal',
    tagline: 'Blitz chess battles with royale field and flags.',
    tags: ['Blitz', 'Flags'],
    accent: 'from-slate-500/25 via-blue-500/15 to-cyan-400/10',
    stats: [
      { label: 'Mode', value: 'Lobby + battle' },
      { label: 'Board', value: 'Royale grid' }
    ],
    emoji: '♟️'
  },
  {
    id: 'ludo-battle-royal',
    name: 'Ludo Battle Royal',
    slug: 'ludobattleroyal',
    lobbyPath: '/games/ludobattleroyal/lobby',
    playPath: '/games/ludobattleroyal',
    tagline: 'High-tempo Ludo arenas with animated tokens.',
    tags: ['Board', 'Party'],
    accent: 'from-teal-400/20 via-cyan-500/15 to-indigo-500/10',
    stats: [
      { label: 'Mode', value: 'Lobby linked' },
      { label: 'Players', value: 'Battle-royal' }
    ],
    emoji: '🎯'
  }
];

export default gamesCatalog;

export const catalogWithSlugs = gamesCatalog.map((game) => ({
  ...game,
  slug: game.slug || (game.lobbyPath || game.playPath || game.route || '').split('/')[2] || game.id
}));
