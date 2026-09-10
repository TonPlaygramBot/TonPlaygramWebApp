// Strict public-contract check; intentionally independent of graphics packages.
// Full application typechecking is a separate CI job, not implied by this test.
import {
  makeTrack,
  createRacer,
  stepRace,
  aiInput,
  TRACKS,
  CUPS,
  type Input,
  type Racer,
  type Track
} from '../webapp/src/games/kartroyale/simulation.mjs';
import { createHeldRaceInput } from '../webapp/src/games/kartroyale/heldRaceInput.mjs';
import {
  finishKartTask,
  freshKartTasks,
  type KartTasks
} from '../webapp/src/games/kartroyale/kartTaskCore.mjs';
import { racingActivity } from '../webapp/src/games/kartroyale/racingModeCore.mjs';
type IsAny<T> = 0 extends 1 & T ? true : false;
type AssertFalse<T extends false> = T;
export type RacerIsTyped = AssertFalse<IsAny<Racer>>;
export type TrackIsTyped = AssertFalse<IsAny<Track>>;
export type TrackFactoryIsTyped = AssertFalse<
  IsAny<ReturnType<typeof makeTrack>>
>;
const track: Track = makeTrack(TRACKS[0].id);
const racer: Racer = createRacer(track, 'contract', 'Contract');
const input: Input = aiInput(racer, track, 0);
const held = createHeldRaceInput();
held.hold('finger', 'steer', 1);
const current: Input = { ...held.read(), shield: false, fire: false };
racer.input = current;
stepRace([racer], track, 1 / 60, 1 / 60);
const progress: KartTasks = finishKartTask(
  freshKartTasks(),
  'qender-qualifier',
  {}
).profile;
const mode: 'race' | 'career' | 'explore' = racingActivity('');
void [input, progress, mode, CUPS];
