import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { webappEntry } from '../../shared/socialApp.js';

const directory = resolve(process.argv[2] || 'dist');
const read = path => readFile(resolve(directory, path), 'utf8');
const social = JSON.parse(await read('social-app/manifest.webmanifest'));
const main = JSON.parse(await read('manifest.webmanifest'));
assert.notEqual(social.id, main.id, 'Social must have a separate install identity');
assert.equal(social.scope, '/social-app/');
assert.ok(new URL(social.start_url, 'https://tpg.example').pathname.startsWith(social.scope));
for (const shortcut of social.shortcuts) assert.ok(shortcut.url.startsWith(social.scope));
for (const path of ['/social-app/wall', '/social-app/hub', '/social-app/wall/profile/user', '/social-app/creator-studio', '/social-app/install']) {
  const html = await read(webappEntry(path));
  assert.ok(html.includes('href="/social-app/manifest.webmanifest"'));
  assert.ok(!html.includes('href="/manifest.webmanifest"'));
}
const worker = await read('social-app/service-worker.js');
assert.ok(!worker.includes('__SOCIAL_VERSION__'));
const assets = JSON.parse(worker.match(/const SOCIAL_ASSETS = (\[.*?\]);/s)[1]);
assert.ok(assets.includes('/social-app/index.html'));
assert.ok(assets.some(path => /\/CommunityWallApp-.*\.js$/.test(path)));
assert.ok(assets.some(path => /\/SocialProfilePage-.*\.js$/.test(path)));
assert.ok(assets.some(path => /\/CreatorStudio-.*\.js$/.test(path)));
assert.ok(!assets.includes('/index.html') && !assets.includes('/manifest.webmanifest'));
assert.ok(!assets.some(path => /(?:game-packs|CityMap-|TiranaStreets-|SnakeAndLadder-|PoolRoyale-)/.test(path)));
let bytes = 0;
for (const path of assets) bytes += (await stat(resolve(directory, path.slice(1)))).size;
for (const size of [192, 512]) {
  const image = await sharp(resolve(directory, `social-app/icon-${size}.png`)).metadata();
  assert.equal(image.width, size); assert.equal(image.height, size); assert.equal(image.format, 'png');
}
for (const path of ['pwa/wall-push.js', 'pwa/wall-upload-worker.js']) assert.ok((await stat(resolve(directory, path))).size > 0);
console.log(`Social build verified: separate manifest, routes, icons and ${assets.length} cached files (${bytes.toLocaleString()} bytes).`);
