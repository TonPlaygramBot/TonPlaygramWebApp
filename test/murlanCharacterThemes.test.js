import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MURLAN_CHARACTER_THEMES } from '../webapp/src/config/murlanCharacterThemes.js';

const sketchfabLocalCharacterThemes = MURLAN_CHARACTER_THEMES.filter(
  (theme) => theme?.sourceFormat === 'sketchfab-converted-gltf'
);

test('Murlan Sketchfab characters have reliable fallback model URLs', () => {
  assert(sketchfabLocalCharacterThemes.length >= 7);

  for (const theme of sketchfabLocalCharacterThemes) {
    assert(theme.url?.startsWith('/models/murlan/'), `${theme.id} should use a local install path first`);
    assert(
      Array.isArray(theme.fallbackModelUrls) && theme.fallbackModelUrls.some((url) => url.startsWith('https://')),
      `${theme.id} should include at least one remote GLB fallback so the seat never stays empty`
    );
    assert.equal(theme.requiresAttribution, true, `${theme.id} must retain attribution metadata`);
  }
});

test('Murlan Ready Player Me variants keep non-RPM fallback GLBs', () => {
  const rpmVariants = MURLAN_CHARACTER_THEMES.filter((theme) => theme.id.startsWith('rpm-') && theme.id !== 'rpm-current');
  assert.equal(rpmVariants.length, 3);

  for (const theme of rpmVariants) {
    assert(
      theme.fallbackModelUrls?.some((url) => !url.includes('readyplayer.me')),
      `${theme.id} should recover when Ready Player Me returns a transient 503`
    );
  }
});

test('Murlan fetch script knows every installable Sketchfab character', async () => {
  const script = await readFile(new URL('../webapp/scripts/fetch-murlan-agent47.mjs', import.meta.url), 'utf8');

  for (const theme of sketchfabLocalCharacterThemes) {
    const assetId = theme.url.split('/models/murlan/')[1]?.split('/')[0];
    assert(assetId, `${theme.id} should have a local asset directory`);
    assert(script.includes(`targetDir: 'public/models/murlan/${assetId}'`), `${assetId} should be installable with fetch:murlan-characters`);
    assert(script.includes(theme.sketchfabUid), `${theme.id} Sketchfab UID should be present in the fetch script`);
  }
});
