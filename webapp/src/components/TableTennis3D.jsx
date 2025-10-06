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
  const uiRef = useRef(ui);
  useEffect(() => { uiRef.current = ui; }, [ui]);

  useEffect(()=>{
    const host = hostRef.current; if (!host) return;
    const timers = [];

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
    setSize();
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

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
    const camRig = {
      dist: 4.35,
      minDist: 3.95,
      height: 1.82,
      minHeight: 1.55,
      pitch: 0.28,
      forwardBias: 0.12,
      yawBase: 0,
      yawRange: 0.38,
      curYaw: 0,
      curDist: 4.35,
      curHeight: 1.82,
    };
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
    const PADDLE_SCALE = 1.18;
    const BALL_R = 0.02;
    function makePaddle(color, orientation = 1){
      const g = new THREE.Group();
      const headRadius = 0.092 * PADDLE_SCALE;
      const headThickness = 0.015 * PADDLE_SCALE;
      const head = new THREE.Mesh(
        new THREE.CylinderGeometry(headRadius, headRadius, headThickness, 36),
        new THREE.MeshStandardMaterial({ color, metalness:0.05, roughness:0.58 })
      );
      head.rotation.x = Math.PI/2;
      head.position.y = T.H + 0.072 * PADDLE_SCALE;
      head.castShadow = true;
      g.add(head);

      const backing = new THREE.Mesh(
        new THREE.CylinderGeometry(headRadius * 0.7, headRadius * 0.7, headThickness * 0.6, 16),
        new THREE.MeshStandardMaterial({ color:0x2a2a2a, roughness:0.4, metalness:0.1 })
      );
      backing.rotation.x = Math.PI/2;
      backing.position.set(0, head.position.y, -orientation * headThickness * 0.65);
      g.add(backing);

      const neck = new THREE.Mesh(
        new THREE.BoxGeometry(0.032 * PADDLE_SCALE, 0.032 * PADDLE_SCALE, 0.08 * PADDLE_SCALE),
        new THREE.MeshStandardMaterial({ color: 0xfff3e0, roughness: 0.6 })
      );
      neck.position.set(0, T.H + 0.058 * PADDLE_SCALE, orientation * 0.028 * PADDLE_SCALE);
      neck.castShadow = true;
      g.add(neck);

      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.03 * PADDLE_SCALE, 0.12 * PADDLE_SCALE, 0.034 * PADDLE_SCALE),
        new THREE.MeshStandardMaterial({ color:0x8b5a2b, roughness:0.78 })
      );
      handle.position.set(0, T.H + 0.045 * PADDLE_SCALE, orientation * 0.082 * PADDLE_SCALE);
      handle.rotation.y = orientation < 0 ? Math.PI : 0;
      handle.castShadow = true;
      g.add(handle);

      g.userData = { headRadius };
      return g;
    }

    const player = makePaddle(0xff4d6d, 1); tableG.add(player);
    const opp    = makePaddle(0x49dcb1, -1); tableG.add(opp);
    const playerBaseZ = T.L/2 - 0.325;
    const oppBaseZ = -T.L/2 + 0.325;
    player.position.z =  playerBaseZ; player.position.x = 0;
    opp.position.z    = oppBaseZ; opp.position.x    = 0;

    const playerPrev = new THREE.Vector3().copy(player.position);
    const oppPrev = new THREE.Vector3().copy(opp.position);
    const playerVel = new THREE.Vector3();
    const oppVel = new THREE.Vector3();
    const prevBall = new THREE.Vector3();

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
      bounces: { P: 0, O: 0 },
      serveProgress: 'awaitServeHit',
      serveTimer: 0.45,
      tmpV: new THREE.Vector3(),
      tmpN: new THREE.Vector3(),
      tmpSpin: new THREE.Vector3(),
      simPos: new THREE.Vector3(),
      simVel: new THREE.Vector3(),
      simSpin: new THREE.Vector3(),
    };

    function resetServe(){
      Sx.v.set(0,0,0);
      Sx.w.set(0,0,0);
      Sx.state='serve';
      Sx.lastTouch=null;
      Sx.bounces.P = 0;
      Sx.bounces.O = 0;
      Sx.serveProgress = 'awaitServeHit';
      Sx.serveTimer = Srv.side === 'P' ? 0.45 : 0.6;
      const side = Srv.side;
      if (side==='P'){
        ball.position.set(player.position.x, T.H + 0.14, playerBaseZ - 0.09);
      } else {
        ball.position.set(opp.position.x, T.H + 0.14, oppBaseZ + 0.09);
      }
      ballShadow.position.set(ball.position.x, T.H + 0.005, ball.position.z);
      ballShadow.scale.set(1, 1, 1);
    }

    // ---------- Input: Drag to move (player) ----------
    const ndc = new THREE.Vector2(); const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0); const hit = new THREE.Vector3();
    const bounds = {
      x: T.W/2 - 0.06,
      zNear: playerBaseZ + 0.08,
      zFar: 0.06,
    };

    const screenToXZ = (cx, cy) => { const r=renderer.domElement.getBoundingClientRect(); ndc.x=((cx-r.left)/r.width)*2-1; ndc.y=-(((cy-r.top)/r.height)*2-1); ray.setFromCamera(ndc, camera); ray.ray.intersectPlane(plane, hit); return new THREE.Vector2(hit.x/S, hit.z/S); };

    let dragging=false;
    const onDown = (e)=>{ const t=e.touches?e.touches[0]:e; const p=screenToXZ(t.clientX,t.clientY); dragging = (p.y > -0.12); if (dragging){ if (e.cancelable) e.preventDefault(); movePlayerTo(p.x,p.y); } };
    const onMove = (e)=>{ if(!dragging) return; const t=e.touches?e.touches[0]:e; if (e.cancelable) e.preventDefault(); const p=screenToXZ(t.clientX,t.clientY); movePlayerTo(p.x,p.y); };
    const onUp = ()=>{ dragging=false; };

    function movePlayerTo(x,z){
      player.position.x = THREE.MathUtils.clamp(x, -bounds.x, bounds.x);
      player.position.z = THREE.MathUtils.clamp(z, bounds.zFar, bounds.zNear);
    }

    renderer.domElement.addEventListener('touchstart', onDown, { passive:false });
    renderer.domElement.addEventListener('touchmove',  onMove,  { passive:false });
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
        const lateral = THREE.MathUtils.clamp(player.position.x, -bounds.x, bounds.x);
        const depth = THREE.MathUtils.clamp(player.position.z, bounds.zFar, bounds.zNear);
        followTarget.set(lateral * 1.12, 0, depth);
      }

      if (immediate){
        camFollow.copy(followTarget);
        camRig.curDist = camRig.dist;
        camRig.curHeight = camRig.height;
      } else {
        camFollow.lerp(followTarget, 0.2);
      }

      const lateralInfluence = THREE.MathUtils.clamp(camFollow.x / (bounds.x * 1.12), -1, 1);
      const yawTarget = camRig.yawBase + camRig.yawRange * lateralInfluence;
      if (immediate){
        camRig.curYaw = yawTarget;
      } else {
        camRig.curYaw += (yawTarget - camRig.curYaw) * 0.18;
      }

      const distTarget = camRig.dist - Math.abs(lateralInfluence) * 0.28;
      const heightTarget = camRig.height - Math.abs(lateralInfluence) * 0.08;
      if (immediate){
        camRig.curDist = distTarget;
        camRig.curHeight = heightTarget;
      } else {
        camRig.curDist += (distTarget - camRig.curDist) * 0.1;
        camRig.curHeight += (heightTarget - camRig.curHeight) * 0.1;
      }

      lookTarget.set(
        camFollow.x * S,
        (T.H - 0.04) * S,
        (camFollow.z - camRig.forwardBias) * S
      );

      backVec.set(Math.sin(camRig.curYaw), 0, Math.cos(camRig.curYaw)).multiplyScalar(camRig.curDist);
      camPos.copy(lookTarget).add(backVec);
      camPos.y = camRig.curHeight + (camRig.pitch * 5.1);

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
        camRig.dist += 0.18;
        camRig.height += 0.06;
      }
      camRig.dist = Math.max(camRig.minDist, camRig.dist - 0.4);
      camRig.height = Math.max(camRig.minHeight, camRig.height - 0.18);
      camRig.curDist = camRig.dist;
      camRig.curHeight = camRig.height;
      camRig.curYaw = camRig.yawBase;
      camFollow.copy(savedFollow);
      updateCamera(true);
    };

    // ---------- AI ----------
    const AI = { speed: 4.6, vertical: 2.8, react: 0.035, targetX: 0, targetZ: oppBaseZ, timer:0, prediction:null };

    function predictBallForSide(targetZ, direction){
      Sx.simPos.copy(ball.position);
      Sx.simVel.copy(Sx.v);
      Sx.simSpin.copy(Sx.w);
      let time = 0;
      const step = 1/240;
      for (let i = 0; i < 960; i++){
        time += step;
        Sx.simVel.addScaledVector(Sx.gravity, step);
        Sx.tmpSpin.crossVectors(Sx.simVel, Sx.simSpin).multiplyScalar(Sx.magnus * step);
        Sx.simVel.add(Sx.tmpSpin);
        Sx.simVel.multiplyScalar(Math.pow(Sx.air, step * 60));
        Sx.simPos.addScaledVector(Sx.simVel, step);

        if (Sx.simPos.y <= T.H && Sx.simVel.y < 0){
          Sx.simPos.y = T.H;
          Sx.simVel.y = -Sx.simVel.y * Sx.tableRest;
          Sx.simVel.x *= 0.985;
          Sx.simVel.z *= 0.985;
          Sx.simSpin.multiplyScalar(0.95);
        }

        if (Math.abs(Sx.simPos.z) < 0.01 && Sx.simPos.y < T.H + T.NET_H){
          Sx.simVel.z *= -Sx.netRest;
          Sx.simVel.x *= 0.94;
          Sx.simVel.y *= 0.7;
        }

        if ((direction > 0 && Sx.simPos.z >= targetZ) || (direction < 0 && Sx.simPos.z <= targetZ)){
          return { pos: Sx.simPos.clone(), vel: Sx.simVel.clone(), time };
        }

        if (Sx.simPos.y < 0.01) break;
      }
      return null;
    }

    function stepAI(dt){
      AI.timer -= dt;
      const baseZ = oppBaseZ;
      if (AI.timer <= 0){
        AI.timer = AI.react;
        AI.prediction = null;
        const movingTowardAI = Sx.v.z < -0.05;
        if (movingTowardAI && (Sx.state === 'rally' || (Sx.state === 'serve' && Srv.side === 'P' && Sx.serveProgress !== 'awaitServeHit'))){
          AI.prediction = predictBallForSide(baseZ, -1);
        }
        if (AI.prediction){
          const anticipation = Math.max(0, 1 - AI.prediction.time * 0.7);
          const aimX = THREE.MathUtils.clamp(AI.prediction.pos.x, -T.W/2 + 0.08, T.W/2 - 0.08);
          AI.targetX = THREE.MathUtils.clamp(
            aimX + (Math.random() - 0.5) * (0.12 + anticipation * 0.1),
            -bounds.x,
            bounds.x
          );
          AI.targetZ = baseZ + THREE.MathUtils.clamp(
            (AI.prediction.pos.y - T.H) * 0.32 - anticipation * 0.05,
            -0.12,
            0.18
          );
        } else {
          AI.targetX *= 0.85;
          AI.targetZ = THREE.MathUtils.lerp(AI.targetZ, baseZ, 0.5);
        }
      }

      opp.position.x += THREE.MathUtils.clamp(AI.targetX - opp.position.x, -AI.speed * dt, AI.speed * dt);
      opp.position.z += THREE.MathUtils.clamp(AI.targetZ - opp.position.z, -AI.vertical * dt, AI.vertical * dt);
    }

    // ---------- Collisions ----------
    function bounceTable(prev){
      if (Sx.state === 'dead') return false;
      if (prev.y > T.H && ball.position.y <= T.H){
        const x = ball.position.x;
        const z = ball.position.z;
        const inBounds = Math.abs(x) <= T.W/2 + 0.01 && Math.abs(z) <= T.L/2 + 0.01;
        if (!inBounds){
          const side = z >= 0 ? 'P' : 'O';
          pointTo(side === 'P' ? 'O' : 'P');
          return true;
        }

        Sx.v.y = -Sx.v.y * Sx.tableRest;
        Sx.v.x *= 0.99;
        Sx.v.z *= 0.99;
        Sx.w.multiplyScalar(0.97);
        ball.position.y = T.H;

        const side = z >= 0 ? 'P' : 'O';
        const other = side === 'P' ? 'O' : 'P';
        Sx.bounces[side] = (Sx.bounces[side] || 0) + 1;

        if (Sx.state === 'serve'){
          if (Sx.serveProgress === 'awaitServerBounce'){
            if (side === Srv.side){
              Sx.serveProgress = 'awaitReceiverBounce';
            } else {
              pointTo(other);
              return true;
            }
          } else if (Sx.serveProgress === 'awaitReceiverBounce'){
            if (side !== Srv.side){
              Sx.state = 'rally';
              Sx.serveProgress = 'live';
              Sx.bounces[other] = 0;
            } else {
              pointTo(other);
              return true;
            }
          }
        } else if (Sx.state === 'rally'){
          if (Sx.lastTouch === side){
            pointTo(other);
            return true;
          } else {
            Sx.bounces[other] = 0;
          }
        }
      }
      return false;
    }

    function hitPaddle(paddle, who, paddleVel){
      if (Sx.state === 'dead') return false;
      if (Sx.state === 'serve' && who === Srv.side && Sx.serveProgress !== 'live') return false;
      const head = paddle.children[0];
      const headRadius = paddle.userData?.headRadius || (0.092 * PADDLE_SCALE);
      const worldHeadX = paddle.position.x + head.position.x;
      const worldHeadY = head.position.y;
      const worldHeadZ = paddle.position.z + head.position.z;
      const dx = ball.position.x - worldHeadX;
      const dy = ball.position.y - worldHeadY;
      const dz = ball.position.z - worldHeadZ;
      const detection = (headRadius + BALL_R) * 1.18;
      if ((dx * dx + dy * dy + dz * dz) < detection * detection){
        const n = Sx.tmpN.set(dx, dy, dz).normalize();
        const vN = Sx.v.dot(n);
        const punch = 3.6 + Math.max(0, -vN * 1.3);
        Sx.v.addScaledVector(n, punch - vN * 1.9);
        if (paddleVel){
          Sx.v.addScaledVector(paddleVel, 0.25);
        }
        const attackSign = who === 'P' ? -1 : 1;
        Sx.v.z += attackSign * (2.35 + Math.abs(paddleVel?.z || 0) * 0.22);
        Sx.v.x += THREE.MathUtils.clamp(n.x * 1.8 + (paddleVel?.x || 0) * 0.35, -3.2, 3.2);
        Sx.w.x += (paddleVel?.z || 0) * -0.45 * attackSign;
        Sx.w.y += (paddleVel?.x || 0) * 0.4;
        Sx.w.z += -n.x * 5.1;
        ball.position.set(
          worldHeadX + n.x * (headRadius * 0.95),
          Math.max(worldHeadY + n.y * (headRadius * 0.95), T.H + BALL_R),
          worldHeadZ + n.z * (headRadius * 0.95)
        );
        Sx.state = 'rally';
        Sx.serveProgress = 'live';
        Sx.lastTouch = who;
        Sx.bounces.P = 0;
        Sx.bounces.O = 0;
        return true;
      }
      return false;
    }

    function hitNet(){
      // net as a thin box at z=0 spanning table width
      const halfW = T.W/2;
      const halfT = 0.01 + BALL_R;
      if (Math.abs(ball.position.z) < halfT && Math.abs(ball.position.x) < halfW && ball.position.y < (T.H + T.NET_H)){
        Sx.v.z *= -Sx.netRest;
        Sx.v.x *= 0.92;
        Sx.v.y *= 0.7;
      }
    }

    // ---------- Scoring & Rules ----------
    function pointTo(winner){
      if (Sx.state === 'dead') return;
      const state = uiRef.current;
      const newP = state.pScore + (winner === 'P' ? 1 : 0);
      const newO = state.oScore + (winner === 'O' ? 1 : 0);
      const total = newP + newO;
      const deuce = newP >= 10 && newO >= 10;
      const shouldSwap = deuce ? true : (total % 2 === 0);
      const currentServer = state.serving;
      const nextServing = shouldSwap ? (currentServer === 'P' ? 'O' : 'P') : currentServer;
      const gameOver = (newP >= 11 || newO >= 11) && Math.abs(newP - newO) >= 2;
      const statusMsg = gameOver ? 'Game Over — Tap Reset' : 'Drag to move';

      setUi({
        pScore: newP,
        oScore: newO,
        serving: nextServing,
        msg: statusMsg,
        gameOver,
      });

      Sx.state = 'dead';
      Sx.v.set(0,0,0);
      Sx.w.set(0,0,0);
      Sx.lastTouch = null;
      Sx.bounces.P = 0;
      Sx.bounces.O = 0;
      Srv.side = nextServing;

      timers.forEach(clearTimeout);
      timers.length = 0;

      if (!gameOver){
        timers.push(setTimeout(()=>{
          if (uiRef.current.gameOver) return;
          resetServe();
        }, 520));
      }
    }

    function checkFaults(){
      if (Sx.state === 'dead') return true;
      const x = ball.position.x;
      const z = ball.position.z;
      const y = ball.position.y;
      if (y < T.H - 0.04){
        if (Math.abs(x) > T.W/2 + 0.02 || Math.abs(z) > T.L/2 + 0.04){
          const winner = (Sx.lastTouch === 'P') ? 'O' : 'P';
          pointTo(winner);
          return true;
        }
      }
      if (Math.abs(z) < 0.025 && y < T.H + 0.02){
        const winner = (Sx.lastTouch === 'P') ? 'O' : 'P';
        pointTo(winner);
        return true;
      }
      if (Sx.state === 'serve' && Sx.serveProgress === 'awaitReceiverBounce'){
        const receiver = Srv.side === 'P' ? 'O' : 'P';
        const receiverSign = receiver === 'P' ? 1 : -1;
        if (z * receiverSign > T.L/2 + 0.04){
          pointTo(receiver);
          return true;
        }
      }
      return false;
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
        prevBall.copy(ball.position);
        const invDt = dt > 0 ? 1 / dt : 0;
        playerVel.copy(player.position).sub(playerPrev).multiplyScalar(invDt);
        oppVel.copy(opp.position).sub(oppPrev).multiplyScalar(invDt);
        playerPrev.copy(player.position);
        oppPrev.copy(opp.position);

        if (Sx.state !== 'dead'){
          if (Sx.state === 'serve'){
            const server = Srv.side === 'P' ? player : opp;
            const serverVel = Srv.side === 'P' ? playerVel : oppVel;
            const targetZ = server.position.z + (Srv.side === 'P' ? -0.14 : 0.14);
            ball.position.x = THREE.MathUtils.lerp(ball.position.x, server.position.x, 0.25);
            ball.position.z = THREE.MathUtils.lerp(ball.position.z, targetZ, 0.22);
            Sx.serveTimer -= dt;
            if (Sx.serveProgress === 'awaitServeHit' && Sx.serveTimer <= 0){
              const dir = Srv.side === 'P' ? -1 : 1;
              const aimX = THREE.MathUtils.clamp((server.position.x + serverVel.x * 0.05) * 0.35, -0.7, 0.7);
              Sx.v.set(aimX, 2.6, 1.55 * dir);
              Sx.w.set(0, dir * -4.2, 0.12 * dir);
              Sx.serveProgress = 'awaitServerBounce';
              Sx.lastTouch = Srv.side;
            }
          }

          const magnus = Sx.tmpV.crossVectors(Sx.v, Sx.w).multiplyScalar(Sx.magnus);
          Sx.v.addScaledVector(Sx.gravity, dt);
          Sx.v.addScaledVector(magnus, dt);
          Sx.v.multiplyScalar(Math.pow(Sx.air, dt * 60));
          ball.position.addScaledVector(Sx.v, dt);

          const scored = bounceTable(prevBall);
          if (!scored){
            hitNet();
            hitPaddle(player, 'P', playerVel);
            hitPaddle(opp, 'O', oppVel);
            checkFaults();
          }
        }

        ballShadow.position.set(ball.position.x, T.H + 0.005, ball.position.z);
        const sh = THREE.MathUtils.clamp(1 - (ball.position.y - T.H), 0.3, 1.05);
        ballShadow.scale.set(sh, sh, 1);
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
      renderer.domElement.removeEventListener('touchstart', onDown);
      renderer.domElement.removeEventListener('touchmove', onMove);
      renderer.domElement.removeEventListener('touchend', onUp);
      renderer.domElement.removeEventListener('mousedown', onDown);
      renderer.domElement.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      timers.forEach(clearTimeout);
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

