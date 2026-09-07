export const GOOGLE_MAP_ORIGIN: number[];
export const GOOGLE_TILE_PREFIX: string;
export const GOOGLE_ROOT_PATH: string;
export const GOOGLE_SESSION_MS: number;
export function gameToGeographic(x: number, z: number): number[];
export function ecef(lat: number, lon: number, height?: number): number[];
export function ecefToGameMatrix(height?: number): number[];
export function tileBudget(quality: string): {
  error: number;
  downloads: number;
  parse: number;
  bytes: number;
  items: number;
};
export function googleTileUrl(path: string, search?: string): URL;
export function rewriteTileJson(
  value: unknown,
  upstream: URL,
  proxyOrigin: string
): unknown;
export type GoogleTileConfig = {
  enabled: boolean;
  origin: number[];
  originHeight: number;
  root: string;
  reason: string | null;
};
export function googleTileConfig(
  env?: Record<string, string | undefined>
): GoogleTileConfig;
export function makeTileLimiter(now?: () => number): (id: string) => boolean;
export function proxyGoogleTile(
  request: Request,
  options: {
    apiKey?: string;
    path: string;
    proxyOrigin: string;
    fetcher?: typeof fetch;
  }
): Promise<Response>;
