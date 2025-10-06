import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createArenaCarpetMaterial, createArenaWallMaterial } from "../utils/arenaDecor.js";

/**
 * TABLE TENNIS 3D — Mobile Portrait (1:1)
 * --------------------------------------
 * • Full-screen on phones (100dvh). Portrait-only experience; no overflow.
 * • 3D table (official size ratio), white lines, center net with posts.
 * • Controls: drag with one finger to move the racket; ball follows real-ish ping-pong physics.
 * • Camera: fixed angle that keeps the entire table centered on screen.
 * • AI opponent on the far side with adjustable difficulty and reaction delay.
 * • Scoring: to 11, win by 2; service swaps every 2 points, auto-serve & rally logic.
 */

export default function TableTennis3D({ player, ai }){
  const hostRef = useRef(null);
  const raf = useRef(0);

  const [ui, setUi] = useState({
    pScore: 0,
    oScore: 0,
    serving: 'P', // P or O
    msg: 'Drag to move',
    gameOver: false,
  });

  useEffect(()=>{
    const host = hostRef.current; if (!host) return;

    // Prevent overscroll on mobile
    const prevOver = document.documentElement.style.overscrollBehavior;
    document.documentElement.style.overscrollBehavior = 'none';

    // ---------- Renderer ----------
    const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
    // Disable real-time shadow mapping to avoid dark artifacts on the
    // arena walls and table surface. Shadow maps from the multiple
    // spotlights were causing the entire scene to appear black in some
    // devices/browsers. We render a fake ball shadow manually so real
    // shadows are unnecessary here.
    renderer.shadowMap.enabled = false;
    // ensure canvas CSS size matches the host container
    const setSize = () => renderer.setSize(host.clientWidth, host.clientHeight);
    setSize(); host.appendChild(renderer.domElement);

    // ---------- Scene & Lights ----------
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0e14);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2233, 0.95));
    // Directional key light. Shadow casting is disabled because shadow
    // maps are turned off above; keeping it false prevents accidental
    // blackening of surfaces.
    const sun = new THREE.DirectionalLight(0xffffff, 0.95);
    sun.position.set(-16, 28, 18);
    sun.castShadow = false;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x99ccff, 0.35); rim.position.set(20, 14, -12); scene.add(rim);

    // arena spotlights
    const spotPositions = [
      [-8, 6, -8],
      [8, 6, -8],
      [-8, 6, 8],
      [8, 6, 8]
    ];
    spotPositions.forEach(p => {
      const s = new THREE.SpotLight(0xffffff, 0.7);
      s.position.set(p[0], p[1], p[2]);
      s.angle = Math.PI / 5;
      s.penumbra = 0.3;
      // Spotlights are purely cosmetic; disable shadow casting to keep
      // the table and walls lit evenly.
      s.castShadow = false;
      s.target.position.set(0, 1, 0);
      scene.add(s);
      scene.add(s.target);
    });

    // ---------- Camera ----------
    const camera = new THREE.PerspectiveCamera(60, host.clientWidth/host.clientHeight, 0.05, 500);
    scene.add(camera);
    const camRig = { dist: 5.4, height: 2.05, yaw: 0, pitch: 0.32, forwardBias: 0.18 };
    const applyCam = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
    };

    // ---------- Table dimensions (official footprint, slightly taller surface) ----------
    const T = { L: 2.74, W: 1.525, H: 0.84, topT: 0.03, NET_H: 0.1525 };

    // Enlarge the entire playfield (table, paddles, ball) for a more dramatic presentation
    const S = 3;
    const tableG = new THREE.Group();
    tableG.scale.set(S, S, S);
    scene.add(tableG);

    const tableMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, roughness: 0.45, metalness: 0.6 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

    // Table top
    const top = new THREE.Mesh(new THREE.BoxGeometry(T.W, T.topT, T.L), tableMat);
    top.position.set(0, T.H - T.topT / 2, 0);
    top.castShadow = true;
    tableG.add(top);

    // Table border apron
    const apronDepth = 0.025;
    const apronGeo = new THREE.BoxGeometry(T.W + 0.04, apronDepth, 0.02);
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x10204d, roughness: 0.8 });
    const apronFront = new THREE.Mesh(apronGeo, apronMat);
    apronFront.position.set(0, T.H - T.topT - apronDepth / 2, T.L / 2 + 0.01);
    const apronBack = apronFront.clone(); apronBack.position.z = -T.L / 2 - 0.01;
    tableG.add(apronFront, apronBack);

    const sideApronGeo = new THREE.BoxGeometry(0.02, apronDepth, T.L + 0.04);
    const apronLeft = new THREE.Mesh(sideApronGeo, apronMat);
    apronLeft.position.set(-T.W / 2 - 0.01, T.H - T.topT - apronDepth / 2, 0);
    const apronRight = apronLeft.clone(); apronRight.position.x = T.W / 2 + 0.01;
    tableG.add(apronLeft, apronRight);

    // White lines
    const borderT = 0.018;
    const lineH = 0.0025;
    const lineY = T.H + lineH / 2;
    const mkLine = (w, h, d, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), whiteMat);
      mesh.position.set(x, y, z);
      tableG.add(mesh);
    };
    mkLine(borderT, lineH, T.L, -T.W / 2 + borderT / 2, lineY, 0);
    mkLine(borderT, lineH, T.L, T.W / 2 - borderT / 2, lineY, 0);
    mkLine(T.W, lineH, borderT, 0, lineY, T.L / 2 - borderT / 2);
    mkLine(T.W, lineH, borderT, 0, lineY, -T.L / 2 + borderT / 2);
    mkLine(borderT, lineH, T.L - borderT * 2, 0, lineY, 0);

    // Net & posts
    const netGroup = new THREE.Group();
    tableG.add(netGroup);
    const netAlpha = makeHexNetAlpha(512, 256, 9);
    const netWeave = makeWeaveTex(256, 256);
    const netMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      alphaMap: netAlpha,
      map: netWeave,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const postR = 0.012;
    const netWidth = T.W + postR * 1.2;
    const netPlane = new THREE.Mesh(new THREE.PlaneGeometry(netWidth, T.NET_H), netMat);
    netPlane.position.set(0, T.H + T.NET_H / 2, 0);
    netGroup.add(netPlane);

    const bandT = 0.014;
    const bandTop = new THREE.Mesh(new THREE.BoxGeometry(netWidth, bandT, 0.004), whiteMat);
    bandTop.position.set(0, T.H + T.NET_H - bandT / 2, 0);
    const bandBottom = bandTop.clone();
    bandBottom.position.set(0, T.H + bandT / 2, 0);
    netGroup.add(bandTop, bandBottom);

    const postH = T.NET_H + 0.08;
    const postGeo = new THREE.CylinderGeometry(postR, postR, postH, 28);
    const postRight = new THREE.Mesh(postGeo, steelMat);
    postRight.position.set(T.W / 2 + postR * 0.6, T.H + postH / 2, 0);
    const postLeft = postRight.clone();
    postLeft.position.x = -T.W / 2 - postR * 0.6;
    tableG.add(postRight, postLeft);

    const clampGeo = new THREE.BoxGeometry(0.06, 0.025, 0.05);
    const clampRight = new THREE.Mesh(clampGeo, steelMat);
    clampRight.position.set(T.W / 2 + 0.03, T.H + 0.03, 0);
    const clampLeft = clampRight.clone();
    clampLeft.position.x = -T.W / 2 - 0.03;
    tableG.add(clampRight, clampLeft);

    addTableLegs(tableG, T, steelMat, wheelMat);

    // arena floor & carpet (match Chess Battle Royal aesthetics)
    const floorSize = 30;
    const carpetSize = 24;
    const baseFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(floorSize, floorSize),
      new THREE.MeshStandardMaterial({ color: 0x0f1222, roughness: 0.95, metalness: 0.05 })
    );
    baseFloor.rotation.x = -Math.PI / 2;
    baseFloor.position.y = 0;
    baseFloor.receiveShadow = true;
    scene.add(baseFloor);

    const carpetMat = createArenaCarpetMaterial();
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(carpetSize, carpetSize), carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.01;
    carpet.receiveShadow = true;
    scene.add(carpet);

    // walls (reuse Chess Battle Royal material)
    const wallMat = createArenaWallMaterial();
    const wallHeight = 6;
    const wallThickness = 0.2;
    const wallOffset = floorSize / 2;
    const wallGeoH = new THREE.BoxGeometry(floorSize, wallHeight, wallThickness);
    const wallGeoV = new THREE.BoxGeometry(wallThickness, wallHeight, floorSize);

    const wallBack = new THREE.Mesh(wallGeoH, wallMat);
    wallBack.position.set(0, wallHeight / 2, -wallOffset);
    scene.add(wallBack);

    const wallFront = new THREE.Mesh(wallGeoH, wallMat);
    wallFront.position.set(0, wallHeight / 2, wallOffset);
    scene.add(wallFront);

    const wallLeft = new THREE.Mesh(wallGeoV, wallMat);
    wallLeft.position.set(-wallOffset, wallHeight / 2, 0);
    scene.add(wallLeft);

    const wallRight = new THREE.Mesh(wallGeoV, wallMat);
    wallRight.position.set(wallOffset, wallHeight / 2, 0);
    scene.add(wallRight);

    // ---------- Rackets (paddles) ----------
    const PADDLE_SCALE = 1.1;
    const BALL_R = 0.02;
    function makePaddle(color){
      const g = new THREE.Group();
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.085*PADDLE_SCALE,0.085*PADDLE_SCALE,0.014*PADDLE_SCALE, 28), new THREE.MeshStandardMaterial({ color, metalness:0.05, roughness:0.6 }));
      head.rotation.x = Math.PI/2; head.position.y = T.H + 0.07 * PADDLE_SCALE; head.castShadow = true; g.add(head);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.025*PADDLE_SCALE,0.10*PADDLE_SCALE,0.025*PADDLE_SCALE), new THREE.MeshStandardMaterial({ color:0x8b5a2b, roughness:0.8 }));
      handle.position.set(0, T.H + 0.045 * PADDLE_SCALE, 0.07 * PADDLE_SCALE); handle.castShadow = true; g.add(handle);
      return g;
    }

    const player = makePaddle(0xff4d6d); tableG.add(player);
    const opp    = makePaddle(0x49dcb1); tableG.add(opp);
    player.position.z =  T.L/2 - 0.325; player.position.x = 0;
    opp.position.z    = -T.L/2 + 0.325; opp.position.x    = 0;

    // ---------- Ball ----------
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 42, 32),
      new THREE.MeshStandardMaterial({ color: 0xfff1cc, roughness: 0.6 })
    );
    ball.castShadow = true;
    tableG.add(ball);
    const ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(BALL_R * 1.6, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
    );
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.position.y = T.H + 0.005;
    tableG.add(ballShadow);

    // ---------- Physics State ----------
      const Srv = { side: ui.serving }; // P or O (mutable copy)
      const Sx = {
      v: new THREE.Vector3(0,0,0),
      w: new THREE.Vector3(0,0,0), // spin (rad/s) — very simplified Magnus
      gravity: new THREE.Vector3(0,-9.81,0),
      air: 0.995,
      magnus: 0.15,
      tableRest: 0.9,
      paddleRest: 1.1,
      netRest: 0.3,
      state: 'serve', // serve | rally | dead
      lastTouch: null, // 'P' or 'O'
    };

    function resetServe(){
      Sx.v.set(0,0,0); Sx.w.set(0,0,0); Sx.state='serve'; Sx.lastTouch=null;
      const side = Srv.side;
        if (side==='P'){
          ball.position.set(player.position.x, T.H + 0.12, T.L/2 - 0.416);
        } else {
          ball.position.set(opp.position.x, T.H + 0.12, -T.L/2 + 0.416);
        }
    }

    // ---------- Input: Drag to move (player) ----------
    const ndc = new THREE.Vector2(); const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0); const hit = new THREE.Vector3();
    const bounds = { x: T.W/2 - 0.16, zNear:  T.L/2 - 0.24, zFar: 0.16 };

    const screenToXZ = (cx, cy) => { const r=renderer.domElement.getBoundingClientRect(); ndc.x=((cx-r.left)/r.width)*2-1; ndc.y=-(((cy-r.top)/r.height)*2-1); ray.setFromCamera(ndc, camera); ray.ray.intersectPlane(plane, hit); return new THREE.Vector2(hit.x/S, hit.z/S); };

    let dragging=false;
    const onDown = (e)=>{ const t=e.touches?e.touches[0]:e; const p=screenToXZ(t.clientX,t.clientY); dragging = (p.y > 0); if (dragging) movePlayerTo(p.x,p.y); };
    const onMove = (e)=>{ if(!dragging) return; const t=e.touches?e.touches[0]:e; const p=screenToXZ(t.clientX,t.clientY); movePlayerTo(p.x,p.y); };
    const onUp = ()=>{ dragging=false; };

    function movePlayerTo(x,z){
      player.position.x = THREE.MathUtils.clamp(x, -bounds.x, bounds.x);
      player.position.z = THREE.MathUtils.clamp(z, bounds.zFar, bounds.zNear);
    }

    renderer.domElement.addEventListener('touchstart', onDown, { passive:true });
    renderer.domElement.addEventListener('touchmove',  onMove,  { passive:true });
    renderer.domElement.addEventListener('touchend',   onUp,    { passive:true });
    renderer.domElement.addEventListener('mousedown',  onDown);
    renderer.domElement.addEventListener('mousemove',  onMove);
    window.addEventListener('mouseup', onUp);

    const camPos = new THREE.Vector3();
    const camFollow = new THREE.Vector3(player.position.x, 0, player.position.z);
    const followTarget = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const backVec = new THREE.Vector3();
    function updateCamera(immediate = false, lockCenter = false){
      if (lockCenter){
        followTarget.set(0, 0, 0);
      } else {
        followTarget.set(
          THREE.MathUtils.clamp(player.position.x, -bounds.x, bounds.x),
          0,
          THREE.MathUtils.clamp(player.position.z, bounds.zFar, bounds.zNear)
        );
      }

      if (immediate){
        camFollow.copy(followTarget);
      } else {
        camFollow.lerp(followTarget, 0.18);
      }

      lookTarget.set(
        camFollow.x * S,
        (T.H - 0.05) * S,
        (camFollow.z - camRig.forwardBias) * S
      );

      const yaw = camRig.yaw;
      backVec.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(camRig.dist);
      camPos.copy(lookTarget).add(backVec);
      camPos.y = camRig.height + (camRig.pitch * 5.2);

      camera.position.copy(camPos);
      camera.lookAt(lookTarget);
    }

    // ensure table fits view similar to Air Hockey
    const corners = [
      new THREE.Vector3(-T.W/2 * S, T.H * S, -T.L/2 * S),
      new THREE.Vector3(T.W/2 * S, T.H * S, -T.L/2 * S),
      new THREE.Vector3(-T.W/2 * S, T.H * S, T.L/2 * S),
      new THREE.Vector3(T.W/2 * S, T.H * S, T.L/2 * S)
    ];
    const toNDC = v => v.clone().project(camera);
    const ensureFit = () => {
      const savedFollow = camFollow.clone();
      for (let i = 0; i < 20; i++) {
        updateCamera(true, true);
        const over = corners.some(c => {
          const p = toNDC(c);
          return Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
        });
        if (!over) break;
        camRig.dist += 0.2;
        camRig.height += 0.07;
      }
      camRig.dist = Math.max(4.6, camRig.dist - 0.7);
      camRig.height = Math.max(1.7, camRig.height - 0.25);
      camFollow.copy(savedFollow);
      updateCamera(true);
    };

    // ---------- AI ----------
    const AI = { speed: 3.5, react: 0.05, targetX: 0, timer:0 };

    function stepAI(dt){
      AI.timer -= dt; if (AI.timer <= 0){
        AI.timer = AI.react;
        if (Sx.v.z < 0){
          const tHit = ((-T.L/2 + 0.325) - ball.position.z/S) / Sx.v.z;
          AI.targetX = THREE.MathUtils.clamp(ball.position.x/S + Sx.v.x * tHit, -T.W/2+0.1, T.W/2-0.1);
        } else {
          AI.targetX = 0;
        }
      }
      const dx = AI.targetX - opp.position.x; opp.position.x += THREE.MathUtils.clamp(dx, -AI.speed*dt, AI.speed*dt);
      opp.position.z = -T.L/2 + 0.325;
    }

    // ---------- Collisions ----------
    function bounceTable(prev){
      if (prev.y > T.H && ball.position.y <= T.H){
        const x=ball.position.x/S, z=ball.position.z/S;
        if (Math.abs(x) <= T.W/2 && Math.abs(z) <= T.L/2){
          Sx.v.y = -Sx.v.y * Sx.tableRest;
          Sx.v.x *= 0.99; Sx.v.z *= 0.99; Sx.w.multiplyScalar(0.98);
          ball.position.y = T.H;
        }
      }
    }

    function hitPaddle(paddle, who){
      // approximate as circle vs cylinder head
      const head = paddle.children[0];
      const R = 0.085 * PADDLE_SCALE; const B = BALL_R; // ball radius
      const dx = (ball.position.x - head.position.x) - paddle.position.x;
      const dz = (ball.position.z - head.position.z) - paddle.position.z;
      const dy = (ball.position.y - head.position.y);
      const dist2 = dx*dx + dy*dy + dz*dz;
      const minR = (R + B*S)**2; // scaled ball
      if (dist2 < minR){
        // reflect velocity away from paddle center + add some of paddle motion as spin/impulse
        const n = new THREE.Vector3(dx, dy, dz).normalize();
        const vN = Sx.v.dot(n);
        Sx.v.addScaledVector(n, (-1.8*vN + 3.2)); // strong push outward
        // add directional aim depending on where we contact
        Sx.v.x += n.x * 1.2; Sx.v.z += n.z * 1.6 * (who==='P' ? -1 : 1);
        // add spin from side swipe (use recent paddle delta if dragging)
        Sx.w.x += (Math.random()-0.5)*2; Sx.w.z += (Math.random()-0.5)*2; Sx.w.y += (who==='P'? -3: 3);
        Sx.state = 'rally'; Sx.lastTouch = who;
      }
    }

    function hitNet(){
      // net as a thin box at z=0 spanning table width
      const halfW=T.W/2, halfT=0.005*S + BALL_R; // thickness scaled
      if (Math.abs(ball.position.z) < halfT && Math.abs(ball.position.x/S) < halfW && ball.position.y < (T.H + T.NET_H)){
        Sx.v.z *= -Sx.netRest; Sx.v.x *= 0.92; Sx.v.y *= 0.7;
      }
    }

    // ---------- Scoring & Rules ----------
    function pointTo(winner){
      if (winner==='P') setUi(s=>({ ...s, pScore: s.pScore+1 })); else setUi(s=>({ ...s, oScore: s.oScore+1 }));
      // swap serve every 2 points until deuce
      setUi(s=>{
        const total = s.pScore + s.oScore + 1; // +1 since we just added
        const deuce = s.pScore>=10 && s.oScore>=10;
        const shouldSwap = deuce ? true : (total%2===0);
        const nextServing = shouldSwap ? (s.serving==='P'?'O':'P') : s.serving;
        const gameOver = (s.pScore>=11 || s.oScore>=11) && Math.abs(s.pScore - s.oScore) >= 2;
        return { ...s, serving: nextServing, gameOver, msg: gameOver? 'Game Over — Tap Reset' : `Serve: ${nextServing==='P'?'You':'AI'}` };
      });
      Srv.side = (Srv.side==='P')?'O':'P';
      resetServe();
    }

    function checkFaults(){
      // Simple rule set:
      // • On serve: ball must bounce once on server side then cross net then bounce on receiver side; otherwise point to receiver.
      // • During rally: if ball hits table outside bounds or fails to cross net → point to other side.
      const x=ball.position.x/S, z=ball.position.z/S, y=ball.position.y;
      if (y < T.H - 0.02){
        // went below table top level: treat as table contact previously; if now out-of-bounds, score to opponent
        if (Math.abs(x) > T.W/2 + 0.02 || Math.abs(z) > T.L/2 + 0.02){
          const winner = (Sx.lastTouch==='P') ? 'O' : 'P';
          pointTo(winner);
        }
      }
      // net double-hit catch (if stuck around net below tape)
      if (Math.abs(z) < 0.02 && y < T.H + 0.02){
        const winner = (Sx.lastTouch==='P') ? 'O' : 'P';
        pointTo(winner);
      }
    }

    // ---------- Loop ----------
    const clock = new THREE.Clock(); let dt=0;
    function step(){
      dt = Math.min(0.033, clock.getDelta());

      // Camera follow
      updateCamera();

      // AI
      stepAI(dt);

      if (!ui.gameOver){
        const prev = ball.position.clone();
        const magnus = new THREE.Vector3().crossVectors(Sx.v, Sx.w).multiplyScalar(Sx.magnus);
        Sx.v.addScaledVector(Sx.gravity, dt);
        Sx.v.addScaledVector(magnus, dt);
        Sx.v.multiplyScalar(Math.pow(Sx.air, dt*60));
        ball.position.addScaledVector(Sx.v, dt);
        ballShadow.position.set(ball.position.x, T.H + 0.005, ball.position.z);
        const sh = THREE.MathUtils.clamp(1 - (ball.position.y - T.H), 0.3, 1);
        ballShadow.scale.set(sh, sh, 1);

        bounceTable(prev);
        hitNet();
        hitPaddle(player, 'P');
        hitPaddle(opp, 'O');
        checkFaults();

        if (Sx.state==='serve'){
          if (Srv.side==='P'){
            Sx.v.y = 1.8; Sx.v.z = -0.5; Sx.state='rally';
          } else {
            Sx.v.set((Math.random()-0.5)*0.8, 1.8, 1.1); Sx.state='rally';
          }
        }
      }

      renderer.render(scene, camera);
      raf.current = requestAnimationFrame(step);
    }

    ensureFit();
    resetServe();
    step();

    // ---------- Resize ----------
    const onResize = ()=>{ setSize(); applyCam(); ensureFit(); };
    window.addEventListener('resize', onResize);

    return ()=>{
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', onResize);
      document.documentElement.style.overscrollBehavior = prevOver;
      try{ host.removeChild(renderer.domElement); }catch{}
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.serving, ui.gameOver]);

  const resetAll = ()=> window.location.reload();

  return (
    <div ref={hostRef} className="w-[100vw] h-[100dvh] bg-black relative overflow-hidden touch-none select-none">
      {/* HUD */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-white text-[11px] sm:text-xs bg-white/10 rounded px-2 py-1 whitespace-nowrap">
        {(player?.name || 'You')} {ui.pScore} : {ui.oScore} {(ai?.name || 'AI')} • Serve: {ui.serving==='P'?(player?.name || 'You'):(ai?.name || 'AI')} — {ui.msg}
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <button onClick={resetAll} className="text-white text-[11px] bg-white/10 hover:bg-white/20 rounded px-2 py-1">Reset</button>
      </div>
    </div>
  );
}

function addTableLegs(tableG, T, steelMat, wheelMat) {
  const tubeR = 0.02;
  const wheelRadius = 0.035;
  const wheelThickness = 0.02;
  const legClearance = 0.004;
  const legH = T.H - T.topT - legClearance - wheelRadius;
  const offsetZ = T.L * 0.36;
  const offsetX = T.W * 0.42;

  const makeFrame = (zSign) => {
    const g = new THREE.Group();
    const uprightGeo = new THREE.CylinderGeometry(tubeR, tubeR, legH, 26);
    const upLeft = new THREE.Mesh(uprightGeo, steelMat);
    const upRight = new THREE.Mesh(uprightGeo, steelMat);
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, offsetX * 2, 26), steelMat);
    upLeft.position.set(-offsetX, wheelRadius + legH / 2, zSign * offsetZ);
    upRight.position.set(offsetX, wheelRadius + legH / 2, zSign * offsetZ);
    cross.rotation.z = Math.PI / 2;
    cross.position.set(0, wheelRadius + 0.11, zSign * offsetZ);
    g.add(upLeft, upRight, cross);

    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 24);
    const wheelLeft = new THREE.Mesh(wheelGeo, wheelMat);
    const wheelRight = new THREE.Mesh(wheelGeo, wheelMat);
    wheelLeft.rotation.x = Math.PI / 2;
    wheelRight.rotation.x = Math.PI / 2;
    wheelLeft.position.set(-offsetX, wheelRadius, zSign * offsetZ);
    wheelRight.position.set(offsetX, wheelRadius, zSign * offsetZ);
    g.add(wheelLeft, wheelRight);
    return g;
  };

  tableG.add(makeFrame(-1), makeFrame(1));
}

function makeHexNetAlpha(w, h, hexR) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  const dx = hexR * 1.732;
  const dy = hexR * 1.5;

  const drawHex = (cx, cy, r) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };

  for (let y = 0; y < h + dy; y += dy) {
    for (let x = 0; x < w + dx; x += dx) {
      const offset = Math.floor(y / dy) % 2 ? dx / 2 : 0;
      drawHex(x + offset, y, hexR);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 2);
  tex.anisotropy = 8;
  return tex;
}

function makeWeaveTex(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f7f7f7';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
  for (let x = 0; x < w; x += 2) ctx.fillRect(x, 0, 1, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = 8;
  return tex;
}

