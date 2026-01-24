export const EVENT_PAYLOAD_SCHEMAS = {
  nineBall: {
    break: {
      eventType: 'break',
      playerName: 'Player 1',
      result: 'made-ball|dry|scratch',
      ball: '1'
    },
    pot: {
      eventType: 'pot',
      playerName: 'Player 1',
      ball: '3',
      positionQuality: 'good',
      runCount: 4,
      difficulty: 'medium'
    },
    foul: {
      eventType: 'foul',
      playerName: 'Player 2',
      opponentName: 'Player 1',
      foulType: 'scratch'
    }
  },
  eightBall: {
    groupsChosen: {
      eventType: 'groupsChosen',
      playerName: 'Player 1',
      shotType: 'solids'
    },
    pressure: {
      eventType: 'pressure',
      playerName: 'Player 1',
      onEightBall: true,
      pocketBlocked: false
    }
  },
  americanPoints: {
    scoring: {
      eventType: 'scoring',
      playerName: 'Player 1',
      points: 38,
      streak: 7,
      lead: '+12'
    },
    clock: {
      eventType: 'clock',
      playerName: 'Player 2',
      timeRemaining: 3
    }
  },
  snooker: {
    breakBuilding: {
      eventType: 'breakBuilding',
      playerName: 'Player 1',
      breakPoints: 56,
      remaining: 3
    },
    pressure: {
      eventType: 'pressure',
      playerName: 'Player 2',
      frameScore: '45-52',
      needsSnookers: false
    },
    foul: {
      eventType: 'foul',
      playerName: 'Player 1',
      opponentName: 'Player 2',
      foulType: 'in-off',
      points: 4
    }
  }
};
