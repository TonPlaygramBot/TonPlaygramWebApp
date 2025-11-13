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

export default function TennisBattleRoyal3D({ playerName, stakeLabel }) {
  const containerRef = useRef(null);
  const [msg, setMsg] = useState(
    () =>
      `Swipe për serve/hit · Kamera fokusohet te topi · 1 BALL${
        playerName ? ` · ${playerName} vs AI` : ''
      }${stakeLabel ? ` · Stake ${stakeLabel}` : ''}`
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    const fitRenderer = () => {
      const w = Math.max(1, container.clientWidth || window.innerWidth || 360);
      const h = Math.max(1, container.clientHeight || window.innerHeight || 640);
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.85;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1020);

    const camera = new THREE.PerspectiveCamera(56, 1, 0.05, 600);
    fitRenderer();

    const hemi = new THREE.HemisphereLight(0xffffff, 0x1b2a44, 0.55);
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(16, 24, 18);
    scene.add(hemi, key);

    const courtL = 23.77;
    const courtW = 9.2;
    const halfL = courtL / 2;
    const halfW = courtW / 2;

    const track = new THREE.Mesh(
      new THREE.PlaneGeometry(courtW + 5.2, courtL + 5.2),
      new THREE.MeshStandardMaterial({ color: 0xb33a2c, roughness: 0.95 })
    );
    track.rotation.x = -Math.PI / 2;
    track.position.y = -0.002;
    scene.add(track);

    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(courtW, courtL),
      new THREE.MeshStandardMaterial({ color: 0x3a8b3d, roughness: 0.9 })
    );
    grass.rotation.x = -Math.PI / 2;
    scene.add(grass);

    const linesCanvas = document.createElement('canvas');
    linesCanvas.width = 2048;
    linesCanvas.height = 4096;
    const ctx = linesCanvas.getContext('2d');
    const scale = linesCanvas.height / courtL;
    const cx = linesCanvas.width / 2;
    const cz = linesCanvas.height / 2;
    const X = (x) => cx + x * scale;
    const Z = (z) => cz + z * scale;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;
    const line = (x1, z1, x2, z2) => {
      ctx.beginPath();
      ctx.moveTo(X(x1), Z(z1));
      ctx.lineTo(X(x2), Z(z2));
      ctx.stroke();
    };
    const box = (x1, z1, x2, z2) => {
      line(x1, z1, x2, z1);
      line(x2, z1, x2, z2);
      line(x2, z2, x1, z2);
      line(x1, z2, x1, z1);
    };
    const service = 6.4;
    box(-halfW, -halfL, halfW, halfL);
    line(-halfW, -service, halfW, -service);
    line(-halfW, service, halfW, service);
    line(0, -service, 0, service);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(X(-halfW - 0.1), Z(-0.6), 16, Z(0.6) - Z(-0.6));
    ctx.fillRect(X(halfW - 0.1), Z(-0.6), 16, Z(0.6) - Z(-0.6));
    const lines = new THREE.Mesh(
      new THREE.PlaneGeometry(courtW, courtL),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(linesCanvas), transparent: true })
    );
    lines.rotation.x = -Math.PI / 2;
    lines.position.y = 0.002;
    scene.add(lines);

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
    scene.add(north, south, east, west);

    const netCanvas = document.createElement('canvas');
    netCanvas.width = 512;
    netCanvas.height = 256;
    const ng = netCanvas.getContext('2d');
    ng.fillStyle = 'rgba(255,255,255,0.1)';
    ng.fillRect(0, 0, 512, 256);
    ng.strokeStyle = 'rgba(0,0,0,0.85)';
    ng.lineWidth = 2;
    for (let y = 10; y < 256; y += 18) {
      ng.beginPath();
      ng.moveTo(0, y);
      ng.lineTo(512, y);
      ng.stroke();
    }
    for (let x = 10; x < 512; x += 18) {
      ng.beginPath();
      ng.moveTo(x, 0);
      ng.lineTo(x, 256);
      ng.stroke();
    }
    const netMat = new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(netCanvas),
      transparent: true,
      roughness: 0.7,
      metalness: 0
    });
    const netH = 0.914;
    const net = new THREE.Mesh(new THREE.PlaneGeometry(courtW, netH), netMat);
    net.position.set(0, netH / 2, 0);
    scene.add(net);
    const tape = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const topTape = new THREE.Mesh(new THREE.BoxGeometry(courtW, 0.1, 0.03), tape);
    topTape.position.set(0, netH, 0.01);
    const bottomTape = topTape.clone();
    bottomTape.position.y = 0.05;
    scene.add(topTape, bottomTape);

    function makeRacket() {
      const group = new THREE.Group();
      const head = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 16, 72), new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.5, roughness: 0.4 }));
      head.rotation.x = Math.PI / 2;
      head.position.y = 1;
      group.add(head);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 1.1, 24), new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.5 }));
      handle.rotation.x = Math.PI / 2;
      handle.position.set(0, 0.55, -0.75);
      group.add(handle);
      group.userData.head = head;
      return group;
    }

    const player = makeRacket();
    const cpu = makeRacket();
    player.position.z = halfL - 1.2;
    player.rotation.y = Math.PI / 2;
    cpu.position.z = -halfL + 1.2;
    cpu.rotation.y = -Math.PI / 2;
    scene.add(player, cpu);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 24), new THREE.MeshStandardMaterial({ color: 0xd8ff43, roughness: 0.45 }));
    scene.add(ball);
    const shadowTex = new THREE.CanvasTexture((() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
      grad.addColorStop(0, 'rgba(0,0,0,0.3)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      return c;
    })());
    const shadow = new THREE.Sprite(new THREE.SpriteMaterial({ map: shadowTex, transparent: true }));
    shadow.scale.set(0.8, 0.8, 1);
    shadow.position.y = 0.01;
    scene.add(shadow);

    const state = { serveBy: 'player', serveSide: 'deuce', live: false };
    const position = new THREE.Vector3(0, 0.12, player.position.z - 0.8);
    const velocity = new THREE.Vector3();
    ball.position.copy(position);

    function resetServe(by) {
      state.serveBy = by;
      state.live = false;
      const idleX = state.serveBy === 'player' ? halfW - 0.2 : -halfW + 0.2;
      if (by === 'player') {
        player.position.set(idleX, 0, halfL - 0.8);
        position.set(idleX * 0.85, 1.15, halfL - 0.6);
      } else {
        cpu.position.set(-idleX, 0, -halfL + 0.8);
        position.set(-idleX * 0.85, 1.15, -halfL + 0.6);
      }
      velocity.setScalar(0);
      ball.position.copy(position);
      shadow.position.set(position.x, 0.01, position.z);
      setMsg(by === 'player' ? `Serve (You) – deuce` : 'Serve (CPU) – deuce');
      if (by === 'cpu') scheduleCpuServe();
    }

    let cpuServeTimeout = null;

    function ensureNetClear(from, vec) {
      const t = (0 - from.z) / (vec.z || 1e-6);
      if (t <= 0) return;
      const y = from.y + vec.y * t + 0.5 * -9.81 * t * t;
      if (y < netH + 0.12) vec.y += (netH + 0.12 - y) / Math.max(t, 0.2);
    }

    resetServe('player');

    const input = { active: false, sx: 0, sy: 0, lx: 0, ly: 0, start: 0 };
    const onDown = (e) => {
      input.active = true;
      input.sx = input.lx = e.clientX;
      input.sy = input.ly = e.clientY;
      input.start = performance.now();
    };
    const onMove = (e) => {
      if (!input.active) return;
      const dx = e.clientX - input.lx;
      const dy = e.clientY - input.ly;
      input.lx = e.clientX;
      input.ly = e.clientY;
      player.position.x = THREE.MathUtils.clamp(player.position.x + dx * 0.006, -halfW * 0.9, halfW * 0.9);
      player.position.z = THREE.MathUtils.clamp(player.position.z + dy * 0.008, halfL - 3, halfL + 0.6);
    };
    const onUp = () => {
      if (!input.active) return;
      const dt = Math.max(1, performance.now() - input.start);
      const vx = ((input.lx - input.sx) / dt) * 1000;
      const vy = ((input.ly - input.sy) / dt) * 1000;
      const spd = Math.hypot(vx, vy);
      if (!state.live && state.serveBy === 'player') {
        const p = THREE.MathUtils.clamp(spd / 1100, 0.28, 0.88);
        velocity.set(THREE.MathUtils.clamp(vx / 900, -1.4, 1.4) * 2, Math.max(1.5, -vy / 800 + 1.1), -18 * p);
        ensureNetClear(position.clone(), velocity);
        state.live = true;
        setMsg('Serve në ajër');
      } else if (state.live && position.z > 0 && Math.abs(position.z - (player.position.z - 0.7)) < 2.2 && position.y < 2.2) {
        const p = THREE.MathUtils.clamp(spd / 1150, 0.25, 0.95);
        velocity.set(THREE.MathUtils.clamp(vx / 900, -1.6, 1.6) * 1.8 + vx * 0.001, Math.max(0.8, -vy * 0.001 + 1.0), -(8 + 11 * p));
        setMsg('Top i kthyer');
      }
      input.active = false;
    };

    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    let last = performance.now();
    let raf = 0;
    function step(dt) {
      if (state.live) {
        velocity.y += -9.81 * dt;
        position.addScaledVector(velocity, dt);
        if (position.y <= 0.11) {
          position.y = 0.11;
          velocity.y = -velocity.y * 0.8;
          velocity.x *= 0.82;
          velocity.z *= 0.82;
          setMsg('Bounce');
        }
        const crossNet = position.z * (position.z - velocity.z * dt) <= 0;
        if (crossNet && position.y < netH + 0.12) {
          resetServe(state.serveBy);
        }
        if (Math.abs(position.x) > halfW || Math.abs(position.z) > halfL + 0.8) {
          const next = state.serveBy === 'player' ? 'cpu' : 'player';
          resetServe(next);
          if (next === 'cpu') scheduleCpuServe();
        }
      }

      if (state.live && velocity.z < 0) {
        const t = Math.max(0.05, (position.z - cpu.position.z) / -velocity.z);
        const predX = position.x + velocity.x * t;
        cpu.position.x += (THREE.MathUtils.clamp(predX, -halfW * 0.9, halfW * 0.9) - cpu.position.x) * 0.22;
        const close = Math.abs(position.z - cpu.position.z) < 1.7 && Math.abs(predX - cpu.position.x) < 1.4 && position.y < 2;
        if (close) {
          velocity.set(THREE.MathUtils.clamp(predX / halfW, -1, 1) * 1.2, THREE.MathUtils.randFloat(3.5, 4.5), THREE.MathUtils.randFloat(7.5, 10.5));
          ensureNetClear(position.clone(), velocity);
          state.live = true;
          setMsg('CPU return');
        }
      }

      ball.position.copy(position);
      shadow.position.set(position.x, 0.01, position.z);

      const camBack = 8;
      const camHeight = 3.6;
      if (!state.live && state.serveBy === 'player') {
        const offset = state.serveSide === 'deuce' ? 1.2 : -1.2;
        camera.position.lerp(new THREE.Vector3(player.position.x + offset, camHeight, player.position.z + camBack), 0.2);
        camera.lookAt(new THREE.Vector3(0, 1.2, -halfL + 0.5));
      } else {
        const followX = THREE.MathUtils.lerp(player.position.x * 0.3, ball.position.x, 0.65);
        const followY = camHeight + THREE.MathUtils.clamp((ball.position.y - 1) * 0.3, -0.4, 1.5);
        const baseZ = player.position.z + camBack;
        camera.position.lerp(new THREE.Vector3(followX, followY, baseZ), 0.18);
        camera.lookAt(new THREE.Vector3(THREE.MathUtils.lerp(player.position.x * 0.1, ball.position.x, 0.7), Math.max(1, ball.position.y), THREE.MathUtils.lerp(player.position.z - 1.1, ball.position.z, 0.7)));
      }
    }

    function scheduleCpuServe() {
      if (cpuServeTimeout) clearTimeout(cpuServeTimeout);
      cpuServeTimeout = setTimeout(() => {
        if (state.live || state.serveBy !== 'cpu') return;
        velocity.set(THREE.MathUtils.randFloatSpread(1.1), 6, THREE.MathUtils.randFloat(7, 9));
        ensureNetClear(position.clone(), velocity);
        state.live = true;
        setMsg('CPU serve');
      }, 800);
    }

    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.03, (now - last) / 1000);
      last = now;
      step(dt);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    window.addEventListener('resize', fitRenderer);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fitRenderer);
      if (cpuServeTimeout) clearTimeout(cpuServeTimeout);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [playerName, stakeLabel]);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#0c1020' }}>
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          right: 8,
          textAlign: 'center',
          color: '#e5e7eb',
          fontFamily: 'ui-sans-serif, system-ui',
          fontSize: 12,
          opacity: 0.92
        }}
      >
        {msg}
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 560, height: '100%', width: '100%' }} />
    </div>
  );
}
