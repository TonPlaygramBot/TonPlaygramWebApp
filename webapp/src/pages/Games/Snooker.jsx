import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { PowerSlider } from '../../../../power-slider.js';
import '../../../../power-slider.css';
import {
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';

/**
 * NEW SNOOKER GAME — fresh build (keep ONLY Guret for balls)
 * Per kërkesën tënde:
 *  • Kamera rotullohet si një person te tavolina (orbit e butë), me kënd pak të ulët, pa rënë në nivelin e cloth.
 *  • 6 gropa të prera realisht në cloth (Shape.holes + Extrude) + kapje (capture radius) → guret bien brenda.
 *  • Power slider i RI: i madh, djathtas ekranit, me gjest **PULL** (tërhiq POSHTË sa fort do → fuqi), dhe **gjuan në release**.
 *  • Playable: aiming line + tick, përplasje, kapje në xhepa, logjikë bazë snooker (reds→colour, pastaj colours in order, fouls, in‑hand).
 */

// --------------------------------------------------
// Config
// --------------------------------------------------
const TABLE = { W: 66, H: 132, THICK: 1.8, WALL: 2.6 };
const BALL_R = 2;
const FRICTION = 0.9925;
const STOP_EPS = 0.02;
const CAPTURE_R = 3.1; // pocket capture radius aligned with Pool Royale

const COLORS = Object.freeze({
  cloth: 0x0b5d39,
  rail: 0x10301f,
  cue: 0xffffff,
  red: 0xb00000,
  yellow: 0xfacc15,
  green: 0x22c55e,
  brown: 0x8b5e3c,
  blue: 0x3b82f6,
  pink: 0xec4899,
  black: 0x111827,
  mark: 0xffffff
});

// Kamera: lejojmë ulje më të madhe (phi më i vogël), por mos shko kurrë krejt në nivel (limit ~0.5rad)
const CAMERA = {
  fov: 44,
  near: 0.1,
  far: 4000,
  minR: 105,
  maxR: 420,
  minPhi: 0.5,
  phiMargin: 0.4
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// --------------------------------------------------
// Utilities
// --------------------------------------------------
const pocketCenters = () => [
  new THREE.Vector2(-TABLE.W / 2, -TABLE.H / 2),
  new THREE.Vector2(0, -TABLE.H / 2),
  new THREE.Vector2(TABLE.W / 2, -TABLE.H / 2),
  new THREE.Vector2(-TABLE.W / 2, TABLE.H / 2),
  new THREE.Vector2(0, TABLE.H / 2),
  new THREE.Vector2(TABLE.W / 2, TABLE.H / 2)
];
const allStopped = (balls) => balls.every((b) => b.vel.length() < STOP_EPS);
function reflectRails(ball) {
  const limX = TABLE.W / 2 - BALL_R - TABLE.WALL;
  const limY = TABLE.H / 2 - BALL_R - TABLE.WALL;
  if (ball.pos.x < -limX && ball.vel.x < 0) {
    ball.pos.x = -limX;
    ball.vel.x *= -1;
  }
  if (ball.pos.x > limX && ball.vel.x > 0) {
    ball.pos.x = limX;
    ball.vel.x *= -1;
  }
  if (ball.pos.y < -limY && ball.vel.y < 0) {
    ball.pos.y = -limY;
    ball.vel.y *= -1;
  }
  if (ball.pos.y > limY && ball.vel.y > 0) {
    ball.pos.y = limY;
    ball.vel.y *= -1;
  }
}

// --------------------------------------------------
// ONLY kept component: Guret (balls factory)
// --------------------------------------------------
function Guret(scene, id, color, x, y) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 28, 28),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05 })
  );
  mesh.position.set(x, BALL_R, y);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return {
    id,
    color,
    mesh,
    pos: new THREE.Vector2(x, y),
    vel: new THREE.Vector2(),
    active: true
  };
}

// --------------------------------------------------
// Table with CUT pockets + markings (fresh)
// --------------------------------------------------
function Table3D(scene) {
  const halfW = TABLE.W / 2,
    halfH = TABLE.H / 2;
  const POCKET_R_VIS = 3.4;
  // Cloth me 6 vrima rrethore (holes)
  const shape = new THREE.Shape();
  shape.moveTo(-halfW, -halfH);
  shape.lineTo(halfW, -halfH);
  shape.lineTo(halfW, halfH);
  shape.lineTo(-halfW, halfH);
  shape.lineTo(-halfW, -halfH);
  pocketCenters().forEach((p) => {
    const h = new THREE.Path();
    h.absellipse(
      p.x,
      p.y,
      POCKET_R_VIS * 0.85,
      POCKET_R_VIS * 0.85,
      0,
      Math.PI * 2,
      false,
      0
    );
    shape.holes.push(h);
  });
  const extrude = new THREE.ExtrudeGeometry(shape, {
    depth: TABLE.THICK,
    bevelEnabled: false
  });
  const cloth = new THREE.Mesh(
    extrude,
    new THREE.MeshStandardMaterial({ color: COLORS.cloth, roughness: 0.95 })
  );
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.y = -TABLE.THICK;
  cloth.receiveShadow = true;
  scene.add(cloth);
  // Rails
  const railMat = new THREE.MeshStandardMaterial({
    color: COLORS.rail,
    metalness: 0.12,
    roughness: 0.7
  });
  const railTop = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE.W + 8, 4, 4),
    railMat
  );
  railTop.position.set(0, 0, halfH + 2);
  const railBot = railTop.clone();
  railBot.position.z = -halfH - 2;
  const railL = new THREE.Mesh(
    new THREE.BoxGeometry(4, 4, TABLE.H + 8),
    railMat
  );
  railL.position.set(-halfW - 2, 0, 0);
  const railR = railL.clone();
  railR.position.x = halfW + 2;
  scene.add(railTop, railBot, railL, railR);
  // Pocket rings (vizuale sipërfaqe)
  const ringGeo = new THREE.RingGeometry(POCKET_R_VIS * 0.6, POCKET_R_VIS, 48);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    metalness: 0.05,
    roughness: 0.4
  });
  pocketCenters().forEach((p) => {
    const m = new THREE.Mesh(ringGeo, ringMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, -0.99, p.y);
    scene.add(m);
  });
  // Markings: baulk, D, spots
  const BAULK_RATIO_FROM_LEFT = 0.2014;
  const D_R = (11.5 / 72) * TABLE.H;
  const baulkX = -halfW + BAULK_RATIO_FROM_LEFT * TABLE.W;
  const markMat = new THREE.LineBasicMaterial({
    color: COLORS.mark,
    transparent: true,
    opacity: 0.65
  });
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(baulkX, -0.98, -halfH),
    new THREE.Vector3(baulkX, -0.98, halfH)
  ]);
  scene.add(new THREE.Line(lineGeo, markMat));
  const dPts = [];
  for (let i = 0; i <= 64; i++) {
    const t = Math.PI * (i / 64);
    dPts.push(
      new THREE.Vector3(baulkX + Math.cos(t) * D_R, -0.98, Math.sin(t) * D_R)
    );
  }
  scene.add(
    new THREE.Line(new THREE.BufferGeometry().setFromPoints(dPts), markMat)
  );
  const spot = (x, z) => {
    const r = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1.0, 24),
      new THREE.MeshBasicMaterial({ color: COLORS.mark })
    );
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, -0.99, z);
    scene.add(r);
  };
  spot(baulkX, 0);
  spot(baulkX, TABLE.H * 0.22);
  spot(baulkX, -TABLE.H * 0.22);
  spot(0, 0);
  spot(TABLE.W * 0.25, 0);
  spot(halfW - TABLE.W * 0.09, 0);
  return { centers: pocketCenters(), baulkX };
}

// --------------------------------------------------
// NEW Engine (no globals). Camera feels like standing at the side.
// --------------------------------------------------
export default function NewSnookerGame() {
  const mountRef = useRef(null);
  const rafRef = useRef(null);
  const [hud, setHud] = useState({
    power: 0.65,
    A: 0,
    B: 0,
    turn: 0,
    phase: 'reds',
    next: 'red',
    inHand: false,
    over: false
  });
  const powerRef = useRef(hud.power);
  useEffect(() => {
    powerRef.current = hud.power;
  }, [hud.power]);
  const [err, setErr] = useState(null);
  const fireRef = useRef(() => {}); // set from effect so slider can trigger fire()
  const cameraRef = useRef(null);
  const sphRef = useRef(null);
  const fitRef = useRef(() => {});
  const topViewRef = useRef(false);
  const [topView, setTopView] = useState(false);
  const aimDirRef = useRef(new THREE.Vector2(0, 1));
  const [timer, setTimer] = useState(60);
  const timerRef = useRef(null);
  const [player, setPlayer] = useState({ name: '', avatar: '' });
  useEffect(() => {
    setPlayer({
      name: getTelegramUsername() || 'Player',
      avatar: getTelegramPhotoUrl()
    });
  }, []);
  const aiFlag = useMemo(
    () => FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)],
    []
  );
  const aiShoot = useRef(() => {
    aimDirRef.current.set(Math.random() - 0.5, Math.random() - 0.5).normalize();
    powerRef.current = 0.5;
    setHud((s) => ({ ...s, power: 0.5 }));
    fireRef.current?.();
  });

  const toggleView = () => {
    setTopView((v) => {
      const next = !v;
      topViewRef.current = next;
      const cam = cameraRef.current;
      const sph = sphRef.current;
      if (cam && sph) {
        if (next) {
          cam.position.set(0, sph.radius, 0);
          cam.lookAt(0, 0, 0);
        } else {
          fitRef.current?.();
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (hud.over) return;
    const playerTurn = hud.turn;
    const duration = playerTurn === 0 ? 60 : 5;
    setTimer(duration);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (playerTurn === 0) {
            setHud((s) => ({ ...s, turn: 1 - s.turn }));
          } else {
            aiShoot.current();
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [hud.turn, hud.over]);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    try {
      screen.orientation?.lock?.('portrait').catch(() => {});
      // Renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(host.clientWidth, host.clientHeight, false);
      host.appendChild(renderer.domElement);

      // Scene & Camera
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050505);
      const camera = new THREE.PerspectiveCamera(
        CAMERA.fov,
        host.clientWidth / host.clientHeight,
        CAMERA.near,
        CAMERA.far
      );
      // Start behind baulk colours
      const sph = new THREE.Spherical(180, 1.05 /*phi ~60°*/, Math.PI);
      const fit = (m = 1.1) => {
        camera.aspect = host.clientWidth / host.clientHeight;
        const a = camera.aspect,
          f = THREE.MathUtils.degToRad(camera.fov);
        const halfW = (TABLE.W / 2) * m,
          halfH = (TABLE.H / 2) * m;
        const dzH = halfH / Math.tan(f / 2);
        const dzW = halfW / (Math.tan(f / 2) * a);
        sph.radius = clamp(Math.max(dzH, dzW), CAMERA.minR, CAMERA.maxR);
        const phiCap = Math.acos(
          THREE.MathUtils.clamp(-0.95 / sph.radius, -1, 1)
        );
        sph.phi = clamp(
          sph.phi,
          CAMERA.minPhi,
          Math.min(phiCap, Math.PI - CAMERA.phiMargin)
        );
        const target = new THREE.Vector3(0, 0, 0);
        camera.position.setFromSpherical(sph).add(target);
        camera.lookAt(target);
        camera.updateProjectionMatrix();
      };
      cameraRef.current = camera;
      sphRef.current = sph;
      fitRef.current = fit;
      fit(window.innerHeight > window.innerWidth ? 1.4 : 1.1);
      const dom = renderer.domElement;
      dom.style.touchAction = 'none';
      const drag = { on: false, x: 0, y: 0 };
      const pinch = { active: false, dist: 0 };
      const down = (e) => {
        if (topViewRef.current) return;
        if (e.touches?.length === 2) {
          const [t1, t2] = e.touches;
          pinch.active = true;
          pinch.dist = Math.hypot(
            t1.clientX - t2.clientX,
            t1.clientY - t2.clientY
          );
          return;
        }
        drag.on = true;
        drag.x = e.clientX || e.touches?.[0]?.clientX || 0;
        drag.y = e.clientY || e.touches?.[0]?.clientY || 0;
      };
      const move = (e) => {
        if (topViewRef.current) return;
        if (pinch.active && e.touches?.length === 2) {
          const [t1, t2] = e.touches;
          const d = Math.hypot(
            t1.clientX - t2.clientX,
            t1.clientY - t2.clientY
          );
          const delta = pinch.dist - d;
          sph.radius = clamp(
            sph.radius + delta * 0.5,
            CAMERA.minR,
            CAMERA.maxR
          );
          pinch.dist = d;
          fit();
          return;
        }
        if (!drag.on) return;
        const x = e.clientX || e.touches?.[0]?.clientX || drag.x;
        const y = e.clientY || e.touches?.[0]?.clientY || drag.y;
        const dx = x - drag.x,
          dy = y - drag.y;
        drag.x = x;
        drag.y = y;
        sph.theta -= dx * 0.005;
        sph.phi = clamp(
          sph.phi + dy * 0.0038,
          CAMERA.minPhi,
          Math.PI - CAMERA.phiMargin
        );
        fit();
      };
      const up = () => {
        drag.on = false;
        pinch.active = false;
      };
      const wheel = (e) => {
        if (topViewRef.current) return;
        sph.radius = clamp(
          sph.radius + e.deltaY * 0.12,
          CAMERA.minR,
          CAMERA.maxR
        );
        fit();
      };
      dom.addEventListener('mousedown', down);
      dom.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      dom.addEventListener('touchstart', down, { passive: true });
      dom.addEventListener('touchmove', move, { passive: true });
      window.addEventListener('touchend', up);
      dom.addEventListener('wheel', wheel, { passive: true });

      // Lights
      scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 0.95));
      const key = new THREE.DirectionalLight(0xffffff, 1.05);
      key.position.set(-60, 90, 40);
      key.castShadow = true;
      scene.add(key);

      // Table
      const { centers, baulkX } = Table3D(scene);

      // Balls (ONLY Guret)
      const balls = [];
      const add = (id, color, x, y) => {
        const b = Guret(scene, id, color, x, y);
        balls.push(b);
        return b;
      };
      let cue = add('cue', COLORS.cue, -TABLE.W * 0.32, 0);
      // reds triangle
      let rid = 0;
      const bx = TABLE.W * 0.1,
        by = 0;
      for (let r = 0; r < 5; r++)
        for (let c = 0; c <= r; c++) {
          const x = bx + r * (BALL_R * 2 + 0.6);
          const y = by - r * BALL_R + c * (BALL_R * 2 + 0.2);
          add(`red_${rid++}`, COLORS.red, x, y);
        }
      // colours
      const SPOTS = {
        yellow: [-TABLE.W * 0.38, TABLE.H * 0.22],
        green: [-TABLE.W * 0.38, -TABLE.H * 0.22],
        brown: [-TABLE.W * 0.3, 0],
        blue: [0, 0],
        pink: [TABLE.W * 0.25, 0],
        black: [TABLE.W / 2 - TABLE.W * 0.09, 0]
      };
      const colors = Object.fromEntries(
        Object.entries(SPOTS).map(([k, [x, y]]) => [k, add(k, COLORS[k], x, y)])
      );

      // Aiming visuals
      const aimMat = new THREE.LineDashedMaterial({
        color: 0xffffff,
        dashSize: 2,
        gapSize: 1,
        transparent: true,
        opacity: 0.9
      });
      const aimGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const aim = new THREE.Line(aimGeom, aimMat);
      aim.visible = false;
      aim.computeLineDistances();
      scene.add(aim);
      const tickGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const tick = new THREE.Line(
        tickGeom,
        new THREE.LineBasicMaterial({ color: 0xffffff })
      );
      tick.visible = false;
      scene.add(tick);

      // Pointer → XZ plane
      const pointer = new THREE.Vector2();
      const ray = new THREE.Raycaster();
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const project = (ev) => {
        const r = dom.getBoundingClientRect();
        const cx =
          (((ev.clientX ?? ev.touches?.[0]?.clientX ?? 0) - r.left) / r.width) *
            2 -
          1;
        const cy = -(
          (((ev.clientY ?? ev.touches?.[0]?.clientY ?? 0) - r.top) / r.height) *
            2 -
          1
        );
        pointer.set(cx, cy);
        ray.setFromCamera(pointer, camera);
        const pt = new THREE.Vector3();
        ray.ray.intersectPlane(plane, pt);
        return new THREE.Vector2(pt.x, pt.z);
      };

      // Aim direction
      const aimDir = aimDirRef.current;
      const onAimMove = (e) => {
        if (hud.inHand || hud.over) return;
        if (!allStopped(balls)) return;
        const hit = project(e);
        const dir = cue.pos.clone().sub(hit);
        if (dir.length() > 1e-3) {
          aimDir.set(dir.x, dir.y).normalize();
        }
      };
      dom.addEventListener('pointermove', onAimMove, { passive: true });

      // In-hand placement
      const free = (x, z) =>
        balls.every(
          (b) =>
            !b.active ||
            b === cue ||
            new THREE.Vector2(x, z).distanceTo(b.pos) > BALL_R * 2.1
        );
      const onPlace = (e) => {
        if (!hud.inHand) return;
        const p = project(e);
        if (
          p.x <= baulkX &&
          Math.abs(p.y) <= TABLE.H / 2 - BALL_R * 2 &&
          free(p.x, p.y)
        ) {
          cue.active = true;
          cue.mesh.visible = true;
          cue.pos.set(p.x, p.y);
          cue.mesh.position.set(p.x, BALL_R, p.y);
          setHud((s) => ({ ...s, inHand: false }));
        }
      };
      dom.addEventListener('pointerdown', onPlace);

      // Shot lifecycle
      let shooting = false;
      let potted = [];
      let foul = false;
      let firstHit = null;
      const legalTarget = () =>
        hud.phase === 'reds'
          ? hud.next === 'red'
            ? 'red'
            : 'colour'
          : hud.next;
      const isRedId = (id) => id.startsWith('red');
      const val = (id) =>
        isRedId(id)
          ? 1
          : { yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7 }[id] ||
            0;

      // Fire (slider e thërret në release)
      const fire = () => {
        if (!cue?.active || hud.inHand || !allStopped(balls) || hud.over)
          return;
        shooting = true;
        potted = [];
        foul = false;
        firstHit = null;
        clearInterval(timerRef.current);
        const base = aimDir
          .clone()
          .multiplyScalar(4.2 * (0.48 + powerRef.current * 1.52));
        cue.vel.copy(base);
      };
      fireRef.current = fire;

      // Resolve shot
      function resolve() {
        const me = hud.turn === 0 ? 'A' : 'B',
          op = hud.turn === 0 ? 'B' : 'A';
        let gain = 0;
        let swap = true;
        if (!cue.active) foul = true;
        const target = legalTarget();
        if (firstHit) {
          if (target === 'red' && !isRedId(firstHit)) foul = true;
          else if (target === 'colour' && isRedId(firstHit)) foul = true;
          else if (
            target !== 'red' &&
            target !== 'colour' &&
            firstHit !== target
          )
            foul = true;
        } else {
          foul = true;
        }
        const reds = potted.filter(isRedId),
          cols = potted.filter((id) => !isRedId(id));
        if (hud.phase === 'reds') {
          if (hud.next === 'red') {
            if (cols.length > 0) foul = true;
            gain += reds.length;
            if (reds.length > 0 && !foul) {
              setHud((s) => ({ ...s, next: 'colour' }));
              swap = false;
            }
          } else {
            if (reds.length > 0) foul = true;
            if (cols.length > 0 && !foul) {
              cols.forEach((id) => {
                gain += val(id);
                const b = colors[id];
                if (b) {
                  const [sx, sy] = SPOTS[id];
                  b.active = true;
                  b.mesh.visible = true;
                  b.pos.set(sx, sy);
                  b.mesh.position.set(sx, BALL_R, sy);
                }
              });
              setHud((s) => ({ ...s, next: 'red' }));
              swap = false;
            }
          }
          const redsLeft = balls.some((b) => b.active && isRedId(b.id));
          if (!redsLeft)
            setHud((s) => ({ ...s, phase: 'colors', next: 'yellow' }));
        } else {
          if (
            cols.length === 1 &&
            reds.length === 0 &&
            cols[0] === hud.next &&
            !foul
          ) {
            gain += val(hud.next);
            const order = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
            const idx = order.indexOf(hud.next);
            const nxt = order[idx + 1];
            if (nxt) {
              setHud((s) => ({ ...s, next: nxt }));
              swap = false;
            } else {
              setHud((s) => ({ ...s, over: true }));
            }
          } else if (cols.length > 0 || reds.length > 0) {
            foul = true;
          }
        }
        if (foul) {
          const foulPts = Math.max(
            4,
            ...potted.map((id) => val(id)),
            cue.active ? 0 : 4
          );
          setHud((s) => ({
            ...s,
            [op]: s[op] + foulPts,
            inHand: true,
            next: s.phase === 'reds' ? 'red' : s.next
          }));
          cue.active = false;
          cue.mesh.visible = false;
          cue.vel.set(0, 0);
        } else if (gain > 0) {
          setHud((s) => ({ ...s, [me]: s[me] + gain }));
        }
        if (swap || foul) setHud((s) => ({ ...s, turn: 1 - s.turn }));
        shooting = false;
        potted = [];
        foul = false;
        firstHit = null;
      }

      // Loop
      const step = () => {
        // Aiming vizual
        if (allStopped(balls) && !hud.inHand && cue?.active && !hud.over) {
          const start = new THREE.Vector3(cue.pos.x, BALL_R, cue.pos.y);
          const end2 = cue.pos
            .clone()
            .add(aimDir.clone().multiplyScalar(26 + 80 * powerRef.current));
          const end = new THREE.Vector3(end2.x, BALL_R, end2.y);
          aimGeom.setFromPoints([start, end]);
          aim.visible = true;
          aim.computeLineDistances();
          const dir = new THREE.Vector3(
            end.x - start.x,
            0,
            end.z - start.z
          ).normalize();
          const perp = new THREE.Vector3(-dir.z, 0, dir.x);
          tickGeom.setFromPoints([
            end.clone().add(perp.clone().multiplyScalar(1.4)),
            end.clone().add(perp.clone().multiplyScalar(-1.4))
          ]);
          tick.visible = true;
        } else {
          aim.visible = false;
          tick.visible = false;
        }

        // Fizika
        balls.forEach((b) => {
          if (!b.active) return;
          b.pos.add(b.vel);
          b.vel.multiplyScalar(FRICTION);
          if (b.vel.length() < STOP_EPS) b.vel.set(0, 0);
          reflectRails(b);
          b.mesh.position.set(b.pos.x, BALL_R, b.pos.y);
        });
        // Kolizione + regjistro firstHit
        for (let i = 0; i < balls.length; i++)
          for (let j = i + 1; j < balls.length; j++) {
            const a = balls[i],
              b = balls[j];
            if (!a.active || !b.active) continue;
            const dx = b.pos.x - a.pos.x,
              dy = b.pos.y - a.pos.y;
            const d2 = dx * dx + dy * dy;
            const min = (BALL_R * 2) ** 2;
            if (d2 > 0 && d2 < min) {
              const d = Math.sqrt(d2) || 1e-4;
              const nx = dx / d,
                ny = dy / d;
              const overlap = (BALL_R * 2 - d) / 2;
              a.pos.x -= nx * overlap;
              a.pos.y -= ny * overlap;
              b.pos.x += nx * overlap;
              b.pos.y += ny * overlap;
              const avn = a.vel.x * nx + a.vel.y * ny;
              const bvn = b.vel.x * nx + b.vel.y * ny;
              const at = a.vel
                .clone()
                .sub(new THREE.Vector2(nx, ny).multiplyScalar(avn));
              const bt = b.vel
                .clone()
                .sub(new THREE.Vector2(nx, ny).multiplyScalar(bvn));
              a.vel.copy(at.add(new THREE.Vector2(nx, ny).multiplyScalar(bvn)));
              b.vel.copy(bt.add(new THREE.Vector2(nx, ny).multiplyScalar(avn)));
              if (!firstHit) {
                if (a.id === 'cue' && b.id !== 'cue') firstHit = b.id;
                else if (b.id === 'cue' && a.id !== 'cue') firstHit = a.id;
              }
            }
          }
        // Kapje në xhepa
        balls.forEach((b) => {
          if (!b.active) return;
          for (const c of centers) {
            if (b.pos.distanceTo(c) < CAPTURE_R) {
              b.active = false;
              b.mesh.visible = false;
              b.vel.set(0, 0);
              if (b !== cue) potted.push(b.id.startsWith('red') ? 'red' : b.id);
              break;
            }
          }
        });
        // Fund i goditjes
        if (shooting) {
          const any = balls.some((b) => b.active && b.vel.length() >= STOP_EPS);
          if (!any) resolve();
        }

        renderer.render(scene, camera);
        rafRef.current = requestAnimationFrame(step);
      };
      step();

      // Resize
      const onResize = () => {
        renderer.setSize(host.clientWidth, host.clientHeight, false);
        fit();
      };
      window.addEventListener('resize', onResize);

      return () => {
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener('resize', onResize);
        try {
          host.removeChild(renderer.domElement);
        } catch {}
        dom.removeEventListener('mousedown', down);
        dom.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        dom.removeEventListener('touchstart', down);
        dom.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', up);
        dom.removeEventListener('wheel', wheel);
        dom.removeEventListener('pointermove', onAimMove);
        dom.removeEventListener('pointerdown', onPlace);
      };
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
    }
  }, [hud.inHand, hud.over]);

  // --------------------------------------------------
  // NEW Big Pull Slider (right side): drag DOWN to set power, releases → fire()
  // --------------------------------------------------
  const sliderRef = useRef(null);
  useEffect(() => {
    const mount = sliderRef.current;
    if (!mount) return;
    const slider = new PowerSlider({
      mount,
      value: powerRef.current * 100,
      cueSrc: '/assets/cue.png',
      onChange: (v) => setHud((s) => ({ ...s, power: v / 100 })),
      onCommit: () => fireRef.current?.()
    });
    return () => {
      mount.innerHTML = '';
      slider.el?.remove?.();
    };
  }, []);

  return (
    <div className="w-full h-[100vh] bg-black text-white overflow-hidden select-none">
      <div ref={mountRef} className="absolute inset-0" />

      {err && (
        <div className="absolute inset-0 bg-black/80 text-white text-xs flex items-center justify-center p-4 z-50">
          Init error: {String(err)}
        </div>
      )}
      <div className="absolute inset-x-0 top-2 flex items-center justify-between px-4 text-xs">
        <div className="flex items-center gap-2">
          <div
            className={`w-9 h-9 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden ${hud.turn === 0 ? 'ring-2 ring-yellow-400' : ''}`}
            style={
              player.avatar
                ? {
                    backgroundImage: `url(${player.avatar})`,
                    backgroundSize: 'cover'
                  }
                : undefined
            }
          >
            {!player.avatar && player.name?.[0]}
          </div>
          <div className="text-left">
            <div className="font-bold leading-none">{player.name}</div>
            <div className="leading-none">{hud.A}</div>
          </div>
        </div>
        <div className="relative flex items-center justify-center">
          <div
            id="spinBox"
            className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center"
          >
            <div id="spinDot" className="w-2 h-2 rounded-full bg-white"></div>
          </div>
          <div
            id="turnTimerText"
            className="absolute top-1 left-0 right-0 text-center text-sm font-bold"
          >
            {timer}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="font-bold leading-none">AI</div>
            <div className="leading-none">{hud.B}</div>
          </div>
          <div
            className={`w-9 h-9 rounded-full bg-gray-600 flex items-center justify-center ${hud.turn === 1 ? 'ring-2 ring-yellow-400' : ''}`}
          >
            {aiFlag}
          </div>
        </div>
      </div>

      {/* Power Slider */}
      <div
        ref={sliderRef}
        className="absolute right-[25%] top-1/2 -translate-y-1/2"
      />

      {/* View toggle */}
      <button
        onClick={toggleView}
        className="absolute bottom-3 right-3 w-12 h-12 rounded-full bg-white text-black text-sm font-bold flex items-center justify-center z-50"
      >
        {topView ? '3D' : '2D'}
      </button>

      {/* Help */}
      <div className="absolute left-3 bottom-2 text-[11px] text-white/70 pr-4 max-w-[80%]">
        Rrotullo ekranin si njeri pranë tavolinës (drag). Tërhiq slider‑in e
        madh në të djathtë POSHTË për fuqi dhe lësho për të gjuajtur. 6 gropat
        janë të prera dhe guret bien brenda.
      </div>
    </div>
  );
}
