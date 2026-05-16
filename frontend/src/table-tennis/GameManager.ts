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
    this.scene.fog = new THREE.Fog('#07162e', 5.5, 9.5);
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
    const fastSwipeBonus = THREE.MathUtils.clamp(360 / Math.max(durationMs, 70), 0, 1);
    const directionalAim = end.x + dx * 0.45;
    const aimX = THREE.MathUtils.clamp(directionalAim, -1, 1);
    const power = THREE.MathUtils.clamp(distance * 0.82 + fastSwipeBonus * 0.5, 0.22, 1);
    const lift = THREE.MathUtils.clamp(0.24 + dy * 0.68, 0, 1);
    const curve = THREE.MathUtils.clamp(dx * 1.08, -1, 1);
    const spin = THREE.MathUtils.clamp(dy * 1.02 + power * 0.26 - Math.abs(curve) * 0.08, -1, 1);
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

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(GAME_CONFIG.table.width + 4.4, GAME_CONFIG.table.length + 5.3),
      new THREE.ShadowMaterial({ opacity: 0.24 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor, table);
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
