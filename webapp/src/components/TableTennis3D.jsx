import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createArenaCarpetMaterial, createArenaWallMaterial } from "../utils/arenaDecor.js";
import { applySRGBColorSpace } from "../utils/colorSpace.js";

// --- Math core from the shared rules snippet ---
class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  clone() {
    return new Vec3(this.x, this.y, this.z);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  addScaled(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }
  scale(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  cross(v) {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }
  len() {
    return Math.hypot(this.x, this.y, this.z);
  }
  norm() {
    const l = this.len() || 1;
    this.x /= l;
    this.y /= l;
    this.z /= l;
    return this;
  }
}

// --- Rules and constants ---
const TABLE_LENGTH = 2.74;
const TABLE_WIDTH = 1.525;
const TABLE_HEIGHT = 0.76;
const NET_HEIGHT = 0.1525;
const BALL_DIAMETER = 0.04;
const BALL_RADIUS = BALL_DIAMETER / 2;
const PADDLE_RADIUS = 0.085;
const WORLD_Y_FLOOR = -0.1;
const GRAVITY = -9.81;
const AIR_DRAG_K = 0.15;
const MAGNUS_K = 0.0007;
const TABLE_RESTITUTION = 0.9;
const TABLE_TANGENTIAL_DAMP = 0.88;
const NET_THICKNESS = 0.012;
const POINTS_TO_WIN = 11;
const SERVE_ALTERNATION = 2;
const FIXED_DT = 1 / 120;
const MAX_ACCUM_DT = 0.2;
const DIFFICULTY = {
  Easy: { react: 2.5, aimErr: 0.28, power: 0.8, spin: 0.5 },
  Medium: { react: 4.0, aimErr: 0.13, power: 1.0, spin: 0.9 },
  Hard: { react: 6.0, aimErr: 0.05, power: 1.2, spin: 1.3 },
};

const halfL = TABLE_LENGTH / 2;
const halfW = TABLE_WIDTH / 2;

class Rules {
  constructor() {
    this.score = { player: 0, ai: 0 };
    this.service = { server: "Player", servesSinceSwap: 0 };
    this.stage = "Warmup";
    this.rally = { lastHitter: null, lastSideBounce: null, consecutiveBouncesOnSameSide: 0 };
    this.contact = { touchedNetThisFlight: false };
    this.letServe = false;
  }
  resetRally() {
    this.rally = { lastHitter: null, lastSideBounce: null, consecutiveBouncesOnSameSide: 0 };
    this.contact.touchedNetThisFlight = false;
    this.letServe = false;
  }
  isDeuce() {
    return this.score.player >= 10 && this.score.ai >= 10 && Math.abs(this.score.player - this.score.ai) < 2;
  }
  currentServeSpan() {
    return this.isDeuce() ? 1 : SERVE_ALTERNATION;
  }
  awardPoint(side) {
    if (this.stage === "GameOver") return;
    if (this.letServe) {
      this.letServe = false;
      this.stage = "ServeFlying";
      this.resetRally();
      return;
    }
    if (side === "Player") this.score.player += 1;
    else this.score.ai += 1;
    const lead = Math.abs(this.score.player - this.score.ai);
    const maxp = Math.max(this.score.player, this.score.ai);
    if (maxp >= POINTS_TO_WIN && lead >= 2) {
      this.stage = "GameOver";
      return;
    }
    this.service.servesSinceSwap += 1;
    if (this.service.servesSinceSwap >= this.currentServeSpan()) {
      this.service.server = this.service.server === "Player" ? "AI" : "Player";
      this.service.servesSinceSwap = 0;
    }
    this.stage = "PointOver";
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function planAIReturn(ballState, difficulty) {
  const preset = DIFFICULTY[difficulty];
  const aimX = clamp(ballState.pos.x + (Math.random() - 0.5) * 0.6, -halfW * 0.75, halfW * 0.75);
  const aimZ = halfL * (0.18 + 0.17 * Math.random());
  const target = new Vec3(aimX, TABLE_HEIGHT + 0.02, aimZ);
  const dir = target.clone().sub(ballState.pos).norm();
  const impulse = dir.scale(3.2 * preset.power);
  impulse.y = 2.4 * preset.power;
  const sideSpin = (Math.random() * 2 - 1) * 40 * preset.spin;
  const topSpin = 50 * preset.spin;
  ballState.omega.set(0, sideSpin, topSpin);
  return { impulse, target };
}

function TableTennis3D({ player, ai }) {
  const mountRef = useRef(null);
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [server, setServer] = useState("Player");
  const [stage, setStage] = useState("Warmup");
  const [fps, setFps] = useState(0);
  const [difficulty] = useState("Medium");
  const accRef = useRef(0);
  const lastFrameRef = useRef(performance.now());

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    applySRGBColorSpace(renderer);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e14);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 2.2, 3.8);
    camera.lookAt(0, TABLE_HEIGHT + 0.05, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(4, 8, 6);
    scene.add(sun);

    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(TABLE_WIDTH + 1.2, TABLE_LENGTH + 1.2),
      createArenaCarpetMaterial({ color: 0xb01224, emissive: 0x2d020a, emissiveIntensity: 0.18, bumpScale: 0.24 })
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0;
    scene.add(carpet);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(TABLE_WIDTH + 4, TABLE_LENGTH + 4),
      new THREE.MeshStandardMaterial({ color: 0x0f1222 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);

    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_WIDTH + 4.5, 2.6, TABLE_LENGTH + 4.5),
      createArenaWallMaterial({ color: 0xeeeeee })
    );
    walls.position.y = 1.3;
    scene.add(walls);

    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_WIDTH, 0.04, TABLE_LENGTH),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6 })
    );
    tableTop.position.y = TABLE_HEIGHT;
    scene.add(tableTop);

    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const makeLine = (w, h, x, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, h), lineMaterial);
      mesh.position.set(x, TABLE_HEIGHT + 0.022, z);
      scene.add(mesh);
    };
    makeLine(TABLE_WIDTH, 0.02, 0, halfL);
    makeLine(TABLE_WIDTH, 0.02, 0, -halfL);
    makeLine(0.02, TABLE_LENGTH, halfW, 0);
    makeLine(0.02, TABLE_LENGTH, -halfW, 0);
    makeLine(0.02, TABLE_LENGTH, 0, 0);

    const net = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_WIDTH, NET_HEIGHT, NET_THICKNESS),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    net.position.y = TABLE_HEIGHT + NET_HEIGHT / 2;
    scene.add(net);

    const paddleGeometry = new THREE.CylinderGeometry(PADDLE_RADIUS, PADDLE_RADIUS, 0.02, 20);
    const paddleMaterialPlayer = new THREE.MeshStandardMaterial({ color: 0xff4d6d });
    const paddleMaterialAI = new THREE.MeshStandardMaterial({ color: 0x49dcb1 });

    const playerMesh = new THREE.Mesh(paddleGeometry, paddleMaterialPlayer);
    playerMesh.rotation.x = Math.PI / 2;
    scene.add(playerMesh);

    const aiMesh = new THREE.Mesh(paddleGeometry, paddleMaterialAI);
    aiMesh.rotation.x = Math.PI / 2;
    scene.add(aiMesh);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffd7a1, emissiveIntensity: 0.5 })
    );
    scene.add(ball);

    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 });
    const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_RADIUS * 2.2, 24), shadowMaterial);
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.position.y = TABLE_HEIGHT + 0.01;
    scene.add(ballShadow);

    const rules = new Rules();
    const ballState = {
      pos: new Vec3(0, TABLE_HEIGHT + 0.3, halfL * 0.35),
      vel: new Vec3(),
      omega: new Vec3(),
    };
    const playerState = { pos: new Vec3(0, TABLE_HEIGHT + 0.13, halfL * 0.3) };
    const aiState = { pos: new Vec3(0, TABLE_HEIGHT + 0.13, -halfL * 0.4) };

    const pointer = { active: false, x: 0, y: 0 };
    const swipe = { pos: playerState.pos.clone(), t: performance.now() };

    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TABLE_HEIGHT + 0.12));

    function syncHUD() {
      setScore({ ...rules.score });
      setServer(rules.service.server);
      setStage(rules.stage);
    }

    function pointerToPlane(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const target = new THREE.Vector3();
      const hit = raycaster.ray.intersectPlane(plane, target);
      if (!hit) return new Vec3(0, TABLE_HEIGHT + 0.12, halfL * 0.3);
      return new Vec3(hit.x, hit.y, hit.z);
    }

    function applyAirDrag(v, dt) {
      v.scale(1 / (1 + AIR_DRAG_K * dt));
    }
    function applyMagnus(v, omega, dt) {
      const c = omega.clone().cross(v);
      v.addScaled(c, MAGNUS_K * dt);
    }
    function reflectTable(state) {
      state.vel.y *= -TABLE_RESTITUTION;
      state.vel.x *= TABLE_TANGENTIAL_DAMP;
      state.vel.z *= TABLE_TANGENTIAL_DAMP;
      state.omega.scale(0.85);
    }
    function collideWithNet(state) {
      state.vel.z *= -0.35;
      state.vel.scale(0.94);
      state.omega.scale(0.9);
    }
    function boundsOut(p) {
      const outX = Math.abs(p.x) > halfW + 0.06;
      const outZ = Math.abs(p.z) > halfL + 0.06;
      const floor = p.y < WORLD_Y_FLOOR;
      return outX || outZ || floor;
    }

    const lastSideZ = (z) => (z > 0 ? "Player" : "AI");

    function onBounceAt(pos) {
      const side = lastSideZ(pos.z);
      const mustServe = rules.service.server;
      if (rules.stage === "ServeFlying") {
        if (rules.rally.lastSideBounce === null) {
          if (side !== mustServe) {
            rules.awardPoint(mustServe === "Player" ? "AI" : "Player");
            syncHUD();
            return;
          }
        } else {
          const mustOpp = mustServe === "Player" ? "AI" : "Player";
          if (side !== mustOpp) {
            rules.awardPoint(mustServe === "Player" ? "AI" : "Player");
            syncHUD();
            return;
          }
          if (rules.contact.touchedNetThisFlight) rules.letServe = true;
        }
      }
      if (rules.rally.lastSideBounce === side) rules.rally.consecutiveBouncesOnSameSide += 1;
      else rules.rally.consecutiveBouncesOnSameSide = 1;
      rules.rally.lastSideBounce = side;
      if (rules.stage === "Rally" && rules.rally.consecutiveBouncesOnSameSide >= 2) {
        rules.awardPoint(side === "Player" ? "AI" : "Player");
        syncHUD();
      }
    }

    function resetForServe(serverSide) {
      rules.stage = "ServeFlying";
      rules.resetRally();
      const z = serverSide === "Player" ? halfL * 0.35 : -halfL * 0.35;
      ballState.pos.set(0, TABLE_HEIGHT + 0.32, z);
      ballState.vel.set((Math.random() - 0.5) * 0.8, 2.2, serverSide === "Player" ? -2.9 : 2.9);
      ballState.omega.set(0, 0, 0);
      setServer(serverSide);
      setStage(rules.stage);
    }

    function hardReset() {
      rules.score = { player: 0, ai: 0 };
      rules.service = { server: "Player", servesSinceSwap: 0 };
      resetForServe("Player");
      syncHUD();
    }

    function performPaddleHits() {
      const entries = [
        { grp: playerState, side: "Player" },
        { grp: aiState, side: "AI" },
      ];
      const now = performance.now();
      for (const { grp, side } of entries) {
        const d = ballState.pos.clone().sub(grp.pos);
        if (d.len() >= PADDLE_RADIUS + BALL_RADIUS) continue;
        let swipeV = new Vec3();
        if (side === "Player") {
          const dtMs = Math.max(1, now - (swipe.t || now));
          swipeV = grp.pos.clone().sub(swipe.pos).scale(1000 / dtMs);
          swipe.pos.copy(grp.pos);
          swipe.t = now;
        } else {
          const deltaX = clamp(ballState.pos.x - grp.pos.x, -1, 1);
          swipeV.set(deltaX, 0, 0);
        }
        const dir = d.norm();
        const basePower = side === "Player" ? 1.8 : 2.2 * DIFFICULTY[difficulty].power;
        const impulse = dir.scale(basePower).addScaled(swipeV, side === "Player" ? 0.02 : 0.01);
        ballState.vel.add(impulse);
        const top = clamp(swipeV.z, -6, 6) * (side === "Player" ? 8 : 10) * (side === "AI" ? DIFFICULTY[difficulty].spin : 1);
        const sideSpin = clamp(-swipeV.x, -6, 6) * 6 * (side === "AI" ? DIFFICULTY[difficulty].spin : 1);
        ballState.omega.add(new Vec3(0, sideSpin, top));
        rules.rally.lastHitter = side;
      }
    }

    function physicsStep(dt) {
      if (rules.stage === "Warmup") {
        resetForServe(rules.service.server);
        return;
      }
      ballState.vel.y += GRAVITY * dt;
      applyAirDrag(ballState.vel, dt);
      applyMagnus(ballState.vel, ballState.omega, dt);

      const nextPos = ballState.pos.clone().addScaled(ballState.vel, dt);
      const onTop =
        nextPos.y - BALL_RADIUS <= TABLE_HEIGHT &&
        Math.abs(nextPos.x) <= halfW &&
        Math.abs(nextPos.z) <= halfL &&
        ballState.vel.y < 0;
      if (onTop) {
        nextPos.y = TABLE_HEIGHT + BALL_RADIUS;
        reflectTable(ballState);
        onBounceAt(nextPos);
        if (rules.stage === "ServeFlying" && rules.rally.lastSideBounce !== null) {
          if (!rules.letServe) rules.stage = "Rally";
          setStage(rules.stage);
        }
      }
      const nearZ = Math.abs(nextPos.z) <= NET_THICKNESS * 0.5 + BALL_RADIUS * 0.6;
      const low = nextPos.y <= TABLE_HEIGHT + NET_HEIGHT + BALL_RADIUS * 0.3;
      if (nearZ && low) {
        collideWithNet(ballState);
        rules.contact.touchedNetThisFlight = true;
      }

      performPaddleHits();

      if (boundsOut(nextPos)) {
        const winner = ballState.pos.z > 0 ? "AI" : "Player";
        rules.awardPoint(winner);
        syncHUD();
        if (rules.stage !== "GameOver") resetForServe(rules.service.server);
        return;
      }

      ballState.pos.copy(nextPos);
    }

    function aiStep(dt) {
      const preset = DIFFICULTY[difficulty];
      const s = Math.min(1, dt * preset.react);
      const targetX = clamp(ballState.pos.x, -halfW + PADDLE_RADIUS, halfW - PADDLE_RADIUS);
      const targetZ = -halfL * 0.4;
      aiState.pos.x += (targetX - aiState.pos.x) * s;
      aiState.pos.z += (targetZ - aiState.pos.z) * s;
      const d = ballState.pos.clone().sub(aiState.pos).len();
      if (d < PADDLE_RADIUS + BALL_RADIUS + 0.02) {
        const plan = planAIReturn(ballState, difficulty);
        ballState.vel.add(plan.impulse);
        rules.rally.lastHitter = "AI";
      }
    }

    function updateMeshes() {
      playerMesh.position.set(playerState.pos.x, playerState.pos.y, playerState.pos.z);
      aiMesh.position.set(aiState.pos.x, aiState.pos.y, aiState.pos.z);
      ball.position.set(ballState.pos.x, ballState.pos.y, ballState.pos.z);
      ballShadow.position.set(ballState.pos.x, TABLE_HEIGHT + 0.01, ballState.pos.z);
      const dropHeight = clamp(1 - (ballState.pos.y - TABLE_HEIGHT) * 2.5, 0, 0.8);
      ballShadow.material.opacity = 0.1 + dropHeight * 0.7;
    }

    function onPointerDown(e) {
      pointer.active = true;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    }
    function onPointerMove(e) {
      if (!pointer.active && e.type === "mousemove") return;
      pointer.x = e.touches ? e.touches[0].clientX : e.clientX;
      pointer.y = e.touches ? e.touches[0].clientY : e.clientY;
      const hit = pointerToPlane(pointer.x, pointer.y);
      const x = clamp(hit.x, -halfW + PADDLE_RADIUS, halfW - PADDLE_RADIUS);
      const z = clamp(hit.z, 0.06, halfL - 0.06);
      playerState.pos.set(x, TABLE_HEIGHT + 0.13, z);
    }
    function onPointerUp() {
      pointer.active = false;
    }

    renderer.domElement.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    renderer.domElement.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerUp);

    let raf = 0;
    function frame() {
      const now = performance.now();
      const dt = Math.min((now - lastFrameRef.current) / 1000, MAX_ACCUM_DT);
      lastFrameRef.current = now;
      accRef.current = Math.min(accRef.current + dt, MAX_ACCUM_DT);
      setFps((p) => (p ? p * 0.8 + (1 / dt) * 0.2 : 1 / dt));

      while (accRef.current >= FIXED_DT) {
        physicsStep(FIXED_DT);
        aiStep(FIXED_DT);
        accRef.current -= FIXED_DT;
      }

      updateMeshes();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    frame();

    function onResize() {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", onResize);

    hardReset();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      renderer.domElement.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [difficulty]);

  return (
    <div className="relative h-[100dvh] w-full bg-[#0b1220]">
      <div ref={mountRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="flex justify-between gap-3 p-3 text-white" style={{ fontFamily: "'Luckiest Guy','Comic Sans MS',cursive" }}>
          <div className="pointer-events-auto rounded-xl bg-[rgba(10,16,34,0.7)] px-4 py-3 text-sm shadow-lg ring-1 ring-[#1f2944]">
            <div>Server: {server === "Player" ? player?.name || "You" : ai?.name || "AI"}</div>
            <div>Score: {score.player} – {score.ai}</div>
            <div>Stage: {stage}</div>
            <div>FPS: {fps.toFixed(0)}</div>
          </div>
        </div>
        <div className="mt-auto p-3 text-center text-xs text-white opacity-75">Drag to move paddle · Swipe forward to serve/return</div>
      </div>
    </div>
  );
}

export default TableTennis3D;
