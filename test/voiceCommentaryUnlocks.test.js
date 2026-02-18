import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import {
  buildVoiceStoreItems,
  createDefaultVoiceInventory,
  normalizeVoiceInventory
} from '../bot/utils/voiceCommentaryCatalog.js';
import { applyVoiceCommentaryUnlocks } from '../bot/routes/voiceCommentary.js';

test('default voice commentary inventory includes free English voice', () => {
  const inventory = createDefaultVoiceInventory();
  assert.equal(inventory.selectedVoiceId, 'nova_en_us_f');
  assert.ok(inventory.ownedVoiceIds.includes('nova_en_us_f'));
  assert.ok(inventory.ownedLocales.includes('en-US'));
});

test('voice unlock grants locale voices for all games', () => {
  const user = {
    voiceCommentaryInventory: createDefaultVoiceInventory()
  };
  const catalog = [
    { id: 'nova_en_us_f', locale: 'en-US' },
    { id: 'atlas_en_us_m', locale: 'en-US' },
    { id: 'sofia_it_it_f', locale: 'it-IT' }
  ];

  applyVoiceCommentaryUnlocks(
    user,
    [{ type: 'voiceLanguage', optionId: 'it-IT' }],
    catalog
  );

  const normalized = normalizeVoiceInventory(user.voiceCommentaryInventory);
  assert.ok(normalized.ownedVoiceIds.includes('sofia_it_it_f'));
  assert.ok(normalized.ownedLocales.includes('it-IT'));
});

test('store item builder keeps English free and paid multilingual packs', () => {
  const items = buildVoiceStoreItems({
    voices: [
      { id: 'nova_en_us_f', locale: 'en-US', language: 'English' },
      { id: 'atlas_en_us_m', locale: 'en-US', language: 'English' },
      { id: 'sofia_it_it_f', locale: 'it-IT', language: 'Italian' }
    ]
  });
  const en = items.find((item) => item.optionId === 'en-US');
  const it = items.find((item) => item.optionId === 'it-IT');
  assert.equal(en.price, 0);
  assert.ok(it.price > 0);
});
