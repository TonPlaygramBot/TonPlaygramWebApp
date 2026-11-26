export type PlayerByteOptions = {signal?: AbortSignal; reload?: boolean};
export type PlayerByteCache = {load(url: string, options?: PlayerByteOptions): Promise<ArrayBuffer>; clear(): void; evict(url: string): void; readonly byteLength: number; readonly size: number};
export function createPlayerByteCache(options?: {maxBytes?: number; maxEntries?: number; ttl?: number; now?: () => number; fetcher?: typeof fetch}): PlayerByteCache;
export const playerModelBytes: PlayerByteCache;
export function loadPlayerModelBytes(url: string | URL, options?: PlayerByteOptions): Promise<ArrayBuffer>;
export function discardPlayerModelBytes(url: string | URL): void;
