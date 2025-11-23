import React, { useEffect, useRef } from "react";
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

function buildSidelineChair() {
  const chair = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.52, metalness: 0.32 });
  const seatMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e40af,
    roughness: 0.36,
    metalness: 0.22,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3
  });

  const ladderWidth = 0.72;
  const stepDepth = 0.18;
  const stepHeight = 0.22;
  for (let i = 0; i < 6; i += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(ladderWidth, stepHeight * 0.36, stepDepth), frameMat);
    step.position.set(0, (i + 0.35) * stepHeight, -0.45 - i * stepDepth * 0.75);
    chair.add(step);
  }

  const railsGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.8, 10);
  const railL = new THREE.Mesh(railsGeo, frameMat);
  railL.position.set(-ladderWidth / 2, 1.4, -1.2);
  const railR = railL.clone();
  railR.position.x = ladderWidth / 2;
  chair.add(railL, railR);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.78), seatMat);
  seat.position.set(0, 1.82, -1.8);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.62, 0.08), seatMat);
  back.position.set(0, 2.13, -2.18);
  chair.add(seat, back);

  const canopy = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), seatMat);
  canopy.rotation.x = -Math.PI / 2.4;
  canopy.position.set(0, 2.65, -1.8);
  chair.add(canopy);

  return chair;
}

function makeCourtSurfaceTexture(w = 2048, h = 4096) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");

  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#2f3673");
  grad.addColorStop(0.5, "#1f2b57");
  grad.addColorStop(1, "#182648");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  g.globalAlpha = 0.1;
  for (let i = 0; i < 1200; i += 1) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 3 + 1;
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.35})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  const stripeCount = 6;
  for (let i = 0; i <= stripeCount; i += 1) {
    const t = i / stripeCount;
    const y = t * h;
    g.strokeStyle = "rgba(255,255,255,0.04)";
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }

  return new THREE.CanvasTexture(c);
}

function buildGrandEntranceStairs({ stepCount = 12, run = 0.46, rise = 0.22, width = 26, landingDepth = 1.6 } = {}) {
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

function buildBillboard({ width = 8, height = 2.6, depth = 0.2, message = "TonPlaygram Championships" } = {}) {
  const board = new THREE.Group();
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const g = canvas.getContext("2d");
  const gradient = g.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, "#111827");
  gradient.addColorStop(1, "#0f172a");
  g.fillStyle = gradient;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "#10b981";
  g.font = "bold 96px 'Segoe UI', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(message, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    [
      new THREE.MeshStandardMaterial({ color: 0x0b1224 }),
      new THREE.MeshStandardMaterial({ color: 0x0b1224 }),
      new THREE.MeshStandardMaterial({ color: 0x0b1224 }),
      new THREE.MeshStandardMaterial({ color: 0x0b1224 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.2 }),
      new THREE.MeshStandardMaterial({ color: 0x0b1224 })
    ]
  );
  panel.position.y = height / 2;
  board.add(panel);

  const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.1 });
  const leg = new THREE.CylinderGeometry(0.08, 0.08, 1.4, 12);
  const legL = new THREE.Mesh(leg, legMat);
  legL.position.set(-width * 0.35, 0.7, 0);
  const legR = legL.clone();
  legR.position.x = width * 0.35;
  board.add(legL, legR);

  return board;
}

function buildUmpireChair() {
  const chair = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0b172a, roughness: 0.65, metalness: 0.22 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.12 });

  const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.2, 0.16), frameMat);
  ladder.position.y = 1.1;
  chair.add(ladder);

  const steps = 6;
  for (let i = 0; i < steps; i += 1) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.2), frameMat);
    rung.position.set(0, 0.2 + (i / steps) * 1.9, 0.12);
    chair.add(rung);
  }

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.6), seatMat);
  seat.position.set(0, 2.3, 0);
  chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.08), seatMat);
  back.position.set(0, 2.53, -0.26);
  chair.add(back);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.9), new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.55 }));
  canopy.position.set(0, 2.85, 0);
  chair.add(canopy);

  chair.position.set(0, 0, 0.6);
  return chair;
}

function buildNetAssembly(width) {
  const netGroup = new THREE.Group();
  const netHeight = 0.9;
  const net = new THREE.Mesh(
    new THREE.BoxGeometry(width, netHeight, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.7 })
  );
  net.position.y = netHeight / 2;
  netGroup.add(net);

  const tape = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
  tape.position.y = netHeight + 0.04;
  netGroup.add(tape);

  const postGeo = new THREE.CylinderGeometry(0.12, 0.12, netHeight + 0.6, 16);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.35 });
  const postL = new THREE.Mesh(postGeo, postMat);
  postL.position.set(-width / 2 - 0.05, (netHeight + 0.6) / 2, 0);
  const postR = postL.clone();
  postR.position.x = width / 2 + 0.05;
  netGroup.add(postL, postR);

  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, netHeight * 0.9, 0.04), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }));
  strap.position.set(0, netHeight * 0.45, 0.07);
  netGroup.add(strap);

  const umpire = buildUmpireChair();
  umpire.position.set(width / 2 + 1.1, 0, 0);
  netGroup.add(umpire);

  return netGroup;
}

function buildCourtSurroundings({ courtW, courtL, apron }) {
  const group = new THREE.Group();
  const trackMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(courtW + apron * 2.6, courtL + apron * 2.6),
    new THREE.MeshStandardMaterial({ color: 0x17192f, roughness: 0.92, metalness: 0.05 })
  );
  trackMesh.rotation.x = -Math.PI / 2;
  trackMesh.position.y = -0.0004;
  group.add(trackMesh);

  const surfaceTex = makeCourtSurfaceTexture();
  surfaceTex.anisotropy = 8;
  surfaceTex.wrapS = surfaceTex.wrapT = THREE.RepeatWrapping;
  surfaceTex.repeat.set(1, 1);
  const courtSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(courtW, courtL),
    new THREE.MeshStandardMaterial({ map: surfaceTex, roughness: 0.82, metalness: 0.04 })
  );
  courtSurface.rotation.x = -Math.PI / 2;
  courtSurface.position.y = 0.0006;
  group.add(courtSurface);

  const apronEdge = new THREE.Mesh(
    new THREE.PlaneGeometry(courtW + apron * 2, courtL + apron * 2),
    new THREE.MeshStandardMaterial({ color: 0x101426, roughness: 0.9, metalness: 0.02 })
  );
  apronEdge.rotation.x = -Math.PI / 2;
  apronEdge.position.y = 0.0002;
  group.add(apronEdge);

  return group;
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
  return group;
}

function buildRacketURT() {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.3,
    clearcoat: 0.4,
    clearcoatRoughness: 0.18
  });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x5b94ff, roughness: 0.35, metalness: 0.28 });
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.22 });

  const headOuter = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.12, 18, 36), frameMat);
  headOuter.rotation.x = Math.PI / 2;
  g.add(headOuter);
  const headInner = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 16, 32), innerMat);
  headInner.rotation.x = Math.PI / 2;
  g.add(headInner);

  const throat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.9), frameMat);
  throat.position.set(0, 0, 1.3);
  g.add(throat);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.22), accentMat);
  bridge.position.set(0, 0, 1.65);
  g.add(bridge);

  const handleR = 0.18;
  const handleLen = 1.2;
  const joinZ = 2.0;
  const handleGeo = new THREE.CylinderGeometry(handleR * 0.9, handleR, handleLen, 40, 1, true);
  const leather = new THREE.ShaderMaterial({
    uniforms: {
      uCol: { value: new THREE.Color("#2b2b2b") },
      uEdge: { value: new THREE.Color("#111") },
      uScale: { value: 24.0 }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `precision mediump float; varying vec2 vUv; uniform vec3 uCol,uEdge; uniform float uScale; float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=h(i),b=h(i+vec2(1,0)),c=h(i+vec2(0,1)),d=h(i+vec2(1,1));float nx=mix(a,b,f.x)+(c-a)*f.y*(1.-f.x)+(d-b)*f.x*f.y;return nx;} void main(){ float t = n(vUv*uScale); vec3 col = mix(uEdge,uCol, smoothstep(0.45,0.9,t)); gl_FragColor=vec4(col,1.0);} `
  });
  const handle = new THREE.Mesh(handleGeo, leather);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, 0, joinZ - (handleLen * 0.5 + 0.08));
  g.add(handle);
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(handleR * 0.95, handleR * 0.95, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x0e1116, roughness: 0.8 }));
  butt.rotation.x = Math.PI / 2;
  butt.position.copy(handle.position);
  butt.position.z -= handleLen * 0.5 + 0.11;
  g.add(butt);

  const decalCanvas = document.createElement("canvas");
  const dctx = decalCanvas.getContext("2d");
  decalCanvas.width = 512;
  decalCanvas.height = 128;
  dctx.fillStyle = "#22262e";
  dctx.fillRect(0, 0, 512, 128);
  dctx.font = "700 72px system-ui";
  dctx.fillStyle = "#f4f6fa";
  dctx.textAlign = "center";
  dctx.fillText("OS‑Racquet", 256, 88);
  const decalTex = new THREE.CanvasTexture(decalCanvas);
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.18), new THREE.MeshBasicMaterial({ map: decalTex, transparent: true }));
  decal.position.set(0, 0.08, 0.55);
  g.add(decal);

  return g;
}

function buildBallURT() {
  const felt = new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: new THREE.Color("#e6ff3b") },
      uB: { value: new THREE.Color("#cfe93a") },
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
  root.userData = { headPivot };
  root.scale.setScalar(0.608);
  return root;
}

export default function TennisBattleRoyal3D({ playerName, stakeLabel, trainingMode = false }) {
  const mountRef = useRef(null);
  const modeLabel = trainingMode ? "Training Mode" : "Fundraising AI";
  const modeSummary = trainingMode
    ? "Practice swipes and timing without staking."
    : "Stake contributes to the rally community pot.";

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    const width = Math.max(1, container.clientWidth || window.innerWidth || 360);
    const height = Math.max(1, container.clientHeight || window.innerHeight || 640);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.55;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.05, 800);

    const courtL = 23.77;
    const courtW = 9.2;
    const halfW = courtW / 2;
    const halfL = courtL / 2;
    const playerZ = halfL - 1.35;
    const cpuZ = -halfL + 1.35;

    // Lights and sky
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
    skyGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
    sky.position.y = -18;
    scene.add(sky);

    // Court and surrounds
    const apron = 4.2;
    const SERVICE_LINE_Z = 6.4;
    const SERVICE_BOX_INNER = 0.2;
    const courtSurroundings = buildCourtSurroundings({ courtW, courtL, apron });
    scene.add(courtSurroundings);

    function courtLinesTex(w = 2048, h = 4096) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.clearRect(0, 0, w, h);
      const s = h / courtL;
      const lineW = 12;
      g.strokeStyle = "#ffffff";
      g.lineWidth = lineW;
      g.lineJoin = "round";
      g.lineCap = "round";
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
      g.fillStyle = "#ffffff";
      const padLenM = 1.2;
      const padWideM = 0.2;
      const z0 = -padLenM / 2;
      const z1 = padLenM / 2;
      g.fillRect(X(0) - (lineW + padWideM * s) / 2, Z(z0), lineW + padWideM * s, padLenM * s);
      return new THREE.CanvasTexture(c);
    }
    const linesMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(courtW, courtL),
      new THREE.MeshBasicMaterial({ map: courtLinesTex(), transparent: true })
    );
    linesMesh.rotation.x = -Math.PI / 2;
    linesMesh.position.y = 0.001;
    courtSurroundings.add(linesMesh);

    const netAssembly = buildNetAssembly(courtW);
    scene.add(netAssembly);

    const billboards = [
      buildBillboard({ message: "Battle Royal Centre Court" }),
      buildBillboard({ message: "Powered by TonPlaygram" }),
      buildBillboard({ message: "Ace the Competition" })
    ];
    billboards[0].position.set(0, 0, -halfL - apron + 0.6);
    billboards[1].position.set(0, 0, halfL + apron - 0.6);
    billboards[2].position.set(-halfW - apron + 0.4, 0, 0);
    billboards[2].rotation.y = Math.PI / 2;
    billboards.forEach((b) => scene.add(b));

    const standOffsetZ = halfL + apron + 2.2;
    const northGrandstand = buildRoyalGrandstand();
    northGrandstand.position.set(0, 0, -standOffsetZ);
    scene.add(northGrandstand);

    const southGrandstand = buildRoyalGrandstand();
    southGrandstand.rotation.y = Math.PI;
    southGrandstand.position.set(0, 0, standOffsetZ);
    scene.add(southGrandstand);
    const stairs = buildGrandEntranceStairs();
    stairs.rotation.y = Math.PI / 2;
    stairs.position.set(halfW + apron + 3.2, 0, standOffsetZ - 1);
    scene.add(stairs);
    const broadcastRig = buildBroadcastCameraRig(1.25);
    broadcastRig.position.set(halfW + 1.8, 0, 0);
    scene.add(broadcastRig);

    const chairOffsetX = halfW + apron - 0.2;
    const leftChair = buildSidelineChair();
    leftChair.position.set(-chairOffsetX, 0, 0.6);
    leftChair.rotation.y = Math.PI / 2;
    scene.add(leftChair);
    const rightChair = buildSidelineChair();
    rightChair.position.set(chairOffsetX, 0, -0.6);
    rightChair.rotation.y = -Math.PI / 2;
    scene.add(rightChair);

    // Rackets and ball
    const ballR = 0.076 * 1.25;
    const ball = buildBallURT();
    ball.scale.setScalar(ballR / 0.26);
    scene.add(ball);

    const player = makeRacket();
    player.position.set(0, 0.65, playerZ);
    player.rotation.y = Math.PI / 2;
    scene.add(player);
    const enemy = makeRacket();
    enemy.position.set(0, 0.65, cpuZ);
    enemy.rotation.y = -Math.PI / 2;
    scene.add(enemy);

    // Physics state
    const velocity = new THREE.Vector3();
    const GRAVITY = -0.01;
    const BOUNCE = 0.82;
    const AIR = 0.996;
    let started = false;

    // Touch + mouse input
    let startX = 0;
    let startY = 0;
    let startT = 0;

    const screenToCourt = (x) => (x / renderer.domElement.clientWidth - 0.5) * courtW;

    const onDown = (x, y) => {
      startX = x;
      startY = y;
      startT = Date.now();
    };

    const onUp = (x, y) => {
      const distX = x - startX;
      const distY = startY - y;
      const time = Math.max((Date.now() - startT) / 1000, 0.15);

      if (distY > 40) {
        started = true;
        const power = Math.min((distY / time) * 0.0008, 0.38);
        velocity.x = THREE.MathUtils.clamp(distX * 0.00075, -0.18, 0.18);
        velocity.y = 0.12 + power * 0.18;
        velocity.z = -0.12 - power * 0.36;

        player.position.x = screenToCourt(startX);
        ball.position.set(player.position.x, player.position.y + 0.45, player.position.z - 0.42);
      }
    };

    const handleTouchStart = (e) => {
      const t = e.touches[0];
      if (!t) return;
      onDown(t.clientX, t.clientY);
    };
    const handleTouchEnd = (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      onUp(t.clientX, t.clientY);
    };
    const handleMouseDown = (e) => onDown(e.clientX, e.clientY);
    const handleMouseUp = (e) => onUp(e.clientX, e.clientY);

    renderer.domElement.addEventListener("touchstart", handleTouchStart, { passive: true });
    renderer.domElement.addEventListener("touchend", handleTouchEnd, { passive: true });
    renderer.domElement.addEventListener("mousedown", handleMouseDown);
    renderer.domElement.addEventListener("mouseup", handleMouseUp);

    // Helpers
    function updateRacketHeight() {
      const targetY = Math.max(0.65, Math.min(ball.position.y, 3));
      player.position.y += (targetY - player.position.y) * 0.2;
      enemy.position.y += (targetY - enemy.position.y) * 0.2;
    }

    function enemyAI() {
      if (!started) return;
      const t = Math.abs((enemy.position.z - ball.position.z) / (velocity.z || 0.01));
      const targetX = ball.position.x + velocity.x * t;
      enemy.position.x += (targetX - enemy.position.x) * 0.08;
      if (ball.position.distanceTo(enemy.position) < 2.0 && velocity.z < 0) {
        velocity.z = Math.abs(velocity.z) + 0.2;
        velocity.y = 0.2 + Math.random() * 0.1;
      }
    }

    function updateCamera() {
      const camTarget = new THREE.Vector3(player.position.x, 5.6, player.position.z + 9.8);
      camera.position.lerp(camTarget, 0.08);
      const lookTarget = new THREE.Vector3(player.position.x, player.position.y + 0.6, player.position.z - 1.2);
      camera.lookAt(lookTarget);
    }

    function physics() {
      if (!started) return;
      velocity.y += GRAVITY;
      ball.position.add(velocity);

      const inCourt = Math.abs(ball.position.x) <= halfW && Math.abs(ball.position.z) <= halfL;

      if (ball.position.y < ballR) {
        if (inCourt) {
          ball.position.y = ballR;
          velocity.y *= -BOUNCE;
          velocity.x *= AIR;
          velocity.z *= AIR;
        } else {
          velocity.set(0, 0, 0);
          started = false;
        }
      }

      if (ball.position.distanceTo(player.position) < 1.8 && velocity.z > 0) {
        velocity.z = -Math.abs(velocity.z) - 0.15;
        velocity.y = 0.2;
      }

      enemyAI();
      updateRacketHeight();
      updateCamera();
    }

    let rafId;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      physics();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = Math.max(1, container.clientWidth || window.innerWidth || 360);
      const h = Math.max(1, container.clientHeight || window.innerHeight || 640);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("touchstart", handleTouchStart);
      renderer.domElement.removeEventListener("touchend", handleTouchEnd);
      renderer.domElement.removeEventListener("mousedown", handleMouseDown);
      renderer.domElement.removeEventListener("mouseup", handleMouseUp);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [trainingMode]);

  return (
    <div
      ref={mountRef}
      style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", touchAction: "none" }}
      aria-label="3D Tennis Battle Royal"
    >
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          padding: "10px 12px",
          background: "rgba(8,11,24,0.7)",
          borderRadius: 12,
          color: "#e5e7eb",
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          maxWidth: 260,
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
          backdropFilter: "blur(6px)",
          pointerEvents: "none",
          zIndex: 12
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase", color: "#9ca3af" }}>
          Tennis Battle Royal
        </div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{modeLabel}</div>
        <div style={{ fontSize: 12, marginTop: 4, color: "#cbd5e1" }}>
          {stakeLabel ? `Stake: ${stakeLabel}` : "No stake applied"}
        </div>
        {playerName ? (
          <div style={{ fontSize: 12, marginTop: 2, color: "#cbd5e1" }}>Player: {playerName}</div>
        ) : null}
        <div style={{ fontSize: 11, marginTop: 6, color: "#94a3b8" }}>{modeSummary}</div>
        <div style={{ fontSize: 11, marginTop: 4, color: "#a5b4fc" }}>Opponent: Rally AI</div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 8,
          left: "50%",
          transform: "translateX(-50%)",
          color: "#fff",
          fontFamily: "Arial, sans-serif",
          fontSize: 14,
          zIndex: 10,
          textAlign: "center",
          pointerEvents: "none"
        }}
      >
        Swipe up to hit • Camera tracks ball • Smart AI
        {playerName ? ` • Player: ${playerName}` : ""}
        {stakeLabel ? ` • Stake: ${stakeLabel}` : ""}
        {trainingMode ? " • Training" : ""}
      </div>
    </div>
  );
}
