export type VisualRoyalGame = {
  slug: string;
  gameType: string;
  title: string;
  icon: string;
  accent: string;
  action: string;
  objective: string;
  target: number;
  players: number;
  scene: 'table-tennis' | 'bowling' | 'darts' | 'carrom' | 'archery' | 'penalty' | 'basketball' | 'kart';
};

export const VISUAL_ROYAL_GAMES: VisualRoyalGame[] = [
  { slug: 'tabletennisroyal', gameType: 'tabletennis', title: 'Table Tennis Royal', icon: '🏓', accent: '#22d3ee', action: 'Serve', objective: 'First to 11, win by two', target: 11, players: 2, scene: 'table-tennis' },
  { slug: 'tenpinbowlingroyal', gameType: 'tenpinbowling', title: 'Ten-Pin Bowling Royal', icon: '🎳', accent: '#f97316', action: 'Bowl', objective: 'Highest score after 10 frames', target: 10, players: 2, scene: 'bowling' },
  { slug: 'dartsroyal', gameType: 'darts', title: 'Darts Royal', icon: '🎯', accent: '#ef4444', action: 'Throw dart', objective: 'Highest score after 10 throws', target: 10, players: 2, scene: 'darts' },
  { slug: 'carromroyal', gameType: 'carrom', title: 'Carrom Royal', icon: '🟤', accent: '#fbbf24', action: 'Flick striker', objective: 'Pocket all nine pieces', target: 9, players: 2, scene: 'carrom' },
  { slug: 'archeryroyal', gameType: 'archery', title: 'Archery Royal', icon: '🏹', accent: '#84cc16', action: 'Release arrow', objective: 'Highest score after 10 arrows', target: 10, players: 2, scene: 'archery' },
  { slug: 'penaltyshootoutroyal', gameType: 'penaltyshootout', title: 'Penalty Shootout Royal', icon: '⚽', accent: '#10b981', action: 'Kick', objective: 'Best of five, then sudden death', target: 5, players: 2, scene: 'penalty' },
  { slug: 'basketballroyal', gameType: 'basketball', title: 'Basketball Free Throw Royal', icon: '🏀', accent: '#fb923c', action: 'Shoot', objective: 'Highest score after 10 shots', target: 10, players: 2, scene: 'basketball' },
  { slug: 'gocrazykartarena', gameType: 'gocrazykart', title: 'Go Crazy Kart Arena', icon: '🏎️', accent: '#a855f7', action: 'Boost', objective: 'First to complete three laps', target: 3, players: 4, scene: 'kart' }
];

export const getVisualRoyalGame = (slug = '') =>
  VISUAL_ROYAL_GAMES.find((game) => game.slug === slug);
