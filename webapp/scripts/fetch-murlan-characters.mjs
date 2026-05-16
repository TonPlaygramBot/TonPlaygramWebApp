import { copyFile, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const MURLAN_SKETCHFAB_CHARACTERS = Object.freeze([
  {
    id: 'agent47',
    label: 'Agent 47',
    uid: '1680cad927304bb687d6a9ad5b9dd98a',
    filename: 'agent-47-rigged-face-morphs.glb'
  },
  {
    id: 'leather-jacket-portrait',
    label: 'Leather Jacket Portrait',
    uid: 'e4b6a08211c746fe932e0d5041d28812',
    filename: 'leather-jacket-portrait.glb'
  },
  {
    id: 'seated-gentleman-suede',
    label: 'Seated Gentleman in Suede Jacket',
    uid: '8b1101c090d4454caf9f311b3c008946',
    filename: 'seated-gentleman-suede-jacket.glb'
  },
  {
    id: 'red-hibiscus-hair',
    label: 'Red Hibiscus in the Hair',
    uid: 'dc65f86920814a4296f930e7d85ab314',
    filename: 'red-hibiscus-in-the-hair.glb'
  },
  {
    id: 'casual-confidence',
    label: 'Casual Confidence',
    uid: 'bff76010d9534241ae6c96a4a46a7959',
    filename: 'casual-confidence.glb'
  }
]);

const TARGET_DIR = resolve('public/models/murlan');
const DEFAULT_CHARACTER_ID = 'all';

function targetPathFor(character) {
  return resolve(TARGET_DIR, character.filename);
}

function parseArgs(argv) {
  const out = { characterId: DEFAULT_CHARACTER_ID, from: null, fromDir: null, target: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--character' || arg === '--id') {
      out.characterId = argv[i + 1] || out.characterId;
      i += 1;
    } else if (arg === '--from') {
      out.from = argv[i + 1] ? resolve(argv[i + 1]) : null;
      i += 1;
    } else if (arg === '--from-dir') {
      out.fromDir = argv[i + 1] ? resolve(argv[i + 1]) : null;
      i += 1;
    } else if (arg === '--target') {
      out.target = argv[i + 1] ? resolve(argv[i + 1]) : null;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      out.help = true;
    }
  }
  return out;
}

function printHelp() {
  const characters = MURLAN_SKETCHFAB_CHARACTERS
    .map((character) => `  ${character.id.padEnd(24)} ${character.filename}`)
    .join('\n');
  console.log(`Install Murlan Royale Sketchfab GLBs without committing binaries.\n\nUsage:\n  SKETCHFAB_TOKEN=<token> npm run fetch:murlan-characters\n  SKETCHFAB_TOKEN=<token> npm run fetch:murlan-characters -- --character agent47\n  npm run fetch:murlan-agent47\n  npm run fetch:murlan-characters -- --character casual-confidence --from /path/to/casual-confidence.glb\n  npm run fetch:murlan-characters -- --from-dir /path/to/downloaded-glbs\n\nCharacters:\n${characters}\n\nOutput directory:\n  public/models/murlan\n\nDownloaded GLBs are gitignored so binary assets stay out of pull requests.`);
}

function resolveCharacters(characterId) {
  const normalized = String(characterId || DEFAULT_CHARACTER_ID).toLowerCase();
  if (normalized === 'all') return MURLAN_SKETCHFAB_CHARACTERS;
  const match = MURLAN_SKETCHFAB_CHARACTERS.find((character) => character.id === normalized);
  if (!match) {
    throw new Error(`Unknown character "${characterId}". Use --help to list supported ids.`);
  }
  return [match];
}

async function ensureTargetDir(target) {
  await mkdir(dirname(target), { recursive: true });
}

async function copyLocalGlb(source, target, label) {
  if (!source) {
    throw new Error(`Missing local .glb source path for ${label}.`);
  }
  if (!source.toLowerCase().endsWith('.glb')) {
    throw new Error(`Expected a .glb file for ${label}, received: ${source}`);
  }
  await stat(source);
  await ensureTargetDir(target);
  await copyFile(source, target);
  console.log(`Copied ${label} GLB to ${target}`);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${body}`);
  }
  return response.json();
}

async function downloadGlb(downloadUrl, target, label) {
  await ensureTargetDir(target);
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`${label} GLB download failed ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const tmp = `${target}.tmp`;
  await writeFile(tmp, buffer);
  await rename(tmp, target);
  console.log(`Downloaded ${label} GLB to ${target} (${buffer.length.toLocaleString()} bytes)`);
}

async function fetchSketchfabCharacter(character, token, target) {
  const apiUrl = `https://api.sketchfab.com/v3/models/${character.uid}/download`;
  const data = await fetchJson(apiUrl, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json'
    }
  });
  const glb = data?.glb?.url;
  if (!glb) {
    throw new Error(`Sketchfab response for ${character.label} did not include a glb.url download.`);
  }

  try {
    await downloadGlb(glb, target, character.label);
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

  const characters = resolveCharacters(args.characterId);
  if (args.from && characters.length !== 1) {
    throw new Error('--from can only be used with one --character id. Use --from-dir for multiple GLBs.');
  }

  if (args.from) {
    await copyLocalGlb(args.from, args.target || targetPathFor(characters[0]), characters[0].label);
    return;
  }

  if (args.fromDir) {
    for (const character of characters) {
      // eslint-disable-next-line no-await-in-loop
      await copyLocalGlb(join(args.fromDir, character.filename), targetPathFor(character), character.label);
    }
    return;
  }

  const token = process.env.SKETCHFAB_TOKEN;
  if (!token) {
    printHelp();
    throw new Error('SKETCHFAB_TOKEN is required unless --from or --from-dir is provided.');
  }

  for (const character of characters) {
    // eslint-disable-next-line no-await-in-loop
    await fetchSketchfabCharacter(character, token, args.target || targetPathFor(character));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
