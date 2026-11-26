export function firstShiftPrompt<T extends {title: string; detail: string; training: boolean}>(context: {
  missionId?: string | null;
  finished: boolean;
  objective: T;
  mode: 'walking' | 'driving' | 'flying';
  learned: readonly string[];
}): T;
