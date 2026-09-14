#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAsset, pruneUnreferencedGeneratedFiles, sha256, vendorInventory, verifyManifest } from './external-assets/downloader.mjs';

const WEBAPP_ROOT = fileURLToPath(new URL('../', import.meta.url));
const REPO_ROOT = path.dirname(WEBAPP_ROOT);

function parseArguments(argv) {
  const args = { outputDir: path.join(WEBAPP_ROOT, 'public/assets/external'), concurrency: 3, maxDownloadBytes: 10 * 1024 ** 3, minFreeBytes: 2 * 1024 ** 3 };
  const values = { '--output': 'outputDir', '--inventory': 'inventoryPath', '--lock': 'lockPath', '--concurrency': 'concurrency', '--timeout': 'timeoutMs', '--retries': 'retries', '--limit': 'limit', '--max-download-bytes': 'maxDownloadBytes', '--min-free-bytes': 'minFreeBytes' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (values[argument]) {
      if (!argv[index + 1]) throw new Error(`Missing value for ${argument}`);
      args[values[argument]] = argv[++index];
    } else if (argument === '--verify') args.verify = true;
    else if (argument === '--dry-run') args.dryRun = true;
    else if (argument === '--update-lock') args.updateLock = true;
    else if (argument === '--frozen-lockfile') args.frozenLockfile = true;
    else if (argument === '--help' || argument === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  for (const key of ['concurrency', 'timeoutMs', 'retries', 'limit', 'maxDownloadBytes', 'minFreeBytes']) if (args[key] !== undefined) {
    args[key] = Number(args[key]);
    if (!Number.isFinite(args[key]) || args[key] < (['retries', 'maxDownloadBytes', 'minFreeBytes'].includes(key) ? 0 : 1)) throw new Error(`Invalid ${key}`);
  }
  args.outputDir = path.resolve(args.outputDir);
  if (args.updateLock && args.frozenLockfile) throw new Error('--update-lock and --frozen-lockfile cannot be combined');
  if (!args.lockPath && !args.inventoryPath) args.lockPath = path.join(WEBAPP_ROOT, 'scripts/external-assets/source-lock.json');
  if (args.lockPath) args.lockPath = path.resolve(args.lockPath);
  return args;
}

async function discoverInventory() {
  const [{ collectStaticExternalAssets }, { collectModelInventory }, polyhaven, { collectVerifiedLocalAssets }] = await Promise.all([
    import('./external-assets/source-inventory.mjs'),
    import('../../scripts/external-assets/model-inventory.mjs'),
    import('./external-assets/polyhaven-inventory.mjs'),
    import('./external-assets/local-aliases.mjs')
  ]);
  const [assets, modelGroups, poly, localAssets] = await Promise.all([
    collectStaticExternalAssets({ repoRoot: REPO_ROOT }),
    collectModelInventory({ repoRoot: REPO_ROOT }),
    polyhaven.buildPolyhavenInventory({ repoRoot: REPO_ROOT }),
    collectVerifiedLocalAssets({ repoRoot: REPO_ROOT })
  ]);
  const groups = [...poly.groups, ...modelGroups];
  const declared = new Set(groups.flatMap((group) => [...(group.candidates || []), ...(group.aliases || [])]));
  for (const asset of assets) {
    if (!declared.has(asset.url)) groups.push({ id: `static:${sha256(asset.url).slice(0, 16)}`, kind: 'static', candidates: [asset.url], sources: asset.referrers, essential: true });
  }
  // Successful HDRs cover these scenes already. Do not duplicate them in EXR
  // fallback format or fetch retired URLs whose procedural fallback is used.
  // Explicit first-choice EXR resources remain essential and are included.
  const requiredGroups = groups.filter(group => group.essential !== false);
  return { schemaVersion: 1, groups: requiredGroups, metadataRequests: poly.metadataRequests, summary: poly.summary, metadataResolver: polyhaven.resolvePolyhavenMetadata, filterMetadata: polyhaven.filterPolyhavenMetadata,
    localAssets: localAssets.map((asset) => ({ ...asset, filename: path.join(WEBAPP_ROOT, 'public', asset.url.replace(/^\//, '')) })) };
}

async function resolveMetadata(inventory, args) {
  if (!inventory.metadataResolver) return inventory;
  const groups = new Map(inventory.groups.map((group) => [group.id, group]));
  const metadataRequests = [];
  const failures = [];
  const cacheDir = path.join(WEBAPP_ROOT, '.cache/external-assets-metadata');
  await mkdir(cacheDir, { recursive: true });
  let cursor = 0;
  const requests = inventory.metadataRequests || [];
  await Promise.all(Array.from({ length: Math.min(3, requests.length) }, async () => {
    while (cursor < requests.length) {
    const request = requests[cursor++];
    try {
      const cacheFile = path.join(cacheDir, `${sha256(request.url)}.json`);
      let json;
      if (!args.updateLock) {
        try { json = JSON.parse(await readFile(cacheFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      if (!json) {
        const response = await fetchAsset(request.url, { timeoutMs: args.timeoutMs, retries: args.retries });
        json = JSON.parse(response.bytes.toString('utf8'));
        await writeFile(cacheFile, `${JSON.stringify(json)}\n`);
      }
      const resolved = inventory.metadataResolver(request, json, [...groups.values()]);
      for (const group of resolved.groups || []) groups.set(group.id, group);
      for (const dependency of resolved.dependencies || []) {
        const url = typeof dependency === 'string' ? dependency : dependency.url;
        if (url) {
          const id = `metadata-dependency:${sha256(url).slice(0, 16)}`;
          const aliases = [...new Set([...(groups.get(id)?.aliases || []), ...(dependency.aliases || [])])];
          groups.set(id, { id, candidates: [url], aliases, kind: 'dependency', essential: true });
        }
      }
      metadataRequests.push({ ...request, body: resolved.body });
    } catch (error) {
      failures.push({ sourceUrl: request.url, essential: true, error: `Metadata discovery failed: ${error.message}` });
      console.error(`[metadata failed] ${request.url}: ${error.message}`);
    }
    }
  }));
  // API responses may add canonical URLs already covered by a static source seed.
  const covered = new Set([...groups.values()].filter((group) => group.kind !== 'static').flatMap((group) => [...(group.candidates || []), ...(group.aliases || [])]));
  return { ...inventory, groups: [...groups.values()].filter((group) => group.kind !== 'static' || !covered.has(group.candidates[0])), metadataRequests, failures };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArguments(argv);
  if (args.help) {
    console.log('Usage: node scripts/vendor-external-assets.mjs [--inventory file.json] [--output directory] [--lock file.json] [--dry-run | --verify] [--frozen-lockfile | --update-lock] [--concurrency 1-4] [--timeout milliseconds] [--retries count] [--limit count] [--max-download-bytes bytes] [--min-free-bytes bytes]\nDownloads required game assets and their dependencies. Existing SHA-256 pins are preserved; --update-lock explicitly accepts changed upstream content. --verify is offline and fails for missing files, unresolved sources, or checksum changes. Default limits: 10 GiB additional downloads, 2 GiB free disk reserve.');
    return 0;
  }
  let inventory = args.inventoryPath ? JSON.parse(await readFile(path.resolve(args.inventoryPath), 'utf8')) : await discoverInventory();
  if (Array.isArray(inventory)) inventory = { groups: inventory.map((asset) => asset.candidates ? asset : { id: asset.url, candidates: [asset.url], sources: asset.referrers }) };
  console.log(JSON.stringify({ groups: inventory.groups.length, metadataRequests: inventory.metadataRequests?.length || 0, summary: inventory.summary || null, output: args.outputDir, maxDownloadBytes: args.maxDownloadBytes, minFreeBytes: args.minFreeBytes }));
  if (args.dryRun) return 0;
  let sourcePins = {};
  if (args.lockPath) {
    try { sourcePins = JSON.parse(await readFile(args.lockPath, 'utf8')).sourcePins || {}; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (args.frozenLockfile && !Object.keys(sourcePins).length) throw new Error('Frozen source lock is missing or empty; run the importer to review and pin source assets first');
  if (args.verify) {
    const result = await verifyManifest(args.outputDir, { inventory, sourcePins, publicRoot: path.join(WEBAPP_ROOT, 'public') });
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }
  inventory = await resolveMetadata(inventory, args);
  if (args.limit && inventory.groups.length > args.limit) {
    const omitted = inventory.groups.length - args.limit;
    inventory.groups = inventory.groups.slice(0, args.limit);
    inventory.failures = [...(inventory.failures || []), { id: 'partial-import', essential: true, error: `${omitted} inventory groups omitted by --limit; run without --limit to finish` }];
  }
  let complete = 0;
  const manifest = await vendorInventory(inventory, {
    ...args,
    sourcePins,
    publicRoot: path.join(WEBAPP_ROOT, 'public'),
    onProgress(event) {
      complete += 1;
      if (event.status === 'failed') console.error(`[failed] ${event.id || event.sourceUrl}: ${event.error}`);
      else if (complete % 10 === 0) console.log(`[${complete}] ${event.status} ${event.sourceUrl} (${event.size} bytes)`);
    }
  });
  if (args.lockPath && !args.frozenLockfile) {
    await mkdir(path.dirname(args.lockPath), { recursive: true });
    await writeFile(args.lockPath, `${JSON.stringify({ schemaVersion: 1, sourcePins: Object.fromEntries(Object.entries(manifest.sourcePins).sort(([a], [b]) => a.localeCompare(b))) }, null, 2)}\n`);
  }
  if (manifest.complete && args.outputDir === path.join(WEBAPP_ROOT, 'public/assets/external')) {
    const verification = await verifyManifest(args.outputDir, { inventory, publicRoot: path.join(WEBAPP_ROOT, 'public'), sourcePins: manifest.sourcePins });
    if (!verification.ok) throw new Error(`Downloaded assets failed verification: ${verification.errors.join('; ')}`);
    const cleaned = await pruneUnreferencedGeneratedFiles(args.outputDir, manifest);
    if (cleaned.removedFiles) console.log(JSON.stringify({ prunedGeneratedRemnants: cleaned }));
  }
  console.log(JSON.stringify({ assets: manifest.assets.length, bytes: manifest.assets.reduce((sum, entry) => sum + entry.size, 0), failures: manifest.failures.length, complete: manifest.complete }));
  return manifest.complete ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
}
