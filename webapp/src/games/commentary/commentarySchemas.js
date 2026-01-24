export const EVENT_SCHEMAS = {
  common: {
    playerName: 'string',
    opponentName: 'string',
    ball: 'string',
    points: 'number',
    remaining: 'number',
    frameScore: 'string',
    breakPoints: 'number',
    foulType: 'string',
    shotType: 'string',
    difficulty: 'string',
    streak: 'number',
    lead: 'number'
  },
  events: {
    'break.dry': { playerName: 'string' },
    'break.made': { playerName: 'string', ball: 'string' },
    'break.scratch': { playerName: 'string' },
    'shot.pot': { playerName: 'string', ball: 'string', shotType: 'string' },
    'shot.miss': { playerName: 'string', ball: 'string' },
    'position.good': { playerName: 'string' },
    'safety.good': { playerName: 'string', opponentName: 'string' },
    'foul.scratch': { playerName: 'string', foulType: 'string' },
    'pressure.match_point': { playerName: 'string' }
  }
};

export const EXAMPLE_EVENT_PAYLOADS = {
  '9ball.shot.pot': {
    gameMode: '9ball',
    eventType: 'shot.pot',
    context: { playerName: 'Arben', ball: '3', positionQuality: 'good', runCount: 4 }
  },
  '8ball.pressure.on8': {
    gameMode: '8ball',
    eventType: 'pressure.on8',
    context: { playerName: 'Lina', onEightBall: true, pocketBlocked: false }
  },
  'american.score.point': {
    gameMode: 'american',
    eventType: 'score.point',
    context: { playerName: 'Mira', currentPoints: 38, streak: 7, lead: 12 }
  },
  'snooker.break.build': {
    gameMode: 'snooker',
    eventType: 'break.build',
    context: { playerName: 'Noel', breakPoints: 56, remainingReds: 3, needsSnookers: false }
  }
};
