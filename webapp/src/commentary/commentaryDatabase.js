export const COMMENTARY_DB = {
  version: 1,
  localeFallback: 'en',
  globalRules: {
    globalCooldownMs: 2800,
    historyWindow: 10,
    maxTextLength: 140
  },
  locales: {
    en: {
      modes: {
        nineBall: {
          voiceId: '9ball-energetic',
          categories: {
            break: {
              priority: 85,
              cooldownMs: 7000,
              lines: [
                'Big break from {playerName} and the cue ball holds up.',
                'Dry break this time; the table stays open.',
                '{playerName} scatters them well and has a look.',
                'Scratch on the break; ball in hand for {opponentName}.',
                'Made a ball on the break, and the one is in view.'
              ]
            },
            pot: {
              priority: 55,
              cooldownMs: 4200,
              lines: [
                '{playerName} buries the {ball} and stays on the line.',
                'Clean pot on the {ball}; cue ball stays obedient.',
                '{playerName} takes the {ball} and keeps the run going.',
                'Nice contact on the {ball}; that opens the table.',
                'The {ball} drops and {playerName} has a chance to run.'
              ]
            },
            miss: {
              priority: 52,
              cooldownMs: 4500,
              lines: [
                'Rattled the pocket on the {ball}; that was close.',
                'Overcut on the {ball}; chance for {opponentName}.',
                'Undercut there, and the {ball} stays up.',
                'Tough miss on the {ball}; speed looked perfect.',
                '{playerName} misses the {ball} and leaves the table open.'
              ]
            },
            position: {
              priority: 50,
              cooldownMs: 4200,
              lines: [
                'Lovely leave on the next ball; that is textbook.',
                'Great angle now; {playerName} can stay in rhythm.',
                'The cue ball lands perfect; {shotType} is on.',
                'Bit of a stretch here; cue ball not ideal.',
                'Hooked behind the {ball}; that is awkward.'
              ]
            },
            safety: {
              priority: 60,
              cooldownMs: 5200,
              lines: [
                'Smart safety from {playerName}; the {ball} is tied up.',
                'A good trap; {opponentName} might have to jump.',
                'Safety battle now, and that is a strong move.',
                'Safety attempt leaks out; there is a shot.',
                'Nice touch on the safety; cue ball hides well.'
              ]
            },
            foul: {
              priority: 95,
              cooldownMs: 6500,
              lines: [
                'Foul: {foulType}. Ball in hand to {opponentName}.',
                'Cue ball scratch; {opponentName} will like this look.',
                'Illegal contact there; that is ball in hand.',
                'Push out called; table is open for {opponentName}.',
                'A costly error; foul gives control away.'
              ]
            },
            pressure: {
              priority: 88,
              cooldownMs: 7000,
              lines: [
                'Hill-hill pressure; every shot matters now.',
                'Match ball on the nine; {playerName} feels it.',
                'Comeback brewing; {playerName} is back within {lead}.',
                'Big moment here with the {ball} on the table.',
                '{playerName} needs this one to stay alive.'
              ]
            },
            runout: {
              priority: 78,
              cooldownMs: 6200,
              lines: [
                'That is three in a row; this run is building.',
                'Nearly perfect so far; {streak} balls without error.',
                'Clean finish lines up if {playerName} keeps shape.',
                'Two balls left; a clear path to the nine.',
                '{playerName} is in full control of this rack.'
              ]
            },
            short: {
              priority: 40,
              cooldownMs: 3000,
              lines: [
                'Nice shot.',
                'Good pace.',
                'Solid cueing.',
                'Well judged.',
                'Clean hit.'
              ]
            }
          }
        },
        eightBall: {
          voiceId: '8ball-energetic',
          categories: {
            break: {
              priority: 82,
              cooldownMs: 7000,
              lines: [
                'Open table after the break; choices everywhere.',
                'Clusters stay tight; pattern play will be key.',
                'Early 8-ball danger on the break; watch this.',
                '{playerName} makes a ball and gets the first look.',
                'Scratch on the break; {opponentName} has ball in hand.'
              ]
            },
            groups: {
              priority: 70,
              cooldownMs: 6000,
              lines: [
                '{playerName} takes solids; the path looks clear.',
                'Stripes claimed; now it is all about the key ball.',
                'Decision made: {playerName} goes with {shotType}.',
                '{playerName} chooses the set with the cleaner lanes.',
                'Groups are set; pattern time.'
              ]
            },
            pot: {
              priority: 55,
              cooldownMs: 4200,
              lines: [
                '{playerName} pockets the {ball} and stays in control.',
                'That is a key ball; table opens up nicely.',
                'Great shot on the {ball}; pattern still intact.',
                '{playerName} clears another; two left in the set.',
                'Nice pocket choice; {playerName} keeps the angle.'
              ]
            },
            miss: {
              priority: 52,
              cooldownMs: 4500,
              lines: [
                'Wrong side of the ball; that miss costs position.',
                'Blocked pocket; {playerName} will regret that.',
                'Bank needed and it stays out; chance swings.',
                'Overcut on the {ball}; that opens the table.',
                'Rattled the {ball}; now the set is exposed.'
              ]
            },
            defense: {
              priority: 62,
              cooldownMs: 5200,
              lines: [
                'Lock-up safety; {opponentName} may be trapped.',
                'Great tie-up; that cluster just got worse.',
                'Smart choice to break the cluster now.',
                'Safety attempt sells out a shot.',
                'Nice containment; {playerName} keeps control.'
              ]
            },
            foul: {
              priority: 95,
              cooldownMs: 6500,
              lines: [
                'Scratch; ball in hand for {opponentName}.',
                'Illegal 8-ball; that is game over.',
                'Early 8-ball drops; that is a loss by rule.',
                'No rail after contact; foul called.',
                'Foul on the {ball}; {opponentName} gets the advantage.'
              ]
            },
            pressure: {
              priority: 88,
              cooldownMs: 7000,
              lines: [
                'On the 8-ball now; this is the moment.',
                '{playerName} at match point on the 8.',
                'Pressure shot with the 8-ball looming.',
                '{opponentName} needs a miss to stay alive.',
                'All eyes on this 8-ball attempt.'
              ]
            },
            short: {
              priority: 40,
              cooldownMs: 3000,
              lines: [
                'Great touch.',
                'Nice angle.',
                'Clean pocket.',
                'Good choice.',
                'Well played.'
              ]
            }
          }
        },
        americanPoints: {
          voiceId: 'american-analyst',
          categories: {
            scoring: {
              priority: 65,
              cooldownMs: 4500,
              lines: [
                '{playerName} adds {points}; the run reaches {streak}.',
                'Another point; {playerName} is staying in line.',
                'That brings the total to {points}; steady progress.',
                '{playerName} hits the {points} mark; strong control.',
                'Milestone reached at {points}; nice pace.'
              ]
            },
            position: {
              priority: 55,
              cooldownMs: 4200,
              lines: [
                'Textbook position; {playerName} stays on pattern.',
                'Two-rail route executed perfectly.',
                'Staying in line here keeps the run simple.',
                'That leave makes the next shot awkward.',
                'Great speed; the cue ball is right in the window.'
              ]
            },
            miss: {
              priority: 52,
              cooldownMs: 4500,
              lines: [
                'That miss sells out big points.',
                'Tough miss; {opponentName} has a chance to run.',
                'The pattern breaks down with that error.',
                'Overhit the position; that ends the streak.',
                'Missed the {shotType}; opening for the other side.'
              ]
            },
            safety: {
              priority: 60,
              cooldownMs: 5200,
              lines: [
                'Smart safety exchange; pressure builds.',
                'Locked up nicely; forcing a thin hit.',
                'Safety wins the table; {playerName} stays ahead.',
                'Risky safety; it leaks a shot.',
                'Good containment; {opponentName} is squeezed.'
              ]
            },
            leadChange: {
              priority: 80,
              cooldownMs: 6500,
              lines: [
                'Lead changes hands; {playerName} now at {lead}.',
                'That run swings the race; advantage {playerName}.',
                'The gap closes to {lead}; momentum shifts.',
                '{playerName} stretches the lead to {lead}.',
                'Score pressure now; {opponentName} must respond.'
              ]
            },
            clock: {
              priority: 75,
              cooldownMs: 6000,
              lines: [
                'Shot-clock pressure; quick decision needed.',
                'Running out of time; {playerName} must commit.',
                'That was late on the clock but well played.',
                'Clock ticking; the pace speeds up.',
                'Under the gun and still finds the line.'
              ]
            },
            short: {
              priority: 40,
              cooldownMs: 3000,
              lines: [
                'Sharp.',
                'Smooth.',
                'Good speed.',
                'Right line.',
                'Steady.'
              ]
            }
          }
        },
        snooker: {
          voiceId: 'snooker-calm',
          categories: {
            breakBuilding: {
              priority: 70,
              cooldownMs: 5200,
              lines: [
                '{playerName} moves to {breakPoints} and counting.',
                'Break reaches {breakPoints}; nice control.',
                'That takes the break past {breakPoints}.',
                '{playerName} is building a serious visit.',
                'Clean cueing keeps the break alive.'
              ]
            },
            colors: {
              priority: 60,
              cooldownMs: 4800,
              lines: [
                'Reds and blacks again; this is the rhythm.',
                'Switching colors now with {remaining} reds left.',
                'Blue is on; key moment in the break.',
                'Pink available; a chance to extend the lead.',
                'Clearing the colors; pressure rising.'
              ]
            },
            safety: {
              priority: 65,
              cooldownMs: 5200,
              lines: [
                'Excellent safety; {opponentName} is snookered.',
                'Thin hit escape; that was very tight.',
                'Great snooker laid; {playerName} asks the question.',
                'Safety battle now; tactical chess on the baize.',
                'Escape missed; foul points on offer.'
              ]
            },
            foul: {
              priority: 95,
              cooldownMs: 6500,
              lines: [
                'Foul: {foulType}; {points} points to {opponentName}.',
                'In-off there; costly mistake.',
                'Miss called; {opponentName} may ask again.',
                'Free ball situation; advantage swings.',
                'Touching ball declared; needs precision.'
              ]
            },
            difficulty: {
              priority: 58,
              cooldownMs: 4800,
              lines: [
                'Long pot from {difficulty} distance; very brave.',
                'Rest shot played beautifully.',
                'Screw shot with side; great cue action.',
                'Stun run-through executed with control.',
                'Thin cut on the {ball}; excellent touch.'
              ]
            },
            pressure: {
              priority: 88,
              cooldownMs: 7000,
              lines: [
                'Frame ball here; {playerName} can seal it.',
                'Needs snookers now; still a chance.',
                'Match pressure with {frameScore} on the board.',
                'Big moment; every point counts.',
                'One chance table; no easy returns.'
              ]
            },
            short: {
              priority: 40,
              cooldownMs: 3000,
              lines: [
                'Lovely.',
                'Classy.',
                'Pure cueing.',
                'Well judged.',
                'Nice touch.'
              ]
            }
          }
        }
      }
    }
  }
};

export const COMMENTARY_EVENT_CATEGORY_MAP = {
  nineBall: {
    break: 'break',
    pot: 'pot',
    combo: 'pot',
    carom: 'pot',
    miss: 'miss',
    position: 'position',
    safety: 'safety',
    foul: 'foul',
    pressure: 'pressure',
    runout: 'runout',
    short: 'short'
  },
  eightBall: {
    break: 'break',
    groupsChosen: 'groups',
    pot: 'pot',
    miss: 'miss',
    defense: 'defense',
    foul: 'foul',
    pressure: 'pressure',
    tactical: 'miss',
    short: 'short'
  },
  americanPoints: {
    scoring: 'scoring',
    position: 'position',
    miss: 'miss',
    safety: 'safety',
    leadChange: 'leadChange',
    clock: 'clock',
    short: 'short'
  },
  snooker: {
    breakBuilding: 'breakBuilding',
    colors: 'colors',
    safety: 'safety',
    foul: 'foul',
    difficulty: 'difficulty',
    pressure: 'pressure',
    short: 'short'
  }
};
