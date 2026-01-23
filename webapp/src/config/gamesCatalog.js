const gamesCatalog = [
  {
    name: "Texas Hold'em",
    route: '/games/texasholdem/lobby',
    image: '/assets/icons/texas-holdem.svg',
    description: 'High-stakes poker tables with quick matchmaking.'
  },
  {
    name: 'Domino Royal 3D',
    route: '/games/domino-royal/lobby',
    image: '/assets/icons/domino-royal.svg',
    description: 'Classic domino strategy with modern 3D flair.'
  },
  {
    name: 'Pool Royale',
    route: '/games/poolroyale/lobby',
    image: '/assets/icons/pool-royale.svg',
    description: 'Rack up and run the table in stylish arenas.'
  },
  {
    name: 'Snooker Royal',
    route: '/games/snookerroyale/lobby',
    image: '/assets/icons/snooker-royale.svg',
    description: 'Precision snooker battles with competitive stakes.'
  },
  {
    name: 'Goal Rush',
    route: '/games/goalrush/lobby',
    image: '/assets/icons/goal_rush_card_1200x675.webp',
    description: 'Score fast goals and climb the rankings.'
  },
  {
    name: 'Air Hockey',
    route: '/games/airhockey/lobby',
    image: '/assets/icons/air-hockey.svg',
    description: 'Lightning puck duels with neon energy.'
  },
  {
    name: 'Snake & Ladder',
    route: '/games/snake/lobby',
    image: '/assets/icons/snakes_and_ladders.webp',
    description: 'Race to the top with quick dice rolls.'
  },
  {
    name: 'Murlan Royale',
    route: '/games/murlanroyale/lobby',
    image: '/assets/icons/murlan-royale.svg',
    description: 'Card-based tactics with a competitive twist.'
  },
  {
    name: 'Chess Battle Royal',
    route: '/games/chessbattleroyal/lobby',
    image: '/assets/icons/chess-royale.svg',
    description: 'Strategic chess showdowns with royal flair.'
  },
  {
    name: 'Ludo Battle Royal',
    route: '/games/ludobattleroyal/lobby',
    image: '/assets/icons/ludo-royale.svg',
    description: 'Classic ludo chaos in a battle royale lobby.'
  }
];

export default gamesCatalog;

export const catalogWithSlugs = gamesCatalog.map((game) => {
  const [, , slug] = game.route.split('/');
  return { ...game, slug };
});
