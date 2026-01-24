# Commentary + TTS System (Pool Royale / Snooker Royale)

## Plan
1. **Data-driven commentary**: store all lines as templates with placeholders per game mode.
2. **Selection manager**: choose lines by event priority, cooldowns, and recent history.
3. **Chatterbox TTS wrapper**: offline synthesis with caching + async queue.
4. **Engine-agnostic API**: one `onEvent` call for gameplay; optional queueing.
5. **Mobile optimization**: warm up common lines during idle/turn transitions.

## Module structure
```
webapp/src/services/commentary/
  commentaryDatabase.js     # Templates, priorities, cooldowns, event map
  CommentaryManager.js      # Event -> line selection, spam controls, queueing
  ChatterboxTtsService.js   # Chatterbox adapter wrapper + cache + async queue
```

## Commentary database format
- `COMMENTARY_DATABASE.locales[locale].modes[modeId]` contains:
  - `categories`: map of category id -> { priority, cooldownMs, lines[] }
  - `eventMap`: eventType -> category id
  - `defaultVoiceId`

Example (shortened):
```js
{
  schemaVersion: 1,
  rules: { globalCooldownMs: [2000, 4000], historySize: 8 },
  locales: {
    en: {
      modes: {
        nineBall: {
          defaultVoiceId: '9ball-energetic',
          categories: {
            breakDry: {
              priority: 70,
              cooldownMs: 6000,
              lines: ['Dry break for {playerName}.']
            }
          },
          eventMap: { 'break.dry': 'breakDry' }
        }
      }
    }
  }
}
```

## Commentary selection logic
- **Priority**: each category sets a priority (foul > match point > runout > pot).
- **Cooldowns**:
  - global cooldown range (2–4s), randomized per line
  - per-category cooldown (3–8s typical)
- **History suppression**: avoid repeating recent lines (default window: 8).
- **Queueing**: multiple events can be queued; manager drains highest-priority event.
- **Suppression flags**: `context.suppressCommentary`, `context.isReplay`, `context.isQuietPeriod`.

### Pseudocode
```pseudo
function onEvent(mode, eventType, context):
  category = lookupCategory(mode, eventType)
  if cooldowns active or suppress flags -> return null
  template = randomLineExcludingHistory(category)
  text = fillPlaceholders(template, context)
  if ttsService -> synthesize(text)
  store history + timestamps
  return selection
```

## Chatterbox TTS wrapper
- **Inputs**: text + voiceId + speed/pitch/style + sampleRate.
- **Outputs**: ArrayBuffer WAV (OGG optional).
- **Caching**: key = hash(voiceId + normalizedText + settings).
- **Async queue**: avoids blocking the render loop.
- **Warm-up**: pre-generate common lines at match start or between turns.

### Adapter contract
```js
adapter.synthesize({ text, voiceId, speed, pitch, style, sampleRate, format })
  -> Promise<ArrayBuffer>
```

## Engine-agnostic API
```ts
onEvent(gameMode, eventType, context) -> {
  text,
  audio, // ArrayBuffer
  categoryId,
  priority
}
```

## Event payload schemas (examples)
- **9-ball pot**
```json
{
  "eventType": "pot.legal",
  "context": {
    "playerName": "Ardi",
    "ball": "3",
    "positionQuality": "good",
    "runCount": 4
  }
}
```

- **8-ball on the 8**
```json
{
  "eventType": "eight.on",
  "context": {
    "playerName": "Lina",
    "onEightBall": true,
    "pocketBlocked": false
  }
}
```

- **American points**
```json
{
  "eventType": "streak",
  "context": {
    "playerName": "Milo",
    "currentPoints": 38,
    "streak": 7,
    "lead": "+12"
  }
}
```

- **Snooker break**
```json
{
  "eventType": "break",
  "context": {
    "playerName": "Dana",
    "breakPoints": 56,
    "remainingReds": 3,
    "needsSnookers": false
  }
}
```

## Example lines (tone + variety)
### 9-ball (samples)
- "Dry break for {playerName}. That opens the door."
- "Ball down on the break. Nice start for {playerName}."
- "Combination play—{playerName} threads the {ball} in."
- "Cue ball scratch! A gift for {opponentName}."
- "Hill-hill tension—every shot matters now."
- "{playerName} strings {streak} in a row. Runout threat."
- "Lovely leave. {playerName} has a clear view."
- "A miss on the {ball}; the table opens."
- "Strong safety. {opponentName} can barely see it."
- "Nice shot."

### 8-ball (samples)
- "Open table after the break—choices everywhere."
- "Groups assigned. {playerName} is on {ball}."
- "That was the key ball. The 8 is now in sight."
- "On the 8-ball now. Big moment for {playerName}."
- "Lock-up safety. {opponentName} is tied up."
- "No rail—foul called. {opponentName} gets ball in hand."
- "Pocket blocked. {playerName} may need a bank."
- "Missed opportunity—{opponentName} has a chance."
- "Smooth stroke."
- "Tough angle."

### American billiards (samples)
- "{playerName} adds {points} points to the tally."
- "{playerName} is on a {streak}-ball run."
- "Milestone hit: {points} on the card for {playerName}."
- "Textbook position from {playerName}."
- "That miss sells out big points."
- "Safety exchange continues. {playerName} keeps it tight."
- "Lead change—{playerName} now ahead by {lead}."
- "Clock pressure—{playerName} needs a quick decision."
- "Well played."
- "Steady pace."

### Snooker (samples)
- "{playerName} moves to {breakPoints} in the break."
- "Century watch—{breakPoints} on the scoreboard."
- "Reds and blacks flowing for {playerName}."
- "Excellent safety—{opponentName} needs an escape."
- "Foul: {foulType}. {points} points to {opponentName}."
- "Frame ball now. {playerName} can close it out."
- "Long pot attempt—{difficulty} difficulty."
- "That one stays out. Chance for {opponentName}."
- "Lovely cueing."
- "Tactical moment."
