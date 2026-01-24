export const COMMENTARY_DATABASE = {
  schemaVersion: 1,
  rules: {
    globalCooldownMs: [2000, 4000],
    historySize: 8,
    maxTextLength: 140,
    defaultCategoryCooldownMs: 4500
  },
  locales: {
    en: {
      modes: {
        nineBall: {
          label: '9-Ball',
          defaultVoiceId: '9ball-energetic',
          categories: {
            breakDry: {
              priority: 70,
              cooldownMs: 6000,
              lines: [
                'Dry break for {playerName}. That opens the door.',
                '{playerName} comes up empty on the break.',
                'No balls down on the break. {opponentName} will fancy this.',
                'A quiet break—nothing drops for {playerName}.'
              ]
            },
            breakMade: {
              priority: 72,
              cooldownMs: 6000,
              lines: [
                '{playerName} pockets a ball on the break.',
                'A productive break—{playerName} stays at the table.',
                'Ball down on the break. Nice start for {playerName}.',
                '{playerName} gets one to go and keeps control.'
              ]
            },
            breakScratch: {
              priority: 85,
              cooldownMs: 7000,
              lines: [
                'Scratch on the break. Ball in hand for {opponentName}.',
                '{playerName} loses the cue ball on the break—costly.',
                'Break scratch! Big swing to {opponentName}.'
              ]
            },
            legalPot: {
              priority: 60,
              cooldownMs: 3200,
              lines: [
                '{playerName} buries the {ball} with authority.',
                'Clean pot on the {ball} by {playerName}.',
                '{playerName} makes the {ball}—textbook.',
                'That {ball} drops and the run continues.',
                'Solid pot from {playerName}; cue ball stays in play.',
                '{playerName} knocks in the {ball} on a {shotType}.'
              ]
            },
            comboCarom: {
              priority: 65,
              cooldownMs: 4200,
              lines: [
                'Combination play—{playerName} threads the {ball} in.',
                'Nice carom! {playerName} nudges the {ball} home.',
                'A clever combo sends the {ball} down.',
                '{playerName} manufactures it with a combo on the {ball}.'
              ]
            },
            miss: {
              priority: 40,
              cooldownMs: 2800,
              lines: [
                'That one rattles out. {opponentName} gets a look.',
                '{playerName} overcuts the {ball} and leaves a chance.',
                'Undercut there—no pot for {playerName}.',
                'A miss on the {ball}; the table opens.',
                'Just misses the {ball}. Pressure flips.'
              ]
            },
            positionGood: {
              priority: 52,
              cooldownMs: 3200,
              lines: [
                'Lovely leave. {playerName} has a clear view.',
                'Perfect position—{playerName} lines up the next {ball}.',
                'Great control from {playerName}; cue ball exactly where needed.'
              ]
            },
            positionBad: {
              priority: 45,
              cooldownMs: 3200,
              lines: [
                'Not the best leave. {playerName} is awkward now.',
                'Cue ball drifts into trouble for {playerName}.',
                'That position is tough—{playerName} may need a rescue.'
              ]
            },
            positionHooked: {
              priority: 55,
              cooldownMs: 4200,
              lines: [
                'Hooked behind a ball—{playerName} is snookered.',
                '{playerName} loses the angle and sits hooked.',
                'Cue ball buried. {playerName} faces a jump or safety.'
              ]
            },
            safetyGood: {
              priority: 58,
              cooldownMs: 4200,
              lines: [
                'Strong safety. {opponentName} can barely see it.',
                '{playerName} locks it up and forces a difficult reply.',
                'Excellent safety—{opponentName} is in a bind.'
              ]
            },
            safetyFailed: {
              priority: 46,
              cooldownMs: 3800,
              lines: [
                'Safety fails—{opponentName} gets a clean look.',
                '{playerName} leaves an opening on the {ball}.',
                'Not enough cover. {opponentName} has a shot.'
              ]
            },
            foul: {
              priority: 90,
              cooldownMs: 6500,
              lines: [
                'Foul called: {foulType}. Ball in hand to {opponentName}.',
                'Illegal contact—{opponentName} will take ball in hand.',
                'Cue ball scratch! A gift for {opponentName}.',
                'Push out or foul? That is ruled a {foulType}.'
              ]
            },
            pressure: {
              priority: 88,
              cooldownMs: 7000,
              lines: [
                'Hill-hill tension—every shot matters now.',
                'Match ball on the table. {playerName} must hold nerve.',
                '{playerName} is chasing a comeback at {lead} down.'
              ]
            },
            runout: {
              priority: 80,
              cooldownMs: 6500,
              lines: [
                '{playerName} strings {streak} in a row. Runout threat.',
                'Nearly perfect control from {playerName}.',
                'Clean finish loading—{playerName} sees the 9.'
              ]
            },
            short: {
              priority: 20,
              cooldownMs: 2400,
              lines: [
                'Nice shot.',
                'Good pace.',
                'Great control.',
                'Pressure moment.'
              ]
            }
          },
          eventMap: {
            'break.dry': 'breakDry',
            'break.made': 'breakMade',
            'break.scratch': 'breakScratch',
            'pot.legal': 'legalPot',
            'pot.combo': 'comboCarom',
            'pot.carom': 'comboCarom',
            'miss.rattle': 'miss',
            'miss.overcut': 'miss',
            'miss.undercut': 'miss',
            'position.good': 'positionGood',
            'position.bad': 'positionBad',
            'position.hooked': 'positionHooked',
            'safety.good': 'safetyGood',
            'safety.failed': 'safetyFailed',
            'foul': 'foul',
            'pressure.hill': 'pressure',
            'pressure.match': 'pressure',
            'comeback': 'pressure',
            'runout.streak': 'runout',
            'runout.clean': 'runout',
            'short': 'short'
          }
        },
        eightBall: {
          label: '8-Ball',
          defaultVoiceId: '8ball-classic',
          categories: {
            breakOpen: {
              priority: 68,
              cooldownMs: 6000,
              lines: [
                'Open table after the break—choices everywhere.',
                'Break opens the table. {playerName} can choose a group.',
                'Clusters loosen up—this table is wide open.',
                '{playerName} spreads them nicely on the break.'
              ]
            },
            breakThreat: {
              priority: 75,
              cooldownMs: 6500,
              lines: [
                'Early 8-ball drama—{playerName} has a look but must be careful.',
                'The 8 sits near a pocket already. Danger signs.',
                'Break leaves the 8-ball temptingly close to a pocket.'
              ]
            },
            groupChosen: {
              priority: 70,
              cooldownMs: 5200,
              lines: [
                '{playerName} takes {shotType} and claims {ball}.',
                '{playerName} settles on {shotType}—that is the group.',
                'Groups assigned. {playerName} is on {ball}.'
              ]
            },
            clearSet: {
              priority: 65,
              cooldownMs: 5200,
              lines: [
                '{playerName} is clearing the set nicely.',
                'That is another in the set for {playerName}.',
                'The set is thinning—{playerName} is in rhythm.'
              ]
            },
            keyBall: {
              priority: 72,
              cooldownMs: 6000,
              lines: [
                'Key ball down—{playerName} is lining up the 8.',
                'That was the key ball. The 8 is now in sight.',
                '{playerName} solves the key ball problem.'
              ]
            },
            onEight: {
              priority: 88,
              cooldownMs: 7000,
              lines: [
                'On the 8-ball now. Big moment for {playerName}.',
                '{playerName} lines up the 8—match point pressure.',
                'Everything rides on the 8 here.'
              ]
            },
            defenseGood: {
              priority: 58,
              cooldownMs: 4200,
              lines: [
                'Lock-up safety. {opponentName} is tied up.',
                '{playerName} plays the lock and freezes the table.',
                'A tidy safety—{opponentName} has no clear pocket.'
              ]
            },
            defenseCluster: {
              priority: 60,
              cooldownMs: 4500,
              lines: [
                '{playerName} nudges the cluster open—smart timing.',
                'Great cluster break. That opens the run.',
                'The cluster is gone. {playerName} can run now.'
              ]
            },
            foul: {
              priority: 90,
              cooldownMs: 6500,
              lines: [
                'Foul on {playerName}: {foulType}. Ball in hand.',
                'Scratch! {opponentName} takes control.',
                'Illegal 8-ball contact—big mistake.',
                'No rail—foul called. {opponentName} gets ball in hand.'
              ]
            },
            tactical: {
              priority: 55,
              cooldownMs: 3800,
              lines: [
                'Wrong side of the ball—this is tricky now.',
                'Pocket blocked. {playerName} may need a bank.',
                '{playerName} is forced to go two rails here.'
              ]
            },
            miss: {
              priority: 42,
              cooldownMs: 2800,
              lines: [
                'That one hangs in the jaws.',
                'Missed opportunity—{opponentName} has a chance.',
                '{playerName} overcuts it and leaves the table open.',
                'A miss at the worst time for {playerName}.',
                'Rattled in the pocket. It stays up.'
              ]
            },
            short: {
              priority: 20,
              cooldownMs: 2400,
              lines: [
                'Nice touch.',
                'Good call.',
                'Smooth stroke.',
                'Tough angle.'
              ]
            }
          },
          eventMap: {
            'break.open': 'breakOpen',
            'break.threat': 'breakThreat',
            'group.chosen': 'groupChosen',
            'set.clear': 'clearSet',
            'key.ball': 'keyBall',
            'eight.on': 'onEight',
            'pressure.match': 'onEight',
            'defense.lock': 'defenseGood',
            'defense.cluster': 'defenseCluster',
            'foul': 'foul',
            'tactical.blocked': 'tactical',
            'tactical.wrongside': 'tactical',
            'miss': 'miss',
            'short': 'short'
          }
        },
        american: {
          label: 'American Billiards',
          defaultVoiceId: 'american-analyst',
          categories: {
            score: {
              priority: 70,
              cooldownMs: 4200,
              lines: [
                '{playerName} adds {points} points to the tally.',
                'That brings {playerName} to {points} for the run.',
                '{playerName} pockets another and builds the count.',
                'Nice scoring touch—{points} more on the board.',
                '{playerName} keeps the points flowing.'
              ]
            },
            streak: {
              priority: 78,
              cooldownMs: 5200,
              lines: [
                '{playerName} is on a {streak}-ball run.',
                'Streak at {streak} and climbing for {playerName}.',
                'That is {streak} in a row—real rhythm.',
                '{playerName} strings them together with ease.'
              ]
            },
            milestone: {
              priority: 82,
              cooldownMs: 6200,
              lines: [
                '{playerName} reaches {points} points—big milestone.',
                'There is {points} for {playerName}. A strong mark.',
                'Milestone hit: {points} on the card for {playerName}.'
              ]
            },
            position: {
              priority: 60,
              cooldownMs: 3600,
              lines: [
                'Textbook position from {playerName}.',
                'Two-rail route executed perfectly.',
                '{playerName} stays in line with the pattern.',
                'Clean pattern play keeps the run alive.'
              ]
            },
            miss: {
              priority: 45,
              cooldownMs: 3000,
              lines: [
                'That miss sells out big points.',
                '{playerName} comes up short and leaves a chance.',
                'A costly miss at {points} on the run.',
                'That one leaks out—opportunity swings.'
              ]
            },
            safety: {
              priority: 55,
              cooldownMs: 4200,
              lines: [
                'Safety exchange continues. {playerName} keeps it tight.',
                'Smart containing safety from {playerName}.',
                '{playerName} forces the error with a measured safety.'
              ]
            },
            leadChange: {
              priority: 80,
              cooldownMs: 6400,
              lines: [
                'Lead change—{playerName} now ahead by {lead}.',
                '{playerName} flips the lead. That is a swing.',
                'The race tightens—{lead} separates them now.'
              ]
            },
            shotClock: {
              priority: 65,
              cooldownMs: 5200,
              lines: [
                'Clock pressure—{playerName} needs a quick decision.',
                'Shot clock ticking. {playerName} has to commit.',
                'Time pressure rising. {playerName} stays composed.'
              ]
            },
            short: {
              priority: 20,
              cooldownMs: 2400,
              lines: [
                'Well played.',
                'Good pattern.',
                'Nice touch.',
                'Steady pace.'
              ]
            }
          },
          eventMap: {
            'score': 'score',
            'streak': 'streak',
            'milestone': 'milestone',
            'position.good': 'position',
            'miss': 'miss',
            'safety': 'safety',
            'lead.change': 'leadChange',
            'shotclock': 'shotClock',
            'short': 'short'
          }
        },
        snooker: {
          label: 'Snooker',
          defaultVoiceId: 'snooker-calm',
          categories: {
            breakBuild: {
              priority: 78,
              cooldownMs: 5200,
              lines: [
                '{playerName} moves to {breakPoints} in the break.',
                'Break at {breakPoints} and counting.',
                '{playerName} is building nicely, now {breakPoints}.',
                'That takes the break to {breakPoints}.',
                'A smooth visit—{playerName} grows the break.'
              ]
            },
            milestone: {
              priority: 88,
              cooldownMs: 7000,
              lines: [
                'That is {breakPoints}—a landmark break.',
                'Fifty up for {playerName}.',
                'Century watch—{breakPoints} on the scoreboard.',
                '{playerName} reaches {breakPoints} with ease.'
              ]
            },
            colorSequence: {
              priority: 70,
              cooldownMs: 4600,
              lines: [
                'Reds and blacks flowing for {playerName}.',
                'Beautiful sequence—reds with a black to follow.',
                '{playerName} takes blue and stays perfect.',
                'Now onto the colors—precision required.'
              ]
            },
            safety: {
              priority: 65,
              cooldownMs: 4200,
              lines: [
                'Safety duel underway. {playerName} lays a snooker.',
                'Excellent safety—{opponentName} needs an escape.',
                'A thin hit escape keeps {playerName} safe.',
                'Smart containment from {playerName}.'
              ]
            },
            foul: {
              priority: 92,
              cooldownMs: 7000,
              lines: [
                'Foul: {foulType}. {points} points to {opponentName}.',
                'In-off! That costs {points}.',
                'Miss called—{opponentName} will have it again.',
                'Free ball situation after the foul.'
              ]
            },
            frameContext: {
              priority: 90,
              cooldownMs: 7200,
              lines: [
                'Frame ball now. {playerName} can close it out.',
                'Needs snookers: {remaining} required.',
                'Clearing the colors could decide the frame.',
                '{playerName} is chasing with {remaining} reds left.'
              ]
            },
            difficulty: {
              priority: 72,
              cooldownMs: 4600,
              lines: [
                'Long pot attempt—{difficulty} difficulty.',
                'Rest shot coming up. Tricky mechanics.',
                'Screw shot needed here. Plenty of touch.',
                'Stun and hold—delicate cue ball control.'
              ]
            },
            miss: {
              priority: 45,
              cooldownMs: 3200,
              lines: [
                'That one stays out. Chance for {opponentName}.',
                'Missed the long pot—table opens.',
                '{playerName} rattles it and loses the chance.',
                'That was close, but it does not drop.'
              ]
            },
            short: {
              priority: 20,
              cooldownMs: 2400,
              lines: [
                'Lovely cueing.',
                'Excellent touch.',
                'Very composed.',
                'Tactical moment.'
              ]
            }
          },
          eventMap: {
            'break': 'breakBuild',
            'break.milestone': 'milestone',
            'color.sequence': 'colorSequence',
            'safety': 'safety',
            'foul': 'foul',
            'frame.context': 'frameContext',
            'difficulty': 'difficulty',
            'miss': 'miss',
            'short': 'short'
          }
        }
      }
    }
  }
};

export const COMMENTARY_DEFAULT_VOICES = {
  nineBall: '9ball-energetic',
  eightBall: '8ball-classic',
  american: 'american-analyst',
  snooker: 'snooker-calm'
};
