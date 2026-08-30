export const RESTORED_ARCADE_GAMES = Object.freeze({
  tetrisroyale: { name: 'Tetris Battle Royale', icon: '🧱', accent: '#a78bfa', instruction: 'Tap a column to drop blocks. Complete rows for bonus points.' },
  fruitslice: { name: 'Fruit Slice', icon: '🍉', accent: '#fb7185', instruction: 'Swipe across fruit. Avoid the dark bombs.' },
  bubblecrush: { name: 'Bubble Crush', icon: '🫧', accent: '#22d3ee', instruction: 'Tap groups of matching bubbles to crush them.' },
  bubblesmash: { name: 'Bubble Smash', icon: '💥', accent: '#fbbf24', instruction: 'Tap every moving bubble before it escapes.' },
  fallingball: { name: 'Falling Ball', icon: '🔵', accent: '#60a5fa', instruction: 'Move the ball left and right through the platform gaps.' }
})

export const isRestoredArcadeGame = (slug) => Boolean(RESTORED_ARCADE_GAMES[slug])
