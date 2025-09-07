const TABLE_WIDTH = 2.84; // table width in meters
const TABLE_HEIGHT = 1.42; // table height in meters
const BALL_RADIUS = 0.0285; // ~57 mm diameter

const CUSHION_WIDTH = 0.05; // cushion width
// playable area inside cushions
const PLAY_MIN_X = CUSHION_WIDTH + BALL_RADIUS;
const PLAY_MAX_X = TABLE_WIDTH - (CUSHION_WIDTH + BALL_RADIUS);
const PLAY_MIN_Y = CUSHION_WIDTH + BALL_RADIUS;
const PLAY_MAX_Y = TABLE_HEIGHT - (CUSHION_WIDTH + BALL_RADIUS);

// fixed green boundary lines
const LINE_MIN_X = BALL_RADIUS;
const LINE_MAX_X = TABLE_WIDTH - BALL_RADIUS;
const LINE_MIN_Y = BALL_RADIUS;
const LINE_MAX_Y = TABLE_HEIGHT - BALL_RADIUS;

// pocket centers moved slightly toward the table center
// moved a touch further inward for tighter pocket alignment
const POCKET_INSET = 0.04;
const POCKETS = [
  [POCKET_INSET, POCKET_INSET],
  [TABLE_WIDTH / 2, POCKET_INSET],
  [TABLE_WIDTH - POCKET_INSET, POCKET_INSET],
  [POCKET_INSET, TABLE_HEIGHT - POCKET_INSET],
  [TABLE_WIDTH / 2, TABLE_HEIGHT - POCKET_INSET],
  [TABLE_WIDTH - POCKET_INSET, TABLE_HEIGHT - POCKET_INSET]
];

class Ball {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.touchedCushion = false; // has hit cushion
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.checkCushion();
    this.checkLine();
  }

  checkCushion() {
    let hit = false;
    if (this.x < PLAY_MIN_X) {
      this.x = 2 * PLAY_MIN_X - this.x;
      this.vx *= -1;
      hit = true;
    } else if (this.x > PLAY_MAX_X) {
      this.x = 2 * PLAY_MAX_X - this.x;
      this.vx *= -1;
      hit = true;
    }
    if (this.y < PLAY_MIN_Y) {
      this.y = 2 * PLAY_MIN_Y - this.y;
      this.vy *= -1;
      hit = true;
    } else if (this.y > PLAY_MAX_Y) {
      this.y = 2 * PLAY_MAX_Y - this.y;
      this.vy *= -1;
      hit = true;
    }
    if (hit) {
      this.touchedCushion = true;
    }
  }

  checkLine() {
    if (!this.touchedCushion) return;
    let crossed = false;
    if (this.x < LINE_MIN_X) {
      this.x = LINE_MIN_X;
      this.vx *= -1;
      crossed = true;
    } else if (this.x > LINE_MAX_X) {
      this.x = 2 * LINE_MAX_X - this.x;
      this.vx *= -1;
      crossed = true;
    }
    if (this.y < LINE_MIN_Y) {
      this.y = LINE_MIN_Y;
      this.vy *= -1;
      crossed = true;
    } else if (this.y > LINE_MAX_Y) {
      this.y = 2 * LINE_MAX_Y - this.y;
      this.vy *= -1;
      crossed = true;
    }
    if (crossed) {
      this.touchedCushion = false;
    }
  }

}

function simulate(balls, steps, dt) {
  for (let i = 0; i < steps; i++) {
    for (const b of balls) {
      b.update(dt);
    }
  }
}

const balls = [new Ball(1.0, 0.7, 0.6, 0.4)];
simulate(balls, 100, 0.1);
const b = balls[0];
console.log(
  `Final: (${b.x.toFixed(2)}, ${b.y.toFixed(2)}) velocity (${b.vx.toFixed(2)}, ${b.vy.toFixed(2)})`
);
