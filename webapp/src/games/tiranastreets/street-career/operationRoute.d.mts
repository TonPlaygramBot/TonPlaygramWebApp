import type {Mission, Point} from '../shared/engine.mjs';
import type {MissionDirector} from './missionDirectorCore.mjs';
export function operationTarget(mission: Mission | undefined, director?: Partial<MissionDirector>, remaining?: number): (Point & {name:string}) | null | undefined;
