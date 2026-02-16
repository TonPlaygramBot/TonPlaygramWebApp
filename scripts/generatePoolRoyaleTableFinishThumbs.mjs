#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(
  repoRoot,
  'webapp',
  'public',
  'store-thumbs',
  'poolRoyale',
  'tableFinish'
);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function loadFinishIds() {
  const mod = await import(
    pathToFileURL(
      path.join(repoRoot, 'webapp/src/config/poolRoyaleInventoryConfig.js')
    )
  );
  const items = mod.POOL_ROYALE_STORE_ITEMS || [];
  const finishIds = items
    .filter((i) => i?.type === 'tableFinish')
    .map((i) => i.optionId)
    .filter(Boolean);
  return Array.from(new Set(finishIds));
}

const baseUrl = process.env.THUMB_BASE_URL || 'http://127.0.0.1:5173';
const size = Number(process.env.THUMB_SIZE) || 768;

async function main() {
  ensureDir(outDir);
  let finishIds = await loadFinishIds();
  const limit = Number(process.env.THUMB_LIMIT) || 0;
  if (limit > 0) finishIds = finishIds.slice(0, limit);

  if (!finishIds.length) {
    console.error('No table finishes found.');
    process.exit(1);
  }

  console.log(`Generating ${finishIds.length} Pool Royale table finish thumbnails...`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Output:   ${outDir}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: size, height: size } });

  // More deterministic rendering.
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const finishId of finishIds) {
    const url = `${baseUrl}/tools/store-thumb/poolroyale/table-finish/${encodeURIComponent(
      finishId
    )}`;
    const outPath = path.join(outDir, `${finishId}.png`);

    console.log(`- ${finishId}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => window.__thumbReady === true, null, {
      timeout: 60_000
    });

    // Screenshot the full viewport.
    await page.screenshot({ path: outPath, type: 'png' });
  }

  await browser.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
