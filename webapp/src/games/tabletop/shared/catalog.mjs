/** Original compact rulesets; no third-party boards, card text or artwork. */
export const TABLETOP_GAMES = Object.freeze([
  {
    id: 'oligarchs',
    name: 'Oligarchs',
    color: '#e9ba69',
    genre: 'PROPERTY & POWER',
    description: 'Buy districts, collect rent and build a city empire.',
    rounds: 16,
    rules: [
      'Roll, then buy the district you land on or open an auction. Passing Start pays 120 city credits.',
      'Matching district pairs double rent. Develop owned districts for higher rents, or sell them for half their invested value.',
      'Auctions rise in steps of 20. Passing removes you from that auction. Debt automatically liquidates property; unpaid debt causes bankruptcy.',
      'After 16 rounds, the highest net worth wins. City credits are game money, separate from TPG.'
    ]
  },
  {
    id: 'harborempires',
    name: 'Harbor Empires',
    color: '#68d5b5',
    genre: 'SETTLEMENT & TRADE',
    description: 'Harvest islands, trade supplies and grow a harbor network.',
    rounds: 20,
    rules: [
      'Roll to produce timber, brick or grain at every matching harbor. Everyone can earn on any turn.',
      'Build next to your own harbor for one of each resource. Upgrade for two brick and two grain.',
      'Trade three matching resources for one other resource, then build or end your turn. Each turn allows one construction.',
      'Reach 12 points to trigger the final round. Harbors score one, cities three. Otherwise the game ends after 20 rounds.'
    ]
  },
  {
    id: 'mosaicroyal',
    name: 'Mosaic Royal',
    color: '#8eb9ff',
    genre: 'TILE DRAFTING',
    description: 'Draft jewel tiles and assemble a scoring mosaic.',
    rounds: 5,
    rules: [
      'Take every tile of one color from a tray. Other colors move to the center. You may also draft from the center.',
      'Choose a row of length one to five. A row accepts only one color, and cannot repeat a color already on its wall.',
      'Completed rows add one wall tile and score connected tiles. Excess tiles lose one point each; the first center pick loses one point.',
      'After five rounds, completed wall rows add five points and columns add seven. Highest score wins.'
    ]
  },
  {
    id: 'railkingdoms',
    name: 'Rail Kingdoms',
    color: '#f29b86',
    genre: 'ROUTES & CONNECTIONS',
    description: 'Collect cargo and connect a network of royal cities.',
    rounds: 20,
    rules: [
      'On your turn, collect two cargo of one color or claim an unowned route by paying its cargo cost.',
      'Routes score their length squared. Each player has two visible delivery contracts worth six points each when connected.',
      'Completed contracts score once. You can connect through any of your own routes.',
      'Highest score wins after 20 rounds or when every route is claimed.'
    ]
  },
  {
    id: 'gemsyndicate',
    name: 'Gem Syndicate',
    color: '#d7a4f2',
    genre: 'ENGINE BUILDING',
    description: 'Collect gems, acquire workshops and fund grand projects.',
    rounds: 25,
    rules: [
      'Collect two different gems, or two of one color when at least four remain in the bank. Hold at most eight gems.',
      'Buy a workshop using gems. Each workshop permanently discounts future purchases in its color.',
      'Reserve up to two workshops to keep them for later. Return two gems of one color to take one of another.',
      'Reach 15 prestige to trigger the final round. Otherwise play 25 rounds; highest prestige wins.'
    ]
  }
]);
export const TABLETOP_IDS = TABLETOP_GAMES.map((g) => g.id);
export const getTabletopGame = (id) => TABLETOP_GAMES.find((g) => g.id === id);
export const PLAYER_COLORS = ['#65d4b8', '#ffb974', '#ac9cff', '#f17fa5'];
export const RESOURCE_NAMES = ['Timber', 'Brick', 'Grain'];
export const GEM_NAMES = ['Sapphire', 'Ruby', 'Emerald'];
export const TILE_COLORS = [
  '#56bce9',
  '#eabc5b',
  '#dc7183',
  '#85ca9e',
  '#a79be5'
];
export const CITY_NAMES = [
  'Aster',
  'Bellhaven',
  'Crown',
  'Dawn',
  'Ember',
  'Fable',
  'Grove',
  'Haven',
  'Ivory',
  'Jade',
  'Kingsport',
  'Lumen'
];
export const RAIL_ROUTES = [
  [0, 1, 2, 0],
  [1, 2, 3, 1],
  [2, 3, 2, 2],
  [4, 5, 3, 2],
  [5, 6, 2, 0],
  [6, 7, 3, 1],
  [8, 9, 2, 1],
  [9, 10, 3, 2],
  [10, 11, 2, 0],
  [0, 4, 2, 1],
  [1, 5, 2, 2],
  [2, 6, 2, 0],
  [3, 7, 2, 1],
  [4, 8, 2, 0],
  [5, 9, 2, 1],
  [6, 10, 2, 2],
  [7, 11, 2, 0],
  [1, 4, 3, 0],
  [3, 6, 3, 2],
  [5, 8, 3, 2],
  [7, 10, 3, 1]
];

export const GEM_COLORS = ['#56bce9', '#dc7183', '#85ca9e'];
export const DISTRICT_COLORS = [
  '#ac795b',
  '#8bbde5',
  '#d58fb7',
  '#edaa62',
  '#db7068',
  '#e4cf68',
  '#89bc90',
  '#9b9add'
];
