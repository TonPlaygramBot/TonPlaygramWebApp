import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fetchAsset, findDependencies, localAssetUrl, rewriteDependencies, sha256, vendorInventory, verifyManifest } from './downloader.mjs';

async function fixture(t, routes) {
  let requests = 0;
  const server = createServer((req, res) => {
    requests += 1;
    const route = routes[req.url];
    if (!route) { res.writeHead(404).end('missing'); return; }
    res.writeHead(route.status || 200, { 'content-type': route.type || 'application/octet-stream' });
    res.end(route.body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'tonplaygram-vendor-'));
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await rm(outputDir, { recursive: true, force: true }); });
  return { base: `http://127.0.0.1:${server.address().port}`, outputDir, requests: () => requests };
}

test('downloads and rewrites complete glTF, stylesheet and module dependency graphs; resumes offline', async (t) => {
  const routes = {
    '/model/scene.gltf': { type: 'model/gltf+json', body: JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'scene.bin', byteLength: 4 }], images: [{ uri: '../image.svg' }] }) },
    '/model/scene.bin': { body: Buffer.from([1, 2, 3, 4]) },
    '/image.svg': { type: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
    '/style.css': { type: 'text/css', body: '@import "./other.css";body{background:url(./image.svg)}' },
    '/other.css': { type: 'text/css', body: '@font-face{src:url("./font.woff2")}' },
    '/font.woff2': { body: 'font-fixture' },
    '/main.js': { type: 'text/javascript', body: 'import { value } from "./other.js"; export const main = value;' },
    '/other.js': { type: 'text/javascript', body: 'export { main } from "./main.js"; export const value=1;' }
  };
  const { base, outputDir, requests } = await fixture(t, routes);
  const inventory = { groups: [
    { id: 'model', candidates: [`${base}/missing.gltf`, `${base}/model/scene.gltf`], aliases: [`${base}/alias.gltf`] },
    { id: 'css', candidates: [`${base}/style.css`] },
    { id: 'js', candidates: [`${base}/main.js`] }
  ] };
  const manifest = await vendorInventory(inventory, { outputDir, retries: 0 });
  assert.equal(manifest.complete, true);
  assert.equal(manifest.assets.length, 8);
  assert.equal(manifest.urlMap[`${base}/alias.gltf`], manifest.urlMap[`${base}/model/scene.gltf`]);
  const localFile = (url) => path.join(outputDir, manifest.urlMap[url].replace('/assets/external/', ''));
  const gltf = JSON.parse(await readFile(localFile(`${base}/model/scene.gltf`), 'utf8'));
  assert.equal(gltf.buffers[0].uri, manifest.urlMap[`${base}/model/scene.bin`]);
  assert.equal(gltf.images[0].uri, manifest.urlMap[`${base}/image.svg`]);
  assert.match(await readFile(localFile(`${base}/style.css`), 'utf8'), /@import "\/assets\/external\//);
  assert.match(await readFile(localFile(`${base}/main.js`), 'utf8'), /from "\/assets\/external\//);
  assert.equal((await verifyManifest(outputDir, { inventory })).ok, true);
  const initialRequests = requests();
  await vendorInventory(inventory, { outputDir, retries: 0, fetchImpl: () => { throw new Error('Network should not be used'); } });
  assert.equal(requests(), initialRequests);
  assert.equal((await verifyManifest(outputDir, { inventory })).ok, true);
});

test('fails closed on upstream checksum changes and corrupt local content', async (t) => {
  const routes = { '/data.bin': { body: 'version one' } };
  const { base, outputDir } = await fixture(t, routes);
  const inventory = { groups: [{ id: 'data', candidates: [`${base}/data.bin`] }] };
  const first = await vendorInventory(inventory, { outputDir, retries: 0 });
  const filename = path.join(outputDir, first.assets[0].url.replace('/assets/external/', ''));
  await writeFile(filename, 'corrupt');
  assert.equal((await verifyManifest(outputDir)).ok, false);
  routes['/data.bin'].body = 'version two';
  const changed = await vendorInventory(inventory, { outputDir, retries: 0 });
  assert.equal(changed.complete, false);
  assert.match(changed.failures[0].error, /Source checksum changed/);
  const retried = await vendorInventory(inventory, { outputDir, retries: 0 });
  assert.equal(retried.complete, false);
  assert.match(retried.failures[0].error, /Source checksum changed/);
});

test('rejects HTML assets, preserves URL query variants, extracts executable dependencies only', async () => {
  await assert.rejects(fetchAsset('https://example.com/model.glb', {
    retries: 0, fetchImpl: async () => new Response('<html>error</html>', { headers: { 'content-type': 'text/html' } })
  }), /HTML instead of an asset/);
  assert.notEqual(localAssetUrl('https://example.com/photo?w=10'), localAssetUrl('https://example.com/photo?w=20'));
  assert.match(localAssetUrl('https://fonts.googleapis.com/css2?family=Example'), /\.css$/);
  assert.match(localAssetUrl('https://esm.sh/three@0.159.0'), /\.js$/);
  assert.equal(localAssetUrl('https://example.com/photo?w=10#abc'), localAssetUrl('https://example.com/photo?w=10'));
  const dependencies = findDependencies(Buffer.from('import "./a.js"; import{value}from"./min.js"; import("./b.js"); new URL("./worker.js", import.meta.url); const endpoint="https://api.test/live";'), 'https://example.com/main.js', 'text/javascript');
  assert.deepEqual(dependencies.map((entry) => entry.url).sort(), ['https://example.com/a.js', 'https://example.com/min.js', 'https://example.com/b.js', 'https://example.com/worker.js'].sort());
});

test('follows Git LFS pointer only to verified bytes', async () => {
  const doc = Buffer.from('{"asset":{"version":"2.0"}}');
  const json = Buffer.concat([doc, Buffer.alloc((4 - doc.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20); header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + json.length, 8); header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const glb = Buffer.concat([header, json]);
  const urls = [];
  const result = await fetchAsset('https://raw.githubusercontent.com/owner/repo/ref/model.glb', {
    retries: 0,
    fetchImpl: async (url) => {
      urls.push(url);
      return new Response(url.includes('media.githubusercontent.com') ? glb : `version https://git-lfs.github.com/spec/v1\noid sha256:${sha256(glb)}\nsize ${glb.length}\n`);
    }
  });
  assert.deepEqual(urls, ['https://raw.githubusercontent.com/owner/repo/ref/model.glb', 'https://media.githubusercontent.com/media/owner/repo/ref/model.glb']);
  assert.deepEqual(result.bytes, glb);
});

test('metadata bodies point only to localized inventory resources', async (t) => {
  const { base, outputDir } = await fixture(t, { '/data.bin': { body: 'payload' } });
  const manifest = await vendorInventory({
    groups: [{ id: 'data', candidates: [`${base}/data.bin`] }],
    metadataRequests: [{ url: `${base}/api/files/data`, aliases: [`${base}/api/files/data-alias`], body: { model: { url: `${base}/data.bin` } } }]
  }, { outputDir, retries: 0 });
  assert.equal(manifest.complete, true);
  const filename = path.join(outputDir, manifest.urlMap[`${base}/api/files/data`].replace('/assets/external/', ''));
  const metadata = JSON.parse(await readFile(filename, 'utf8'));
  assert.equal(metadata.model.url, manifest.urlMap[`${base}/data.bin`]);
  assert.equal(manifest.urlMap[`${base}/api/files/data-alias`], manifest.urlMap[`${base}/api/files/data`]);
});

test('uses the final redirect directory for glTF and module dependencies', () => {
  const sourceUrl = 'https://example.com/latest/model.gltf';
  const resolvedUrl = 'https://example.com/releases/v2/model.gltf';
  const bytes = Buffer.from(JSON.stringify({ buffers: [{ uri: 'model.bin' }] }));
  const dependencies = findDependencies(bytes, sourceUrl, 'model/gltf+json', resolvedUrl);
  assert.equal(dependencies[0].url, 'https://example.com/releases/v2/model.bin');
  const rewritten = JSON.parse(rewriteDependencies(bytes, sourceUrl, 'model/gltf+json', { [dependencies[0].url]: '/assets/external/model.bin' }, dependencies));
  assert.equal(rewritten.buffers[0].uri, '/assets/external/model.bin');
});

test('captures all worker scripts and retains SVG font fragments', () => {
  const worker = findDependencies(Buffer.from('importScripts("./first.js", "./second.js")'), 'https://example.com/worker.js', 'text/javascript');
  assert.deepEqual(worker.map((entry) => entry.reference), ['./first.js', './second.js']);
  const stylesheet = Buffer.from('@font-face{src:url("./font.svg#my-font")}');
  const deps = findDependencies(stylesheet, 'https://example.com/style.css', 'text/css');
  assert.equal(deps[0].url, 'https://example.com/font.svg');
  assert.equal(rewriteDependencies(stylesheet, 'https://example.com/style.css', 'text/css', { 'https://example.com/font.svg': '/assets/external/font.svg' }, deps).toString(), '@font-face{src:url("/assets/external/font.svg#my-font")}');
});

test('discovers multiline module imports without converting bare packages to URLs', () => {
  const source = 'import {\n  Vector3,\n  Matrix4\n} from "./math.js";\nexport {\n  Scene\n} from "https://cdn.example.com/scene.js";\nimport { Vector2 } from "three";\nnew URL("worker.wasm", import.meta.url);';
  const dependencies = findDependencies(Buffer.from(source), 'https://example.com/module.js', 'text/javascript');
  assert.deepEqual(dependencies.map((entry) => entry.url).sort(), ['https://example.com/math.js', 'https://cdn.example.com/scene.js', 'https://example.com/worker.wasm'].sort());
});

test('verification rejects unpublished mappings and resume checks current source pins', async (t) => {
  const { base, outputDir } = await fixture(t, { '/data.bin': { body: 'payload' } });
  const sourceUrl = `${base}/data.bin`;
  const inventory = { groups: [{ id: 'data', candidates: [sourceUrl] }] };
  await vendorInventory(inventory, { outputDir, retries: 0 });
  await writeFile(path.join(outputDir, 'url-map.json'), '{}');
  assert.equal((await verifyManifest(outputDir)).ok, false);
  const result = await vendorInventory(inventory, { outputDir, retries: 0, sourcePins: { [sourceUrl]: sha256('different reviewed payload') } });
  assert.equal(result.complete, false);
  assert.match(result.failures[0].error, /Cached source differs from source lock/);
});

test('bounds additional downloads and stops before violating the disk reserve', async (t) => {
  const { base, outputDir, requests } = await fixture(t, { '/data.bin': { body: 'payload larger than budget' } });
  const inventory = { groups: [{ id: 'data', candidates: [`${base}/data.bin`] }] };
  const budget = await vendorInventory(inventory, { outputDir, retries: 0, maxDownloadBytes: 5 });
  assert.equal(budget.complete, false);
  assert.equal(budget.assets.length, 0);
  assert.ok(budget.failures.some((failure) => /Download budget exceeded/.test(failure.error)));
  const before = requests();
  const reserve = await vendorInventory(inventory, { outputDir, retries: 0, minFreeBytes: Number.MAX_SAFE_INTEGER });
  assert.equal(reserve.complete, false);
  assert.equal(requests(), before);
  assert.ok(reserve.failures.some((failure) => /Free disk reserve/.test(failure.error)));
});

test('incomplete passes retain unvisited source checksums without reviving retired aliases', async (t) => {
  const { base, outputDir, requests } = await fixture(t, {
    '/existing.bin': { body: 'existing exact bytes' },
    '/new.bin': { body: 'larger than the remaining budget' }
  });
  const existing = `${base}/existing.bin`;
  const alias = `${base}/retired.bin`;
  const first = await vendorInventory({ groups: [{ id: 'existing', candidates: [existing], aliases: [alias] }] }, { outputDir, retries: 0 });
  const inventory = { groups: [{ id: 'new', candidates: [`${base}/new.bin`] }, { id: 'existing', candidates: [existing] }] };
  const partial = await vendorInventory(inventory, { outputDir, retries: 0, concurrency: 1, maxDownloadBytes: 5 });
  assert.equal(partial.complete, false);
  assert.equal(partial.assets.find((entry) => entry.sourceUrl === existing).sourceSha256, first.sourcePins[existing]);
  assert.equal(partial.urlMap[existing], first.urlMap[existing]);
  assert.equal(partial.urlMap[alias], undefined);
  const before = requests();
  const resumed = await vendorInventory({ groups: [{ id: 'existing', candidates: [existing] }] }, { outputDir, retries: 0, fetchImpl: () => { throw new Error('Existing bytes must resume offline'); } });
  assert.equal(resumed.complete, true);
  assert.equal(requests(), before);
  assert.equal(resumed.urlMap[alias], undefined);
  assert.equal((await verifyManifest(outputDir)).ok, true);
});

test('rejects audio symlink text during download, legacy-cache verification and resume', async (t) => {
  const { base, outputDir } = await fixture(t, { '/Check.mp3': { type: 'audio/mpeg', body: '../Silence.mp3' } });
  const sourceUrl = `${base}/Check.mp3`;
  await assert.rejects(fetchAsset(sourceUrl, { retries: 0 }), /Invalid MP3 signature/);
  const payload = Buffer.from([255, 243, 228, 100, 0, 31]);
  await vendorInventory({ groups: [{ id: 'audio', candidates: [sourceUrl] }] }, {
    outputDir, retries: 0, fetchImpl: async () => new Response(payload, { headers: { 'content-type': 'audio/mpeg' } })
  });
  const filename = path.join(outputDir, 'manifest.json');
  const legacy = JSON.parse(await readFile(filename, 'utf8'));
  const pointer = Buffer.from('../Silence.mp3');
  Object.assign(legacy.assets[0], { size: pointer.length, sha256: sha256(pointer), sourceSha256: sha256(pointer) });
  legacy.sourcePins[sourceUrl] = sha256(pointer);
  await writeFile(path.join(outputDir, legacy.assets[0].url.replace('/assets/external/', '')), pointer);
  await writeFile(filename, JSON.stringify(legacy));
  assert.ok((await verifyManifest(outputDir)).errors.some((error) => /Invalid MP3 signature/.test(error)));
  const resumed = await vendorInventory({ groups: [{ id: 'audio', candidates: [sourceUrl] }] }, { outputDir, retries: 0 });
  assert.equal(resumed.complete, false);
  assert.match(resumed.failures[0].error, /Invalid MP3 signature/);
});

test('refreshes the pinned document when a dependency alias changes its local target', async (t) => {
  const model = JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'shared.bin', byteLength: 4 }] });
  const { base, outputDir } = await fixture(t, {
    '/model.gltf': { type: 'model/gltf+json', body: model },
    '/one/shared.bin': { body: Buffer.from([1, 2, 3, 4]) },
    '/two/shared.bin': { body: Buffer.from([1, 2, 3, 4]) }
  });
  const inventory = (directory) => ({ groups: [
    { id: 'model', candidates: [`${base}/model.gltf`] },
    { id: 'buffer', candidates: [`${base}/${directory}/shared.bin`], aliases: [`${base}/shared.bin`] }
  ] });
  const first = await vendorInventory(inventory('one'), { outputDir, retries: 0 });
  const second = await vendorInventory(inventory('two'), { outputDir, retries: 0 });
  assert.equal(second.complete, true);
  const entry = second.assets.find((asset) => asset.sourceUrl === `${base}/model.gltf`);
  assert.equal(entry.sourceSha256, first.sourcePins[entry.sourceUrl]);
  const filename = path.join(outputDir, entry.url.replace('/assets/external/', ''));
  const rewritten = JSON.parse(await readFile(filename, 'utf8'));
  assert.equal(rewritten.buffers[0].uri, second.urlMap[`${base}/two/shared.bin`]);
  assert.equal((await verifyManifest(outputDir)).ok, true);
  const stale = Buffer.from(JSON.stringify({ ...rewritten, buffers: [{ ...rewritten.buffers[0], uri: first.urlMap[`${base}/one/shared.bin`] }] }));
  await writeFile(filename, stale);
  Object.assign(entry, { sha256: sha256(stale), size: stale.length });
  await writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(second));
  assert.ok((await verifyManifest(outputDir)).errors.some((error) => /Dependency URI does not point/.test(error)));
});
