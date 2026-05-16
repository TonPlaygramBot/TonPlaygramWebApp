import { copyFile, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const SKETCHFAB_CHARACTERS = Object.freeze({
  'agent-47': {
    label: 'Agent 47',
    uid: '1680cad927304bb687d6a9ad5b9dd98a',
    target: 'public/models/murlan/agent-47-rigged-face-morphs.glb'
  },
  'leather-jacket-portrait': {
    label: 'Leather Jacket Portrait',
    uid: 'e4b6a08211c746fe932e0d5041d28812',
    target: 'public/models/murlan/leather-jacket-portrait.glb'
  },
  'suede-gentleman': {
    label: 'Seated Gentleman in Suede Jacket',
    uid: '8b1101c090d4454caf9f311b3c008946',
    target: 'public/models/murlan/seated-gentleman-suede-jacket.glb'
  },
  'red-hibiscus-hair': {
    label: 'Red Hibiscus in the Hair',
    uid: 'dc65f86920814a4296f930e7d85ab314',
    target: 'public/models/murlan/red-hibiscus-in-the-hair.glb'
  },
  'casual-confidence': {
    label: 'Casual Confidence',
    uid: 'bff76010d9534241ae6c96a4a46a7959',
    target: 'public/models/murlan/casual-confidence.glb'
  }
});

function parseArgs(argv) {
  const out = { asset: 'agent-47', from: null, target: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--asset') {
      out.asset = argv[i + 1] || out.asset;
      i += 1;
    } else if (arg === '--from') {
      out.from = argv[i + 1] ? resolve(argv[i + 1]) : null;
      i += 1;
    } else if (arg === '--target') {
      out.target = argv[i + 1] ? resolve(argv[i + 1]) : out.target;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      out.help = true;
    }
  }
  return out;
}

function printHelp() {
  const assetList = Object.entries(SKETCHFAB_CHARACTERS)
    .map(([id, asset]) => `  ${id.padEnd(24)} ${asset.label}`)
    .join('\n');
  console.log(`Install Murlan Royale Sketchfab character GLBs without committing binaries.\n\nUsage:\n  SKETCHFAB_TOKEN=<token> npm run fetch:murlan-characters\n  SKETCHFAB_TOKEN=<token> npm run fetch:murlan-characters -- --asset all\n  SKETCHFAB_TOKEN=<token> npm run fetch:murlan-characters -- --asset suede-gentleman\n  npm run fetch:murlan-agent47 -- --from /path/to/agent-47.glb\n\nAssets:\n${assetList}\n\nOutput directory:\n  public/models/murlan/\n\nThe output paths are gitignored so binary assets stay out of pull requests.`);
}

function resolveAsset(assetId) {
  const asset = SKETCHFAB_CHARACTERS[assetId];
  if (!asset) {
    throw new Error(`Unknown --asset "${assetId}". Use --help to list supported assets.`);
  }
  return asset;
}

async function ensureTargetDir(target) {
  await mkdir(dirname(target), { recursive: true });
}

async function copyLocalGlb(source, target) {
  if (!source) {
    throw new Error('Missing --from path.');
  }
  if (!source.toLowerCase().endsWith('.glb')) {
    throw new Error(`Expected a .glb file for --from, received: ${source}`);
  }
  await stat(source);
  await ensureTargetDir(target);
  await copyFile(source, target);
  console.log(`Copied local Sketchfab GLB to ${target}`);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${body}`);
  }
  return response.json();
}

async function downloadGlb(downloadUrl, target) {
  await ensureTargetDir(target);
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`GLB download failed ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const tmp = `${target}.tmp`;
  await writeFile(tmp, buffer);
  await rename(tmp, target);
  console.log(`Downloaded Sketchfab GLB to ${target} (${buffer.length.toLocaleString()} bytes)`);
}

async function downloadAsset(asset, token, targetOverride = null) {
  const target = resolve(targetOverride || asset.target);
  const apiUrl = `https://api.sketchfab.com/v3/models/${asset.uid}/download`;
  const data = await fetchJson(apiUrl, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json'
    }
  });
  const glb = data?.glb?.url;
  if (!glb) {
    throw new Error(`Sketchfab response did not include a glb.url download for ${asset.label}.`);
  }

  try {
    await downloadGlb(glb, target);
  } catch (error) {
    await rm(`${target}.tmp`, { force: true }).catch(() => {});
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.from) {
    if (args.asset === 'all') {
      throw new Error('--from can only copy one asset at a time. Pass a concrete --asset id.');
    }
    const asset = resolveAsset(args.asset);
    await copyLocalGlb(args.from, resolve(args.target || asset.target));
    return;
  }

  const token = process.env.SKETCHFAB_TOKEN;
  if (!token) {
    printHelp();
    throw new Error('SKETCHFAB_TOKEN is required unless --from is provided.');
  }

  if (args.asset === 'all') {
    for (const asset of Object.values(SKETCHFAB_CHARACTERS)) {
      // eslint-disable-next-line no-await-in-loop
      await downloadAsset(asset, token);
    }
    return;
  }

  await downloadAsset(resolveAsset(args.asset), token, args.target);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
