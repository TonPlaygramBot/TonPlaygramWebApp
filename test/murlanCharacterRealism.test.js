import { strict as assert } from 'assert';
import {
  MURLAN_CHARACTER_MATERIAL_LIBRARY,
  MURLAN_REALISM_RENDERING_GUIDE,
  MURLAN_REALISM_SOURCE_NOTES,
  MURLAN_ROYAL_STYLE_PROFILES,
  resolveMurlanGarment,
  resolveMurlanMaterial,
  resolveMurlanStyleProfile
} from '../webapp/src/config/murlanCharacterRealism.js';

describe('Murlan Royale character realism config', () => {
  test('documents approved open PBR material sources', () => {
    const names = new Set(MURLAN_REALISM_SOURCE_NOTES.map((source) => source.name));
    assert.ok(names.has('Poly Haven'));
    assert.ok(names.has('ambientCG'));
    assert.ok(names.has('CGBookcase'));
  });

  test('material library exposes PBR maps and source metadata for runtime cloth styling', () => {
    for (const [id, material] of Object.entries(MURLAN_CHARACTER_MATERIAL_LIBRARY)) {
      assert.equal(typeof material.color, 'string', id);
      assert.equal(typeof material.normal, 'string', id);
      assert.equal(typeof material.roughnessMap, 'string', id);
      assert.equal(material.license, 'CC0', id);
      assert.ok(material.sourceUrl.startsWith('https://'), id);
      assert.ok(material.repeat > 0, id);
    }
  });

  test('every royal style profile has distinct garment slots and physical styling data', () => {
    for (const profile of MURLAN_ROYAL_STYLE_PROFILES) {
      const slots = ['upper', 'lower', 'accent', 'shoes'];
      const materialIds = slots.map((slot) => resolveMurlanGarment(profile, slot).material);
      assert.equal(new Set(materialIds).size, materialIds.length, profile.id);
      assert.ok(profile.skinTone > 0, profile.id);
      assert.ok(profile.hairColor > 0, profile.id);
      assert.ok(profile.eyeColor > 0, profile.id);
      assert.ok(profile.ageDetail >= 0, profile.id);
    }
  });

  test('resolver cycles style profiles per seat and resolves fallback materials safely', () => {
    assert.equal(resolveMurlanStyleProfile(null, 0).id, MURLAN_ROYAL_STYLE_PROFILES[0].id);
    assert.equal(resolveMurlanStyleProfile(null, MURLAN_ROYAL_STYLE_PROFILES.length).id, MURLAN_ROYAL_STYLE_PROFILES[0].id);
    assert.equal(resolveMurlanMaterial('missing').id, MURLAN_CHARACTER_MATERIAL_LIBRARY.denim.id);
    assert.ok(MURLAN_REALISM_RENDERING_GUIDE.principles.some((principle) => principle.includes('original glTF UVs')));
  });
});
