type Position = { x: number; z: number };
export class StreetRouteRefresh {
  clear(): void;
  request(mode: 'drive' | 'walk', origin: Position, target: Position): boolean;
}
