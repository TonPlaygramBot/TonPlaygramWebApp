import test from 'node:test';
import assert from 'node:assert/strict';
import {
  googleTileUrl,
  rewriteTileJson,
  googleTileConfig,
  proxyGoogleTile,
  makeTileLimiter,
  ecef,
  ecefToGameMatrix,
  gameToGeographic,
  tileBudget,
  GOOGLE_ROOT_PATH,
  GOOGLE_TILE_PREFIX
} from '../webapp/src/games/tiranastreets/shared/googleTiles.mjs';

const origin = 'https://game.example';
const path = '/v1/3dtiles/datasets/CgA/files/test.glb';
const request = (p = path, search = '?session=valid_session') =>
  new Request(origin + GOOGLE_TILE_PREFIX + p + search);
const transformed = (m, p) =>
  [0, 1, 2].map(
    (i) =>
      m[i * 4] * p[0] + m[i * 4 + 1] * p[1] + m[i * 4 + 2] * p[2] + m[i * 4 + 3]
  );

test('Google origin and east/up/south match; map projection drift stays under 3 metres', () => {
  const m = ecefToGameMatrix(150);
  assert.ok(
    Math.hypot(...transformed(m, ecef(...gameToGeographic(0, 0), 150))) < 1e-6
  );
  for (const [x, z] of [
    [100, 0],
    [0, 100],
    [-805, -380],
    [660, 1150]
  ]) {
    const [tx, y, tz] = transformed(m, ecef(...gameToGeographic(x, z), 150));
    assert.ok(Math.abs(tx - x) < 3, `x ${x} -> ${tx}`);
    assert.ok(Math.abs(tz - z) < 3, `z ${z} -> ${tz}`);
    assert.ok(Math.abs(y) < 0.2);
  }
  assert.ok(
    Math.abs(transformed(m, ecef(...gameToGeographic(0, 0), 160))[1] - 10) <
      1e-6
  );
});

test('missing key leaves the existing city enabled without leaking credentials', () => {
  assert.equal(googleTileConfig().enabled, false);
  assert.equal(
    googleTileConfig({ GOOGLE_MAPS_TILE_API_KEY: '  ' }).enabled,
    false
  );
  assert.equal(
    googleTileConfig({
      GOOGLE_MAPS_TILE_API_KEY: 'private-fixture',
      GOOGLE_MAPS_3D_ENABLED: 'false'
    }).enabled,
    false
  );
  const config = googleTileConfig({
    GOOGLE_MAPS_TILE_API_KEY: 'private-fixture',
    GOOGLE_MAPS_TILE_ORIGIN_HEIGHT: '158.75'
  });
  assert.equal(config.enabled, true);
  assert.equal(config.originHeight, 158.75);
  assert.ok(!JSON.stringify(config).includes('private-fixture'));
  assert.equal(
    googleTileConfig({ GOOGLE_MAPS_TILE_ORIGIN_HEIGHT: 'NaN' }).originHeight,
    150
  );
});

test('request URLs preserve Google sessions and prohibit other hosts, APIs, paths and keys', () => {
  assert.equal(
    googleTileUrl(path, '?session=abc-_').hostname,
    'tile.googleapis.com'
  );
  for (const invalid of [
    'https://evil.example/a.glb',
    '//evil.example/a.glb',
    '/v1/streetview/a.jpg',
    '/v1/3dtiles/../secret.json',
    '/v1/3dtiles/datasets/%2e%2e/secret.glb',
    '/v1/3dtiles/datasets/a//b.glb'
  ])
    assert.throws(() => googleTileUrl(invalid));
  for (const invalid of [
    '?key=steal',
    '?session=a&session=b',
    '?redirect=https://evil.example',
    '?session=' + 'x'.repeat(2049)
  ])
    assert.throws(() => googleTileUrl(path, invalid));
});

test('nested tilesets keep filename extensions, sessions and copyright; upstream key stays server-side', () => {
  const source = {
    root: {
      content: {
        uri: '/v1/3dtiles/datasets/CgA/files/next.json?key=private-fixture&session=abc'
      },
      children: [{ content: { url: 'test.glb' } }]
    },
    asset: { copyright: 'Data © Provider; Google' }
  };
  const result = rewriteTileJson(
    source,
    new URL(
      'https://tile.googleapis.com/v1/3dtiles/datasets/CgA/files/base.json?session=abc'
    ),
    origin
  );
  assert.equal(
    result.root.content.uri,
    origin +
      GOOGLE_TILE_PREFIX +
      '/v1/3dtiles/datasets/CgA/files/next.json?session=abc'
  );
  assert.equal(
    result.root.children[0].content.url,
    origin + GOOGLE_TILE_PREFIX + path + '?session=abc'
  );
  assert.equal(result.asset.copyright, source.asset.copyright);
  assert.ok(!JSON.stringify(result).includes('private-fixture'));
  assert.throws(() =>
    rewriteTileJson(
      { uri: 'https://evil.example/x.glb' },
      googleTileUrl(GOOGLE_ROOT_PATH),
      origin
    )
  );
});

test('proxy never fetches when a key or valid scope is missing', async () => {
  const fetcher = () => {
    throw Error('Must not contact upstream');
  };
  assert.equal(
    (await proxyGoogleTile(request(), { path, proxyOrigin: origin, fetcher }))
      .status,
    503
  );
  assert.equal(
    (
      await proxyGoogleTile(request(), {
        apiKey: 'fixture',
        path: '/v1/secrets',
        proxyOrigin: origin,
        fetcher
      })
    ).status,
    400
  );
});

test('binary forwarding preserves exact bytes, private caching and ETag without forwarding identity', async () => {
  let seen;
  const body = new Uint8Array([0, 1, 2, 255, 128]);
  const req = new Request(request(), {
    headers: {
      'X-Telegram-Init-Data': 'signed-user',
      Cookie: 'session=user',
      'If-None-Match': 'tag'
    }
  });
  const response = await proxyGoogleTile(req, {
    apiKey: 'private-fixture',
    path,
    proxyOrigin: origin,
    fetcher: async (url, options) => {
      seen = { url, options };
      return new Response(body, {
        headers: {
          'Content-Type': 'model/gltf-binary',
          'Cache-Control': 'public, max-age=120, must-revalidate',
          ETag: 'tag'
        }
      });
    }
  });
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), body);
  assert.equal(new URL(seen.url).searchParams.get('key'), 'private-fixture');
  assert.equal(new URL(seen.url).searchParams.get('session'), 'valid_session');
  assert.equal(seen.options.headers.get('if-none-match'), 'tag');
  assert.equal(seen.options.headers.has('cookie'), false);
  assert.equal(seen.options.headers.has('x-telegram-init-data'), false);
  assert.equal(seen.options.redirect, 'error');
  assert.equal(response.headers.get('etag'), 'tag');
  assert.equal(
    response.headers.get('cache-control'),
    'private, max-age=120, must-revalidate'
  );
});

test('proxy rewrites root JSON with no durable caching or byte-invalid ETag', async () => {
  const root = {
    root: { content: { uri: path + '?session=next&key=private-fixture' } }
  };
  const response = await proxyGoogleTile(request(GOOGLE_ROOT_PATH, ''), {
    apiKey: 'private-fixture',
    path: GOOGLE_ROOT_PATH,
    proxyOrigin: origin,
    fetcher: async () => Response.json(root, { headers: { ETag: 'upstream' } })
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('etag'), null);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(
    (await response.json()).root.content.uri,
    origin + GOOGLE_TILE_PREFIX + path + '?session=next'
  );
});

test('proxy redacts upstream errors, rejects redirects and handles revalidation', async () => {
  for (const status of [401, 403, 429, 404, 500]) {
    const response = await proxyGoogleTile(request(), {
      apiKey: 'private-fixture',
      path,
      proxyOrigin: origin,
      fetcher: async () =>
        new Response('private-fixture: Google diagnostic', { status })
    });
    assert.equal(
      response.status,
      status === 429 ? 429 : [401, 403].includes(status) ? 403 : 502
    );
    assert.ok(!(await response.text()).includes('private-fixture'));
  }
  const unavailable = await proxyGoogleTile(request(), {
    apiKey: 'fixture',
    path,
    proxyOrigin: origin,
    fetcher: async () => {
      throw Error('redirect or network error');
    }
  });
  assert.equal(unavailable.status, 502);
  const unchanged = await proxyGoogleTile(request(), {
    apiKey: 'fixture',
    path,
    proxyOrigin: origin,
    fetcher: async () =>
      new Response(null, { status: 304, headers: { ETag: 'a' } })
  });
  assert.equal(unchanged.status, 304);
  assert.equal(unchanged.body, null);
});

test('oversized JSON fails closed and per-viewer budget recovers after the window', async () => {
  const response = await proxyGoogleTile(request(GOOGLE_ROOT_PATH), {
    apiKey: 'fixture',
    path: GOOGLE_ROOT_PATH,
    proxyOrigin: origin,
    fetcher: async () => new Response(new Uint8Array(8 * 1024 ** 2 + 1))
  });
  assert.equal(response.status, 502);
  let time = 1000;
  const allow = makeTileLimiter(() => time);
  for (let i = 0; i < 360; i++) assert.equal(allow('player'), true);
  assert.equal(allow('player'), false);
  assert.equal(allow('another'), true);
  time += 60000;
  assert.equal(allow('player'), true);
});

test('mobile streaming budgets reduce work and memory on battery mode', () => {
  const low = tileBudget('battery'),
    normal = tileBudget('auto'),
    high = tileBudget('high');
  assert.ok(low.bytes < normal.bytes && normal.bytes < high.bytes);
  assert.ok(
    low.downloads < normal.downloads && normal.downloads < high.downloads
  );
  assert.ok(low.error > normal.error && normal.error > high.error);
});
