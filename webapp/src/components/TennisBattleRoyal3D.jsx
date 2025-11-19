import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function buildRoyalGrandstand() {
  const group = new THREE.Group();
  const seatMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x15306d,
    roughness: 0.3,
    metalness: 0.18,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25
  });
  const frameMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x2b303a,
    roughness: 0.55,
    metalness: 0.35
  });
  const concreteMaterial = new THREE.MeshStandardMaterial({
    color: 0x7b7b7b,
    roughness: 0.84,
    metalness: 0.05
  });

  const seatGeo = new THREE.BoxGeometry(1.25, 0.16, 1.1);
  const backGeo = new THREE.BoxGeometry(1.25, 0.82, 0.12);
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);

  function buildTier(offsetX, baseY, depthOffset) {
    const tier = new THREE.Group();
    const seatsPerRow = 18;
    const rows = 8;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < seatsPerRow; c += 1) {
        if (Math.abs(c - seatsPerRow / 2) <= 0.5) continue;
        const x = offsetX + (c - seatsPerRow / 2) * 1.7;
        const y = baseY + r * 0.78;
        const z = depthOffset - r * 1.8;
        const seat = new THREE.Mesh(seatGeo, seatMaterial);
        seat.position.set(x, y, z);
        const back = new THREE.Mesh(backGeo, seatMaterial);
        back.position.set(x, y + 0.46, z - 0.55);
        const legL = new THREE.Mesh(legGeo, frameMaterial);
        legL.position.set(x - 0.55, y - 0.35, z + 0.35);
        const legR = legL.clone();
        legR.position.x = x + 0.55;
        tier.add(seat, back, legL, legR);
      }
      const tread = new THREE.Mesh(new THREE.BoxGeometry(32, 0.32, 1.7), concreteMaterial);
      tread.position.set(offsetX, baseY + r * 0.78 - 0.38, depthOffset - r * 1.8 - 0.85);
      tier.add(tread);
    }
    return tier;
  }

  const tiers = [
    { baseY: 0, depth: 0 },
    { baseY: 5.6, depth: -15 },
    { baseY: 11.2, depth: -30 },
    { baseY: 16.8, depth: -45 }
  ];
  tiers.forEach(({ baseY, depth }) => {
    group.add(buildTier(-15, baseY, depth));
    group.add(buildTier(15, baseY, depth));
    const walkway = new THREE.Mesh(new THREE.BoxGeometry(68, 0.42, 6), concreteMaterial);
    walkway.position.set(0, baseY - 0.44, depth - 6);
    walkway.receiveShadow = true;
    group.add(walkway);
  });

  const suiteHeight = tiers[tiers.length - 1].baseY + 0.78 * 7 + 1.2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(72, 0.5, 14), concreteMaterial);
  deck.position.set(0, suiteHeight, -42);
  deck.castShadow = deck.receiveShadow = true;
  group.add(deck);

  const suiteMaterial = new THREE.MeshStandardMaterial({ color: 0x3a414d, roughness: 0.52, metalness: 0.45 });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xbfd9ff,
    roughness: 0.1,
    transmission: 0.85,
    transparent: true,
    opacity: 0.65,
    ior: 1.45
  });
  for (let i = -2; i <= 2; i += 1) {
    const x = i * 12;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 11), suiteMaterial);
    frame.position.set(x, suiteHeight + 2.3, -45);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), glassMaterial);
    glass.position.set(x, suiteHeight + 2.3, -39);
    group.add(frame, glass);
  }

  const roofMat = new THREE.MeshPhysicalMaterial({
    color: 0x1c2430,
    roughness: 0.34,
    metalness: 0.55,
    clearcoat: 0.35,
    clearcoatRoughness: 0.22,
    side: THREE.DoubleSide
  });
  const roofGeo = new THREE.PlaneGeometry(96, 110, 16, 8);
  const attr = roofGeo.attributes.position;
  for (let i = 0; i < attr.count; i += 1) {
    const x = attr.getX(i);
    const y = attr.getY(i);
    const arch = Math.pow(Math.max(0, 1 - (x / 48) ** 2), 1.1);
    const drop = Math.pow((y + 55) / 110, 1.6) * 8;
    attr.setZ(i, 9 + arch * 11 - drop);
  }
  attr.needsUpdate = true;
  roofGeo.computeVertexNormals();
  roofGeo.rotateX(-Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, suiteHeight + 6.4, -52);
  group.add(roof);

  group.scale.setScalar(0.35);
  group.position.y = 0.1;
  return group;
}

function buildGrandEntranceStairs({
  stepCount = 12,
  run = 0.46,
  rise = 0.22,
  width = 26,
  landingDepth = 1.6
} = {}) {
  const stairs = new THREE.Group();
  const treadMat = new THREE.MeshStandardMaterial({ color: 0xcdd5e0, roughness: 0.82, metalness: 0.12 });
  const riserMat = new THREE.MeshStandardMaterial({ color: 0xb3bdcc, roughness: 0.78, metalness: 0.18 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x8f9bb0, roughness: 0.7, metalness: 0.22 });

  for (let i = 0; i < stepCount; i += 1) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(run, rise, width), treadMat);
    tread.position.set((i + 0.5) * run, (i + 0.5) * rise, 0);
    stairs.add(tread);

    if (i < stepCount - 1) {
      const riser = new THREE.Mesh(new THREE.BoxGeometry(0.04, rise, width * 0.98), riserMat);
      riser.position.set((i + 1) * run, (i + 0.5) * rise, 0);
      stairs.add(riser);
    }
  }

  const landing = new THREE.Mesh(new THREE.BoxGeometry(landingDepth, rise * 0.72, width * 1.05), treadMat);
  landing.position.set(stepCount * run + landingDepth / 2, stepCount * rise + (rise * 0.72) / 2, 0);
  stairs.add(landing);

  const sideHeight = stepCount * rise + rise * 0.72;
  const sideThickness = 0.12;
  const side = new THREE.BoxGeometry(stepCount * run + landingDepth, sideHeight, sideThickness);
  const sideL = new THREE.Mesh(side, sideMat);
  sideL.position.set((stepCount * run + landingDepth) / 2, sideHeight / 2, width / 2 + sideThickness / 2);
  const sideR = sideL.clone();
  sideR.position.z = -width / 2 - sideThickness / 2;
  stairs.add(sideL, sideR);

  return stairs;
}

function buildBroadcastCameraRig(scale = 1) {
  const group = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.62, metalness: 0.3 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.42, metalness: 0.28 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.25, metalness: 0.12 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.58, metalness: 0.2 });

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.12, 14), legMat);
  hub.position.y = 0.08;
  group.add(hub);

  const legGeo = new THREE.CylinderGeometry(0.04, 0.02, 0.92, 10);
  const footGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 14);
  const spread = 0.82;
  const tilt = THREE.MathUtils.degToRad(18);
  for (let i = 0; i < 3; i += 1) {
    const ang = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(Math.cos(ang) * spread * 0.45, 0.58, Math.sin(ang) * spread * 0.45);
    leg.quaternion.setFromAxisAngle(new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang)).normalize(), tilt);
    group.add(leg);

    const foot = new THREE.Mesh(footGeo, gripMat);
    foot.position.set(Math.cos(ang) * spread, 0.02, Math.sin(ang) * spread);
    group.add(foot);
  }

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.96;
  group.add(headPivot);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.28, 0.3), bodyMat);
  body.position.set(0, 0.08, -0.06);
  headPivot.add(body);

  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 20), accentMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.04, 0.28);
  headPivot.add(lens);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.32), gripMat);
  visor.position.set(0, 0.22, 0.04);
  headPivot.add(visor);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.48, 12), gripMat);
  handle.rotation.z = Math.PI / 2.2;
  handle.position.set(0.32, -0.08, 0.02);
  headPivot.add(handle);

  group.scale.setScalar(scale);
  return { group, headPivot };
}

export default function TennisBattleRoyal3D({ playerName, stakeLabel }) {
  const containerRef = useRef(null);
  const playerLabel = playerName || 'You';
  const cpuLabel = 'CPU';
  const suffixParts = [];
  if (playerName) suffixParts.push(`${playerName} vs AI`);
  if (stakeLabel) suffixParts.push(`Stake ${stakeLabel}`);
  const matchTag = suffixParts.join(' · ');
  const introMessage = 'Swipe & Hit';
  const [msg, setMsg] = useState(introMessage);
  const [hudInfo, setHudInfo] = useState(() => ({
    points: '0 - 0',
    games: '0 - 0',
    sets: '0 - 0',
    server: playerLabel,
    side: 'deuce',
    attempts: 2,
    playerSets: 0,
    cpuSets: 0,
    playerGames: 0,
    cpuGames: 0,
    playerPointLabel: '0',
    cpuPointLabel: '0'
  }));
  const [scoreboardOpen, setScoreboardOpen] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    let W = Math.max(1, container.clientWidth || window.innerWidth || 360);
    let H = Math.max(1, container.clientHeight || window.innerHeight || 640);
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.55;
    renderer.shadowMap.enabled = false;
    renderer.setClearColor(0x87ceeb, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    const camera = new THREE.PerspectiveCamera(56, W / H, 0.05, 800);

    const courtL = 23.77;
    const courtW = 9.2;
    const halfW = courtW / 2;
    const halfL = courtL / 2;
    const SERVICE_LINE_Z = 6.4;
    const SERVICE_BOX_INNER = 0.2;

    const playerZ = halfL - 1.35;
    const cpuZ = -halfL + 1.35;

    let camBack = 8.0;
    let camHeight = 3.8;
    const cameraMinZ = 1.2;
    const cameraMaxZ = halfL + 2.6;

    const hemi = new THREE.HemisphereLight(0xf2f6ff, 0xb7d4a8, 1.05);
    hemi.position.set(0, 60, 0);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff6cf, 1.35);
    sun.position.set(-28, 52, 24);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(18, 32, -16);
    scene.add(fill);
    const bounce = new THREE.AmbientLight(0xe5f1ff, 0.18);
    scene.add(bounce);

    const maxAniso = renderer.capabilities.getMaxAnisotropy?.() || 8;
    const grassURL = 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg';

    const skyGeo = new THREE.SphereGeometry(420, 48, 32);
    const colors = [];
    const topColor = new THREE.Color(0x8fc9ff);
    const horizonColor = new THREE.Color(0xdaf1ff);
    const positionAttr = skyGeo.attributes.position;
    for (let i = 0; i < positionAttr.count; i += 1) {
      const y = positionAttr.getY(i);
      const t = THREE.MathUtils.clamp((y + 420) / 420, 0, 1);
      const color = topColor.clone().lerp(horizonColor, Math.pow(1 - t, 0.6));
      colors.push(color.r, color.g, color.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(
      skyGeo,
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })
    );
    sky.position.y = -18;
    scene.add(sky);

    const matGrass = new THREE.MeshStandardMaterial({
      color: 0x4fa94c,
      roughness: 0.9,
      metalness: 0.0,
      emissive: new THREE.Color('#1c5c22'),
      emissiveIntensity: 0.03
    });

    function loadDeshadowedGrass(url, onReady) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const aspect = img.height / img.width;
        const w = 1024;
        const h = Math.round(w * aspect);
        const base = document.createElement('canvas');
        base.width = w;
        base.height = h;
        const gb = base.getContext('2d');
        gb.drawImage(img, 0, 0, w, h);
        const small = document.createElement('canvas');
        small.width = Math.max(64, w >> 4);
        small.height = Math.max(64, h >> 4);
        const gs = small.getContext('2d');
        gs.imageSmoothingEnabled = true;
        gs.drawImage(base, 0, 0, small.width, small.height);
        const blur = document.createElement('canvas');
        blur.width = w;
        blur.height = h;
        const gl = blur.getContext('2d');
        gl.imageSmoothingEnabled = true;
        gl.drawImage(small, 0, 0, w, h);

        const src = gb.getImageData(0, 0, w, h);
        const low = gl.getImageData(0, 0, w, h);
        const d = src.data;
        const b = low.data;
        const eps = 1e-3;
        const target = 138;
        for (let i = 0; i < d.length; i += 4) {
          const L = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2];
          const k = target / (L + eps);
          d[i] = Math.max(0, Math.min(255, d[i] * k));
          d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * k));
          d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * k));
        }
        gb.putImageData(src, 0, 0);
        gb.globalCompositeOperation = 'overlay';
        gb.fillStyle = 'rgba(40,120,44,0.08)';
        gb.fillRect(0, 0, w, h);
        gb.globalCompositeOperation = 'source-over';

        const tex = new THREE.CanvasTexture(base);
        tex.anisotropy = Math.min(16, maxAniso);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
        else tex.encoding = THREE.sRGBEncoding;
        tex.repeat.set(8, 18);
        onReady(tex);
      };
      img.src = url;
    }

    function courtLinesTex(w = 2048, h = 4096) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.clearRect(0, 0, w, h);
      const s = h / courtL;
      const lineW = 12;
      g.strokeStyle = '#ffffff';
      g.lineWidth = lineW;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      const X = (x) => w / 2 + x * s;
      const Z = (z) => h / 2 + z * s;
      const line = (x1, z1, x2, z2) => {
        g.beginPath();
        g.moveTo(X(x1), Z(z1));
        g.lineTo(X(x2), Z(z2));
        g.stroke();
      };
      const box = (x1, z1, x2, z2) => {
        line(x1, z1, x2, z1);
        line(x2, z1, x2, z2);
        line(x2, z2, x1, z2);
        line(x1, z2, x1, z1);
      };
      box(-halfW, -halfL, halfW, halfL);
      line(-halfW, -halfL, halfW, -halfL);
      line(-halfW, halfL, halfW, halfL);
      line(-halfW, -SERVICE_LINE_Z, halfW, -SERVICE_LINE_Z);
      line(-halfW, SERVICE_LINE_Z, halfW, SERVICE_LINE_Z);
      line(0, -SERVICE_LINE_Z, 0, SERVICE_LINE_Z);
      g.fillStyle = '#ffffff';
      const padLenM = 1.2;
      const padWideM = 0.2;
      const z0 = -padLenM / 2;
      const z1 = padLenM / 2;
      const pxW = padWideM * s;
      const hgt = Math.abs(Z(z1) - Z(z0));
      g.fillRect(X(-halfW - padWideM / 2), Math.min(Z(z0), Z(z1)), pxW, hgt);
      g.fillRect(X(halfW - padWideM / 2), Math.min(Z(z0), Z(z1)), pxW, hgt);
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = Math.min(16, maxAniso);
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.needsUpdate = true;
      return t;
    }

    const matLines = new THREE.MeshBasicMaterial({
      map: courtLinesTex(),
      transparent: true,
      opacity: 0.995,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      depthWrite: false
    });

    function trackTex(w = 1024, h = 1024) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '#b33a2c';
      g.fillRect(0, 0, w, h);
      const dots = Math.floor(w * h * 0.004);
      for (let i = 0; i < dots; i += 1) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = Math.random() * 1.6 + 0.2;
        g.fillStyle = Math.random() < 0.5 ? 'rgba(255,190,180,0.35)' : 'rgba(40,12,10,0.35)';
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = Math.min(16, maxAniso);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace;
      else t.encoding = THREE.sRGBEncoding;
      t.repeat.set(1, 1);
      return t;
    }
    const matTrack = new THREE.MeshStandardMaterial({ map: trackTex(), roughness: 0.96, metalness: 0.0 });

    const apron = 2.6;
    const trackMesh = new THREE.Mesh(new THREE.PlaneGeometry(courtW + apron * 2, courtL + apron * 2), matTrack);
    trackMesh.rotation.x = -Math.PI / 2;
    trackMesh.position.y = -0.001;
    scene.add(trackMesh);

    const grassMesh = new THREE.Mesh(new THREE.PlaneGeometry(courtW, courtL), matGrass);
    grassMesh.rotation.x = -Math.PI / 2;
    grassMesh.position.y = 0.0;
    scene.add(grassMesh);

    const linesMesh = new THREE.Mesh(new THREE.PlaneGeometry(courtW, courtL), matLines);
    linesMesh.rotation.x = -Math.PI / 2;
    linesMesh.position.y = 0.002;
    scene.add(linesMesh);

    loadDeshadowedGrass(grassURL, (tex) => {
      matGrass.map = tex;
      matGrass.needsUpdate = true;
    });

    function tennisNetTex(w = 1024, h = 512, cell = 8, thickness = 2) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(18,18,18,0.96)';
      g.lineWidth = thickness;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      for (let y = cell; y <= h - cell; y += cell) {
        g.beginPath();
        g.moveTo(cell, y);
        g.lineTo(w - cell, y);
        g.stroke();
      }
      for (let x = cell; x <= w - cell; x += cell) {
        g.beginPath();
        g.moveTo(x, cell);
        g.lineTo(x, h - cell);
        g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.06)';
      for (let y = cell; y <= h - cell; y += cell) {
        for (let x = cell; x <= w - cell; x += cell) {
          g.fillRect(x - 1, y - 1, 2, 2);
        }
      }
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = Math.min(8, maxAniso);
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    }

    const matTape = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const matPost = new THREE.MeshStandardMaterial({ color: 0xb7bcc7, roughness: 0.45, metalness: 0.35 });
    const netH = 0.914;
    const netW = courtW;
    const netTex = tennisNetTex(1024, 512, 7, 2);
    const netMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(netW, netH, 1, 1),
      new THREE.MeshStandardMaterial({ map: netTex, roughness: 0.8, metalness: 0.0, transparent: true, opacity: 1.0, color: 0xffffff })
    );
    netMesh.position.set(0, netH / 2, 0);
    scene.add(netMesh);
    const tapeH = 0.09;
    const topTape = new THREE.Mesh(new THREE.BoxGeometry(netW, tapeH, 0.02), matTape);
    topTape.position.set(0, netH - tapeH / 2, 0.005);
    scene.add(topTape);
    const botTape = new THREE.Mesh(new THREE.BoxGeometry(netW, tapeH, 0.02), matTape);
    botTape.position.set(0, tapeH / 2, 0.005);
    scene.add(botTape);
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.35, 16), matPost);
    postL.position.set(-netW / 2, 0.675, 0);
    scene.add(postL);
    const postR = postL.clone();
    postR.position.x = netW / 2;
    scene.add(postR);
    const capL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), matPost);
    capL.position.set(-netW / 2, 1.35, 0);
    scene.add(capL);
    const capR = capL.clone();
    capR.position.x = netW / 2;
    scene.add(capR);

    const stand = buildRoyalGrandstand();
    const baseGap = 8;
    const sideGap = 9;
    const north = stand.clone();
    north.position.z = -(halfL + baseGap);
    const south = stand.clone();
    south.rotation.y = Math.PI;
    south.position.z = halfL + baseGap;
    const east = stand.clone();
    east.rotation.y = -Math.PI / 2;
    east.position.x = halfW + sideGap;
    const west = stand.clone();
    west.rotation.y = Math.PI / 2;
    west.position.x = -(halfW + sideGap);
    const eastRear = stand.clone();
    eastRear.rotation.y = -Math.PI / 2;
    eastRear.position.x = halfW + sideGap + 7.8;
    const westRear = stand.clone();
    westRear.rotation.y = Math.PI / 2;
    westRear.position.x = -(halfW + sideGap + 7.8);
    scene.add(north, south, east, west, eastRear, westRear);

    const stairsEast = buildGrandEntranceStairs({ width: courtL + apron * 1.2 });
    stairsEast.position.set(halfW + apron + 0.4, 0, 0);
    const stairsWest = stairsEast.clone();
    stairsWest.rotation.y = Math.PI;
    stairsWest.position.set(-(halfW + apron + 0.4), 0, 0);
    scene.add(stairsEast, stairsWest);

    const cameraFocus = new THREE.Vector3(0, 1.18, 0);
    const cameraRigs = [
      { position: new THREE.Vector3(-halfW - 1.6, 0, halfL + 2.4) },
      { position: new THREE.Vector3(halfW + 1.6, 0, -halfL - 2.6) },
      { position: new THREE.Vector3(0, 0, -halfL - 2.9) }
    ];
    cameraRigs.forEach(({ position }) => {
      const rig = buildBroadcastCameraRig(0.58);
      rig.group.position.copy(position);
      rig.group.rotation.y = Math.atan2(cameraFocus.x - position.x, cameraFocus.z - position.z);
      rig.headPivot.up.set(0, 1, 0);
      rig.headPivot.lookAt(cameraFocus);
      scene.add(rig.group);
    });

    const ump = new THREE.Group();
    const legH = 1.45;
    const legR = 0.035;
    const span = 0.6;
    const legMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.6, metalness: 0.2 });
    for (let sx of [-1, 1]) {
      for (let sz of [-1, 1]) {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR, legH, 12), legMat);
        cyl.position.set((sx * span) / 2, legH / 2, (sz * span) / 2);
        ump.add(cyl);
      }
    }
    const plat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.72), new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.7, metalness: 0.15 }));
    plat.position.y = legH + 0.03;
    ump.add(plat);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.6 }));
    seat.position.set(0, legH + 0.36, 0);
    ump.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.04), new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.6 }));
    back.position.set(0, legH + 0.56, -0.18);
    ump.add(back);
    const ladder = new THREE.Group();
    const railMat = new THREE.MeshStandardMaterial({ color: 0xbfbfbf, roughness: 0.55 });
    const railL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 10), railMat);
    railL.position.set(-0.28, 0.6, 0.42);
    ladder.add(railL);
    const railR2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 10), railMat);
    railR2.position.set(0.28, 0.6, 0.42);
    ladder.add(railR2);
    for (let i = 0; i < 5; i += 1) {
      const y = 0.18 + i * 0.2;
      const step = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.52, 10), railMat);
      step.rotation.z = Math.PI / 2;
      step.position.set(0, y, 0.42);
      ladder.add(step);
    }
    ump.add(ladder);
    ump.position.set(halfW + 0.75, 0, 0.1);
    scene.add(ump);

    class EllipseCurve3D extends THREE.Curve {
      constructor(a = 0.74, b = 0.92) {
        super();
        this.a = a;
        this.b = b;
      }
      getPoint(t) {
        const ang = t * 2 * Math.PI;
        return new THREE.Vector3(this.a * Math.cos(ang), 0, this.b * Math.sin(ang));
      }
    }

    function buildRacketURT() {
      const g = new THREE.Group();
      const a = 0.74;
      const b = 0.92;
      const tubeRad = 0.032;
      const ellipse = new EllipseCurve3D(a, b);
      const hoopGeo = new THREE.TubeGeometry(ellipse, 220, tubeRad, 20, true);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.55, roughness: 0.38 });
      const hoop = new THREE.Mesh(hoopGeo, frameMat);
      g.add(hoop);
      const bump = new THREE.Mesh(new THREE.TorusGeometry(a * 0.985, 0.008, 10, 160), new THREE.MeshStandardMaterial({ color: 0x1a1f27, roughness: 0.6 }));
      bump.rotation.x = Math.PI / 2;
      bump.scale.z = b / a;
      bump.position.y = 0.009;
      g.add(bump);
      const strings = new THREE.Group();
      const sMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.35, metalness: 0.0 });
      const count = 22;
      const innerA = a - tubeRad * 1.05;
      const innerB = b - tubeRad * 1.05;
      const thick = 0.008;
      for (let i = -(count / 2); i <= count / 2; i += 1) {
        const x = (i * (innerA * 1.7)) / count;
        if (Math.abs(x) >= innerA) continue;
        const zmax = innerB * Math.sqrt(Math.max(0, 1 - (x / innerA) * (x / innerA)));
        const len = Math.max(0.02, zmax * 2 * 0.98);
        const geo = new THREE.BoxGeometry(thick, thick, len);
        const mesh = new THREE.Mesh(geo, sMat);
        mesh.position.set(x, 0, 0);
        strings.add(mesh);
      }
      for (let i = -(count / 2); i <= count / 2; i += 1) {
        const z = (i * (innerB * 1.7)) / count;
        if (Math.abs(z) >= innerB) continue;
        const xmax = innerA * Math.sqrt(Math.max(0, 1 - (z / innerB) * (z / innerB)));
        const len = Math.max(0.02, xmax * 2 * 0.98);
        const geo = new THREE.BoxGeometry(len, thick, thick);
        const mesh = new THREE.Mesh(geo, sMat);
        mesh.position.set(0, 0, z);
        strings.add(mesh);
      }
      g.add(strings);
      function beamBetween(p0, p1, sx = 0.06, sy = 0.1) {
        const d = new THREE.Vector3().subVectors(p1, p0);
        const L = d.length();
        const geo = new THREE.BoxGeometry(sx, sy, L);
        const m = new THREE.Mesh(geo, frameMat);
        const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
        m.position.copy(mid);
        const yaw = Math.atan2(d.x, d.z);
        m.rotation.set(0, yaw, 0);
        return m;
      }
      const alpha = 0.35;
      const thL = -Math.PI / 2 - alpha;
      const thR = -Math.PI / 2 + alpha;
      const innerA2 = a - tubeRad * 0.6;
      const innerB2 = b - tubeRad * 0.6;
      const pL = new THREE.Vector3(innerA2 * Math.cos(thL), 0, innerB2 * Math.sin(thL));
      const pR = new THREE.Vector3(innerA2 * Math.cos(thR), 0, innerB2 * Math.sin(thR));
      const joinZ = -(b + 0.55);
      const J = new THREE.Vector3(0, 0, joinZ);
      const armL = beamBetween(pL, J, 0.06, 0.1);
      const armR = beamBetween(pR, J, 0.06, 0.1);
      g.add(armL, armR);
      const handleLen = 2.1;
      const handleR = 0.11;
      const leather = new THREE.ShaderMaterial({
        uniforms: {
          uCol: { value: new THREE.Color('#2b2b2b') },
          uEdge: { value: new THREE.Color('#111') },
          uScale: { value: 24.0 }
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `precision mediump float; varying vec2 vUv; uniform vec3 uCol,uEdge; uniform float uScale; float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=h(i),b=h(i+vec2(1,0)),c=h(i+vec2(0,1)),d=h(i+vec2(1,1));float nx=mix(a,b,f.x)+(c-a)*f.y*(1.-f.x)+(d-b)*f.x*f.y;return nx;} void main(){ float t = n(vUv*uScale); vec3 col = mix(uEdge,uCol, smoothstep(0.45,0.9,t)); gl_FragColor=vec4(col,1.0);} `
      });
      const handleGeo = new THREE.CylinderGeometry(handleR * 0.9, handleR, handleLen, 40, 1, true);
      const handle = new THREE.Mesh(handleGeo, leather);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(0, 0, joinZ - (handleLen * 0.5 + 0.08));
      g.add(handle);
      const butt = new THREE.Mesh(new THREE.CylinderGeometry(handleR * 0.95, handleR * 0.95, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x0e1116, roughness: 0.8 }));
      butt.rotation.x = Math.PI / 2;
      butt.position.copy(handle.position);
      butt.position.z -= handleLen * 0.5 + 0.11;
      g.add(butt);
      const decalCanvas = document.createElement('canvas');
      const dctx = decalCanvas.getContext('2d');
      decalCanvas.width = 512;
      decalCanvas.height = 128;
      dctx.fillStyle = '#22262e';
      dctx.fillRect(0, 0, 512, 128);
      dctx.font = '700 72px system-ui';
      dctx.fillStyle = '#f4f6fa';
      dctx.textAlign = 'center';
      dctx.fillText('OS‑Racquet', 256, 88);
      const decalTex = new THREE.CanvasTexture(decalCanvas);
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.18), new THREE.MeshBasicMaterial({ map: decalTex, transparent: true }));
      decal.position.set(0, 0.08, 0.55);
      g.add(decal);
      return g;
    }

    function buildBallURT() {
      const felt = new THREE.ShaderMaterial({
        uniforms: {
          uA: { value: new THREE.Color('#e6ff3b') },
          uB: { value: new THREE.Color('#cfe93a') },
          uExp: { value: 1.85 }
        },
        vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `precision mediump float; varying vec3 vP; varying vec3 vN; uniform vec3 uA,uB; uniform float uExp; float h(vec3 p){return fract(sin(dot(p,vec3(27.1,57.7,12.4)))*43758.5453);} float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); float a=h(i), b=h(i+vec3(1,0,0)), c=h(i+vec3(0,1,0)), d=h(i+vec3(1,1,0)); float e=h(i+vec3(0,0,1)), f2=h(i+vec3(1,0,1)), g=h(i+vec3(0,1,1)), h2=h(i+vec3(1,1,1)); float nx=mix(a,b,f.x)+(c-a)*f.y*(1.0-f.x)+(d-b)*f.x*f.y; float ny=mix(e,f2,f.x)+(g-e)*f.y*(1.0-f.x)+(h2-f2)*f.x*f.y; return mix(nx,ny,f.z);} float fbm(vec3 p){ float v=0.,amp=0.5; for(int i=0;i<6;i++){ v+=amp*n(p); p*=2.02; amp*=0.5;} return v;} vec3 aces(vec3 x){const float A=2.51,B=0.03,C=2.43,D=0.59,E=0.14; vec3 y=max(vec3(0.0),x*uExp); return clamp((y*(A*y+B))/(y*(C*y+D)+E),0.0,1.0);} void main(){ float f=fbm(vP*7.0+normalize(vN)*2.0); vec3 col=mix(uA,uB,smoothstep(0.35,0.8,f)); gl_FragColor=vec4(aces(col),1.0); }`,
        lights: false
      });
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.26, 48, 36), felt);
      const seamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      const band = new THREE.TorusGeometry(0.26, 0.008, 12, 96);
      const s1 = new THREE.Mesh(band, seamMat);
      s1.rotation.y = Math.PI / 2;
      ball.add(s1);
      const s2 = new THREE.Mesh(band, seamMat);
      s2.rotation.x = Math.PI / 3;
      ball.add(s2);
      return ball;
    }

    function makeRacket() {
      const root = new THREE.Group();
      const headPivot = new THREE.Group();
      root.add(headPivot);
      const urt = buildRacketURT();
      urt.rotation.x = 0;
      urt.position.y = 1.0;
      headPivot.add(urt);
      root.userData = { headPivot, swing: 0, swingLR: 0, headRadius: 0.34 };
      root.scale.setScalar(0.608);
      return root;
    }

    const ballR = 0.076 * 1.5;
    const ball = buildBallURT();
    const s = ballR / 0.26;
    ball.scale.setScalar(s);
    scene.add(ball);
    const ballPhysics = {
      mass: 0.0577,
      airDensity: 1.2,
      dragCoeff: 0.52,
      magnusCoeff: 0.24,
      spinDecay: 1.35
    };
    const ballArea = Math.PI * ballR * ballR;
    const dragFactor = (0.5 * ballPhysics.airDensity * ballPhysics.dragCoeff * ballArea) / ballPhysics.mass;
    const magnusFactor = ballPhysics.magnusCoeff / ballPhysics.mass;

    const sC = document.createElement('canvas');
    sC.width = sC.height = 96;
    const sg = sC.getContext('2d');
    const rg = sg.createRadialGradient(48, 48, 8, 48, 48, 46);
    rg.addColorStop(0, 'rgba(0,0,0,0.35)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = rg;
    sg.fillRect(0, 0, 96, 96);
    const sT = new THREE.CanvasTexture(sC);
    const sM = new THREE.SpriteMaterial({ map: sT, transparent: true, depthWrite: false });
    const shadow = new THREE.Sprite(sM);
    shadow.scale.set(ballR * 10, ballR * 10, 1);
    shadow.position.y = 0.01;
    scene.add(shadow);

    const trailN = 14;
    const trailGeom = new THREE.BufferGeometry();
    const trailPos = new Float32Array(trailN * 3);
    trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    const trail = new THREE.Line(trailGeom, new THREE.LineBasicMaterial({ transparent: true, opacity: 0.22 }));
    scene.add(trail);
    function updateTrail() {
      for (let i = trailN - 1; i > 0; i -= 1) {
        trailPos[i * 3 + 0] = trailPos[(i - 1) * 3 + 0];
        trailPos[i * 3 + 1] = trailPos[(i - 1) * 3 + 1];
        trailPos[i * 3 + 2] = trailPos[(i - 1) * 3 + 2];
      }
      trailPos[0] = ball.position.x;
      trailPos[1] = ball.position.y;
      trailPos[2] = ball.position.z;
      trailGeom.attributes.position.needsUpdate = true;
    }

    const hitRing = new THREE.Mesh(new THREE.RingGeometry(ballR * 0.86, ballR * 1.12, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    hitRing.rotation.x = -Math.PI / 2;
    hitRing.position.y = 0.002;
    scene.add(hitRing);
    let hitTTL = 0;

    const player = makeRacket();
    player.position.set(0, 0, playerZ);
    player.rotation.y = Math.PI / 2;
    scene.add(player);
    const cpu = makeRacket();
    cpu.position.set(0, 0, cpuZ);
    cpu.rotation.y = -Math.PI / 2;
    scene.add(cpu);
    updateHeadKinematics('player');
    updateHeadKinematics('cpu');

    const BALL_SPEED_BOOST = 1.25;

    const state = {
      gravity: -9.81,
      drag: 0.48,
      cor: 0.8,
      fric: 0.18,
      live: false,
      serveBy: 'player',
      serveSide: 'deuce',
      attempts: 2,
      awaitingServeBounce: false,
      rallyStarted: false,
      bounceSide: null,
      matchOver: false,
      score: {
        points: { player: 0, cpu: 0 },
        games: { player: 0, cpu: 0 },
        sets: { player: 0, cpu: 0 }
      }
    };
    const pos = new THREE.Vector3(0, ballR + 0.01, playerZ - 1.0);
    const vel = new THREE.Vector3();
    const spin = new THREE.Vector3();
    const tmpVec = new THREE.Vector3();
    const accVec = new THREE.Vector3();
    const tangentVel = new THREE.Vector3();
    const spinSurfaceVel = new THREE.Vector3();
    const headWorld = { player: new THREE.Vector3(), cpu: new THREE.Vector3() };
    const shotQueue = { player: null, cpu: null };
    function respondToCourtImpact(impactSpeed) {
      const forwardSpin = THREE.MathUtils.clamp(spin.x / 70, -1, 1);
      const sideSpin = THREE.MathUtils.clamp(spin.y / 55, -1, 1);
      const bounceScale = THREE.MathUtils.clamp(state.cor + impactSpeed / 42, state.cor, 0.94);
      const spinDampen = 1 - 0.18 * Math.abs(forwardSpin);
      const skidInfluence = THREE.MathUtils.clamp(impactSpeed / 24, 0.35, 1);
      vel.y = impactSpeed * bounceScale * spinDampen;
      tangentVel.set(vel.x, 0, vel.z);
      spinSurfaceVel.set(-spin.z * ballR, 0, spin.x * ballR);
      const bite = THREE.MathUtils.lerp(0.25, 0.64, skidInfluence);
      tangentVel.addScaledVector(spinSurfaceVel, bite);
      tangentVel.x += sideSpin * 0.4;
      tangentVel.multiplyScalar(1 - state.fric * skidInfluence);
      vel.x = tangentVel.x;
      vel.z = tangentVel.z;
      const spinDecay = THREE.MathUtils.lerp(0.52, 0.7, skidInfluence);
      spin.x *= spinDecay;
      spin.y *= 0.58;
      spin.z *= Math.max(0.48, 0.72 - Math.abs(forwardSpin) * 0.12);
    }

    function updateHeadKinematics(id) {
      const racket = id === 'player' ? player : cpu;
      const pivot = racket.userData?.headPivot;
      if (!pivot) return;
      pivot.updateWorldMatrix(true, false);
      pivot.getWorldPosition(headWorld[id]);
    }
    function queueShot(id, vec, spinVec, { ttl = 0.4, meta = {} } = {}) {
      shotQueue[id] = {
        vec: vec.clone ? vec.clone() : vec,
        spin: spinVec.clone ? spinVec.clone() : spinVec,
        ttl,
        meta
      };
    }
    function tryExecuteShot(id, { force = false } = {}) {
      const entry = shotQueue[id];
      if (!entry) return false;
      const racket = id === 'player' ? player : cpu;
      const headPos = headWorld[id];
      const radius = (racket.userData?.headRadius || 0.32) + ballR;
      if (!force) {
        tmpVec.copy(pos).sub(headPos);
        const dist = tmpVec.length();
        if (dist > radius) {
          return false;
        }
        if (dist > 1e-4) {
          tmpVec.divideScalar(dist);
        } else {
          tmpVec.set(0, 1, id === 'player' ? -1 : 1).normalize();
        }
      } else {
        tmpVec.copy(entry.vec);
        if (tmpVec.lengthSq() < 1e-4) {
          tmpVec.set(0, 1, id === 'player' ? -1 : 1);
        }
        tmpVec.normalize();
      }
      pos.copy(headPos).addScaledVector(tmpVec, radius);
      vel.copy(entry.vec);
      spin.copy(entry.spin);
      if (entry.meta?.serve) {
        state.live = true;
        state.awaitingServeBounce = true;
        state.rallyStarted = false;
        state.bounceSide = null;
      } else {
        state.rallyStarted = true;
        state.bounceSide = null;
      }
      lastHitter = id;
      const racketData = racket.userData || {};
      const swingForce = entry.meta?.swingForce ?? 0.9;
      racketData.swing = Math.max(racketData.swing || 0, swingForce);
      racketData.swingLR = THREE.MathUtils.clamp(entry.vec.x / 7.2, -1, 1);
      hitTTL = 1.0;
      hitRing.position.set(pos.x, 0.002, pos.z);
      shotQueue[id] = null;
      return true;
    }
    function processShotQueue(dt) {
      for (const id of ['player', 'cpu']) {
        const entry = shotQueue[id];
        if (!entry) continue;
        if (tryExecuteShot(id, { force: Boolean(entry.meta?.forceContact) })) {
          continue;
        }
        entry.ttl -= dt;
        if (entry.ttl <= 0) {
          shotQueue[id] = null;
        }
      }
    }
    let lastHitter = 'player';
    ball.position.copy(pos);

    const opponentOf = (id) => (id === 'player' ? 'cpu' : 'player');
    const POINT_LABELS = ['0', '15', '30', '40'];
    const GAMES_TO_WIN = 4;
    const SETS_TO_WIN = 2;

    function resetRally() {
      state.awaitingServeBounce = false;
      state.rallyStarted = false;
      state.bounceSide = null;
      spin.set(0, 0, 0);
    }

    function formatPoints() {
      const p = state.score.points.player;
      const c = state.score.points.cpu;
      if (p >= 3 && c >= 3) {
        if (p === c) return 'Deuce';
        if (p === c + 1) return `Adv ${playerLabel}`;
        if (c === p + 1) return `Adv ${cpuLabel}`;
      }
      const left = POINT_LABELS[Math.min(p, 3)];
      const right = POINT_LABELS[Math.min(c, 3)];
      return `${playerLabel} ${left} – ${cpuLabel} ${right}`;
    }

    function pointLabelFor(playerKey) {
      const opponentKey = opponentOf(playerKey);
      const me = state.score.points[playerKey];
      const opp = state.score.points[opponentKey];
      if (me >= 3 && opp >= 3) {
        if (me === opp) return '40';
        if (me === opp + 1) return 'AD';
        return '40';
      }
      return POINT_LABELS[Math.min(me, 3)];
    }

    function updateHud() {
      setHudInfo({
        points: formatPoints(),
        games: `${state.score.games.player} - ${state.score.games.cpu}`,
        sets: `${state.score.sets.player} - ${state.score.sets.cpu}`,
        server: state.serveBy === 'player' ? playerLabel : cpuLabel,
        side: state.serveSide,
        attempts: state.attempts,
        playerSets: state.score.sets.player,
        cpuSets: state.score.sets.cpu,
        playerGames: state.score.games.player,
        cpuGames: state.score.games.cpu,
        playerPointLabel: pointLabelFor('player'),
        cpuPointLabel: pointLabelFor('cpu')
      });
    }

    function serviceBoxFor(server) {
      const receive = opponentOf(server);
      const sign = state.serveSide === 'deuce' ? 1 : -1;
      const minX = sign > 0 ? SERVICE_BOX_INNER : -halfW + SERVICE_BOX_INNER;
      const maxX = sign > 0 ? halfW - SERVICE_BOX_INNER : -SERVICE_BOX_INNER;
      const minZ = receive === 'player' ? 0.15 : -SERVICE_LINE_Z + 0.15;
      const maxZ = receive === 'player' ? SERVICE_LINE_Z - 0.15 : -0.15;
      return { minX, maxX, minZ, maxZ };
    }

    function inBox(x, z, box, pad = 0.08) {
      return (
        x >= box.minX - pad &&
        x <= box.maxX + pad &&
        z >= box.minZ - pad &&
        z <= box.maxZ + pad
      );
    }

    function rotateServeSide() {
      state.serveSide = state.serveSide === 'deuce' ? 'ad' : 'deuce';
    }

    function resetForNextPoint() {
      state.attempts = 2;
      resetRally();
      updateHud();
    }

    let matchResetTO = null;

    function handleGameWin(winner, reason = '') {
      const loser = opponentOf(winner);
      const prefix = reason ? `${reason} · ` : '';
      state.score.points.player = 0;
      state.score.points.cpu = 0;
      state.score.games[winner] += 1;
      state.serveSide = 'deuce';
      resetForNextPoint();
      const label = winner === 'player' ? playerLabel : cpuLabel;
      let announce = `${prefix}Game ${label}`;
      const gW = state.score.games[winner];
      const gL = state.score.games[loser];
      if (gW >= GAMES_TO_WIN && gW >= gL + 2) {
        state.score.sets[winner] += 1;
        announce += ` · Set ${label}`;
        state.score.games.player = 0;
        state.score.games.cpu = 0;
        const sW = state.score.sets[winner];
        if (sW >= SETS_TO_WIN) {
          announce += ` · Match ${label}`;
          state.matchOver = true;
          updateHud();
          setMsg(formatMsg(announce));
          if (matchResetTO) {
            try {
              clearTimeout(matchResetTO);
            } catch {}
          }
          matchResetTO = setTimeout(() => {
            state.matchOver = false;
            state.score.points.player = 0;
            state.score.points.cpu = 0;
            state.score.games.player = 0;
            state.score.games.cpu = 0;
            state.score.sets.player = 0;
            state.score.sets.cpu = 0;
            state.serveBy = 'player';
            state.serveSide = 'deuce';
            resetForNextPoint();
            prepareServe('player');
          }, 3600);
          return;
        }
      }
      state.serveBy = opponentOf(state.serveBy);
      updateHud();
      prepareServe(state.serveBy, { announce });
    }

    function awardPoint(winner, reason = '') {
      if (state.matchOver) return;
      const loser = opponentOf(winner);
      const pts = state.score.points;
      const prefix = reason ? `${reason} · ` : '';
      if (pts[winner] >= 3 && pts[loser] >= 3) {
        if (pts[winner] === pts[loser]) {
          pts[winner] += 1;
          rotateServeSide();
          resetForNextPoint();
          const label = winner === 'player' ? playerLabel : cpuLabel;
          prepareServe(state.serveBy, { announce: `${prefix}Adv ${label}` });
          return;
        }
        if (pts[winner] === pts[loser] + 1) {
          handleGameWin(winner, reason);
          return;
        }
        pts[loser] = Math.max(0, pts[loser] - 1);
        rotateServeSide();
        resetForNextPoint();
        prepareServe(state.serveBy, { announce: `${prefix}Deuce` });
        return;
      }
      pts[winner] += 1;
      if (pts[winner] >= 4 && pts[winner] >= pts[loser] + 2) {
        handleGameWin(winner, reason);
        return;
      }
      rotateServeSide();
      resetForNextPoint();
      const label = winner === 'player' ? playerLabel : cpuLabel;
      prepareServe(state.serveBy, { announce: `${prefix}Point ${label}` });
    }

    function finishPoint(winner, reason = '') {
      state.live = false;
      resetRally();
      awardPoint(winner, reason);
    }

    function registerFault(server, reason) {
      state.live = false;
      state.awaitingServeBounce = false;
      if (state.matchOver) return;
      state.attempts = Math.max(0, state.attempts - 1);
      if (state.attempts <= 0) {
        const winner = opponentOf(server);
        finishPoint(winner, `${reason} · Double Fault`);
        return;
      }
      updateHud();
      const announce = state.attempts === 1 ? `${reason} · 2nd` : reason;
      prepareServe(server, { resetAttempts: false, announce });
    }

    function solveShot(from, to, g, tSec) {
      const t = tSec;
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const dy = to.y - from.y;
      const vx = dx / t;
      const vz = dz / t;
      const vy = (dy - 0.5 * g * t * t) / t;
      return new THREE.Vector3(vx, vy, vz);
    }
    function ensureNetClear(from, v, g, netY, margin = ballR * 0.8) {
      const vz = v.z;
      const dzToNet = 0 - from.z;
      if (Math.abs(vz) < 1e-4) return v;
      const tNet = dzToNet / vz;
      if (tNet <= 0) return v;
      const yNet = from.y + v.y * tNet + 0.5 * g * tNet * tNet;
      const need = netY + margin;
      if (yNet < need) {
        v.y += (need - yNet) / Math.max(0.15, tNet);
      }
      return v;
    }

    function clampNetSpan(from, v, singlesLimit = halfW - 0.32) {
      const vz = v.z;
      if (Math.abs(vz) < 1e-4) return v;
      const tNet = (0 - from.z) / vz;
      if (tNet <= 0) return v;
      const netX = from.x + v.x * tNet;
      const limit = Math.max(0.2, singlesLimit);
      const span = Math.abs(netX);
      if (span > limit) {
        const scale = limit / Math.max(span, 1e-4);
        v.x *= scale;
      }
      return v;
    }

    function placeCamera() {
      const servingDiag = !state.live && state.serveBy === 'player';
      if (servingDiag) {
        const sideOffset = state.serveSide === 'deuce' ? 1.25 : -1.25;
        const diagTarget = new THREE.Vector3(
          player.position.x + sideOffset,
          camHeight,
          THREE.MathUtils.clamp(player.position.z + camBack, cameraMinZ, cameraMaxZ)
        );
        camera.position.lerp(diagTarget, 0.25);
        camera.lookAt(new THREE.Vector3(0, 1.2, -halfL + 1.0));
        return;
      }
      const camFollowZ = ball.position.z + (ball.position.z >= player.position.z - 0.5 ? 2.8 : 3.6);
      const desiredZ = THREE.MathUtils.clamp(
        Math.max(camFollowZ, player.position.z + 0.8),
        cameraMinZ,
        Math.min(cameraMaxZ + 1.0, player.position.z + camBack + 1.5)
      );
      const followX = THREE.MathUtils.lerp(player.position.x, ball.position.x, 0.85);
      const followY = Math.max(camHeight * 0.85, ball.position.y + 1.15);
      const target = new THREE.Vector3(followX, followY, desiredZ);
      camera.position.lerp(target, 0.18);
      const look = new THREE.Vector3(
        THREE.MathUtils.lerp(player.position.x * 0.1, ball.position.x, 0.95),
        Math.max(1.2, ball.position.y + 0.3),
        ball.position.z - 1.8
      );
      camera.lookAt(look);
    }

    function inSinglesX(x) {
      return Math.abs(x) <= halfW - 0.05;
    }

    let cpuSrvTO = null;
    let playerSrvTO = null;
    const formatMsg = (base) => base;

    function prepareServe(by, options = {}) {
      const { resetAttempts = true, announce } = options;
      state.serveBy = by;
      if (resetAttempts) state.attempts = 2;
      state.live = false;
      resetRally();
      const idleX = state.serveSide === 'deuce' ? halfW - 0.2 : -halfW + 0.2;
      if (by === 'player') {
        player.position.set(idleX, 0, halfL + 0.55);
        pos.set(idleX * 0.88, 1.34, halfL - 0.25);
      } else {
        cpu.position.set(-idleX, 0, -halfL - 0.55);
        pos.set(-idleX * 0.88, 1.34, -halfL + 0.25);
      }
      vel.set(0, 0, 0);
      spin.set(0, 0, 0);
      ball.position.copy(pos);
      shadow.position.set(pos.x, 0.01, pos.z);
      const serverLabel = by === 'player' ? playerLabel : cpuLabel;
      const sideLabel = state.serveSide === 'deuce' ? 'D' : 'Ad';
      const base = `Serve ${sideLabel} · ${serverLabel}`;
      const text = announce ? `${announce} · ${base}` : base;
      setMsg(formatMsg(text));
      lastHitter = by;
      updateHud();
      if (cpuSrvTO) {
        try {
          clearTimeout(cpuSrvTO);
        } catch {}
        cpuSrvTO = null;
      }
      if (playerSrvTO) {
        try {
          clearTimeout(playerSrvTO);
        } catch {}
        playerSrvTO = null;
      }
      if (by === 'cpu') {
        cpuSrvTO = setTimeout(() => {
          if (state.live || state.matchOver) return;
          const box = serviceBoxFor('cpu');
          const tx = THREE.MathUtils.randFloat(box.minX, box.maxX);
          const tz = THREE.MathUtils.randFloat(box.minZ, box.maxZ);
          const to = new THREE.Vector3(tx, ballR + 0.06, tz);
          let v0 = solveShot(pos.clone(), to, state.gravity, THREE.MathUtils.randFloat(0.9, 1.08));
          v0 = ensureNetClear(pos.clone(), v0, state.gravity, netH, ballR * 1.05);
          clampNetSpan(pos.clone(), v0);
          const vec = v0.multiplyScalar(0.9 * BALL_SPEED_BOOST);
          const spinVec = craftCpuSpin(vec.z, 0.65, tx / halfW);
          queueShot('cpu', vec, spinVec, {
            ttl: 0.6,
            meta: { serve: true, swingForce: 0.95, forceContact: true }
          });
          setMsg(formatMsg(`Serve · ${cpuLabel}`));
          cpu.userData.swing = 0.95;
          cpu.userData.swingLR = THREE.MathUtils.clamp((tx - cpu.position.x) / halfW, -1, 1);
        }, 650);
      } else {
        playerSrvTO = setTimeout(() => {
          if (state.live || state.matchOver || state.serveBy !== 'player') return;
          const box = serviceBoxFor('player');
          const tx = THREE.MathUtils.randFloat(box.minX, box.maxX);
          const tz = THREE.MathUtils.randFloat(box.minZ, box.maxZ);
          const to = new THREE.Vector3(tx, ballR + 0.06, tz);
          let v0 = solveShot(pos.clone(), to, state.gravity, THREE.MathUtils.randFloat(0.92, 1.05));
          v0 = ensureNetClear(pos.clone(), v0, state.gravity, netH, ballR * 1.05);
          clampNetSpan(pos.clone(), v0);
          const vec = v0.multiplyScalar(BALL_SPEED_BOOST);
          const autoSpin = new THREE.Vector3(
            THREE.MathUtils.randFloat(26, 42) * Math.sign(vec.z || -1),
            THREE.MathUtils.randFloatSpread(8),
            THREE.MathUtils.randFloatSpread(4)
          );
          pos.y = Math.max(pos.y, 1.32);
          queueShot('player', vec, autoSpin, {
            ttl: 0.7,
            meta: { serve: true, swingForce: 0.65, forceContact: true }
          });
          setMsg(formatMsg(`Serve · ${playerLabel}`));
          player.userData.swing = 0.65;
          player.userData.swingLR = THREE.MathUtils.clamp((tx - player.position.x) / halfW, -1, 1);
        }, 1100);
      }
    }

    const el = renderer.domElement;
    el.style.touchAction = 'none';
    let touching = false;
    let sx = 0;
    let sy = 0;
    let lx = 0;
    let ly = 0;
    let st = 0;
    function onDown(e) {
      touching = true;
      sx = lx = e.clientX;
      sy = ly = e.clientY;
      st = performance.now();
    }
    function onMove(e) {
      if (!touching) return;
      lx = e.clientX;
      ly = e.clientY;
    }
    function mapSwipeToShot(vx, vy, spd, { serve = false } = {}) {
      const scale = serve ? 1050 : 1150;
      const minForce = serve ? 0.28 : 0.18;
      const force = THREE.MathUtils.clamp(spd / scale, minForce, 1.0);
      const plane = new THREE.Vector2(vx, -vy);
      if (plane.lengthSq() < 1e-2) {
        plane.set(0, 1);
      } else {
        plane.normalize();
      }
      plane.y = THREE.MathUtils.clamp(plane.y, 0.24, 1);
      plane.normalize();
      const contactHeight = THREE.MathUtils.clamp((pos.y - ballR) / 2.4, 0, 1);
      const incomingSpeed = THREE.MathUtils.clamp(vel.length() / 28, 0, 1);
      const timing = THREE.MathUtils.lerp(0.88, 1.08, contactHeight) * THREE.MathUtils.lerp(1.08, 0.94, incomingSpeed);
      const baseSpeedRaw = serve
        ? THREE.MathUtils.lerp(10.0, 20.5, force)
        : THREE.MathUtils.lerp(7.4, 17.2, force);
      const baseSpeed = baseSpeedRaw * timing;
      const aimAssist = THREE.MathUtils.clamp(player.position.x / (halfW - 0.45), -1, 1);
      const blended = THREE.MathUtils.clamp(plane.x * 0.9 + aimAssist * 0.35, -1, 1);
      const lateral = THREE.MathUtils.clamp(blended * baseSpeed * 0.48, -6.0, 6.0);
      const forward = THREE.MathUtils.clamp(-plane.y * baseSpeed, -22.0, -5.5);
      const liftBase = serve ? 1.3 : 0.85;
      const liftGain = serve ? 1.5 : 1.2;
      const liftSwipe = Math.max(0, -vy) / (serve ? 1200 : 1450);
      const lift = (liftBase + liftGain * force + liftSwipe) * THREE.MathUtils.lerp(1.18, 0.9, contactHeight);
      const topSpinInfluence = THREE.MathUtils.clamp(Math.max(0, -vy) / (serve ? 900 : 1150), 0, 1);
      const sliceInfluence = THREE.MathUtils.clamp(Math.max(0, vy) / (serve ? 1150 : 1500), 0, 1);
      const spinStrengthRaw = serve
        ? THREE.MathUtils.lerp(24, 46, force)
        : THREE.MathUtils.lerp(32, 68, force);
      const spinStrength = spinStrengthRaw * THREE.MathUtils.lerp(1.2, 0.78, contactHeight);
      const topComponent = (topSpinInfluence - sliceInfluence * 0.6) * spinStrength;
      const sideComponent = plane.x * spinStrength * 0.35;
      const forwardSign = Math.sign(forward === 0 ? -1 : forward);
      const twistComponent = THREE.MathUtils.clamp(plane.x, -0.85, 0.85) * spinStrength * (serve ? 0.12 : 0.2);
      const spinVec = new THREE.Vector3(forwardSign * topComponent, sideComponent, twistComponent);
      return { lateral, forward, lift, force, spin: spinVec };
    }

    function craftCpuSpin(directionZ, aggression = 0.55, sideBias = 0) {
      const bias = THREE.MathUtils.clamp(sideBias, -1, 1);
      const forwardSign = Math.sign(directionZ === 0 ? -1 : directionZ);
      const top = THREE.MathUtils.lerp(18, 58, aggression);
      const side = THREE.MathUtils.lerp(4, 18, aggression);
      const randSide = THREE.MathUtils.randFloatSpread(side * 0.35);
      const randTwist = THREE.MathUtils.randFloatSpread(6);
      return new THREE.Vector3(forwardSign * top, bias * side + randSide, randTwist);
    }
    function onUp() {
      if (!touching) return;
      touching = false;
      const dt = Math.max(1, performance.now() - st);
      const vx = ((lx - sx) / dt) * 1000;
      const vy = ((ly - sy) / dt) * 1000;
      const spd = Math.hypot(vx, vy);
      if (!state.live) {
        if (state.serveBy === 'player') {
          const shot = mapSwipeToShot(vx, vy, spd, { serve: true });
          const shotVec = new THREE.Vector3(shot.lateral, shot.lift, shot.forward);
          ensureNetClear(pos.clone(), shotVec, state.gravity, netH, ballR * 1.05);
          clampNetSpan(pos.clone(), shotVec);
          shotVec.multiplyScalar(BALL_SPEED_BOOST);
          pos.y = Math.max(pos.y, 1.32);
          queueShot('player', shotVec, shot.spin, {
            ttl: 0.65,
            meta: { serve: true, swingForce: 0.55 + 0.85 * shot.force, forceContact: true }
          });
          setMsg(formatMsg(`Serve · ${playerLabel}`));
          player.userData.swing = 0.55 + 0.85 * shot.force;
          player.userData.swingLR = THREE.MathUtils.clamp(shot.lateral / 6.5, -1, 1);
          if (playerSrvTO) {
            try {
              clearTimeout(playerSrvTO);
            } catch {}
            playerSrvTO = null;
          }
        }
      } else {
        const near = pos.z > 0 && Math.abs(pos.z - (playerZ - 0.75)) < 2.1;
        if (near && pos.y <= 2.05) {
          const shot = mapSwipeToShot(vx, vy, spd, { serve: false });
          const shotVec = new THREE.Vector3(shot.lateral, shot.lift, shot.forward);
          ensureNetClear(pos.clone(), shotVec, state.gravity, netH, ballR * 0.9);
          clampNetSpan(pos.clone(), shotVec);
          shotVec.multiplyScalar(BALL_SPEED_BOOST);
          queueShot('player', shotVec, shot.spin, {
            ttl: 0.35,
            meta: { swingForce: 0.5 + 0.9 * shot.force }
          });
          player.userData.swing = 0.5 + 0.9 * shot.force;
          player.userData.swingLR = THREE.MathUtils.clamp(shot.lateral / 6.5, -1, 1);
        }
      }
    }
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);

    let cpuWind = 0;
    let cpuPlan = null;
    function cpuTryHit(dt) {
      if (!state.live) {
        cpuWind = Math.max(0, cpuWind - dt);
        cpu.position.x = THREE.MathUtils.damp(cpu.position.x, 0, 4.2, dt);
        cpu.position.z = THREE.MathUtils.damp(cpu.position.z, cpuZ, 3.5, dt);
        return;
      }
      const approaching = vel.z < 0;
      const hasQueuedShot = Boolean(shotQueue.cpu);
      if (!approaching) {
        cpuWind = Math.max(0, cpuWind - dt);
        cpu.position.x = THREE.MathUtils.damp(cpu.position.x, 0, 4.5, dt);
        cpu.position.z = THREE.MathUtils.damp(cpu.position.z, cpuZ, 4.0, dt);
        return;
      }
      const vz = Math.min(-0.001, vel.z);
      const t = THREE.MathUtils.clamp((pos.z - cpuZ) / vz, 0.06, 1.4);
      const predictedX = pos.x + vel.x * t;
      const clampX = THREE.MathUtils.clamp(predictedX, -halfW * 0.92, halfW * 0.92);
      cpu.position.x = THREE.MathUtils.damp(cpu.position.x, clampX, 7.2, dt);
      const retreat = THREE.MathUtils.mapLinear(Math.min(1.0, t), 0, 1, -0.2, 0.6);
      const targetZ = cpuZ - retreat;
      cpu.position.z = THREE.MathUtils.damp(cpu.position.z, targetZ, 5.5, dt);

      const interceptY = pos.y + vel.y * t + 0.5 * state.gravity * t * t;
      const close = t < 0.24 && Math.abs(predictedX - cpu.position.x) < 1.35 && interceptY <= 2.2;
      if (close && cpuWind <= 0 && !cpuPlan && !hasQueuedShot) {
        const aggression = THREE.MathUtils.clamp(Math.abs(player.position.x) / halfW, 0.25, 0.85);
        const corner = player.position.x > 0 ? -halfW + 0.45 : halfW - 0.45;
        const mix = THREE.MathUtils.lerp(predictedX, corner, aggression);
        const tx = THREE.MathUtils.clamp(mix + THREE.MathUtils.randFloatSpread(0.35), -halfW + 0.35, halfW - 0.35);
        let tz = THREE.MathUtils.mapLinear(Math.min(halfW, Math.abs(player.position.x)), 0, halfW, halfL - 1.55, halfL - 0.9);
        if (player.position.z < halfL - 2.4) tz = halfL - 0.75;
        tz = THREE.MathUtils.clamp(tz + THREE.MathUtils.randFloatSpread(0.3), halfL - 1.7, halfL - 0.55);
        cpuPlan = { tx, tz };
        cpuWind = 0.11 + Math.random() * 0.07;
        cpu.userData.swing = -0.6;
      }
      if (cpuWind > 0) {
        cpuWind -= dt;
        if (cpuWind <= 0 && cpuPlan) {
          const to = new THREE.Vector3(cpuPlan.tx, ballR + 0.06, cpuPlan.tz);
          let v0 = solveShot(pos.clone(), to, state.gravity, THREE.MathUtils.randFloat(0.82, 1.0));
          v0 = ensureNetClear(pos.clone(), v0, state.gravity, netH, ballR * 0.9);
          clampNetSpan(pos.clone(), v0);
          const vec = v0.multiplyScalar(0.95 * BALL_SPEED_BOOST);
          const aggression = THREE.MathUtils.clamp(Math.abs(player.position.x) / halfW, 0.4, 0.85);
          const bias = THREE.MathUtils.clamp((cpuPlan.tx - player.position.x) / halfW, -1, 1);
          const shotSpin = craftCpuSpin(vec.z, aggression, bias);
          queueShot('cpu', vec, shotSpin, { ttl: 0.32, meta: { swingForce: 1.18 } });
          cpu.userData.swing = 1.18;
          cpu.userData.swingLR = THREE.MathUtils.clamp((cpuPlan.tx - cpu.position.x) / halfW, -1, 1);
          cpuPlan = null;
        }
      }
    }

    const adPanels = [];
    function makeAdTexture(line1 = 'TonPlaygram · the future of peer‑to‑peer crypto gaming', line2 = 'Earn · Play · Compete · Secure · Instant Payouts') {
      const w = 1024;
      const h = 256;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#111827');
      grad.addColorStop(1, '#0ea5a1');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.font = '700 44px system-ui,Segoe UI,Arial';
      g.fillStyle = '#ffffff';
      g.textBaseline = 'middle';
      const block = `${line1}   •   ${line2}   •   `;
      let x = 20;
      for (let i = 0; i < 6; i += 1) {
        g.fillText(block, x, h * 0.52);
        x += g.measureText(block).width + 40;
      }
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = Math.min(8, maxAniso);
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.repeat.set(4, 1);
      return t;
    }
    function makeBillboard(width, height, speed = 0.06, pos = new THREE.Vector3(), rotY = 0) {
      const tex = makeAdTexture();
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      const geo = new THREE.PlaneGeometry(width, height);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.rotation.y = rotY;
      scene.add(mesh);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x7c818c, roughness: 0.6, metalness: 0.2 });
      const postH = height + 0.4;
      const cyl = new THREE.CylinderGeometry(0.04, 0.04, postH, 10);
      const p1 = new THREE.Mesh(cyl, postMat);
      const p2 = new THREE.Mesh(cyl, postMat);
      p1.position.set(pos.x - width / 2 + 0.15 * Math.cos(rotY), (postH / 2) * 0.98, pos.z - (width / 2) * Math.sin(rotY));
      p2.position.set(pos.x + width / 2 - 0.15 * Math.cos(rotY), (postH / 2) * 0.98, pos.z + (width / 2) * Math.sin(rotY));
      scene.add(p1);
      scene.add(p2);
      adPanels.push({ mesh, tex, speed });
    }

    const apronSize = 2.6;
    const outerX = halfW + apronSize;
    const outerZ = halfL + apronSize;
    const offset = 0.25;
    const bbH = 1.1;
    const sideLenZ = courtL + 2 * apronSize;
    const endLenX = courtW + 2 * apronSize;
    makeBillboard(sideLenZ, bbH, 0.055, new THREE.Vector3(-outerX - offset, bbH / 2, 0), Math.PI / 2);
    makeBillboard(endLenX, bbH, 0.07, new THREE.Vector3(0, bbH / 2, -outerZ - offset), 0);
    makeBillboard(sideLenZ, bbH, 0.055, new THREE.Vector3(outerX + offset, bbH / 2, 0), -Math.PI / 2);

    const MAX_SUBSTEP = 1 / 360;
    const MIN_SUBSTEP = 1 / 960;
    const MAX_SUBSTEP_ITER = 8;
    const GROUND_GLIDE = 0.085;
    function advanceBallState(dt) {
      const prevZ = pos.z;
      const prevY = pos.y;
      const vLen = vel.length();
      accVec.set(0, state.gravity, 0);
      if (vLen > 1e-3) {
        accVec.addScaledVector(vel, -dragFactor * vLen);
        tmpVec.crossVectors(spin, vel);
        accVec.addScaledVector(tmpVec, magnusFactor);
      }
      vel.addScaledVector(accVec, dt);
      const decay = Math.max(0, 1 - ballPhysics.spinDecay * dt);
      spin.multiplyScalar(decay);
      pos.addScaledVector(vel, dt);

      const aboveCourt = pos.y - ballR;
      if (aboveCourt < GROUND_GLIDE && vel.y < 1.5 && aboveCourt > -GROUND_GLIDE) {
        const proximity = THREE.MathUtils.clamp(1 - aboveCourt / GROUND_GLIDE, 0, 1);
        const groundFriction = THREE.MathUtils.clamp(proximity * dt * 14, 0, 0.85);
        vel.x *= 1 - groundFriction;
        vel.z *= 1 - groundFriction;
      }

      if (pos.y <= ballR) {
        pos.y = ballR;
        if (vel.y < 0) {
          respondToCourtImpact(Math.abs(vel.y));
        }
        hitTTL = 1.0;
        hitRing.position.set(pos.x, 0.002, pos.z);
        const side = pos.z >= 0 ? 'player' : 'cpu';
        if (state.awaitingServeBounce) {
          if (side !== opponentOf(state.serveBy)) {
            registerFault(state.serveBy, 'Fault · Side');
            return false;
          }
          const box = serviceBoxFor(state.serveBy);
          if (!inBox(pos.x, pos.z, box)) {
            registerFault(state.serveBy, 'Fault · Box');
            return false;
          }
          state.awaitingServeBounce = false;
          state.rallyStarted = true;
          state.bounceSide = side;
        } else {
          if (state.rallyStarted && lastHitter === side) {
            finishPoint(opponentOf(side), 'Net');
            return false;
          }
          if (state.bounceSide === side) {
            finishPoint(opponentOf(side), 'Double Bounce');
            return false;
          }
          state.bounceSide = side;
        }
        if (!inSinglesX(pos.x) || Math.abs(pos.z) > halfL + 0.05) {
          finishPoint(opponentOf(side), 'Out');
          return false;
        }
      }
      const denom = pos.z - prevZ || 1e-6;
      const tCross = (0 - prevZ) / denom;
      const yCross = THREE.MathUtils.lerp(prevY, pos.y, THREE.MathUtils.clamp(tCross, 0, 1));
      if (((prevZ > 0 && pos.z <= 0) || (prevZ < 0 && pos.z >= 0)) && yCross < netH + ballR * 0.55) {
        if (state.awaitingServeBounce && lastHitter === state.serveBy) {
          registerFault(state.serveBy, 'Fault · Net');
        } else {
          finishPoint(lastHitter === 'player' ? 'cpu' : 'player', 'Net');
        }
        return false;
      }
      if (!inSinglesX(pos.x) || pos.z > halfL + 0.6 || pos.z < -halfL - 0.6) {
        if (state.awaitingServeBounce && lastHitter === state.serveBy) {
          registerFault(state.serveBy, 'Fault · Out');
        } else {
          finishPoint(lastHitter === 'player' ? 'cpu' : 'player', 'Out');
        }
        return false;
      }
      return true;
    }

    function simulateBallMotion(dt) {
      let remaining = dt;
      let iter = 0;
      while (remaining > 1e-5 && iter < MAX_SUBSTEP_ITER) {
        const speedRatio = THREE.MathUtils.clamp(vel.length() / 32, 0, 1);
        const adaptive = THREE.MathUtils.lerp(MAX_SUBSTEP, MIN_SUBSTEP, speedRatio);
        const subDt = Math.min(remaining, adaptive);
        if (!advanceBallState(subDt)) {
          return false;
        }
        remaining -= subDt;
        iter += 1;
      }
      return true;
    }

    const FIXED = 1 / 120;
    let acc = 0;
    let last = performance.now();
    let raf = 0;
    function step(dt) {
      if (state.live && vel.z > 0) {
        const strikeZ = playerZ - 0.8;
        const t = Math.max(0.05, (strikeZ - pos.z) / (vel.z || 1e-6));
        const predX = pos.x + vel.x * t;
        player.position.x += (THREE.MathUtils.clamp(predX, -halfW, halfW) - player.position.x) * 0.22;
      } else {
        player.position.x += (0 - player.position.x) * 0.08;
      }
      const homeZ = playerZ - 0.3;
      player.position.z += (homeZ - player.position.z) * 0.08;

      if (state.live) {
        if (!simulateBallMotion(dt)) {
          return;
        }
      }
      player.userData.swing *= Math.exp(-5.0 * dt);
      cpu.userData.swing *= Math.exp(-5.0 * dt);
      const ps = player.userData.swing || 0;
      const plrLR = THREE.MathUtils.clamp(player.userData.swingLR || 0, -1, 1);
      const cs = cpu.userData.swing || 0;
      const cpuLR = THREE.MathUtils.clamp(cpu.userData.swingLR || 0, -1, 1);
      if (player.userData.headPivot) {
        player.userData.headPivot.rotation.x = -0.45 * ps;
        player.userData.headPivot.rotation.z = -0.28 * plrLR * ps;
        player.userData.headPivot.position.z = -0.06 * ps;
      }
      if (cpu.userData.headPivot) {
        cpu.userData.headPivot.rotation.x = -0.55 * cs;
        cpu.userData.headPivot.rotation.z = -0.30 * cpuLR * cs;
        cpu.userData.headPivot.position.z = -0.07 * cs;
      }
      updateHeadKinematics('player');
      updateHeadKinematics('cpu');
      processShotQueue(dt);

      ball.position.copy(pos);
      shadow.position.set(pos.x, 0.01, pos.z);
      updateTrail();
      if (hitTTL > 0) {
        hitTTL -= dt;
        hitRing.material.opacity = Math.max(0, hitTTL) * 0.9;
      }
      cpuTryHit(dt);
      placeCamera();
    }

    function animate() {
      const now = performance.now();
      let dt = (now - last) / 1000;
      last = now;
      acc += dt;
      acc = Math.min(acc, 0.25);
      while (acc >= FIXED) {
        step(FIXED);
        acc -= FIXED;
      }
      for (const p of adPanels) {
        p.tex.offset.x = (p.tex.offset.x + p.speed * dt) % 1;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }

    loadDeshadowedGrass(grassURL, (tex) => {
      matGrass.map = tex;
      matGrass.needsUpdate = true;
    });
    prepareServe('player');
    animate();

    function onResize() {
      W = Math.max(1, container.clientWidth || window.innerWidth || 1);
      H = Math.max(1, container.clientHeight || window.innerHeight || 1);
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);

    console.assert(Math.abs(new THREE.Vector3(0, 0, 1).length() - 1) < 1e-6, 'vec length test');
    console.assert(inSinglesX(0.0) && inSinglesX(halfW - 0.06) && !inSinglesX(halfW + 0.1), 'bounds X test');

    return () => {
      try {
        cancelAnimationFrame(raf);
      } catch {
      }
      window.removeEventListener('resize', onResize);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (cpuSrvTO) {
        try {
          clearTimeout(cpuSrvTO);
        } catch {}
      }
      if (playerSrvTO) {
        try {
          clearTimeout(playerSrvTO);
        } catch {}
      }
      if (matchResetTO) {
        try {
          clearTimeout(matchResetTO);
        } catch {}
      }
      try {
        container.removeChild(renderer.domElement);
      } catch {}
      renderer.dispose();
    };
  }, [playerLabel, setHudInfo]);

  const serveAttemptLabel = hudInfo.attempts >= 2 ? '1st serve' : hudInfo.attempts === 1 ? '2nd serve' : 'Serve reset';
  const scoreboardRows = [
    {
      label: playerLabel,
      sets: hudInfo.playerSets,
      games: hudInfo.playerGames,
      points: hudInfo.playerPointLabel,
      isServer: hudInfo.server === playerLabel
    },
    {
      label: cpuLabel,
      sets: hudInfo.cpuSets,
      games: hudInfo.cpuGames,
      points: hudInfo.cpuPointLabel,
      isServer: hudInfo.server === cpuLabel
    }
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #e1f1ff 0%, #f5f9ff 45%, #ffffff 100%)'
      }}
    >
      <div ref={containerRef} style={{ flex: 1, minHeight: 560, height: '100%', width: '100%' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              color: '#f8fafc',
              borderRadius: 18,
              padding: '14px 20px 16px',
              boxShadow: '0 22px 44px rgba(15, 23, 42, 0.38)',
              minWidth: 260,
              fontFamily: 'ui-sans-serif, system-ui'
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '140px repeat(3, minmax(42px, auto))',
                columnGap: 14,
                rowGap: 8,
                alignItems: 'center'
              }}
            >
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, opacity: 0.75 }}>Lojtarët</div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, opacity: 0.75 }}>Sete</div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, opacity: 0.75 }}>Lojë</div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, opacity: 0.75 }}>Pikë</div>
              {scoreboardRows.map((row) => (
                <React.Fragment key={row.label}>
                  <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: row.isServer ? '#facc15' : 'rgba(148, 163, 184, 0.65)',
                        boxShadow: row.isServer ? '0 0 8px rgba(250, 204, 21, 0.65)' : 'none'
                      }}
                    />
                    {row.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, justifySelf: 'center' }}>{row.sets}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, justifySelf: 'center' }}>{row.games}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, justifySelf: 'center' }}>{row.points}</div>
                </React.Fragment>
              ))}
            </div>
            {matchTag ? (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  opacity: 0.6,
                  textAlign: 'center'
                }}
              >
                {matchTag}
              </div>
            ) : null}
          </div>
          <div
            style={{
              background: 'rgba(241, 245, 249, 0.95)',
              color: '#0f172a',
              borderRadius: 999,
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              boxShadow: '0 12px 24px rgba(15, 23, 42, 0.18)'
            }}
          >
            {msg} · {serveAttemptLabel} · Court {hudInfo.side === 'deuce' ? 'D' : 'Ad'}
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 24, right: 24, pointerEvents: 'auto' }}>
        <button
          type="button"
          onClick={() => setScoreboardOpen(true)}
          style={{
            background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)',
            color: '#f8fafc',
            border: 'none',
            borderRadius: 999,
            padding: '12px 22px',
            fontFamily: 'ui-sans-serif, system-ui',
            fontWeight: 600,
            fontSize: 13,
            boxShadow: '0 14px 28px rgba(30, 64, 175, 0.35)',
            cursor: 'pointer'
          }}
        >
          Match Info
        </button>
      </div>
      {scoreboardOpen && (
        <div
          onClick={() => setScoreboardOpen(false)}
          role="presentation"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            pointerEvents: 'auto'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="presentation"
            style={{
              background: 'rgba(255,255,255,0.98)',
              color: '#0f172a',
              borderRadius: 20,
              padding: '22px 28px',
              maxWidth: 320,
              width: '100%',
              boxShadow: '0 28px 44px rgba(15, 23, 42, 0.22)',
              fontFamily: 'ui-sans-serif, system-ui'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Match Center</h3>
              <button
                type="button"
                onClick={() => setScoreboardOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#1f2937',
                  fontSize: 18,
                  fontWeight: 700,
                  cursor: 'pointer',
                  lineHeight: 1
                }}
                aria-label="Close scoreboard"
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: matchTag ? 4 : 10 }}>{msg}</div>
            {matchTag ? (
              <div
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  opacity: 0.6,
                  marginBottom: 10
                }}
              >
                {matchTag}
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
              <span>{playerLabel}</span>
              <span>{cpuLabel}</span>
            </div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Sets · {hudInfo.sets}</div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Games · {hudInfo.games}</div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>Points · {hudInfo.points}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 2 }}>
              Serve · {hudInfo.server} · Court {hudInfo.side === 'deuce' ? 'D' : 'Ad'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.78, marginBottom: 12 }}>{serveAttemptLabel}</div>
            {stakeLabel ? (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#0f172a',
                  background: 'rgba(30, 64, 175, 0.08)',
                  borderRadius: 12,
                  padding: '8px 12px'
                }}
              >
                Stake · {stakeLabel}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
