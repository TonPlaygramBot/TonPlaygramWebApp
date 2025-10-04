import * as THREE from 'three';

export const TABLE_DIMENSIONS_MM = Object.freeze({ length: 2240, width: 1120 });
export const BALL_DIAMETER_MM = 57.15;
export const POCKET_RADIUS_MM = 63;

export type AmericanBallId =
  | 'SOLID1'
  | 'SOLID2'
  | 'SOLID3'
  | 'SOLID4'
  | 'SOLID5'
  | 'SOLID6'
  | 'SOLID7'
  | 'BLACK8'
  | 'STRIPE9'
  | 'STRIPE10'
  | 'STRIPE11'
  | 'STRIPE12'
  | 'STRIPE13'
  | 'STRIPE14'
  | 'STRIPE15'
  | 'CUE';

export interface BallDefinition {
  id: AmericanBallId;
  number: number;
  label: string;
  type: 'solid' | 'stripe' | 'black' | 'cue';
  color: string;
}

export const BALL_SET: ReadonlyArray<BallDefinition> = Object.freeze([
  { id: 'SOLID1', number: 1, label: '1 Ball', type: 'solid', color: '#f7d21b' },
  { id: 'SOLID2', number: 2, label: '2 Ball', type: 'solid', color: '#1d69d6' },
  { id: 'SOLID3', number: 3, label: '3 Ball', type: 'solid', color: '#c8363c' },
  { id: 'SOLID4', number: 4, label: '4 Ball', type: 'solid', color: '#7d4cb4' },
  { id: 'SOLID5', number: 5, label: '5 Ball', type: 'solid', color: '#f07f1a' },
  { id: 'SOLID6', number: 6, label: '6 Ball', type: 'solid', color: '#2b9c5a' },
  { id: 'SOLID7', number: 7, label: '7 Ball', type: 'solid', color: '#7c3f2b' },
  { id: 'BLACK8', number: 8, label: '8 Ball', type: 'black', color: '#111111' },
  { id: 'STRIPE9', number: 9, label: '9 Ball', type: 'stripe', color: '#f7d21b' },
  { id: 'STRIPE10', number: 10, label: '10 Ball', type: 'stripe', color: '#1d69d6' },
  { id: 'STRIPE11', number: 11, label: '11 Ball', type: 'stripe', color: '#c8363c' },
  { id: 'STRIPE12', number: 12, label: '12 Ball', type: 'stripe', color: '#7d4cb4' },
  { id: 'STRIPE13', number: 13, label: '13 Ball', type: 'stripe', color: '#f07f1a' },
  { id: 'STRIPE14', number: 14, label: '14 Ball', type: 'stripe', color: '#2b9c5a' },
  { id: 'STRIPE15', number: 15, label: '15 Ball', type: 'stripe', color: '#7c3f2b' },
  { id: 'CUE', number: 0, label: 'Cue Ball', type: 'cue', color: '#f8f8f6' }
]);

const BALL_MAP = new Map(BALL_SET.map((ball) => [ball.id, ball]));

const TRIANGLE_ROWS: AmericanBallId[][] = [
  ['SOLID1'],
  ['STRIPE10', 'STRIPE15'],
  ['SOLID2', 'BLACK8', 'SOLID3'],
  ['STRIPE11', 'SOLID7', 'STRIPE14', 'SOLID6'],
  ['SOLID4', 'STRIPE13', 'SOLID5', 'STRIPE12', 'STRIPE9']
];

export function mmToMeters(value: number): number {
  return value / 1000;
}

export function getBallDefinition(id: AmericanBallId): BallDefinition {
  const ball = BALL_MAP.get(id);
  if (!ball) throw new Error(`Unknown American 8-ball id: ${id}`);
  return ball;
}

function createCanvas(size = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function drawStripe(ctx: CanvasRenderingContext2D, color: string) {
  const { width, height } = ctx.canvas;
  const stripeHeight = height * 0.38;
  const y = (height - stripeHeight) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(0, y, width, stripeHeight);
}

function drawSolid(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function paintNumber(
  ctx: CanvasRenderingContext2D,
  number: number,
  type: BallDefinition['type'],
  accent: string
) {
  const { width } = ctx.canvas;
  const radius = width * 0.22;
  ctx.beginPath();
  ctx.fillStyle = type === 'black' ? '#fdfdfd' : '#ffffff';
  ctx.arc(width / 2, width / 2, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = radius * 0.12;
  ctx.strokeStyle = type === 'stripe' ? accent : type === 'black' ? '#fdfdfd' : 'rgba(255,255,255,0.45)';
  ctx.stroke();
  ctx.fillStyle = type === 'black' ? '#050505' : '#000000';
  ctx.font = `bold ${radius * 1.4}px "Arial"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), width / 2, width / 2);
}

export function createBallTexture(ball: BallDefinition): THREE.Texture {
  const canvas = createCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create canvas context');

  if (ball.type === 'cue') {
    ctx.fillStyle = '#f9f9f4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (ball.type === 'stripe') {
    drawStripe(ctx, ball.color);
  } else {
    drawSolid(ctx, ball.color);
  }

  if (ball.type !== 'cue') {
    paintNumber(ctx, ball.number, ball.type, ball.color);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface RackPosition {
  id: AmericanBallId;
  position: THREE.Vector3;
}

export function computeRackLayout(ballDiameter: number, tableLength: number): RackPosition[] {
  const spacing = ballDiameter;
  const rowAdvance = spacing * Math.sin(Math.PI / 3);
  const footSpot = tableLength / 2 - spacing * 1.5;
  const positions: RackPosition[] = [];
  TRIANGLE_ROWS.forEach((rowBalls, rowIndex) => {
    const z = footSpot - rowIndex * rowAdvance;
    const rowWidth = (rowBalls.length - 1) * spacing;
    rowBalls.forEach((id, index) => {
      const x = -rowWidth / 2 + index * spacing;
      positions.push({ id, position: new THREE.Vector3(x, 0, z) });
    });
  });
  return positions;
}

export function getCueBallPosition(ballDiameter: number, tableLength: number): THREE.Vector3 {
  const headString = -tableLength / 4;
  return new THREE.Vector3(0, 0, headString);
}
