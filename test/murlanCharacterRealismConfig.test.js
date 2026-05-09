import fs from 'node:fs';
import path from 'node:path';
import { MURLAN_CHARACTER_THEMES } from '../webapp/src/config/murlanCharacterThemes.js';

describe('Murlan Royale character realism configuration', () => {
  test('every human character has royal styling metadata', () => {
    expect(MURLAN_CHARACTER_THEMES.length).toBeGreaterThan(0);
    MURLAN_CHARACTER_THEMES.forEach((theme) => {
      expect(theme.royalStyle).toBeTruthy();
      expect(['natural', 'court']).toContain(theme.royalStyle.makeup);
      expect(theme.royalStyle.ageDetail).toBeGreaterThanOrEqual(0);
      expect(theme.royalStyle.ageDetail).toBeLessThanOrEqual(1);
      expect(theme.royalStyle.metalTone).toBeGreaterThan(0);
    });
  });

  test('arena contains diverse open PBR wardrobe and micro-detail pipeline', () => {
    const arenaSource = fs.readFileSync(path.join(process.cwd(), 'webapp/src/pages/Games/MurlanRoyaleArena.jsx'), 'utf8');
    ['denim_fabric', 'floral_jacquard', 'cotton_jersey', 'poly_wool_herringbone', 'brown_leather', 'leather_white'].forEach((assetId) => {
      expect(arenaSource).toContain(assetId);
    });
    expect(arenaSource).toContain('MURLAN_CHARACTER_DETAIL_PROVIDER_NOTES');
    expect(arenaSource).toContain('ambientCG');
    expect(arenaSource).toContain('cgbookcase');
    expect(arenaSource).toContain('createMurlanSkinAlbedoTexture');
    expect(arenaSource).toContain('addMurlanRoyalMicroDetails');
    expect(arenaSource).toContain('murlanPreservedOriginalUvMap');
  });
});
