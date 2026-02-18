# Pool Royal Training Mode (50-Level Solo Roadmap)

## Goals implemented in this design

- **Solo training only**: no AI opponent in training.
- **No dice gating** in training mode.
- **50 levels** with different ball layouts and increasing complexity.
- **Roadmap popup after each cleared level** so players see progression.
- **Persistent loaded state**: keep player in training flow without lobby reload.
- **Saved progress**: player resumes from the last unlocked level.
- **Attempt economy**: each level grants 3 attempts; any unused attempts roll forward.

This model is represented in `src/rules/PoolRoyaleTraining.ts` and can be integrated with your UI/state machine.

## Drill families used (inspired by common pool coaching practice)

The 50 tasks are grouped into 10 strategy families (5 levels each):

1. Stop-shot control
2. Stun / follow / draw control
3. Cut-angle ladder
4. Rail-first recovery (kick basics)
5. Bank-shot fundamentals
6. Combination paths
7. Cluster breakout
8. Safety placement
9. Speed-control zones
10. Mini runout patterns

This mirrors real-world practice progressions used in pool academies and billiards training apps: fundamentals first, then rails, then pattern/runout decisions.

## Core flow

1. Player selects **Training**.
2. Game loads `TrainingProgress` from local/cloud profile.
3. `startTrainingLevel()` initializes attempts for that level: `3 + carryOverAttempts`.
4. On each missed run, call `consumeAttempt()`.
5. On success, call `completeCurrentLevel()`, then show roadmap popup from `getTrainingRoadmap()`.
6. Persist updated `TrainingProgress` and continue to next task without unloading table scene.

## Data contract summary

Main structures:

- `TRAINING_MODE_CONFIG`
- `TRAINING_TASKS` (50 tasks)
- `TrainingProgress`
- `TrainingRoadmapNode`

Main functions:

- `createInitialTrainingProgress()`
- `startTrainingLevel()`
- `consumeAttempt()`
- `completeCurrentLevel()`
- `getCurrentTrainingTask()`
- `getTrainingRoadmap()`

## UI integration notes

- Add a **Training badge** in HUD: `Level X/50` + `Attempts Left`.
- Show roadmap popup after pass:
  - completed levels = green/check
  - current level = highlighted
  - locked levels = dimmed
- Keep return path: `Training -> Lobby` should not clear progress.
- Autosave on: level start, attempt consumed, level complete, app background.

## Suggested next step

If you want, I can now add a concrete React/Unity UI integration layer that:

- binds this module to your existing game state,
- renders a mobile-friendly vertical roadmap (portrait-first),
- and persists training progress in the same storage you already use for player profiles.
