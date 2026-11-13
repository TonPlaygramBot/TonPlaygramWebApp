import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAsset, sha256 } from './downloader.mjs';

const canonical = 'https://cdn.polyhaven.com/asset_img/thumbs/dark_wood.png?width=256&height=256';
const explicit = `${canonical}&format=png`;
// Complete 1px PNG fixture; the retry must retain these exact reviewed bytes.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=', 'base64');
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([12, 0, 0, 0]), Buffer.from('WEBPVP8X'), Buffer.alloc(8)]);
const jpeg = Buffer.from([255, 216, 255, 224, 0, 2, 255, 217]);

test('negotiated Poly Haven thumbnails retry explicit PNG and keep the original reviewed hash', async () => {
  for (const negotiated of [webp, jpeg]) {
    const urls = [];
    const result = await fetchAsset(canonical, {
      retries: 0, expectedSha256: sha256(png),
      fetchImpl: async url => {
        urls.push(url);
        return new Response(url === explicit ? png : negotiated, {
          headers: { 'content-type': url === explicit ? 'image/png' : 'application/octet-stream' },
        });
      },
    });
    assert.deepEqual(urls, [canonical, explicit]);
    assert.deepEqual(result.bytes, png);
    assert.equal(result.sourceSha256, sha256(png));
    assert.equal(result.contentType, 'image/png');
  }
});

test('explicit PNG retries cannot bypass reviewed checksums even during an update-lock call', async () => {
  const changed = Buffer.concat([png, Buffer.from('different upstream payload')]);
  for (const updateLock of [false, true]) {
    await assert.rejects(fetchAsset(canonical, {
      retries: 0, expectedSha256: sha256(png), updateLock,
      fetchImpl: async url => new Response(url === explicit ? changed : webp),
    }), /Source checksum changed/);
  }
});

test('format recovery stays scoped and rejects HTML, invalid bytes, and repeated negotiation', async () => {
  for (const [url, body, contentType] of [
    ['https://example.com/image.png', webp, 'image/webp'],
    ['https://cdn.polyhaven.com/not-thumbnails/image.png', webp, 'image/webp'],
    [explicit, webp, 'image/webp'],
    [canonical, Buffer.from('<html>error</html>'), 'text/html'],
    [canonical, Buffer.from('upstream error'), 'application/octet-stream'],
    [canonical, webp, 'text/html'],
  ]) {
    let requests = 0;
    await assert.rejects(fetchAsset(url, {
      retries: 0, expectedSha256: sha256(png),
      fetchImpl: async () => { requests++; return new Response(body, { headers: { 'content-type': contentType } }); },
    }), /HTML instead of an asset|Invalid PNG signature/);
    assert.equal(requests, 1, url);
  }
});
