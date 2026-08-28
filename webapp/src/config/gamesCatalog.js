const gamesCatalog = [
  {
    name: "Texas Hold'em",
    route: '/games/texasholdem/lobby',
    slug: 'texasholdem',
    image: '/assets/icons/Texas%20holdem%20poker%20game%20logo.png',
    description: 'High-stakes poker tables with quick matchmaking.'
  },
  {
    name: 'Domino Royal 3D',
    route: '/games/domino-royal/lobby',
    slug: 'domino-royal',
    image: '/assets/icons/Domino%20battle%20Royal%20logo.png',
    description: 'Classic domino strategy with modern 3D flair.'
  },
  {
    name: 'Pool Royale',
    route: '/games/poolroyale/lobby',
    slug: 'poolroyale',
    image: '/assets/icons/pool-royale.svg',
    description: 'Rack up and run the table in stylish arenas.'
  },
  {
    name: 'Snooker Royal',
    route: '/games/snookerroyale/lobby',
    slug: 'snookerroyale',
    image: '/assets/icons/file_00000000123071f4a91766ac58320bce.png',
    description: 'Precision snooker battles with competitive stakes.'
  },
  {
    name: 'Air Hockey',
    route: '/games/airhockey/lobby',
    slug: 'airhockey',
    image: '/assets/icons/Air%20hockey%20game%20logo.png',
    description: 'Lightning puck duels with neon energy.'
  },
  {
    name: 'Snake & Ladder',
    route: '/games/snake/lobby',
    slug: 'snake',
    image: '/assets/icons/Snake%20and%20ladder%20game%20logo.png',
    description: 'Race to the top with quick dice rolls.'
  },
  {
    name: 'Murlan Royale',
    route: '/games/murlanroyale/lobby',
    slug: 'murlanroyale',
    image: '/assets/icons/Murlan%20Royal%20logo.png',
    description: 'Card-based tactics with a competitive twist.'
  },
  {
    name: 'Chess Battle Royal',
    route: '/games/chessbattleroyal/lobby',
    slug: 'chessbattleroyal',
    image: '/assets/icons/Chess%20battle%20Royal%20logo.png',
    description: 'Strategic chess showdowns with royal flair.'
  },

  {
    name: 'Checkers Battle Royal',
    route: '/games/checkersbattleroyal/lobby',
    slug: 'checkersbattleroyal',
    image: '/assets/icons/Checkersbattleroyallogo.png',
    description: 'Classic checkers duels with royal 3D presentation.'
  },

  {
    name: '4 in a Row',
    route: '/games/fourinrowroyale/lobby',
    slug: 'fourinrowroyale',
    image: '/assets/icons/four-in-row-royale.svg',
    description:
      'Vertical 4 in a Row strategy on the shared Battle Royal 3D arena.'
  },

  {
    name: 'Backgammon Royal',
    route: '/games/tavullbattleroyal/lobby',
    slug: 'tavullbattleroyal',
    image: '/assets/icons/Backgammonroyallogo.png',
    description: 'Backgammon duels with a royal 3D-inspired board and smart AI.'
  },

  {
    name: 'Ludo Battle Royal',
    route: '/games/ludobattleroyal/lobby',
    slug: 'ludobattleroyal',
    image: '/assets/icons/Ludo%20battle%20Royal%20game%20logo.png',
    description: 'Classic ludo chaos in a battle royale lobby.'
  },
  {
    name: 'Table Tennis Royal',
    route: '/games/tabletennisroyal/royal-lobby',
    slug: 'tabletennisroyal',
    image: '/assets/icons/table-tennis-icon.svg',
    description: 'Fast 3D rallies in portrait-first online matches.'
  },
  {
    name: 'Ten-Pin Bowling Royal',
    route: '/games/tenpinbowlingroyal/royal-lobby',
    slug: 'tenpinbowlingroyal',
    image: '/assets/icons/visual-royal.svg',
    description: 'Ten polished frames of competitive 3D bowling.'
  },
  {
    name: 'Darts Royal',
    route: '/games/dartsroyal/royal-lobby',
    slug: 'dartsroyal',
    image: '/assets/icons/visual-royal.svg',
    description: 'Precision darts with synchronized online scoring.'
  },
  {
    name: 'Carrom Royal',
    route: '/games/carromroyal/royal-lobby',
    slug: 'carromroyal',
    image: '/assets/icons/visual-royal.svg',
    description: 'Flick, rebound, and pocket pieces online.'
  },
  {
    name: 'Archery Royal',
    route: '/games/archeryroyal/royal-lobby',
    slug: 'archeryroyal',
    image: '/assets/icons/visual-royal.svg',
    description: 'Competitive 3D bullseye challenges.'
  },
  {
    name: 'Penalty Shootout Royal',
    route: '/games/penaltyshootoutroyal/royal-lobby',
    slug: 'penaltyshootoutroyal',
    image: '/assets/icons/visual-royal.svg',
    description: 'Best-of-five football pressure duels.'
  },
  {
    name: 'Basketball Free Throw Royal',
    route: '/games/basketballroyal/royal-lobby',
    slug: 'basketballroyal',
    image: '/assets/icons/visual-royal.svg',
    description: 'Ten-shot 3D free-throw battles.'
  },
  {
    name: 'Go Crazy Kart Arena',
    route: '/games/gocrazykartarena/royal-lobby',
    slug: 'gocrazykartarena',
    image: '/assets/icons/visual-royal.svg',
    description: 'Colorful four-player kart arena races.'
  }
]

export default gamesCatalog

export const catalogWithSlugs = gamesCatalog.map((game) => {
  if (game.slug) return game
  const [, , slug] = game.route.split('/')
  return { ...game, slug }
})
