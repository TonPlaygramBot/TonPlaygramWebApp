import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Home mounts exactly one install card immediately after the theme picker', async () => {
  const home = await readSource('webapp/src/pages/Home.jsx');
  assert.equal((home.match(/<PwaDownloadFrame\s*\/>/g) || []).length, 1);
  assert.match(home, /<ThemePicker\s*\/>\s*<PwaDownloadFrame\s*\/>/);
});

test('Home installation appears before the community, wallet and achievements sections', async () => {
  const home = await readSource('webapp/src/pages/Home.jsx');
  const install = home.indexOf('<PwaDownloadFrame />');
  assert.ok(install > 0);
  for (const marker of ['<article className="home-protest-card">', 'aria-labelledby="gram-wallet-title"', '<ProjectAchievementsCard />']) {
    assert.ok(home.indexOf(marker) > install, `Install must appear before ${marker}`);
  }
});

test('Home installation is not conditional on an account, Telegram session or wallet', async () => {
  const home = await readSource('webapp/src/pages/Home.jsx');
  assert.match(home, /<div className="home-page app-theme-page space-y-4">\s*<ThemePicker\s*\/>\s*<PwaDownloadFrame\s*\/>/);
});

test('The card identifies phone installation and keeps APK availability gating', async () => {
  const card = await readSource('webapp/src/components/PwaDownloadFrame.jsx');
  assert.match(card, /id="install-tonplaygram"/);
  assert.match(card, />Install TonPlayGram<\/h3>/);
  assert.match(card, /releaseState === 'available' && androidAllowed/);
  assert.match(card, /href=\{release\.url\}/);
  assert.match(card, /APK not published yet/);
  assert.doesNotMatch(card, /href=["']#["']/);
});

test('The card retains a separate browser-install action and Android install instructions', async () => {
  const card = await readSource('webapp/src/components/PwaDownloadFrame.jsx');
  assert.match(card, /onClick=\{handleInstall\}/);
  assert.match(card, /await pwa\.promptToInstall\(\)/);
  assert.match(card, /open the APK and confirm Install on your phone/);
});
