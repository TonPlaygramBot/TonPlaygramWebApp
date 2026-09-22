import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_SCRIPT = path.resolve(__dirname, '../webapp/public/domino-royal-game.js');

describe('Domino Royal graphics safety', () => {
  const script = fs.readFileSync(PUBLIC_SCRIPT, 'utf8');

  test('offers a real 50 Hz low-memory graphics profile', () => {
    expect(script).toContain("id: 'hd50'");
    expect(script).toContain("label: 'Low (50 Hz)'");
    expect(script).toContain('fps: 50');
    expect(script).toContain("hd50: Object.freeze(['1k'])");
  });

  test('automatically protects constrained phones and three-person video calls', () => {
    expect(script).toContain("return 'hd50';");
    expect(script).toContain('countActiveVideoParticipants() < 3');
    expect(script).toContain("applyFrameRateSelection('hd50', { source: 'video-safety' })");
    expect(script).toContain("renderer.shadowMap.enabled = !IS_TELEGRAM_RUNTIME && quality?.id !== 'hd50';");
  });

  test('paces rendering to the selected target instead of rendering every display refresh', () => {
    expect(script).toContain('frameTimeAccumulatorMs + 0.25 < targetMs');
    expect(script).toContain('frameTimeAccumulatorMs %= targetMs');
  });
});
