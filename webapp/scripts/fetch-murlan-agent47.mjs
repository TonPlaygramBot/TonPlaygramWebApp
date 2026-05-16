import { copyFile, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const MODEL_UID = '1680cad927304bb687d6a9ad5b9dd98a';
const API_URL = `https://api.sketchfab.com/v3/models/${MODEL_UID}/download`;
const TARGET_PATH = resolve('public/models/murlan/agent-47-rigged-face-morphs.glb');

function parseArgs(argv) {
  const out = { from: null, target: TARGET_PATH };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from') {
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
  console.log(`Install the Murlan Royale Agent 47 Sketchfab GLB without committing binaries.\n\nUsage:\n  SKETCHFAB_TOKEN=<token> npm run fetch:murlan-agent47\n  npm run fetch:murlan-agent47 -- --from /path/to/agent-47.glb\n\nOutput:\n  public/models/murlan/agent-47-rigged-face-morphs.glb\n\nThe output path is gitignored so the binary asset stays out of pull requests.`);
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.from) {
    await copyLocalGlb(args.from, args.target);
    return;
  }

  const token = process.env.SKETCHFAB_TOKEN;
  if (!token) {
    printHelp();
    throw new Error('SKETCHFAB_TOKEN is required unless --from is provided.');
  }

  const data = await fetchJson(API_URL, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json'
    }
  });
  const glb = data?.glb?.url;
  if (!glb) {
    throw new Error('Sketchfab response did not include a glb.url download.');
  }

  try {
    await downloadGlb(glb, args.target);
  } catch (error) {
    await rm(`${args.target}.tmp`, { force: true }).catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
