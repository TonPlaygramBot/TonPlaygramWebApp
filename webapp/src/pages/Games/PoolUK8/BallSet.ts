import * as THREE from 'three';

export const TABLE_DIMENSIONS_MM = Object.freeze({ length: 1981, width: 991 });
export const BALL_DIAMETER_MM = 50.8;
export const POCKET_RADIUS_MM = 60;

export type UkBallId =
  | 'Y1'
  | 'Y2'
  | 'Y3'
  | 'Y4'
  | 'Y5'
  | 'Y6'
  | 'Y7'
  | 'R1'
  | 'R2'
  | 'R3'
  | 'R4'
  | 'R5'
  | 'R6'
  | 'R7'
  | 'BLACK'
  | 'CUE';

export interface BallDefinition {
  id: UkBallId;
  number: number;
  label: string;
  type: 'yellow' | 'red' | 'black' | 'cue';
  color: string;
}

export const BALL_SET: ReadonlyArray<BallDefinition> = Object.freeze([
  { id: 'Y1', number: 1, label: 'Yellow 1', type: 'yellow', color: '#f6d000' },
  { id: 'Y2', number: 2, label: 'Yellow 2', type: 'yellow', color: '#f6d000' },
  { id: 'Y3', number: 3, label: 'Yellow 3', type: 'yellow', color: '#f6d000' },
  { id: 'Y4', number: 4, label: 'Yellow 4', type: 'yellow', color: '#f6d000' },
  { id: 'Y5', number: 5, label: 'Yellow 5', type: 'yellow', color: '#f6d000' },
  { id: 'Y6', number: 6, label: 'Yellow 6', type: 'yellow', color: '#f6d000' },
  { id: 'Y7', number: 7, label: 'Yellow 7', type: 'yellow', color: '#f6d000' },
  { id: 'R1', number: 9, label: 'Red 1', type: 'red', color: '#c2272d' },
  { id: 'R2', number: 10, label: 'Red 2', type: 'red', color: '#c2272d' },
  { id: 'R3', number: 11, label: 'Red 3', type: 'red', color: '#c2272d' },
  { id: 'R4', number: 12, label: 'Red 4', type: 'red', color: '#c2272d' },
  { id: 'R5', number: 13, label: 'Red 5', type: 'red', color: '#c2272d' },
  { id: 'R6', number: 14, label: 'Red 6', type: 'red', color: '#c2272d' },
  { id: 'R7', number: 15, label: 'Red 7', type: 'red', color: '#c2272d' },
  { id: 'BLACK', number: 8, label: 'Black 8', type: 'black', color: '#111111' },
  { id: 'CUE', number: 0, label: 'Cue Ball', type: 'cue', color: '#f8f8f6' }
]);

const BALL_MAP = new Map(BALL_SET.map((ball) => [ball.id, ball]));

const TRIANGLE_ROWS: UkBallId[][] = [
  ['Y1'],
  ['R1', 'Y2'],
  ['Y3', 'BLACK', 'R2'],
  ['R3', 'Y4', 'R4', 'Y5'],
  ['Y6', 'R5', 'Y7', 'R6', 'R7']
];

export function mmToMeters(value: number): number {
  return value / 1000;
}

export function getBallDefinition(id: UkBallId): BallDefinition {
  const ball = BALL_MAP.get(id);
  if (!ball) {
    throw new Error(`Unknown UK ball id: ${id}`);
  }
  return ball;
}

function createCanvas(size = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function paintNumberedCircle(
  ctx: CanvasRenderingContext2D,
  number: number,
  options: { fill: string; stroke: string; text: string }
) {
  const { fill, stroke, text } = options;
  const { width, height } = ctx.canvas;
  const radius = width * 0.22;
  ctx.beginPath();
  ctx.fillStyle = fill;
  ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = radius * 0.12;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.fillStyle = text;
  ctx.font = `bold ${radius * 1.4}px "Arial"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), width / 2, height / 2);
}

export function createBallTexture(ball: BallDefinition): THREE.Texture {
  const canvas = createCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to acquire 2D context for ball texture');
  ctx.fillStyle = ball.type === 'cue' ? '#f9f9f4' : ball.color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (ball.type !== 'cue') {
    const circleFill = ball.type === 'black' ? '#fefefe' : '#ffffff';
    const textColor = ball.type === 'black' ? '#050505' : '#000000';
    paintNumberedCircle(ctx, ball.number, {
      fill: circleFill,
      stroke: 'rgba(255,255,255,0.35)',
      text: textColor
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface RackPosition {
  id: UkBallId;
  position: THREE.Vector3;
}

export function computeRackLayout(ballDiameter: number, tableLength: number): RackPosition[] {
  const spacing = ballDiameter;
  const rowAdvance = spacing * Math.sin(Math.PI / 3);
  const footSpot = tableLength / 2 - spacing * 1.5;
  const result: RackPosition[] = [];
  TRIANGLE_ROWS.forEach((rowBalls, rowIndex) => {
    const z = footSpot - rowIndex * rowAdvance;
    const rowWidth = (rowBalls.length - 1) * spacing;
    rowBalls.forEach((id, index) => {
      const x = -rowWidth / 2 + index * spacing;
      result.push({ id, position: new THREE.Vector3(x, 0, z) });
    });
  });
  return result;
}

export function getCueBallPosition(ballDiameter: number, tableLength: number): THREE.Vector3 {
  const headString = -tableLength / 4;
  return new THREE.Vector3(0, 0, headString);
}
