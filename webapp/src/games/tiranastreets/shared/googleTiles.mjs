// Keep this origin and projection identical to build-tirana-map.py.
export const GOOGLE_MAP_ORIGIN = [41.3275, 19.8188];
export const GOOGLE_TILE_PREFIX = '/api/tirana-3d/tiles';
export const GOOGLE_ROOT_PATH = '/v1/3dtiles/root.json';
export const GOOGLE_SESSION_MS = 170 * 60 * 1000;

export function gameToGeographic(x, z) {
  const [lat, lon] = GOOGLE_MAP_ORIGIN;
  return [
    lat - z / 111320,
    lon + x / (111320 * Math.cos((lat * Math.PI) / 180))
  ];
}

export function ecef(lat, lon, height = 0) {
  const phi = (lat * Math.PI) / 180,
    lambda = (lon * Math.PI) / 180;
  const a = 6378137,
    e2 = 6.6943799901413165e-3;
  const n = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  return [
    (n + height) * Math.cos(phi) * Math.cos(lambda),
    (n + height) * Math.cos(phi) * Math.sin(lambda),
    (n * (1 - e2) + height) * Math.sin(phi)
  ];
}

/** Rigid ECEF -> local east/up/south (row-major). No non-uniform tile scaling.
 * The source OSM map's 111320 approximation differs by <3 m over this district.
 */
export function ecefToGameMatrix(height = 0) {
  const [lat, lon] = GOOGLE_MAP_ORIGIN;
  const phi = (lat * Math.PI) / 180,
    lambda = (lon * Math.PI) / 180;
  const s = Math.sin(phi),
    c = Math.cos(phi),
    sl = Math.sin(lambda),
    cl = Math.cos(lambda);
  const rows = [
    [-sl, cl, 0],
    [c * cl, c * sl, s],
    [s * cl, s * sl, -c]
  ];
  const origin = ecef(lat, lon, height);
  return [
    ...rows.flatMap((r) => [
      ...r,
      -r.reduce((sum, v, i) => sum + v * origin[i], 0)
    ]),
    0,
    0,
    0,
    1
  ];
}

export function tileBudget(quality) {
  return quality === 'battery'
    ? { error: 28, downloads: 3, parse: 1, bytes: 80 * 1024 ** 2, items: 350 }
    : quality === 'high'
      ? {
          error: 12,
          downloads: 6,
          parse: 2,
          bytes: 200 * 1024 ** 2,
          items: 800
        }
      : {
          error: 20,
          downloads: 4,
          parse: 2,
          bytes: 128 * 1024 ** 2,
          items: 550
        };
}

/** No API keys, arbitrary hosts, traversal, or unrelated Google APIs. */
export function googleTileUrl(path, search = '') {
  if (
    typeof path !== 'string' ||
    path.length > 4096 ||
    !/^\/v1\/3dtiles\/(root\.json|datasets\/[A-Za-z0-9_~./-]+\.(json|glb|gltf|b3dm|pnts|bin|jpg|jpeg|png|webp))$/.test(
      path
    ) ||
    path.includes('//') ||
    path.split('/').some((p) => p === '.' || p === '..')
  )
    throw Error('Invalid tile path');
  const query = new URLSearchParams(search);
  if (
    [...query.keys()].some((k) => k !== 'session') ||
    query.getAll('session').length > 1
  )
    throw Error('Invalid tile query');
  const session = query.get('session');
  if (
    session &&
    (session.length > 2048 || !/^[A-Za-z0-9_~.+/=-]+$/.test(session))
  )
    throw Error('Invalid tile session');
  const url = new URL(path, 'https://tile.googleapis.com');
  if (session) url.searchParams.set('session', session);
  return url;
}

/** Rewrite only resource links; preserve all geometry and attribution metadata. */
export function rewriteTileJson(value, upstream, proxyOrigin) {
  if (Array.isArray(value))
    return value.map((v) => rewriteTileJson(v, upstream, proxyOrigin));
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if ((key === 'uri' || key === 'url') && typeof item === 'string') {
      const url = new URL(item, upstream);
      if (
        url.origin !== 'https://tile.googleapis.com' ||
        url.username ||
        url.password ||
        url.hash
      )
        throw Error('Unsupported tile resource');
      url.searchParams.delete('key');
      if (
        !url.searchParams.has('session') &&
        upstream.searchParams.has('session')
      )
        url.searchParams.set('session', upstream.searchParams.get('session'));
      const safe = googleTileUrl(url.pathname, url.search);
      result[key] = new URL(
        GOOGLE_TILE_PREFIX + safe.pathname + safe.search,
        proxyOrigin
      ).href;
    } else result[key] = rewriteTileJson(item, upstream, proxyOrigin);
  }
  return result;
}

export function googleTileConfig(env = {}) {
  const enabled =
    Boolean(env.GOOGLE_MAPS_TILE_API_KEY?.trim()) &&
    env.GOOGLE_MAPS_3D_ENABLED !== 'false';
  const raw = Number(env.GOOGLE_MAPS_TILE_ORIGIN_HEIGHT);
  // Ellipsoidal metres, not elevation above sea level; calibrate on activation.
  const originHeight =
    env.GOOGLE_MAPS_TILE_ORIGIN_HEIGHT &&
    Number.isFinite(raw) &&
    raw >= -100 &&
    raw <= 1000
      ? raw
      : 150;
  return {
    enabled,
    origin: GOOGLE_MAP_ORIGIN,
    originHeight,
    root: GOOGLE_TILE_PREFIX + GOOGLE_ROOT_PATH,
    reason: enabled ? null : 'not_configured'
  };
}

/** In-memory per-principal request budget; no tiles or API credentials stored. */
export function makeTileLimiter(now = Date.now) {
  const windows = new Map();
  return (id) => {
    const time = now();
    if (windows.size >= 4096)
      for (const [key, value] of windows)
        if (time - value.start >= 60000) windows.delete(key);
    let value = windows.get(id);
    if (!value || time - value.start >= 60000) {
      if (!value && windows.size >= 4096) return false;
      value = { start: time, count: 0 };
      windows.set(id, value);
    }
    return ++value.count <= 360;
  };
}

export async function proxyGoogleTile(
  request,
  { apiKey, path, proxyOrigin, fetcher = fetch }
) {
  const headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  const failure = (status, error) =>
    Response.json({ error }, { status, headers });
  if (!apiKey?.trim()) return failure(503, 'not_configured');
  let upstream;
  try {
    upstream = googleTileUrl(path, new URL(request.url).search);
  } catch {
    return failure(400, 'invalid_tile');
  }
  upstream.searchParams.set('key', apiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const forwarded = new Headers();
    const etag = request.headers.get('if-none-match');
    if (etag) forwarded.set('If-None-Match', etag);
    const response = await fetcher(upstream.href, {
      headers: forwarded,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.any([request.signal, controller.signal])
    });
    if (!response.ok && response.status !== 304) {
      await response.body?.cancel();
      return failure(
        response.status === 429
          ? 429
          : response.status === 403 || response.status === 401
            ? 403
            : 502,
        response.status === 429
          ? 'quota_exceeded'
          : response.status === 403 || response.status === 401
            ? 'access_denied'
            : 'tiles_unavailable'
      );
    }
    const out = new Headers(headers);
    for (const key of [
      'content-type',
      'cache-control',
      'etag',
      'last-modified'
    ]) {
      const value = response.headers.get(key);
      if (value) out.set(key, value);
    }
    // Tiles remain private to this authenticated viewer, even if upstream is public.
    out.set(
      'Cache-Control',
      'private, ' +
        (out.get('Cache-Control') || 'no-store').replace(
          /\bpublic\s*,?\s*/g,
          ''
        )
    );
    if (response.status === 304)
      return new Response(null, { status: 304, headers: out });
    if (path.endsWith('.json')) {
      // Avoid buffering an unbounded upstream error/document in a Worker isolate.
      const reader = response.body.getReader(),
        chunks = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8 * 1024 ** 2) {
          await reader.cancel();
          return failure(502, 'tiles_unavailable');
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const json = rewriteTileJson(
        JSON.parse(new TextDecoder().decode(bytes)),
        upstream,
        proxyOrigin
      );
      out.set('Cache-Control', 'private, no-store');
      out.delete('etag');
      out.delete('last-modified');
      return Response.json(json, { headers: out });
    }
    return new Response(response.body, { headers: out });
  } catch {
    return failure(502, 'tiles_unavailable');
  } finally {
    clearTimeout(timer);
  }
}
