import * as THREE from 'three';
import { AIController } from './AIController';
import { BallPhysics } from './BallPhysics';
import { CameraController } from './CameraController';
import { GAME_CONFIG, ShotCommand, ShotType } from './gameConfig';
import { PaddleHitDetector } from './PaddleHitDetector';
import { PlayerController } from './PlayerController';
import { ReplayManager } from './ReplayManager';
import { ScoreManager } from './ScoreManager';

export interface GameHudState {
  playerScore: number;
  aiScore: number;
  server: string;
  lastShot: string;
  lastReason: string;
  replaying: boolean;
  debug: {
    ballState: string;
    bounces: string;
    hitValidity: string;
    predictedLanding: string;
  };
}

export class GameManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly ball = new BallPhysics();
  readonly score = new ScoreManager();
  readonly replay = new ReplayManager();
  private readonly hitDetector = new PaddleHitDetector();
  private readonly cameraController: CameraController;
  private readonly player: PlayerController;
  private readonly ai: AIController;
  private readonly clock = new THREE.Clock();
  private readonly ballMesh: THREE.Mesh;
  private readonly predictedMarker: THREE.Mesh;
  private animationId = 0;
  private rallyTime = 0;
  private pointResetTimer = 0;
  private lastShot = '';
  private lastHitValidity = 'waiting';
  private onHud?: (hud: GameHudState) => void;

  constructor(private mount: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(48, mount.clientWidth / mount.clientHeight, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(mount.clientWidth, mount.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color('#07162e');
    this.scene.fog = new THREE.Fog('#07162e', 8.5, 15.5);
    this.cameraController = new CameraController(this.camera);
    this.createLights();
    this.createTable();
    const playerVisuals = this.createAvatar('player');
    const aiVisuals = this.createAvatar('ai');
    this.player = new PlayerController(playerVisuals);
    this.ai = new AIController(aiVisuals.root, aiVisuals.hand, aiVisuals.paddle);
    this.ballMesh = this.createBall();
    this.predictedMarker = this.createPredictionMarker();
    this.resetPoint();
  }

  start(onHud: (hud: GameHudState) => void) {
    this.onHud = onHud;
    this.clock.start();
    const loop = () => {
      this.animationId = requestAnimationFrame(loop);
      this.update(Math.min(this.clock.getDelta(), 0.05));
    };
    loop();
  }

  dispose() {
    cancelAnimationFrame(this.animationId);
    this.renderer.dispose();
    this.mount.removeChild(this.renderer.domElement);
  }

  setPointer(_normalizedX: number) {
    // Player movement is auto-tracked now; pointer movement is reserved for swipe shooting.
  }

  shootSwipe(start: { x: number; y: number }, end: { x: number; y: number }, durationMs: number) {
    if (this.replay.isReplaying) return;
    this.player.queueShot(this.buildShotCommandFromSwipe(start, end, durationMs));
  }

  replayLastRally() {
    this.replay.beginReplay();
  }

  resetMatch() {
    this.score.resetMatch();
    this.resetPoint();
  }

  private update(dt: number) {
    if (this.replay.isReplaying) {
      const replayBall = this.replay.update(dt);
      if (replayBall) this.ballMesh.position.copy(replayBall);
      this.cameraController.update(dt, this.ballMesh.position, new THREE.Vector3(0, 0, GAME_CONFIG.player.z));
      this.renderer.render(this.scene, this.camera);
      this.emitHud();
      return;
    }

    this.rallyTime += dt;
    this.player.update(dt, this.ball.position, this.ball.predictLandingPoint('player'));
    this.ai.update(dt, this.ball);

    if (this.ball.state === 'serve') this.ball.serve(this.score.state.server);
    const events = this.ball.update(dt);
    events.filter((event) => event.type === 'bounce').forEach((event) => this.replay.recordBounce(this.rallyTime, event.side, event.position));

    this.tryPlayerHit();
    this.tryAiHit();

    const pointWinner = this.score.evaluate(events, this.ball);
    if (pointWinner) {
      this.replay.recordScore(this.rallyTime, pointWinner, { player: this.score.state.player, ai: this.score.state.ai }, this.score.state.lastReason);
      this.pointResetTimer = 1.35;
    }

    if (this.ball.state === 'pointEnded') {
      this.pointResetTimer -= dt;
      if (this.pointResetTimer <= 0 && !this.score.state.winner) this.resetPoint();
    }

    this.ballMesh.position.copy(this.ball.position);
    this.updatePredictionMarker();
    this.replay.recordBall(this.rallyTime, this.ball.position, this.ball.state);
    this.cameraController.update(dt, this.ball.position, new THREE.Vector3(this.playerPositionX(), 0, GAME_CONFIG.player.z));
    this.renderer.render(this.scene, this.camera);
    this.emitHud();
  }

  private tryPlayerHit() {
    if (this.ball.lastTouch === 'player' || this.ball.bounces.player < 1 || this.ball.bounces.player > 1) return;
    const result = this.hitDetector.detect({
      side: 'player',
      paddlePosition: this.player.getPaddleWorldPosition(),
      paddleForward: this.player.getPaddleForward(),
      ballPosition: this.ball.position,
      ballVelocity: this.ball.velocity,
      ballSpin: this.ball.spin,
      requestedShot: this.player.currentShot,
      shotCommand: this.player.peekShotCommand(),
    });
    this.lastHitValidity = result.valid ? 'valid player hit' : result.reason ?? 'invalid';
    if (result.valid && result.velocity && result.spin && result.shotType) {
      this.player.consumeShotCommand();
      this.ball.applyPaddleHit('player', result.velocity, result.spin);
      this.player.triggerHit();
      this.lastShot = result.shotType;
      this.replay.recordHit(this.rallyTime, 'player', result.shotType, this.ball.position);
    }
  }

  private tryAiHit() {
    if (this.ball.lastTouch === 'ai' || this.ball.bounces.ai < 1 || this.ball.bounces.ai > 1 || !this.ai.canReach(this.ball.position) || this.ai.shouldMiss()) return;
    const shot = this.ai.currentShot as ShotType;
    const result = this.hitDetector.detect({
      side: 'ai',
      paddlePosition: this.ai.getPaddleWorldPosition(),
      paddleForward: this.ai.getPaddleForward(),
      ballPosition: this.ball.position,
      ballVelocity: this.ball.velocity,
      ballSpin: this.ball.spin,
      requestedShot: shot,
      shotCommand: this.ai.getShotCommand(),
      accuracy: GAME_CONFIG.ai.difficulty.accuracy,
      powerScale: GAME_CONFIG.ai.difficulty.shotPower,
    });
    this.lastHitValidity = result.valid ? 'valid AI hit' : result.reason ?? 'invalid';
    if (result.valid && result.velocity && result.spin && result.shotType) {
      this.ball.applyPaddleHit('ai', result.velocity, result.spin);
      this.lastShot = result.shotType;
      this.replay.recordHit(this.rallyTime, 'ai', result.shotType, this.ball.position);
    }
  }


  private buildShotCommandFromSwipe(start: { x: number; y: number }, end: { x: number; y: number }, durationMs: number): ShotCommand {
    const dx = end.x - start.x;
    const dy = start.y - end.y;
    const distance = Math.hypot(dx, dy);
    const horizontalIntent = THREE.MathUtils.clamp(dx / Math.max(distance, 0.001), -1, 1);
    const verticalIntent = THREE.MathUtils.clamp(dy / Math.max(distance, 0.001), -1, 1);
    const swipeSpeed = distance / Math.max(durationMs / 1000, 0.08);
    const speedPower = THREE.MathUtils.clamp(swipeSpeed / 4.4, 0, 1);
    const distancePower = THREE.MathUtils.clamp(distance / 1.35, 0, 1);
    const aimX = THREE.MathUtils.clamp(end.x * 0.62 + horizontalIntent * 0.38 + dx * 0.18, -1, 1);
    const power = THREE.MathUtils.clamp(distancePower * 0.58 + speedPower * 0.42, 0.14, 1);
    const lift = THREE.MathUtils.clamp(0.22 + Math.max(verticalIntent, -0.25) * 0.44 + dy * 0.18, 0, 1);
    const curve = THREE.MathUtils.clamp(dx * 0.62 + horizontalIntent * 0.22, -1, 1);
    const spin = THREE.MathUtils.clamp(verticalIntent * 0.52 + dy * 0.28 + power * 0.24 - Math.abs(curve) * 0.08, -1, 1);
    return { aimX, power, lift, curve, spin };
  }

  private resetPoint() {
    this.rallyTime = 0;
    this.lastShot = '';
    this.lastHitValidity = 'waiting';
    this.replay.startRecording();
    this.ball.resetForServe(this.score.state.server);
  }

  private emitHud() {
    const landing = this.ball.predictLandingPoint();
    this.onHud?.({
      playerScore: this.score.state.player,
      aiScore: this.score.state.ai,
      server: this.score.state.server === 'player' ? 'YOU' : 'AI',
      lastShot: this.lastShot,
      lastReason: this.score.state.lastReason,
      replaying: this.replay.isReplaying,
      debug: {
        ballState: this.ball.state,
        bounces: `P:${this.ball.bounces.player} AI:${this.ball.bounces.ai}`,
        hitValidity: this.lastHitValidity,
        predictedLanding: landing ? `${landing.x.toFixed(2)}, ${landing.z.toFixed(2)}` : 'none',
      },
    });
  }

  private playerPositionX() {
    return this.player.getPaddleWorldPosition().x;
  }

  private updatePredictionMarker() {
    const landing = this.ball.predictLandingPoint();
    this.predictedMarker.visible = Boolean(landing);
    if (landing) this.predictedMarker.position.set(landing.x, GAME_CONFIG.table.topY + 0.006, landing.z);
  }

  private createLights() {
    this.scene.add(new THREE.HemisphereLight('#dbeafe', '#0f172a', 1.15));
    const key = new THREE.DirectionalLight('#ffffff', 2.25);
    key.position.set(2.8, 5.2, 3.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    this.scene.add(key);
  }

  private createTable() {
    const table = new THREE.Group();
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(GAME_CONFIG.table.width, GAME_CONFIG.table.thickness, GAME_CONFIG.table.length),
      new THREE.MeshStandardMaterial({ color: GAME_CONFIG.table.color, roughness: 0.58, metalness: 0.05 }),
    );
    top.position.y = GAME_CONFIG.table.topY - GAME_CONFIG.table.thickness / 2;
    top.receiveShadow = true;
    table.add(top);

    const lineMat = new THREE.MeshBasicMaterial({ color: GAME_CONFIG.table.lineColor });
    const addLine = (w: number, l: number, x: number, z: number) => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.006, l), lineMat);
      line.position.set(x, GAME_CONFIG.table.topY + 0.004, z);
      table.add(line);
    };
    addLine(GAME_CONFIG.table.width, 0.012, 0, 0);
    addLine(0.012, GAME_CONFIG.table.length, 0, 0);
    addLine(GAME_CONFIG.table.width, 0.016, 0, GAME_CONFIG.table.length / 2 - 0.01);
    addLine(GAME_CONFIG.table.width, 0.016, 0, -GAME_CONFIG.table.length / 2 + 0.01);
    addLine(0.016, GAME_CONFIG.table.length, GAME_CONFIG.table.width / 2 - 0.01, 0);
    addLine(0.016, GAME_CONFIG.table.length, -GAME_CONFIG.table.width / 2 + 0.01, 0);

    const net = this.createNet();
    table.add(net);

    this.scene.add(this.createCourtSurface(), table);
    this.createVenueDetails();
  }

  private createCourtSurface() {
    const court = new THREE.Group();
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(GAME_CONFIG.venue.width, GAME_CONFIG.venue.length),
      new THREE.MeshStandardMaterial({ color: GAME_CONFIG.venue.surfaceColor, roughness: 0.86, metalness: 0.02 }),
    );
    surface.rotation.x = -Math.PI / 2;
    surface.receiveShadow = true;
    court.add(surface);

    const innerWidth = GAME_CONFIG.table.width + 3.0;
    const innerLength = GAME_CONFIG.table.length + 3.6;
    const runoff = new THREE.Mesh(
      new THREE.PlaneGeometry(innerWidth, innerLength),
      new THREE.MeshStandardMaterial({ color: GAME_CONFIG.venue.runoffColor, roughness: 0.82, metalness: 0.015 }),
    );
    runoff.rotation.x = -Math.PI / 2;
    runoff.position.y = 0.002;
    runoff.receiveShadow = true;
    court.add(runoff);

    const addCourtLine = (width: number, length: number, x: number, z: number) => {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.008, length),
        new THREE.MeshBasicMaterial({ color: GAME_CONFIG.venue.borderLineColor }),
      );
      line.position.set(x, 0.009, z);
      court.add(line);
    };
    const lineThickness = 0.035;
    addCourtLine(innerWidth, lineThickness, 0, innerLength / 2);
    addCourtLine(innerWidth, lineThickness, 0, -innerLength / 2);
    addCourtLine(lineThickness, innerLength, innerWidth / 2, 0);
    addCourtLine(lineThickness, innerLength, -innerWidth / 2, 0);
    addCourtLine(innerWidth, lineThickness * 0.75, 0, 0);
    addCourtLine(lineThickness * 0.75, innerLength, 0, 0);

    return court;
  }

  private createVenueDetails() {
    const fenceMaterial = new THREE.MeshStandardMaterial({ color: '#132637', roughness: 0.62, metalness: 0.32 });
    const fenceHeight = 1.08;
    const fenceThickness = 0.035;
    const halfWidth = GAME_CONFIG.venue.width / 2;
    const halfLength = GAME_CONFIG.venue.length / 2;
    const fencePanels: THREE.Mesh[] = [
      new THREE.Mesh(new THREE.BoxGeometry(GAME_CONFIG.venue.width, fenceHeight, fenceThickness), fenceMaterial),
      new THREE.Mesh(new THREE.BoxGeometry(GAME_CONFIG.venue.width, fenceHeight, fenceThickness), fenceMaterial),
      new THREE.Mesh(new THREE.BoxGeometry(fenceThickness, fenceHeight, GAME_CONFIG.venue.length), fenceMaterial),
      new THREE.Mesh(new THREE.BoxGeometry(fenceThickness, fenceHeight, GAME_CONFIG.venue.length), fenceMaterial),
    ];
    fencePanels[0].position.set(0, fenceHeight / 2, halfLength);
    fencePanels[1].position.set(0, fenceHeight / 2, -halfLength);
    fencePanels[2].position.set(halfWidth, fenceHeight / 2, 0);
    fencePanels[3].position.set(-halfWidth, fenceHeight / 2, 0);
    fencePanels.forEach((panel) => {
      panel.castShadow = true;
      panel.receiveShadow = true;
      this.scene.add(panel);
    });

    this.createUmpireChair(-halfWidth + 0.62, 0.08);
    this.createBench(halfWidth - 0.85, -1.52, Math.PI / 2);
    this.createBench(-halfWidth + 0.85, -1.52, -Math.PI / 2);
    this.createBallBasket(halfWidth - 0.62, 1.34);
    this.createBallBasket(-halfWidth + 0.62, 1.34);
    this.createAdBoard(0, halfLength - 0.08, 'TON PLAYGRAM');
    this.createAdBoard(0, -halfLength + 0.08, 'TABLE TENNIS ARENA');
    this.createLightRig(-halfWidth + 0.5, -halfLength + 0.5);
    this.createLightRig(halfWidth - 0.5, -halfLength + 0.5);
    this.createLightRig(-halfWidth + 0.5, halfLength - 0.5);
    this.createLightRig(halfWidth - 0.5, halfLength - 0.5);
  }


  private createUmpireChair(x: number, z: number) {
    const chair = new THREE.Group();
    chair.position.set(x, 0, z);
    const frameMaterial = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.38, metalness: 0.42 });
    const seatMaterial = new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.58 });
    const legGeometry = new THREE.BoxGeometry(0.035, 0.78, 0.035);
    [-0.18, 0.18].forEach((legX) => [-0.18, 0.18].forEach((legZ) => {
      const leg = new THREE.Mesh(legGeometry, frameMaterial);
      leg.position.set(legX, 0.39, legZ);
      leg.castShadow = true;
      chair.add(leg);
    }));
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.42), seatMaterial);
    seat.position.y = 0.82;
    seat.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.055), seatMaterial);
    back.position.set(0, 1.06, -0.2);
    back.castShadow = true;
    const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.62), frameMaterial);
    ladder.position.set(0.34, 0.42, 0.08);
    ladder.rotation.z = -0.42;
    ladder.castShadow = true;
    chair.add(seat, back, ladder);
    this.scene.add(chair);
  }

  private createBench(x: number, z: number, rotationY: number) {
    const bench = new THREE.Group();
    bench.position.set(x, 0, z);
    bench.rotation.y = rotationY;
    const plankMaterial = new THREE.MeshStandardMaterial({ color: '#b7791f', roughness: 0.72 });
    const frameMaterial = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.48, metalness: 0.25 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.32), plankMaterial);
    seat.position.y = 0.34;
    seat.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.32), plankMaterial);
    back.position.set(0, 0.64, -0.2);
    back.rotation.x = -0.22;
    back.castShadow = true;
    [-0.42, 0.42].forEach((legX) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.34, 0.055), frameMaterial);
      leg.position.set(legX, 0.17, 0.08);
      leg.castShadow = true;
      bench.add(leg);
    });
    bench.add(seat, back);
    this.scene.add(bench);
  }

  private createBallBasket(x: number, z: number) {
    const basket = new THREE.Group();
    basket.position.set(x, 0, z);
    const rimMaterial = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.34, metalness: 0.45 });
    const ballMaterial = new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#facc15', emissiveIntensity: 0.12, roughness: 0.42 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 32), rimMaterial);
    rim.position.y = 0.48;
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true;
    basket.add(rim);
    [-0.14, 0.14].forEach((legX) => [-0.14, 0.14].forEach((legZ) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.48, 0.015), rimMaterial);
      leg.position.set(legX, 0.24, legZ);
      leg.castShadow = true;
      basket.add(leg);
    }));
    for (let i = 0; i < 7; i += 1) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), ballMaterial);
      ball.position.set((i % 3 - 1) * 0.07, 0.5 + Math.floor(i / 3) * 0.045, (Math.floor(i / 2) % 3 - 1) * 0.055);
      ball.castShadow = true;
      basket.add(ball);
    }
    this.scene.add(basket);
  }

  private createAdBoard(x: number, z: number, label: string) {
    const texture = this.createSignTexture(label);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.42, 0.045),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.48, metalness: 0.08 }),
    );
    board.position.set(x, 0.32, z);
    board.castShadow = true;
    board.receiveShadow = true;
    if (z < 0) board.rotation.y = Math.PI;
    this.scene.add(board);
  }

  private createLightRig(x: number, z: number) {
    const rig = new THREE.Group();
    rig.position.set(x, 0, z);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.32, metalness: 0.55 });
    const lampMaterial = new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#bae6fd', emissiveIntensity: 0.45, roughness: 0.28 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.2, 12), poleMaterial);
    pole.position.y = 1.1;
    pole.castShadow = true;
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.04), poleMaterial);
    crossbar.position.y = 2.16;
    crossbar.castShadow = true;
    [-0.22, 0.22].forEach((lampX) => {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.12), lampMaterial);
      lamp.position.set(lampX, 2.1, 0.02);
      lamp.castShadow = true;
      rig.add(lamp);
    });
    rig.add(pole, crossbar);
    this.scene.add(rig);
  }

  private createNet() {
    const netGroup = new THREE.Group();
    const netWidth = GAME_CONFIG.table.width + GAME_CONFIG.net.overhang * 2;
    const netHeight = GAME_CONFIG.net.height;
    const netTexture = this.createHexNetTexture();
    const netMaterial = new THREE.MeshBasicMaterial({
      map: netTexture,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const netPanel = new THREE.Mesh(new THREE.PlaneGeometry(netWidth, netHeight), netMaterial);
    netPanel.position.y = GAME_CONFIG.table.topY + netHeight / 2;
    netPanel.rotation.y = Math.PI;
    netPanel.castShadow = true;
    netGroup.add(netPanel);

    const stripeMaterial = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.42, metalness: 0.02 });
    const stripeHeight = 0.018;
    const stripeDepth = GAME_CONFIG.net.thickness * 1.35;
    const topStripe = new THREE.Mesh(new THREE.BoxGeometry(netWidth, stripeHeight, stripeDepth), stripeMaterial);
    topStripe.position.y = GAME_CONFIG.table.topY + netHeight - stripeHeight / 2;
    topStripe.castShadow = true;
    const bottomStripe = topStripe.clone();
    bottomStripe.position.y = GAME_CONFIG.table.topY + stripeHeight / 2;
    netGroup.add(topStripe, bottomStripe);

    return netGroup;
  }


  private createSignTexture(label: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) return new THREE.CanvasTexture(canvas);

    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(0.55, '#1d4ed8');
    gradient.addColorStop(1, '#0f766e');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(255, 255, 255, 0.74)';
    context.lineWidth = 8;
    context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    context.fillStyle = '#f8fafc';
    context.font = '700 42px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createHexNetTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (!context) return new THREE.CanvasTexture(canvas);

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(219, 234, 254, 0.92)';
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    const radius = 14;
    const hexWidth = Math.sqrt(3) * radius;
    const verticalStep = radius * 1.5;
    for (let y = radius; y < canvas.height + radius; y += verticalStep) {
      const row = Math.round((y - radius) / verticalStep);
      const xOffset = row % 2 === 0 ? radius : radius + hexWidth / 2;
      for (let x = -hexWidth; x < canvas.width + hexWidth; x += hexWidth) {
        this.drawHexagon(context, x + xOffset, y, radius);
      }
    }

    return new THREE.CanvasTexture(canvas);
  }

  private drawHexagon(context: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number) {
    context.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.PI / 6 + (Math.PI / 3) * i;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.stroke();
  }

  private createAvatar(side: 'player' | 'ai') {
    const root = new THREE.Group();
    root.position.set(0, 0, side === 'player' ? GAME_CONFIG.player.z : GAME_CONFIG.ai.z);
    root.rotation.y = side === 'player' ? 0 : Math.PI;
    const avatarScale = side === 'player' ? GAME_CONFIG.player.avatarScale : GAME_CONFIG.ai.avatarScale;
    root.scale.setScalar(avatarScale);
    const material = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.72, metalness: 0.02 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.44, 5, 12), material);
    torso.position.y = 0.72;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), material);
    head.position.y = 1.16;
    head.castShadow = true;
    const hand = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.34, 4, 8), material);
    arm.rotation.x = Math.PI / 2;
    arm.castShadow = true;
    hand.add(arm);
    const paddle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.018, 32),
      new THREE.MeshStandardMaterial({ color: '#d72638', roughness: 0.48 }),
    );
    paddle.rotation.x = Math.PI / 2;
    paddle.castShadow = true;
    hand.add(paddle);
    root.add(torso, head, hand);
    this.scene.add(root);
    return { root, torso, head, hand, paddle };
  }

  private createBall() {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(GAME_CONFIG.ballRadius, 24, 18),
      new THREE.MeshStandardMaterial({ color: '#fff8b5', emissive: '#facc15', emissiveIntensity: 0.22, roughness: 0.36 }),
    );
    ball.castShadow = true;
    this.scene.add(ball);
    return ball;
  }

  private createPredictionMarker() {
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.12, 32),
      new THREE.MeshBasicMaterial({ color: '#fef08a', transparent: true, opacity: 0.65, side: THREE.DoubleSide }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.visible = false;
    this.scene.add(marker);
    return marker;
  }
}
