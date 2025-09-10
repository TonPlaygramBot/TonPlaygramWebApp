import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * BRICK BREAKER 3D — Portrait, Centered, Mobile‑Friendly
 * ------------------------------------------------------
 * • Plays vertically (no phone rotation). Whole playfield auto‑fits & stays centered.
 * • One‑finger drag to move paddle (bottom). Tap/Swipe up to launch.
 * • 3D look (lights/shadows), simple physics & level progression.
 */

export default function BrickBreaker3D({ player }) {
  const wrapRef = useRef(null);
  const raf = useRef(0);

  const [ui, setUi] = useState({ level: 1, score: 0, lives: 3, running: false, msg: "Drag to move • Tap to launch" });

  useEffect(() => {
    const host = wrapRef.current; if (!host) return;

    // ---------- Renderer ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    // Ensure the canvas element visually matches its drawing buffer so the
    // game always fills the available space on screen.
    renderer.setSize(host.clientWidth, host.clientHeight); // update style size
    renderer.shadowMap.enabled = true;
    renderer.domElement.style.display = "block"; // remove inline gap
    host.appendChild(renderer.domElement);

    // ---------- Scene & Camera ----------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e14);

    const CAM = { fov: 58, near: 0.05, far: 200 };
    const camera = new THREE.PerspectiveCamera(CAM.fov, host.clientWidth/host.clientHeight, CAM.near, CAM.far);
    scene.add(camera);

    const fitCamera = () => {
      camera.aspect = host.clientWidth/host.clientHeight;
      // Distance to fit height fully in view at given FOV (with small margin)
      const margin = 1.0; // remove extra margin so board fills the screen
      const dist = (BOARD.H * margin) / (2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
      camera.position.set(0, 9, dist + 4);
      camera.lookAt(0, 0.5, 0);
      camera.updateProjectionMatrix();
      // Keep renderer canvas in sync with host size on resize events
      renderer.setSize(host.clientWidth, host.clientHeight);
    };

    // ---------- Lights ----------
    scene.add(new THREE.HemisphereLight(0xffffff, 0x172033, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(-6, 12, 8); dir.castShadow = true; scene.add(dir);

    // ---------- Playfield ----------
    const BOARD = { W: 9.0, H: 16.0, wallT: 0.2 }; // larger board
    const group = new THREE.Group(); scene.add(group);

    // Floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(BOARD.W+2, 0.2, BOARD.H+2), new THREE.MeshStandardMaterial({ color: 0x121722, roughness: 1.0 }));
    floor.position.y = -0.11; floor.receiveShadow = true; group.add(floor);

    // Walls (3D rails so ball stays in)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3347, roughness: 0.6, metalness: 0.1 });
    const wallH = 0.8, t = BOARD.wallT;
    const wallTop = new THREE.Mesh(new THREE.BoxGeometry(BOARD.W, wallH, t), wallMat); wallTop.position.set(0, wallH/2, -BOARD.H/2 - t/2); wallTop.castShadow = true; group.add(wallTop);
    const wallBot = new THREE.Mesh(new THREE.BoxGeometry(BOARD.W, 0.4, t), wallMat); wallBot.position.set(0, 0.2, BOARD.H/2 + t/2); wallBot.castShadow = true; group.add(wallBot);
    const wallL   = new THREE.Mesh(new THREE.BoxGeometry(t, wallH, BOARD.H), wallMat); wallL.position.set(-BOARD.W/2 - t/2, wallH/2, 0); wallL.castShadow = true; group.add(wallL);
    const wallR   = new THREE.Mesh(new THREE.BoxGeometry(t, wallH, BOARD.H), wallMat); wallR.position.set( BOARD.W/2 + t/2, wallH/2, 0); wallR.castShadow = true; group.add(wallR);

    // Paddle
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: 0x59c1ff, metalness: 0.2, roughness: 0.6 }));
    paddle.position.set(0, 0.2, BOARD.H/2 - 0.9); paddle.castShadow = true; group.add(paddle);

    // Ball
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16), new THREE.MeshStandardMaterial({ color: 0xffe14a }));
    ball.position.set(0, 0.3, BOARD.H/2 - 1.2); ball.castShadow = true; group.add(ball);

    // Bricks
    const bricks = [];
    const makeLevel = (n=1) => {
      // Clear old bricks
      bricks.forEach(b => group.remove(b.mesh)); bricks.length = 0;
      // Layout: rows near the top
      const cols = 7, rows = Math.min(5 + n, 9);
      const gw = BOARD.W - 0.6; const gh = 6.5; // grid width/height area
      const cellW = gw/cols; const cellH = gh/rows;
      const g0x = -gw/2 + cellW/2; const g0z = -BOARD.H/2 + 1.2;
      for (let r=0; r<rows; r++) {
        for (let c=0; c<cols; c++) {
          if (Math.random() < 0.1 && r>0) continue; // small gaps for variety
          const w = cellW*0.86, h=0.4, d=cellH*0.62;
          const color = new THREE.Color().setHSL((0.55 + 0.08*r + 0.02*c) % 1, 0.65, 0.55);
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.15 }));
          mesh.castShadow = true;
          const x = g0x + c*cellW, z = g0z + r*cellH;
          mesh.position.set(x, 0.25, z);
          group.add(mesh);
          bricks.push({ mesh, w, d });
        }
      }
    };

    // Physics state
    const S = {
      vel: new THREE.Vector3(0, 0, 0),
      speed: 8.0, // slightly faster base speed
      launched: false,
      lives: 3,
      level: 1,
      score: 0,
    };

    // Launch ball
    const launch = () => {
      if (S.launched) return;
      S.launched = true;
      // random slight angle upward
      const angle = THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(235, 305)); // toward top
      S.vel.set(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(S.speed);
      setUi(s => ({ ...s, msg: "" }));
    };

    // Input mapping (drag bottom half to move paddle)
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

    const pointerToXZ = (clientX, clientY) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -(((clientY - r.top) / r.height) * 2 - 1);
      ray.setFromCamera(ndc, camera);
      ray.ray.intersectPlane(plane, hit);
      return { x: clamp(hit.x, -BOARD.W/2 + 0.8, BOARD.W/2 - 0.8), z: hit.z };
    };
    const onMove = (e) => {
      const t = e.touches ? e.touches[0] : e;
      const p = pointerToXZ(t.clientX, t.clientY);
      if (p.z > 0) paddle.position.x = p.x; // bottom half only
      if (!S.launched) ball.position.x = paddle.position.x; // carry ball before launch
    };
    const onTap = () => launch();

    renderer.domElement.addEventListener("touchstart", onMove, { passive: true });
    renderer.domElement.addEventListener("touchmove",  onMove, { passive: true });
    renderer.domElement.addEventListener("touchend",   onTap,  { passive: true });
    renderer.domElement.addEventListener("mousemove",  onMove);
    renderer.domElement.addEventListener("mouseup",    onTap);

    // Collisions
    const sphereAABB = (sPos, sR, bPos, bW, bD) => {
      const dx = Math.max(Math.abs(sPos.x - bPos.x) - bW/2, 0);
      const dz = Math.max(Math.abs(sPos.z - bPos.z) - bD/2, 0);
      return (dx*dx + dz*dz) <= (sR*sR);
    };

    const resetBall = () => {
      S.launched = false; S.vel.set(0,0,0);
      ball.position.set(paddle.position.x, 0.3, BOARD.H/2 - 1.2);
    };

    const newLife = () => {
      S.lives -= 1;
      setUi(s => ({ ...s, lives: S.lives, msg: S.lives>0 ? "Tap to relaunch" : "Game Over — Reset" }));
      resetBall();
    };

    const nextLevel = () => {
      S.level += 1; S.speed += 0.6;
      setUi(s => ({ ...s, level: S.level, msg: `Level ${S.level}` }));
      makeLevel(S.level);
      resetBall();
    };

    // Build first level
    makeLevel(1);

    // Main loop
    const clock = new THREE.Clock();
    const tick = () => {
      const dt = Math.min(0.033, clock.getDelta());

      // Ball physics
      if (S.launched) {
        ball.position.x += S.vel.x * dt;
        ball.position.z += S.vel.z * dt;

        // Wall bounces
        if (Math.abs(ball.position.x) > (BOARD.W/2 - 0.18)) { ball.position.x = clamp(ball.position.x, -BOARD.W/2 + 0.18, BOARD.W/2 - 0.18); S.vel.x *= -1; }
        if (ball.position.z < (-BOARD.H/2 + 0.18)) { ball.position.z = -BOARD.H/2 + 0.18; S.vel.z *= -1; }
        if (ball.position.z > (BOARD.H/2 + 0.2)) { // fell out bottom → life lost
          newLife();
        }

        // Paddle collision (AABB vs sphere)
        if (sphereAABB(ball.position, 0.18, paddle.position, 1.6, 0.4)) {
          // Reflect upward with angle based on where it hit the paddle
          const dx = (ball.position.x - paddle.position.x) / 0.8; // -1..1
          const angle = THREE.MathUtils.degToRad(260 - dx*40); // steer
          const speed = S.vel.length();
          S.vel.set(Math.cos(angle)*speed, 0, Math.sin(angle)*speed);
          // Nudge above paddle to avoid sticking
          ball.position.z = paddle.position.z - 0.3;
        }

        // Brick collisions
        for (let i = bricks.length - 1; i >= 0; i--) {
          const b = bricks[i]; const m = b.mesh;
          if (sphereAABB(ball.position, 0.18, m.position, b.w, b.d)) {
            // Simple reflect: pick the dominant axis of penetration by comparing distances
            const dx = (ball.position.x - m.position.x) / (b.w/2);
            const dz = (ball.position.z - m.position.z) / (b.d/2);
            if (Math.abs(dx) > Math.abs(dz)) S.vel.x *= -1; else S.vel.z *= -1;
            group.remove(m); bricks.splice(i,1);
            S.score += 50; setUi(s => ({ ...s, score: S.score }));
            break;
          }
        }

        // Win condition: all bricks cleared
        if (bricks.length === 0) nextLevel();
      } else {
        // Carry ball with paddle before launch
        ball.position.x = paddle.position.x;
      }

      renderer.render(scene, camera);
      raf.current = requestAnimationFrame(tick);
    };

    fitCamera();
    tick();

    const onResize = () => fitCamera();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", onResize);
      try { host.removeChild(renderer.domElement); } catch {}
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={wrapRef} className="w-full h-[100dvh] bg-black relative overflow-hidden select-none">
      <div className="absolute top-0 left-2 flex items-center space-x-2 text-white text-xs bg-white/10 rounded px-2 py-1">
        <img src={player.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
        <span>{player.name}: {ui.score}</span>
      </div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 text-white text-xs bg-white/10 rounded px-2 py-1">
        Level {ui.level} • Lives {ui.lives} — {ui.msg}
      </div>
      <button onClick={() => window.location.reload()} className="absolute left-2 bottom-0 text-white text-xs bg-white/10 hover:bg-white/20 rounded px-2 py-1">Reset</button>
    </div>
  );
}

