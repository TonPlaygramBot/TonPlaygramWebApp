const gamesCatalog = [
  { name: "Texas Hold'em", route: '/games/texasholdem/lobby' },
  { name: 'Domino Royal 3D', route: '/games/domino-royal/lobby' },
  { name: 'Pool Royale', route: '/games/poolroyale/lobby' },
  { name: 'Snooker Club', route: '/games/snookerclub/lobby' },
  { name: 'Goal Rush', route: '/games/goalrush/lobby' },
  { name: 'Air Hockey', route: '/games/airhockey/lobby' },
  { name: 'Snake & Ladder', route: '/games/snake/lobby' },
  { name: 'Murlan Royale', route: '/games/murlanroyale/lobby' },
  { name: 'Chess Battle Royal', route: '/games/chessbattleroyal/lobby' },
  { name: 'Ludo Battle Royal', route: '/games/ludobattleroyal/lobby' }
];

export default gamesCatalog;

export const catalogWithSlugs = gamesCatalog.map((game) => {
  const [, , slug] = game.route.split('/');
  return { ...game, slug };
});
