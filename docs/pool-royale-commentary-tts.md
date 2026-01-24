# Pool Royale Commentary + TTS System (Chatterbox)

## Plan (high level)
1. **Define data-first commentary content** for all 4 modes in JSON with categories, cooldowns, priorities, and template lines.
2. **Add a commentary manager** to select lines, fill placeholders, apply cooldown/suppression, and avoid repeats.
3. **Wrap Chatterbox TTS** in a cache-first service with deterministic keys and an async queue.
4. **Expose a lightweight API** (`onEvent`) for the game to request commentary output without blocking gameplay.
5. **Document event schemas + examples** to make future localization (English → Albanian) straightforward.

## Module structure
```
webapp/src/games/commentary/
  commentaryDatabase.json
  commentaryManager.js
  chatterboxTtsService.js
  commentarySchemas.js
  index.js
```

## Commentary database format
```json
{
  "meta": {
    "locale": "en",
    "version": 1,
    "placeholders": ["{playerName}", "{ball}", "{points}"]
  },
  "modes": {
    "9ball": {
      "id": "9ball",
      "voiceProfile": "energetic",
      "categories": {
        "break": {
          "eventTypes": ["break.dry", "break.made", "break.scratch"],
          "priority": 80,
          "cooldownMs": 6000,
          "suppresses": ["short"],
          "suppressMs": 3000,
          "lines": ["Dry break from {playerName}—nothing drops."]
        }
      }
    }
  }
}
```

## Commentary manager behavior (implementation notes)
- **Input**: `onEvent(gameMode, eventType, context)`.
- **Selection**: map `eventType` to a category, prefer highest `priority` among pending events.
- **Cooldowns**: enforce `globalCooldownMs` and per-category `cooldownMs`.
- **Suppression**: allow high-priority categories to suppress low-priority categories for `suppressMs`.
- **Non-repetition**: keep a `historySize` window to avoid repeating recent lines.
- **Output**: resolves to `{ text, audio, category, mode }` or `null`.

### Selection pseudocode
```
function onEvent(gameMode, eventType, context) -> Promise
  enqueue event
  processQueue()

processQueue():
  while pendingEvents:
    best = pickBestEventByPriorityAndAge()
    if suppressed or cooldown => skip
    wait for global cooldown
    template = pickLineWithoutRecentRepeats()
    line = fillPlaceholders(template, context)
    audio = ttsService.synthesize(line, voiceSettings)
    resolve promise with audio
```

## Chatterbox TTS wrapper
- **synthesize(text, options)**
  - normalizes whitespace/punctuation
  - clamps length to `maxTextLength`
  - caches by `(voiceId + normalizedText + settings)`
  - async queue to avoid blocking gameplay
- **preload(lines)**
  - warm-up at match start for common lines

## Rules to avoid spam
- **Global cooldown**: 2–4s (default 2.5s in manager)
- **Category cooldown**: 3–8s (set per category in JSON)
- **Suppression**: foul/pressure suppress short commentary lines
- **Priority**: foul > match point/frame ball > big break > normal pot > short filler

## Example commentary lines (sample)
### 9-ball
- “Dry break from {playerName}—nothing drops.”
- “Open break, but no ball down for {playerName}.”
- “Solid break—{playerName} pockets a ball and keeps the table.”
- “Combination play—{ball} falls from the carom.”
- “Two-ball combo and the {ball} drops.”
- “Rattles in the jaws—{ball} stays up.”
- “Overcut it, and the {ball} stays on the table.”
- “Perfect leave—{playerName} is on the next ball.”
- “The 9 is waiting—match ball pressure.”
- “Clean finish—runout complete.”

### 8-ball
- “Open table after the break.”
- “That break splits the pack nicely.”
- “Clusters remain—work to do from here.”
- “{playerName} takes solids.”
- “Stripes are the choice for {playerName}.”
- “Key ball cleared—{playerName} is on the 8.”
- “One ball left before the money ball.”
- “Pocket blocked—bank may be required.”
- “Wrong side of the ball, tough route now.”
- “On the 8-ball now—big moment.”

### American billiards (points-based)
- “Point on the board for {playerName}.”
- “That adds {points} to the tally.”
- “{streak} in a row—{playerName} is flowing.”
- “Streak extends, {playerName} in full control.”
- “Milestone hit—{points} points for {playerName}.”
- “Race marker reached at {points}.”
- “Textbook position there.”
- “Two-rail route and perfect line.”
- “Missed, and that could sell out points.”
- “Lead grows to {lead} points.”

### Snooker
- “Break building now, {breakPoints} and counting.”
- “That’s {breakPoints} in the break for {playerName}.”
- “Switching to colors, blue to follow.”
- “Pink is there—position looks perfect.”
- “That’s a good snooker, {opponentName} is stuck.”
- “Excellent escape, threaded through.”
- “Frame ball on the table.”
- “Needs snookers now to stay alive.”
- “Long pot from distance—{difficulty} shot.”
- “Rest shot coming up, steady hands.”

## Example event payloads
```json
{
  "gameMode": "9ball",
  "eventType": "shot.pot",
  "context": { "playerName": "Arben", "ball": "3", "positionQuality": "good", "runCount": 4 }
}
```
```json
{
  "gameMode": "8ball",
  "eventType": "pressure.on8",
  "context": { "playerName": "Lina", "onEightBall": true, "pocketBlocked": false }
}
```
```json
{
  "gameMode": "american",
  "eventType": "score.point",
  "context": { "playerName": "Mira", "currentPoints": 38, "streak": 7, "lead": 12 }
}
```
```json
{
  "gameMode": "snooker",
  "eventType": "break.build",
  "context": { "playerName": "Noel", "breakPoints": 56, "remainingReds": 3, "needsSnookers": false }
}
```

## Notes on localization
- Keep templates in `commentaryDatabase.json` per locale key.
- All placeholders are stable and language-agnostic.
- Add a `meta.locale` and new language nodes for Albanian when ready.
