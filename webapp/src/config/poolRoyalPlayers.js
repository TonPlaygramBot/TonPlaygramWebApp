// Original fictional snooker competitors. Source and generated geometry: MIT.
export const POOL_ROYAL_PLAYERS = Object.freeze([
  {
    id: 'alex',
    name: 'Alex Morgan',
    country: 'England',
    style: 'All-rounder',
    waistcoat: 0x183c32,
    skin: 0xb77851,
    hair: 0x38281f,
    accuracy: 0.66,
    safety: 0.45
  },
  {
    id: 'mei',
    name: 'Mei Lin',
    country: 'China',
    style: 'Position specialist',
    waistcoat: 0x702d3d,
    skin: 0xd69d75,
    hair: 0x191619,
    accuracy: 0.78,
    safety: 0.62
  },
  {
    id: 'arben',
    name: 'Arben Dervishi',
    country: 'Albania',
    style: 'Attacking potter',
    waistcoat: 0x183356,
    skin: 0xc68a62,
    hair: 0x24201c,
    accuracy: 0.83,
    safety: 0.35
  },
  {
    id: 'amara',
    name: 'Amara Okafor',
    country: 'Nigeria',
    style: 'Safety tactician',
    waistcoat: 0x4b3065,
    skin: 0x71482f,
    hair: 0x171412,
    accuracy: 0.85,
    safety: 0.9
  },
  {
    id: 'mateo',
    name: 'Mateo Silva',
    country: 'Portugal',
    style: 'Break builder',
    waistcoat: 0x68491e,
    skin: 0xb98460,
    hair: 0x30211b,
    accuracy: 0.92,
    safety: 0.67
  },
  {
    id: 'evan',
    name: 'Evan Price',
    country: 'Wales',
    style: 'Tour champion',
    waistcoat: 0x262d37,
    skin: 0xd7aa8b,
    hair: 0x503c2c,
    accuracy: 0.97,
    safety: 0.8
  }
]);
export const getPoolRoyalPlayer = (id) =>
  POOL_ROYAL_PLAYERS.find((player) => player.id === id) ||
  POOL_ROYAL_PLAYERS[0];
