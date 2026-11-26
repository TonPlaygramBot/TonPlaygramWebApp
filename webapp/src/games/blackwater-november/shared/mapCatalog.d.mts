import type {BattlefieldMapId} from '../core';
export const BATTLEFIELD_MAP_CATALOG: ReadonlyArray<Readonly<{
  id: BattlefieldMapId;
  name: string;
  worldX: number;
  worldZ: number;
}>>;
