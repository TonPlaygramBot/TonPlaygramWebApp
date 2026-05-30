import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOMINO_PUBLIC_SCRIPT = path.resolve(__dirname, '../webapp/public/domino-royal-game.js');

function readNumericConstant(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+);`));
  if (!match) throw new Error(`Missing ${name} constant`);
  return Number(match[1]);
}

test('Domino Royal seated human characters stay readable while appearing smaller on screen', () => {
  const source = fs.readFileSync(DOMINO_PUBLIC_SCRIPT, 'utf8');
  const baseScale = readNumericConstant(source, 'DOMINO_CHARACTER_PROPORTION_SCALE');
  const humanBoost = readNumericConstant(source, 'DOMINO_HUMAN_CHARACTER_SCALE_BOOST');

  expect(baseScale).toBeGreaterThanOrEqual(2.35);
  expect(baseScale + humanBoost).toBeGreaterThanOrEqual(3.05);
});


test('Domino Royal character actions use the Murlan Royale arm and hand gesture timings', () => {
  const source = fs.readFileSync(DOMINO_PUBLIC_SCRIPT, 'utf8');

  [
    "rightUpperArm: { x: THREE.MathUtils.degToRad(-24), y: THREE.MathUtils.degToRad(-6), z: THREE.MathUtils.degToRad(-7) }",
    "rightForeArm: { x: THREE.MathUtils.degToRad(-38), y: THREE.MathUtils.degToRad(-2), z: THREE.MathUtils.degToRad(-1) }",
    "rightHand: { x: THREE.MathUtils.degToRad(-18), y: THREE.MathUtils.degToRad(-4), z: THREE.MathUtils.degToRad(-3) }",
    "rightUpperArm: { x: THREE.MathUtils.degToRad(-17), y: THREE.MathUtils.degToRad(-6), z: THREE.MathUtils.degToRad(-7) }",
    "rightForeArm: { x: THREE.MathUtils.degToRad(-30), y: THREE.MathUtils.degToRad(-2), z: THREE.MathUtils.degToRad(-1) }",
    "rightHand: { x: THREE.MathUtils.degToRad(-12), y: THREE.MathUtils.degToRad(-4), z: THREE.MathUtils.degToRad(-3) }",
    "rightUpperArm: { x: THREE.MathUtils.degToRad(-20), y: THREE.MathUtils.degToRad(-18), z: THREE.MathUtils.degToRad(-14) }",
    "rightForeArm: { x: THREE.MathUtils.degToRad(-24), y: THREE.MathUtils.degToRad(-1) }",
    "rightHand: { x: THREE.MathUtils.degToRad(-14), y: THREE.MathUtils.degToRad(-5), z: THREE.MathUtils.degToRad(-1) }",
    'start: now + 520, duration: 260',
    'start: now + 560, duration: 300',
    'action.update?.(easeInOutCubic(t));'
  ].forEach((snippet) => {
    expect(source).toContain(snippet);
  });
});
