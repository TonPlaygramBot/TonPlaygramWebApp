import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { PowerSlider } from "../../snooker/PowerSlider.js";
import "../../snooker/power-slider.css";
import "../../snooker/ui.css";

/**
 * Snooker 3D – Pro Table Look + Proper Pockets + Spin UI
 * ------------------------------------------------------
 * What’s new (per request):
 *  - Pockets shaped like a "0":
 *      • Corners = elliptical rings rotated 45° (diagonal)
 *      • Middles = elliptical rings aligned horizontally
 *  - Cushions cut at angles to form pocket jaws/guides
 *  - Luxury table look (darker rails, light-wood legs)
 *  - Aiming line + target tick
 *  - Thin power bar: click/drag to set, release to shoot
 *  - Spin controller: draggable red dot on a white ball UI
 */

// Scene scale (arbitrary units tuned for look)
const TABLE = { W: 100, H: 50, WALL: 2.5 };
const BALL_R = 2;
const POCKET_R = 4.1; // visual ring radius (ellipse scales applied)
const FRICTION = 0.9925;
const STOP_EPS = 0.02;

const COLORS = {
  cloth: 0x0b5d39,
  rail: 0x083220, // darker than cloth
  wood: 0xcaa677, // light brown wood legs
  cue: 0xffffff,
  red: 0xb00000,
  yellow: 0xfacc15,
  green: 0x22c55e,
  brown: 0x8b5e3c,
  blue: 0x3b82f6,
  pink: 0xec4899,
  black: 0x111827,
};

export default function Snooker3D() {
  const mountRef = useRef(null);
  const rafRef = useRef(null);
  const cueIdxRef = useRef(0);
  const ballsRef = useRef([]);
  const aimRef = useRef({ active: false, dir: new THREE.Vector2(1, 0) });
  const sphRef = useRef(new THREE.Spherical(120, Math.PI / 3.2, Math.PI / 6));
  const updateCamRef = useRef(() => {});
  const powerRef = useRef(null);
  const spinRef = useRef(null);
  const [ui, setUi] = useState({ score: 0, power: 0, spinX: 0, spinY: 0 });
  const [timer, setTimer] = useState(60);
  const [cueVariant, setCueVariant] = useState("auto");

  useEffect(() => {
    const id = setInterval(() => setTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (t) => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // THREE setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    const target = new THREE.Vector3(0, 0, 0);
    const sph = sphRef.current;
    const updateCam = () => { camera.position.setFromSpherical(sph).add(target); camera.lookAt(target); };
    updateCamRef.current = updateCam;
    updateCam();

    // Minimal orbit controls
    const state = { drag: false, lastX: 0, lastY: 0 };
    const onDown = (e) => { state.drag = true; state.lastX = e.clientX || e.touches?.[0].clientX || 0; state.lastY = e.clientY || e.touches?.[0].clientY || 0; };
    const onMove = (e) => { if (!state.drag) return; const x = e.clientX || e.touches?.[0].clientX || state.lastX; const y = e.clientY || e.touches?.[0].clientY || state.lastY; const dx = x - state.lastX, dy = y - state.lastY; state.lastX = x; state.lastY = y; sph.theta -= dx * 0.005; sph.phi = Math.min(Math.max(0.35, sph.phi + dy * 0.005), Math.PI / 2); updateCam(); };
    const onUp = () => { state.drag = false; };
    const onWheel = (e) => { sph.radius = THREE.MathUtils.clamp(sph.radius + e.deltaY * 0.05, 70, 180); updateCam(); };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onDown); dom.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    dom.addEventListener('touchstart', onDown, { passive: true }); dom.addEventListener('touchmove', onMove, { passive: true }); window.addEventListener('touchend', onUp);
    dom.addEventListener('wheel', onWheel, { passive: true });

    // Lights
    scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(-40, 60, 30); key.castShadow = true; scene.add(key);

    // Cloth (lux finish)
    const cloth = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE.W, 2, TABLE.H),
      new THREE.MeshStandardMaterial({ color: COLORS.cloth, roughness: 0.95 })
    );
    cloth.position.y = -1; cloth.receiveShadow = true; scene.add(cloth);

    // Rails (darker), plus beveled jaws wedges at pockets
    const railMat = new THREE.MeshStandardMaterial({ color: COLORS.rail, metalness: 0.15, roughness: 0.7 });
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(TABLE.W + 8, 4, 4), railMat); railTop.position.set(0, 0, TABLE.H / 2 + 2);
    const railBot = railTop.clone(); railBot.position.z = -TABLE.H / 2 - 2;
    const railL = new THREE.Mesh(new THREE.BoxGeometry(4, 4, TABLE.H + 8), railMat); railL.position.set(-TABLE.W / 2 - 2, 0, 0);
    const railR = railL.clone(); railR.position.x = TABLE.W / 2 + 2;
    scene.add(railTop, railBot, railL, railR);

    // Pocket jaws (angled guides): two wedges per pocket
    const addJaws = (x, z, angleRad) => {
      const jawMat = railMat;
      const w = 7, h = 4, d = 2.2;
      const left = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), jawMat);
      const right = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), jawMat);
      left.position.set(x, 0, z); right.position.set(x, 0, z);
      left.rotation.y = angleRad; right.rotation.y = angleRad + Math.PI / 2;
      // offset outwards a touch to create the mouth
      left.position.x += Math.cos(angleRad) * 3; left.position.z += Math.sin(angleRad) * 3;
      right.position.x += Math.cos(angleRad + Math.PI / 2) * 3; right.position.z += Math.sin(angleRad + Math.PI / 2) * 3;
      scene.add(left, right);
    };

    // Pockets: elliptical rings (corner diagonal, middle horizontal)
    const pocketRing = new THREE.RingGeometry(POCKET_R * 0.55, POCKET_R, 48);
    const pocketMat = new THREE.MeshStandardMaterial({ color: 0x000000, side: THREE.DoubleSide, metalness: 0.05, roughness: 0.4 });

    // Corner pockets (ellipse rotated 45°): TL, TR, BL, BR
    const corners = [
      [-TABLE.W / 2, -TABLE.H / 2], [TABLE.W / 2, -TABLE.H / 2],
      [-TABLE.W / 2, TABLE.H / 2], [TABLE.W / 2, TABLE.H / 2]
    ];
    corners.forEach(([x, z]) => {
      const ring = new THREE.Mesh(pocketRing, pocketMat);
      ring.rotation.x = -Math.PI / 2; // lie flat
      ring.scale.set(1.25, 1.0, 1);   // ellipse (major axis ~diagonal after yaw)
      ring.position.set(x, -0.9, z);
      // rotate ellipse 45° within plane via yaw
      ring.rotation.y = Math.PI / 4;
      scene.add(ring);
      // Jaws for corners, angle to diagonals (~45°)
      addJaws(x + Math.sign(x) * 2, z + Math.sign(z) * 2, Math.atan2(z, x) + Math.PI / 4);
    });

    // Middle pockets (ellipse horizontal, long axis along X)
    const middles = [[0, -TABLE.H / 2], [0, TABLE.H / 2]];
    middles.forEach(([x, z]) => {
      const ring = new THREE.Mesh(pocketRing, pocketMat);
      ring.rotation.x = -Math.PI / 2; // flat
      ring.position.set(x, -0.9, z);
      ring.scale.set(1.35, 0.95, 1);  // slightly wider horizontally
      // horizontal (no yaw) for a clean, modern look
      scene.add(ring);
      // Jaws facing across table (guide towards pocket)
      addJaws(x, z, 0);
    });

    // Legs – light-wood, beveled tops for luxury feel
    const legMat = new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 0.45, metalness: 0.05 });
    const leg = () => new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 30, 20), legMat);
    [[-TABLE.W / 2 - 3, -TABLE.H / 2 - 3], [TABLE.W / 2 + 3, -TABLE.H / 2 - 3], [-TABLE.W / 2 - 3, TABLE.H / 2 + 3], [TABLE.W / 2 + 3, TABLE.H / 2 + 3]].forEach(([x, z]) => {
      const l = leg(); l.position.set(x, -16, z); scene.add(l);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.5, 2.2, 20), legMat); cap.rotation.x = Math.PI; cap.position.set(x, -1, z); scene.add(cap);
    });

    // Aiming line (primary) + target tick (small line at the end)
    const aimMat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 2, gapSize: 1, transparent: true, opacity: 0.9 });
    const aimGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const aimLine = new THREE.Line(aimGeom, aimMat); aimLine.computeLineDistances(); scene.add(aimLine);

    const tickGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const tickMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const tick = new THREE.Line(tickGeom, tickMat); scene.add(tick);

    // Balls
    const makeBall = (color) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 32), new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05 }));
      mesh.position.y = BALL_R; scene.add(mesh); return mesh;
    };

    const balls = [];
    // cue
    balls.push({ mesh: makeBall(COLORS.cue), pos: new THREE.Vector2(-TABLE.W * 0.3, 0), vel: new THREE.Vector2(), active: true, id: 'cue' });
    cueIdxRef.current = 0;

    // reds triangle (15)
    let id = 0; const sx = TABLE.W * 0.1; const sy = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c <= r; c++) {
        const x = sx + r * (BALL_R * 2 + 0.6);
        const y = sy - r * BALL_R + c * (BALL_R * 2 + 0.2);
        balls.push({ mesh: makeBall(COLORS.red), pos: new THREE.Vector2(x, y), vel: new THREE.Vector2(), active: true, id: `red_${id++}` });
      }
    }
    // colours
    const addColor = (id, color, x, y) => balls.push({ mesh: makeBall(color), pos: new THREE.Vector2(x, y), vel: new THREE.Vector2(), active: true, id });
    addColor('yellow', COLORS.yellow, -TABLE.W * 0.38, TABLE.H * 0.22);
    addColor('green', COLORS.green, -TABLE.W * 0.38, -TABLE.H * 0.22);
    addColor('brown', COLORS.brown, -TABLE.W * 0.3, 0);
    addColor('blue', COLORS.blue, 0, 0);
    addColor('pink', COLORS.pink, TABLE.W * 0.06, 0);
    addColor('black', COLORS.black, TABLE.W * 0.32, 0);

    balls.forEach(b => b.mesh.position.set(b.pos.x, BALL_R, b.pos.y));
    ballsRef.current = balls;

    // Helpers
    const isRest = () => balls.every(b => b.vel.length() < STOP_EPS);
    const cueBall = () => balls[cueIdxRef.current];

    // Pointer-to-table projection
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const screenToPoint = (event) => {
      const rect = dom.getBoundingClientRect();
      const cx = (event.clientX - rect.left) / rect.width * 2 - 1;
      const cy = -(event.clientY - rect.top) / rect.height * 2 + 1;
      pointer.set(cx, cy); raycaster.setFromCamera(pointer, camera);
      const pt = new THREE.Vector3(); raycaster.ray.intersectPlane(plane, pt);
      return new THREE.Vector2(pt.x, pt.z);
    };

    // Input: aiming and shooting (powered by thin power bar drag)
    let pendingShot = false; // set when mouse down on power bar

    const onPointerDown = (e) => {
      if (!isRest()) return;
      const cb = cueBall(); if (!cb?.active) return;
      const hit = screenToPoint(e);
      if (hit.distanceTo(cb.pos) < 15) {
        aimRef.current.active = true;
      }
    };
    const onPointerMove = (e) => {
      if (!aimRef.current.active) return;
      const cb = cueBall(); if (!cb) return;
      const hit = screenToPoint(e);
      const dir = cb.pos.clone().sub(hit); if (dir.length() > 0.0001) aimRef.current.dir.copy(dir.normalize());
    };
    const doShot = () => {
      const cb = cueBall(); if (!cb) return;
      // velocity = power * dir + spin lateral (red dot UI => ui.spinX/Y)
      const base = aimRef.current.dir.clone().multiplyScalar(1.8 * (0.6 + ui.power * 1.4));
      const lateral = new THREE.Vector2(-ui.spinY, ui.spinX).multiplyScalar(0.6 * ui.power);
      cb.vel.copy(base.add(lateral));
    };
    const onPointerUp = () => {
      if (aimRef.current.active && pendingShot) {
        doShot();
      }
      aimRef.current.active = false;
      pendingShot = false;
    };

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Physics: walls reflect; balls collide; pocket capture
    const reflectWalls = (b) => {
      const limX = TABLE.W / 2 - BALL_R - TABLE.WALL;
      const limY = TABLE.H / 2 - BALL_R - TABLE.WALL;
      if (b.pos.x < -limX && b.vel.x < 0) { b.pos.x = -limX; b.vel.x *= -1; }
      if (b.pos.x > limX && b.vel.x > 0) { b.pos.x = limX; b.vel.x *= -1; }
      if (b.pos.y < -limY && b.vel.y < 0) { b.pos.y = -limY; b.vel.y *= -1; }
      if (b.pos.y > limY && b.vel.y > 0) { b.pos.y = limY; b.vel.y *= -1; }
    };

    const collideBalls = () => {
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i], b = balls[j]; if (!a.active || !b.active) continue;
          const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
          const dist2 = dx * dx + dy * dy; const min = (BALL_R * 2) * (BALL_R * 2);
          if (dist2 > 0 && dist2 < min) {
            const dist = Math.sqrt(dist2) || 0.0001; const nx = dx / dist, ny = dy / dist;
            const overlap = (BALL_R * 2 - dist) / 2; a.pos.x -= nx * overlap; a.pos.y -= ny * overlap; b.pos.x += nx * overlap; b.pos.y += ny * overlap;
            const avn = a.vel.x * nx + a.vel.y * ny; const bvn = b.vel.x * nx + b.vel.y * ny;
            const at = a.vel.clone().sub(new THREE.Vector2(nx, ny).multiplyScalar(avn));
            const bt = b.vel.clone().sub(new THREE.Vector2(nx, ny).multiplyScalar(bvn));
            a.vel.copy(at.add(new THREE.Vector2(nx, ny).multiplyScalar(bvn)));
            b.vel.copy(bt.add(new THREE.Vector2(nx, ny).multiplyScalar(avn)));
          }
        }
      }
    };

    const pocketCenters = [
      new THREE.Vector2(-TABLE.W / 2, -TABLE.H / 2),
      new THREE.Vector2(0, -TABLE.H / 2),
      new THREE.Vector2(TABLE.W / 2, -TABLE.H / 2),
      new THREE.Vector2(-TABLE.W / 2, TABLE.H / 2),
      new THREE.Vector2(0, TABLE.H / 2),
      new THREE.Vector2(TABLE.W / 2, TABLE.H / 2),
    ];

    const pocketsCheck = () => {
      balls.forEach(b => {
        if (!b.active) return;
        for (const p of pocketCenters) {
          if (b.pos.distanceTo(p) < POCKET_R * 0.95) {
            b.active = false; b.mesh.visible = false; b.vel.set(0, 0);
            setUi(s => ({ ...s, score: s.score + 1 }));
            break;
          }
        }
      });
    };

    // Main loop (also updates aim line + target tick)
    const step = () => {
      const cb = cueBall();
      if (aimRef.current.active && cb?.active) {
        const start = new THREE.Vector3(cb.pos.x, BALL_R, cb.pos.y);
        const end2D = cb.pos.clone().add(aimRef.current.dir.clone().multiplyScalar(20 + 60 * ui.power));
        const end = new THREE.Vector3(end2D.x, BALL_R, end2D.y);
        aimGeom.setFromPoints([start, end]); aimLine.visible = true; aimLine.computeLineDistances();
        // target tick perpendicular at tip
        const dir3 = new THREE.Vector3(end.x - start.x, 0, end.z - start.z).normalize();
        const perp = new THREE.Vector3(-dir3.z, 0, dir3.x);
        const t1 = end.clone().add(perp.clone().multiplyScalar(1.2));
        const t2 = end.clone().add(perp.clone().multiplyScalar(-1.2));
        tickGeom.setFromPoints([t1, t2]); tick.visible = true;
      } else { aimLine.visible = false; tick.visible = false; }

      balls.forEach(b => {
        if (!b.active) return;
        b.pos.add(b.vel);
        b.vel.multiplyScalar(FRICTION);
        if (b.vel.length() < STOP_EPS) b.vel.set(0, 0);
        reflectWalls(b);
        b.mesh.position.set(b.pos.x, BALL_R, b.pos.y);
      });

      collideBalls();
      pocketsCheck();

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(step);
    };
    step();

    // Hook up HUD interop (power bar shot commit)
    const handleShotCommit = () => { pendingShot = true; }; // will fire on pointerup if aiming
    (window).__snk_commitShot = handleShotCommit;

    return () => {
      cancelAnimationFrame(rafRef.current);
      delete (window).__snk_commitShot;
    };
  }, [ui.power, ui.spinX, ui.spinY]);

  // --- HUD CONTROLS ---
  // Power slider (imported from Pool Royale but copied locally for Snooker)
  useEffect(() => {
    const mount = powerRef.current;
    if (!mount) return;
    const slider = new PowerSlider({
      mount,
      value: 0,
      onChange: (v) => setUi((s) => ({ ...s, power: v / 100 })),
      onCommit: () => {
        if ((window).__snk_commitShot) (window).__snk_commitShot();
      }
    });
    return () => slider.destroy();
  }, []);

  // Spin controller: white ball with red dot (copied from Pool Royale)
  useEffect(() => {
    const root = spinRef.current; if (!root) return;
    const dot = root.querySelector('.snk-spin-dot');
    let dragging = false;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const setFromClient = (clientX, clientY) => {
      const rect = root.getBoundingClientRect();
      const cx = rect.left + rect.width / 2; const cy = rect.top + rect.height / 2; const r = rect.width / 2 - 6;
      const dx = clientX - cx; const dy = clientY - cy;
      const len = Math.hypot(dx, dy);
      const sx = clamp(dx / r, -1, 1); const sy = clamp(dy / r, -1, 1);
      setUi(s => ({ ...s, spinX: -sy, spinY: sx })); // up is +spinX
      const k = len > r ? r / len : 1;
      dot.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    };
    const onDown = (e) => { dragging = true; setFromClient(e.clientX || e.touches?.[0].clientX || 0, e.clientY || e.touches?.[0].clientY || 0); };
    const onMove = (e) => { if (!dragging) return; setFromClient(e.clientX || e.touches?.[0].clientX || 0, e.clientY || e.touches?.[0].clientY || 0); };
    const onUp = () => { dragging = false; };
    root.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
    root.addEventListener('touchstart', onDown, { passive: true }); window.addEventListener('touchmove', onMove, { passive: true }); window.addEventListener('touchend', onUp);
    return () => {
      root.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      root.removeEventListener('touchstart', onDown); window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp);
    };
  }, []);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden">
      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Top card with player info and spin */}
      <div className="snk-header">
        <div className="snk-player">
          <div className="snk-avatar">U</div>
          <div className="snk-score">{ui.score}</div>
          <div className="snk-info">
            <div className="snk-name">Player</div>
          </div>
        </div>
        <div ref={spinRef} className="snk-spin-box">
          <div className="snk-spin-dot" style={{ transform: `translate(${ui.spinY * 35}px, ${-ui.spinX * 35}px)` }} />
          <div className="snk-timer">{formatTime(timer)}</div>
        </div>
      </div>

      {/* Power slider */}
      <div ref={powerRef} className="absolute right-3 top-1/2 -translate-y-1/2"></div>

      {/* Cue variants card */}
      <div className="snk-cue-options">
        <div className="snk-cue-label">Cue</div>
        {['short', 'medium', 'long', 'auto'].map((opt) => (
          <button
            key={opt}
            className={`snk-cue-btn${cueVariant === opt ? ' active' : ''}`}
            onClick={() => setCueVariant(opt)}
          >
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </button>
        ))}
      </div>

      {/* Top view button */}
      <button
        onClick={() => {
          sphRef.current.phi = 0.35;
          sphRef.current.theta = 0;
          updateCamRef.current();
        }}
        className="absolute top-20 right-16 w-12 h-12 rounded-full border border-white text-white bg-transparent"
        aria-label="Top view"
      >
        ⬆️
      </button>
    </div>
  );
}
