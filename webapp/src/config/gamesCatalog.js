const gamesCatalog = [
  {
    name: 'Explore Albania',
    route: '/games/explorealbania/lobby',
    slug: 'explorealbania',
    attribution: 'Geography © OpenStreetMap contributors',
    image: '/assets/icons/explore-albania.svg',
    badge: 'New',
    featured: true,
    multiplayer: false,
    modes: ['Freight career', 'Free drive'],
    launchLabel: 'Enter Truck Garage',
    description:
      'Drive a detailed mobile truck simulator across twelve Albanian cities with freight jobs, fuel, damage and a day-night cycle.'
  },
  {
    name: 'Royal Lanes Bowling',
    route: '/games/royallanes/lobby',
    slug: 'royallanes',
    image: '/assets/royal-lanes/mark.svg',
    featured: true,
    modes: ['VS AI', 'TPG Online'],
    launchLabel: 'Enter Bowling Lobby',
    description: 'Realistic 3D bowling, human players, touch controls and ten-frame TPG matches.'
  },
  {
    name: 'Table Tennis Royal',
    route: '/games/tabletennisroyal/lobby',
    slug: 'tabletennisroyal',
    image: '/assets/icons/table-tennis-royal.svg',
    description:
      'Human players, spin rallies, a career tour and TPC online matches.'
  },
  {
    name: 'Tirana Streets',
    route: '/games/tiranastreets/lobby',
    slug: 'tiranastreets',
    attribution: '© OpenStreetMap',
    image: '/assets/tirana-streets/map.svg',
    badge: 'Beta',
    featured: true,
    modes: ['Solo operation', 'TPG Multiplayer'],
    launchLabel: 'Enter Tirana Streets',
    description:
      'First-person action on Tirana’s mapped streets. Three-wave operations, city landmarks and 2–4 player TPG matches.'
  },
  {
    name: 'Tennis Royal',
    route: '/games/tennisroyal/lobby',
    slug: 'tennisroyal',
    image: '/assets/icons/tennis-royal.svg',
    description: '3D tennis, career tournaments and same-stake online matches.'
  },
  {
    name: 'Racing Royal',
    route: '/games/kartroyale/lobby',
    slug: 'kartroyale',
    image: '/assets/kart-royale/cover.webp',
    badge: 'Beta',
    featured: true,
    modes: ['VS AI', 'TPG Multiplayer', 'Career'],
    launchLabel: 'Enter Racing Lobby',
    description:
      'Enter your racing lobby for TPG matchmaking, private races, free AI practice and career cups.'
  },
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
    name: 'Underrun Arena',
    route: '/games/underrunarena/lobby',
    slug: 'underrunarena',
    image: '/assets/icons/underrun-arena.svg',
    description: 'Survive an auto-fire neon swarm online.'
  }
];

export default gamesCatalog;

export const inviteGamesCatalog = gamesCatalog.filter(
  (game) => game.multiplayer !== false && game.inviteFlow !== 'room-code'
);

export const catalogWithSlugs = gamesCatalog.map((game) => {
  if (game.slug) return game;
  const [, , slug] = game.route.split('/');
  return { ...game, slug };
});
