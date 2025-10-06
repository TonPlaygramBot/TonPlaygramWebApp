import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

let cachedSnookerCarpetTextures = null;

function makeSnookerCarpetTextures(){
  if (cachedSnookerCarpetTextures) return cachedSnookerCarpetTextures;
  if (typeof document === 'undefined'){
    cachedSnookerCarpetTextures = { carpetTexture: null, carpetBump: null };
    return cachedSnookerCarpetTextures;
  }

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#7c111f');
  gradient.addColorStop(1, '#510a15');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < size * size * 0.35; i++){
    const x = Math.random() * size;
    const y = Math.random() * size;
    const tone = 0.7 + Math.random() * 0.3;
    ctx.fillStyle = `rgba(${Math.floor(190 * tone)}, ${Math.floor(40 * tone)}, ${Math.floor(60 * tone)}, 0.45)`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }

  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#000000';
  for (let row = 0; row < size; row += 3){
    ctx.fillRect(0, row, size, 1);
  }
  ctx.globalAlpha = 1;

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  map.needsUpdate = true;
  if ('colorSpace' in map) map.colorSpace = THREE.SRGBColorSpace;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d');
  bumpCtx.drawImage(canvas, 0, 0);
  const bumpImage = bumpCtx.getImageData(0, 0, size, size);
  const bumpData = bumpImage.data;
  for (let i = 0; i < bumpData.length; i += 4){
    const avg = (bumpData[i] + bumpData[i + 1] + bumpData[i + 2]) / 3;
    const noise = (Math.random() - 0.5) * 32;
    const next = Math.min(255, Math.max(0, avg + noise));
    bumpData[i] = bumpData[i + 1] = bumpData[i + 2] = next;
  }
  bumpCtx.putImageData(bumpImage, 0, 0);
  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.anisotropy = 2;
  bump.needsUpdate = true;

  cachedSnookerCarpetTextures = { carpetTexture: map, carpetBump: bump };
  return cachedSnookerCarpetTextures;
}

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
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a14);

    const hemi = new THREE.HemisphereLight(0xfdfdf9, 0x0a1629, 0.82);
    scene.add(hemi);

    const key = new THREE.SpotLight(0xfaf4df, 1.25, 28, Math.PI / 4.4, 0.32, 1.4);
    key.position.set(-1.2, 8.6, 0);
    key.target.position.set(0, 1.1, 0);
    key.castShadow = false;
    scene.add(key);
    scene.add(key.target);

    const fill = new THREE.SpotLight(0xe8f0ff, 0.55, 26, Math.PI / 4.8, 0.45, 1.2);
    fill.position.set(1.6, 7.2, -4.5);
    fill.target.position.set(0, 1.1, -0.3);
    fill.castShadow = false;
    scene.add(fill);
    scene.add(fill.target);

    const rim = new THREE.DirectionalLight(0x7fb3ff, 0.48);
    rim.position.set(-6.2, 6.4, 7.8);
    scene.add(rim);

    const overheadRig = new THREE.Group();
    const overheadPositions = [
      [-1.8, 6.6, -1.6],
      [1.8, 6.6, -1.6],
      [-1.8, 6.6, 1.6],
      [1.8, 6.6, 1.6]
    ];
    overheadPositions.forEach(([x, y, z]) => {
      const spot = new THREE.SpotLight(0xffffff, 0.42, 18, Math.PI / 5.6, 0.5);
      spot.position.set(x, y, z);
      spot.target.position.set(0, 1, 0);
      spot.castShadow = false;
      overheadRig.add(spot);
      overheadRig.add(spot.target);
    });
    scene.add(overheadRig);

    // ---------- Camera ----------
    const camera = new THREE.PerspectiveCamera(60, host.clientWidth/host.clientHeight, 0.05, 500);
    scene.add(camera);
    const camRig = { dist: 6.8, height: 2.4, yaw: 0, pitch: 0.28 };
    const applyCam = () => { camera.aspect = host.clientWidth/host.clientHeight; camera.updateProjectionMatrix(); };

    // ---------- Table dimensions (match snooker table footprint) ----------
    const T = { L: 3.569, W: 1.778, H: 0.87, NET_H: 0.1525 };

    // Use a 1:1 scale since size already matches the field
    const S = 1;
    const tableG = new THREE.Group();
    tableG.scale.set(S, S, S);
    tableG.position.z = 0.1; // align with Air Hockey field offset
    scene.add(tableG);

    // Table top (snooker baize)
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(T.W, 0.038, T.L),
      new THREE.MeshStandardMaterial({
        color: 0x0d6934,
        roughness: 0.65,
        metalness: 0.02
      })
    );
    table.position.set(0, T.H, 0);
    table.castShadow = true;
    table.receiveShadow = true;
    tableG.add(table);

    const cushionHeight = 0.08;
    const cushionThickness = 0.12;
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x0f7c3c,
      roughness: 0.58,
      metalness: 0.03
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a1a,
      roughness: 0.55,
      metalness: 0.18
    });

    const addRail = (w, h, d, x, y, z, mat) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      rail.position.set(x, y, z);
      rail.castShadow = true;
      tableG.add(rail);
      return rail;
    };

    const railTopY = T.H + cushionHeight / 2 + 0.019;
    const cushionY = T.H + cushionHeight / 2;
    addRail(T.W + cushionThickness * 2, cushionHeight, cushionThickness, 0, cushionY, T.L / 2 + cushionThickness / 2, cushionMat);
    addRail(T.W + cushionThickness * 2, cushionHeight, cushionThickness, 0, cushionY, -T.L / 2 - cushionThickness / 2, cushionMat);
    addRail(cushionThickness, cushionHeight, T.L, T.W / 2 + cushionThickness / 2, cushionY, 0, cushionMat);
    addRail(cushionThickness, cushionHeight, T.L, -T.W / 2 - cushionThickness / 2, cushionY, 0, cushionMat);

    addRail(T.W + cushionThickness * 2, 0.05, cushionThickness * 1.12, 0, railTopY + 0.025, T.L / 2 + cushionThickness / 2, railMat);
    addRail(T.W + cushionThickness * 2, 0.05, cushionThickness * 1.12, 0, railTopY + 0.025, -T.L / 2 - cushionThickness / 2, railMat);
    addRail(cushionThickness * 1.12, 0.05, T.L, T.W / 2 + cushionThickness / 2, railTopY + 0.025, 0, railMat);
    addRail(cushionThickness * 1.12, 0.05, T.L, -T.W / 2 - cushionThickness / 2, railTopY + 0.025, 0, railMat);

    // White lines
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });
    const mkLine = (w,h,d,x,y,z)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), lineMat); m.position.set(x,y,z); tableG.add(m); };
    const lt=0.01; // line thickness meters
    // Sidelines
    mkLine(lt, 0.045, T.L, -T.W/2+lt/2, T.H+0.022, 0);
    mkLine(lt, 0.045, T.L,  T.W/2-lt/2, T.H+0.022, 0);
    // End lines
    mkLine(T.W, 0.045, lt, 0, T.H+0.022,  T.L/2-lt/2);
    mkLine(T.W, 0.045, lt, 0, T.H+0.022, -T.L/2+lt/2);
    // Center line (for doubles look)
    mkLine(lt, 0.045, T.L, 0, T.H+0.022, 0);

    // Net & posts
    const netGroup = new THREE.Group();
    tableG.add(netGroup);
    const hexTex = makeHexTexture(1024, 256, 9);
    const netMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: hexTex,
      transparent: true,
      roughness: 0.55
    });
    const netPlane = new THREE.Mesh(new THREE.PlaneGeometry(T.W + 0.2, T.NET_H), netMat);
    netPlane.position.set(0, T.H + T.NET_H / 2, 0);
    netGroup.add(netPlane);
    const tape = new THREE.Mesh(
      new THREE.BoxGeometry(T.W + 0.22, 0.024, 0.012),
      new THREE.MeshStandardMaterial({ color: 0xf2f5f9, roughness: 0.35 })
    );
    tape.position.set(0, T.H + T.NET_H + 0.012, 0);
    netGroup.add(tape);
    const netCol = new THREE.Mesh(
      new THREE.BoxGeometry(T.W + 0.24, T.NET_H, 0.01),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06 })
    );
    netCol.position.set(0, T.H + T.NET_H / 2, 0);
    netGroup.add(netCol);
    const postGeo = new THREE.CylinderGeometry(0.018, 0.018, T.NET_H + 0.12, 24);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xcfd8e3, roughness: 0.35, metalness: 0.4 });
    const postL = new THREE.Mesh(postGeo, postMat);
    postL.position.set(-T.W / 2 - 0.05, T.H + T.NET_H / 2, 0);
    postL.castShadow = true;
    tableG.add(postL);
    const postR = postL.clone();
    postR.position.x = T.W / 2 + 0.05;
    tableG.add(postR);

    // Legs
    const legExtra = 0.1; // extend legs slightly below floor
    const legH = T.H - 0.02 + legExtra;
    const legGeo = new THREE.CylinderGeometry(0.05, 0.05, legH, 12);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.78, metalness: 0.1 });
    const legOffsetX = T.W/2 - 0.15;
    const legOffsetZ = T.L/2 - 0.3;
    [[-legOffsetX,-legOffsetZ],[legOffsetX,-legOffsetZ],[-legOffsetX,legOffsetZ],[legOffsetX,legOffsetZ]].forEach(([x,z])=>{
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, (T.H - 0.02) - legH/2, z);
      leg.castShadow = true;
      tableG.add(leg);
    });

    // floor & arena dressing inspired by snooker arena
    const { carpetTexture, carpetBump } = makeSnookerCarpetTextures();
    const arenaWidth = 18;
    const arenaDepth = 26;
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xb01224,
      roughness: 0.9,
      metalness: 0.05
    });
    if (carpetTexture) {
      floorMat.map = carpetTexture;
      floorMat.map.repeat.set(arenaWidth / 8, arenaDepth / 8);
      floorMat.map.needsUpdate = true;
    }
    if (carpetBump) {
      floorMat.bumpMap = carpetBump;
      floorMat.bumpScale = 0.25;
      floorMat.bumpMap.repeat.set(arenaWidth / 8, arenaDepth / 8);
      floorMat.bumpMap.needsUpdate = true;
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(arenaWidth, arenaDepth), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xe8edf4,
      roughness: 0.88,
      metalness: 0.08
    });
    const wallHeight = 6.4;
    const wallThickness = 0.6;
    const halfW = arenaWidth / 2;
    const halfD = arenaDepth / 2;

    const buildWall = (w, h, d, x, z, ry = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      mesh.position.set(x, h / 2, z);
      mesh.rotation.y = ry;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };

    buildWall(arenaWidth, wallHeight, wallThickness, 0, -halfD + wallThickness / 2);
    buildWall(arenaWidth, wallHeight, wallThickness, 0, halfD - wallThickness / 2);
    buildWall(wallThickness, wallHeight, arenaDepth, -halfW + wallThickness / 2, 0);
    buildWall(wallThickness, wallHeight, arenaDepth, halfW - wallThickness / 2, 0);

    addBillboardsAndScreens();
    addBroadcastCameras();

    function makeSignageTexture({ title, subtitle, accent = '#38bdf8', background = ['#0b1220', '#131c32'] }) {
      if (typeof document === 'undefined') return null;
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, background[0]);
      gradient.addColorStop(1, background[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = accent;
      ctx.fillRect(0, canvas.height * 0.82, canvas.width, canvas.height * 0.18);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 120px "Segoe UI", "Helvetica Neue", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title.toUpperCase(), canvas.width / 2, canvas.height * 0.42);

      if (subtitle) {
        ctx.fillStyle = '#dbeafe';
        ctx.font = '600 72px "Segoe UI", "Helvetica Neue", sans-serif';
        ctx.fillText(subtitle.toUpperCase(), canvas.width / 2, canvas.height * 0.68);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy?.() || 4;
      texture.needsUpdate = true;
      if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    function makeScreenMaterial(texture) {
      const material = new THREE.MeshBasicMaterial({ toneMapped: false });
      if (texture) material.map = texture;
      else material.color = new THREE.Color(0x0f172a);
      return material;
    }

    function createBillboard(texture) {
      const width = 9.6;
      const height = 4.2;
      const depth = 0.6;
      const frame = new THREE.Group();
      const frameMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.48, metalness: 0.58 })
      );
      frame.add(frameMesh);
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.92, height * 0.82),
        makeScreenMaterial(texture)
      );
      screen.position.z = depth / 2 + 0.02;
      frame.add(screen);
      return frame;
    }

    function createArenaTv(texture) {
      const width = 7.2;
      const height = 4.4;
      const depth = 0.36;
      const group = new THREE.Group();
      const bezel = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.4, metalness: 0.6 })
      );
      group.add(bezel);
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.92, height * 0.88),
        makeScreenMaterial(texture)
      );
      screen.position.z = depth / 2 + 0.02;
      group.add(screen);
      const mount = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.12, height * 0.4, depth * 0.4),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.5 })
      );
      mount.position.set(0, -height * 0.58, -depth * 0.4);
      group.add(mount);
      return group;
    }

    function addBillboardsAndScreens(){
      const wallInset = wallThickness / 2 + 0.28;
      const signageY = wallHeight * 0.58;
      const frontZ = -halfD + wallInset;
      const backZ = halfD - wallInset;
      const leftX = -halfW + wallInset;
      const rightX = halfW - wallInset;

      const billboardTexture = makeSignageTexture({
        title: 'TonPlaygram Championship',
        subtitle: 'Table Tennis Showdown',
        accent: '#2563eb',
        background: ['#0f172a', '#1f2937']
      });
      const tvTexture = makeSignageTexture({
        title: 'Live Broadcast',
        subtitle: 'Powered by 3D Snooker Studio',
        accent: '#38bdf8',
        background: ['#041127', '#0b1f3d']
      });

      [
        { type: 'tv', position: [0, signageY, frontZ], rotationY: 0 },
        { type: 'tv', position: [0, signageY, backZ], rotationY: Math.PI },
        { type: 'billboard', position: [leftX, signageY, 0], rotationY: Math.PI / 2 },
        { type: 'billboard', position: [rightX, signageY, 0], rotationY: -Math.PI / 2 }
      ].forEach(({ type, position, rotationY }) => {
        const assembly = type === 'tv'
          ? createArenaTv(tvTexture)
          : createBillboard(billboardTexture);
        assembly.position.set(position[0], position[1], position[2]);
        assembly.rotation.y = rotationY;
        scene.add(assembly);
      });
    }

    function createBroadcastCamera(){
      const group = new THREE.Group();
      const legLength = 1.4;
      const legMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.55, metalness: 0.35 });
      const legGeo = new THREE.CylinderGeometry(0.045, 0.05, legLength, 12);
      const placements = [
        [-0.28, legLength / 2, 0.22, 0.32],
        [0.26, legLength / 2, 0.24, -0.34],
        [0.08, legLength / 2, -0.32, -0.12]
      ];
      placements.forEach(([x, y, z, tilt]) => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(x, y, z);
        leg.rotation.x = tilt;
        group.add(leg);
      });

      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.3, 0.32),
        new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 0.48, metalness: 0.5 })
      );
      head.position.set(0, legLength + 0.16, 0);
      group.add(head);

      const accent = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.08, 0.34),
        new THREE.MeshStandardMaterial({ color: 0x1d4ed8, emissive: new THREE.Color(0x0f1d4f), emissiveIntensity: 0.32, roughness: 0.35 })
      );
      accent.position.set(0, legLength + 0.1, 0);
      group.add(accent);

      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.3, 18),
        new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.3, metalness: 0.65 })
      );
      lens.rotation.z = Math.PI / 2;
      lens.position.set(0.36, legLength + 0.16, 0);
      group.add(lens);

      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.42, 12),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })
      );
      handle.rotation.z = THREE.MathUtils.degToRad(32);
      handle.position.set(-0.32, legLength + 0.1, -0.18);
      group.add(handle);

      return group;
    }

    function addBroadcastCameras(){
      const target = new THREE.Vector3(0, T.H - 0.08, 0);
      const radiusX = T.W / 2 + 1.6;
      const radiusZ = T.L / 2 + 1.4;
      const positions = [
        [radiusX, 0, radiusZ],
        [-radiusX, 0, radiusZ],
        [radiusX, 0, -radiusZ],
        [-radiusX, 0, -radiusZ]
      ];
      positions.forEach(([x, y, z]) => {
        const cam = createBroadcastCamera();
        cam.position.set(x, y, z);
        cam.lookAt(target);
        scene.add(cam);
      });
    }

    // ---------- Rackets (paddles) ----------
    const PADDLE_SCALE = 2;
    const BALL_R = 0.024 * PADDLE_SCALE;
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
      new THREE.SphereGeometry(BALL_R, 32, 28),
      new THREE.MeshStandardMaterial({ color: 0xf9f3de, roughness: 0.3, metalness: 0.05 })
    );
    ball.castShadow = true;
    tableG.add(ball);
    const ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(BALL_R * 1.5, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
    );
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.position.y = T.H + 0.01;
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

    function movePlayerTo(x,z){ player.position.x = THREE.MathUtils.clamp(x, -bounds.x, bounds.x); player.position.z = THREE.MathUtils.clamp(z, bounds.zFar, bounds.zNear); }

    renderer.domElement.addEventListener('touchstart', onDown, { passive:true });
    renderer.domElement.addEventListener('touchmove',  onMove,  { passive:true });
    renderer.domElement.addEventListener('touchend',   onUp,    { passive:true });
    renderer.domElement.addEventListener('mousedown',  onDown);
    renderer.domElement.addEventListener('mousemove',  onMove);
    window.addEventListener('mouseup', onUp);

    const camPos = new THREE.Vector3();
    function updateCamera(){
      const target = new THREE.Vector3(0, T.H - 0.1, 0);
      const yaw = camRig.yaw;
      const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(camRig.dist);
      camPos.copy(target).add(back); camPos.y = camRig.height + (camRig.pitch * 6);
      camera.position.copy(camPos);
      camera.lookAt(0, T.H - 0.1, 0);
    }

    // ensure table fits view similar to Air Hockey
    const corners = [
      new THREE.Vector3(-T.W/2, T.H, -T.L/2),
      new THREE.Vector3(T.W/2, T.H, -T.L/2),
      new THREE.Vector3(-T.W/2, T.H, T.L/2),
      new THREE.Vector3(T.W/2, T.H, T.L/2)
    ];
    const toNDC = v => v.clone().project(camera);
    const ensureFit = () => {
      for (let i = 0; i < 20; i++) {
        updateCamera();
        const over = corners.some(c => {
          const p = toNDC(c);
          return Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
        });
        if (!over) break;
        camRig.dist += 0.2;
        camRig.height += 0.07;
      }
      updateCamera();
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
        ballShadow.position.set(ball.position.x, T.H + 0.01, ball.position.z);
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

function makeHexTexture(w = 1024, h = 256, r = 10) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,0)';
  x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,255,255,0.88)';
  x.lineWidth = 1.4;
  const dx = r * Math.sqrt(3);
  const dy = r * 1.5;
  function hex(cx, cy) {
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.closePath();
    x.stroke();
  }
  for (let y = 0; y < h + dy; y += dy) {
    for (let x0 = 0; x0 < w + dx; x0 += dx) {
      hex(x0 + (Math.floor(y / dy) % 2 ? dx / 2 : 0), y);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

