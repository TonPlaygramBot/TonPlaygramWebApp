import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function TennisBattleRoyal3D({ playerName, stakeLabel }) {
  const containerRef = useRef(null);
  const [msg, setMsg] = useState(
    () =>
      `Swipe për serve/hit · Kamera fokusohet te topi · 1 BALL${
        playerName ? ` · ${playerName} vs AI` : ""
      }${stakeLabel ? ` · Stake ${stakeLabel}` : ""}`
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Renderer
    let W = Math.max(1, container.clientWidth || window.innerWidth || 360);
    let H = Math.max(1, container.clientHeight || window.innerHeight || 640);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    if ("outputColorSpace" in renderer)
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    else renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.85;
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    // Scene / Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1020);
    const camera = new THREE.PerspectiveCamera(56, W / H, 0.05, 800);

    // Court dims (meters)
    const courtL = 23.77;
    const courtW = 9.2; // posts align with sidelines
    const halfW = courtW / 2,
      halfL = courtL / 2;

    // Player/cpu Z positions
    const playerZ = halfL - 1.35; // +Z side
    const cpuZ = -halfL + 1.35; // -Z side

    // Player-cam params
    let camBack = 8.0; // distance behind player along +Z
    let camHeight = 3.8; // a bit higher

    // Lighting (minimal to avoid shader uniform overflow)
    const hemi = new THREE.HemisphereLight(0xffffff, 0x1b2a44, 0.45);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(16, 22, 18);
    scene.add(key);

    // === GRASS (tileable) with DESHADOW processing ===
    const maxAniso = renderer.capabilities.getMaxAnisotropy?.() || 8;
    const grassURL = "https://threejs.org/examples/textures/terrain/grasslight-big.jpg";

    const matGrass = new THREE.MeshStandardMaterial({
      color: 0x3a8b3d,
      roughness: 0.94,
      metalness: 0.0,
      emissive: new THREE.Color("#153a18"),
      emissiveIntensity: 0.05
    });

    function loadDeshadowedGrass(url, onReady) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const aspect = img.height / img.width;
        const w = 1024;
        const h = Math.round(w * aspect);
        const base = document.createElement("canvas");
        base.width = w;
        base.height = h;
        const gb = base.getContext("2d");
        gb.drawImage(img, 0, 0, w, h);
        const small = document.createElement("canvas");
        small.width = Math.max(64, w >> 4);
        small.height = Math.max(64, h >> 4);
        const gs = small.getContext("2d");
        gs.imageSmoothingEnabled = true;
        gs.drawImage(base, 0, 0, small.width, small.height);
        const blur = document.createElement("canvas");
        blur.width = w;
        blur.height = h;
        const gl = blur.getContext("2d");
        gl.imageSmoothingEnabled = true;
        gl.drawImage(small, 0, 0, w, h);

        const src = gb.getImageData(0, 0, w, h);
        const low = gl.getImageData(0, 0, w, h);
        const d = src.data,
          b = low.data;
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
        gb.globalCompositeOperation = "overlay";
        gb.fillStyle = "rgba(40,120,44,0.08)";
        gb.fillRect(0, 0, w, h);
        gb.globalCompositeOperation = "source-over";

        const tex = new THREE.CanvasTexture(base);
        tex.anisotropy = Math.min(16, maxAniso);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        if ("colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
        else tex.encoding = THREE.sRGBEncoding;
        tex.repeat.set(8, 18);
        onReady(tex);
      };
      img.src = url;
    }

    function courtLinesTex(w = 2048, h = 4096) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.clearRect(0, 0, w, h);
      const s = h / courtL; // pixels per meter along Z
      const lineW = 12; // wider lines
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
      const serviceZ = 6.4;
      box(-halfW, -halfL, halfW, halfL);
      line(-halfW, -halfL, halfW, -halfL);
      line(-halfW, halfL, halfW, halfL);
      line(-halfW, -serviceZ, halfW, -serviceZ);
      line(-halfW, serviceZ, halfW, serviceZ);
      line(0, -serviceZ, 0, serviceZ);
      // Post pads
      g.fillStyle = "#ffffff";
      const padLenM = 1.2,
        padWideM = 0.2;
      const z0 = -padLenM / 2,
        z1 = padLenM / 2;
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

    // —— Red rubber running-track apron ——
    function trackTex(w = 1024, h = 1024) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.fillStyle = "#b33a2c";
      g.fillRect(0, 0, w, h);
      const dots = Math.floor(w * h * 0.004);
      for (let i = 0; i < dots; i++) {
        const x = Math.random() * w,
          y = Math.random() * h;
        const r = Math.random() * 1.6 + 0.2;
        g.fillStyle =
          Math.random() < 0.5
            ? "rgba(255,190,180,0.35)"
            : "rgba(40,12,10,0.35)";
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = Math.min(16, maxAniso);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace;
      else t.encoding = THREE.sRGBEncoding;
      t.repeat.set(1, 1);
      return t;
    }
    const matTrack = new THREE.MeshStandardMaterial({
      map: trackTex(),
      roughness: 0.96,
      metalness: 0.0
    });

    // ——— Ground/Court ———
    const apron = 2.6;
    const trackMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(courtW + apron * 2, courtL + apron * 2),
      matTrack
    );
    trackMesh.rotation.x = -Math.PI / 2;
    trackMesh.position.y = -0.001;
    scene.add(trackMesh);

    const grassMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(courtW, courtL),
      matGrass
    );
    grassMesh.rotation.x = -Math.PI / 2;
    grassMesh.position.y = 0.0;
    scene.add(grassMesh);

    const linesMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(courtW, courtL),
      matLines
    );
    linesMesh.rotation.x = -Math.PI / 2;
    linesMesh.position.y = 0.002;
    scene.add(linesMesh);

    loadDeshadowedGrass(grassURL, (tex) => {
      matGrass.map = tex;
      matGrass.needsUpdate = true;
    });

    // Bleachers on both sides (no VIP rooms)
    function buildBleachers(side = 1) {
      const group = new THREE.Group();
      const seatMat = new THREE.MeshStandardMaterial({
        color: 0x1f3b6b,
        roughness: 0.45,
        metalness: 0.2
      });
      const riserMat = new THREE.MeshStandardMaterial({
        color: 0x4b5563,
        roughness: 0.7,
        metalness: 0.1
      });
      const supportMat = new THREE.MeshStandardMaterial({
        color: 0x2d3748,
        roughness: 0.6,
        metalness: 0.25
      });
      const rows = 8;
      const seatsPerRow = 18;
      const rowDepth = 1.1;
      const rowHeight = 0.5;
      const baseX = side * (halfW + apron + 1.4);
      for (let r = 0; r < rows; r++) {
        const zOffset = -((seatsPerRow - 1) * 1.8) / 2;
        const y = 0.3 + r * rowHeight;
        const zBase = zOffset - r * 0.12;
        const tread = new THREE.Mesh(
          new THREE.BoxGeometry(34, 0.16, rowDepth + 0.2),
          riserMat
        );
        tread.position.set(baseX, y - 0.1, zBase);
        group.add(tread);
        for (let c = 0; c < seatsPerRow; c++) {
          const seat = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 0.08, 0.7),
            seatMat
          );
          const back = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 0.5, 0.08),
            seatMat
          );
          const x = baseX;
          const z = zOffset + c * 1.8 - r * 0.08;
          seat.position.set(x, y, z);
          back.position.set(x - side * 0.25, y + 0.28, z - rowDepth / 2);
          group.add(seat, back);
        }
      }
      const supportGeo = new THREE.BoxGeometry(0.18, rows * rowHeight + 0.6, 0.18);
      const supports = [-16, -8, 0, 8, 16];
      supports.forEach((z) => {
        const s1 = new THREE.Mesh(supportGeo, supportMat);
        s1.position.set(baseX - side * 1.2, (rows * rowHeight) / 2, z);
        const s2 = s1.clone();
        s2.position.x = baseX + side * 1.2;
        group.add(s1, s2);
      });
      group.rotation.y = side === 1 ? Math.PI : 0;
      return group;
    }

    scene.add(buildBleachers(1));
    scene.add(buildBleachers(-1));

    // Tennis net (with white top/bottom tape) + posts
    function tennisNetTex(w = 1024, h = 512, cell = 8, thickness = 2) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.clearRect(0, 0, w, h);
      g.strokeStyle = "rgba(18,18,18,0.96)";
      g.lineWidth = thickness;
      g.lineJoin = "round";
      g.lineCap = "round";
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
      g.fillStyle = "rgba(255,255,255,0.06)";
      for (let y = cell; y <= h - cell; y += cell)
        for (let x = cell; x <= w - cell; x += cell) g.fillRect(x - 1, y - 1, 2, 2);
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = Math.min(8, maxAniso);
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    }

    const matTape = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const matPost = new THREE.MeshStandardMaterial({
      color: 0xb7bcc7,
      roughness: 0.45,
      metalness: 0.35
    });
    const netH = 0.914,
      netW = courtW;
    const netTex = tennisNetTex(1024, 512, 7, 2);
    const netMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(netW, netH, 1, 1),
      new THREE.MeshStandardMaterial({
        map: netTex,
        roughness: 0.8,
        metalness: 0.0,
        transparent: true,
        opacity: 1.0,
        color: 0xffffff
      })
    );
    netMesh.position.set(0, netH / 2, 0);
    scene.add(netMesh);
    const tapeH = 0.09;
    const topTape = new THREE.Mesh(
      new THREE.BoxGeometry(netW, tapeH, 0.02),
      matTape
    );
    topTape.position.set(0, netH - tapeH / 2, 0.005);
    scene.add(topTape);
    const botTape = new THREE.Mesh(
      new THREE.BoxGeometry(netW, tapeH, 0.02),
      matTape
    );
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

    // Umpire stand
    const ump = new THREE.Group();
    const legH = 1.45,
      legR = 0.035,
      span = 0.6;
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x6b7280,
      roughness: 0.6,
      metalness: 0.2
    });
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const cyl = new THREE.Mesh(
          new THREE.CylinderGeometry(legR, legR, legH, 12),
          legMat
        );
        cyl.position.set((sx * span) / 2, legH / 2, (sz * span) / 2);
        ump.add(cyl);
      }
    const plat = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.06, 0.72),
      new THREE.MeshStandardMaterial({
        color: 0x9ca3af,
        roughness: 0.7,
        metalness: 0.15
      })
    );
    plat.position.y = legH + 0.03;
    ump.add(plat);
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.05, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.6 })
    );
    seat.position.set(0, legH + 0.36, 0);
    ump.add(seat);
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.4, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.6 })
    );
    back.position.set(0, legH + 0.56, -0.18);
    ump.add(back);
    const ladder = new THREE.Group();
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xbfbfbf,
      roughness: 0.55
    });
    const railL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.2, 10),
      railMat
    );
    railL.position.set(-0.28, 0.6, 0.42);
    ladder.add(railL);
    const railR2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.2, 10),
      railMat
    );
    railR2.position.set(0.28, 0.6, 0.42);
    ladder.add(railR2);
    for (let i = 0; i < 5; i++) {
      const y = 0.18 + i * 0.2;
      const step = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.52, 10),
        railMat
      );
      step.rotation.z = Math.PI / 2;
      step.position.set(0, y, 0.42);
      ladder.add(step);
    }
    ump.add(ladder);
    ump.position.set(halfW + 0.75, 0, 0.1);
    scene.add(ump);

    // ——— Rackets & Ball ———
    class EllipseCurve3D extends THREE.Curve {
      constructor(a = 0.74, b = 0.92) {
        super();
        this.a = a;
        this.b = b;
      }
      getPoint(t) {
        const ang = t * 2 * Math.PI;
        return new THREE.Vector3(
          this.a * Math.cos(ang),
          0,
          this.b * Math.sin(ang)
        );
      }
    }

    function buildRacketURT() {
      const g = new THREE.Group();
      const a = 0.74,
        b = 0.92;
      const tubeRad = 0.032;
      const ellipse = new EllipseCurve3D(a, b);
      const hoopGeo = new THREE.TubeGeometry(ellipse, 220, tubeRad, 20, true);
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x22262e,
        metalness: 0.55,
        roughness: 0.38
      });
      const hoop = new THREE.Mesh(hoopGeo, frameMat);
      g.add(hoop);
      const bump = new THREE.Mesh(
        new THREE.TorusGeometry(a * 0.985, 0.008, 10, 160),
        new THREE.MeshStandardMaterial({ color: 0x1a1f27, roughness: 0.6 })
      );
      bump.rotation.x = Math.PI / 2;
      bump.scale.z = b / a;
      bump.position.y = 0.009;
      g.add(bump);
      const strings = new THREE.Group();
      const sMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        roughness: 0.35,
        metalness: 0.0
      });
      const count = 22;
      const innerA = a - tubeRad * 1.05;
      const innerB = b - tubeRad * 1.05;
      const thick = 0.008;
      for (let i = -(count / 2); i <= count / 2; i++) {
        const x = (i * (innerA * 1.7)) / count;
        if (Math.abs(x) >= innerA) continue;
        const zmax =
          innerB * Math.sqrt(Math.max(0, 1 - (x / innerA) * (x / innerA)));
        const len = Math.max(0.02, zmax * 2 * 0.98);
        const geo = new THREE.BoxGeometry(thick, thick, len);
        const mesh = new THREE.Mesh(geo, sMat);
        mesh.position.set(x, 0, 0);
        strings.add(mesh);
      }
      for (let i = -(count / 2); i <= count / 2; i++) {
        const z = (i * (innerB * 1.7)) / count;
        if (Math.abs(z) >= innerB) continue;
        const xmax =
          innerA * Math.sqrt(Math.max(0, 1 - (z / innerB) * (z / innerB)));
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
      const innerA2 = a - tubeRad * 0.6,
        innerB2 = b - tubeRad * 0.6;
      const pL = new THREE.Vector3(
        innerA2 * Math.cos(thL),
        0,
        innerB2 * Math.sin(thL)
      );
      const pR = new THREE.Vector3(
        innerA2 * Math.cos(thR),
        0,
        innerB2 * Math.sin(thR)
      );
      const joinZ = -(b + 0.55);
      const J = new THREE.Vector3(0, 0, joinZ);
      const armL = beamBetween(pL, J, 0.06, 0.1);
      const armR = beamBetween(pR, J, 0.06, 0.1);
      g.add(armL, armR);
      const handleLen = 2.1,
        handleR = 0.11;
      const leather = new THREE.ShaderMaterial({
        uniforms: {
          uCol: { value: new THREE.Color("#2b2b2b") },
          uEdge: { value: new THREE.Color("#111") },
          uScale: { value: 24.0 }
        },
        vertexShader:
          "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader:
          "precision mediump float; varying vec2 vUv; uniform vec3 uCol,uEdge; uniform float uScale; float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=h(i),b=h(i+vec2(1,0)),c=h(i+vec2(0,1)),d=h(i+vec2(1,1));float nx=mix(a,b,f.x)+(c-a)*f.y*(1.-f.x)+(d-b)*f.x*f.y;return nx;} void main(){ float t = n(vUv*uScale); vec3 col = mix(uEdge,uCol, smoothstep(0.45,0.9,t)); gl_FragColor=vec4(col,1.0);} ",
      });
      const handleGeo = new THREE.CylinderGeometry(
        handleR * 0.9,
        handleR,
        handleLen,
        40,
        1,
        true
      );
      const handle = new THREE.Mesh(handleGeo, leather);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(0, 0, joinZ - handleLen * 0.5 - 0.08);
      g.add(handle);
      const butt = new THREE.Mesh(
        new THREE.CylinderGeometry(handleR * 0.95, handleR * 0.95, 0.12, 24),
        new THREE.MeshStandardMaterial({ color: 0x0e1116, roughness: 0.8 })
      );
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
      dctx.fillText("OS-Racquet", 256, 88);
      const decalTex = new THREE.CanvasTexture(decalCanvas);
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.18),
        new THREE.MeshBasicMaterial({ map: decalTex, transparent: true })
      );
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
        vertexShader:
          "varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader:
          "precision mediump float; varying vec3 vP; varying vec3 vN; uniform vec3 uA,uB; uniform float uExp; float h(vec3 p){return fract(sin(dot(p,vec3(27.1,57.7,12.4)))*43758.5453);} float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); float a=h(i), b=h(i+vec3(1,0,0)), c=h(i+vec3(0,1,0)), d=h(i+vec3(1,1,0)); float e=h(i+vec3(0,0,1)), f2=h(i+vec3(1,0,1)), g=h(i+vec3(0,1,1)), h2=h(i+vec3(1,1,1)); float nx=mix(a,b,f.x)+(c-a)*f.y*(1.0-f.x)+(d-b)*f.x*f.y; float ny=mix(e,f2,f.x)+(g-e)*f.y*(1.0-f.x)+(h2-f2)*f.x*f.y; return mix(nx,ny,f.z);} float fbm(vec3 p){ float v=0.,amp=0.5; for(int i=0;i<6;i++){ v+=amp*n(p); p*=2.02; amp*=0.5;} return v;} vec3 aces(vec3 x){const float A=2.51,B=0.03,C=2.43,D=0.59,E=0.14; vec3 y=max(vec3(0.0),x*uExp); return clamp((y*(A*y+B))/(y*(C*y+D)+E),0.0,1.0);} void main(){ float f=fbm(vP*7.0+normalize(vN)*2.0); vec3 col=mix(uA,uB,smoothstep(0.35,0.8,f)); gl_FragColor=vec4(aces(col),1.0); }",
        lights: false
      });
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.26, 48, 36), felt);
      const seamMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.4
      });
      const band = new THREE.TorusGeometry(0.26, 0.008, 12, 96);
      const s1 = new THREE.Mesh(band, seamMat);
      s1.rotation.y = Math.PI / 2;
      ball.add(s1);
      const s2 = new THREE.Mesh(band, seamMat);
      s2.rotation.x = Math.PI / 3;
      ball.add(s2);
      return ball;
    }

    // Wrapper keep API: makeRacket() with userData.headPivot
    function makeRacket() {
      const root = new THREE.Group();
      const headPivot = new THREE.Group();
      root.add(headPivot);
      const urt = buildRacketURT();
      urt.rotation.x = 0; // HORIZONTAL face (parallel to ground)
      urt.position.y = 1.0;
      headPivot.add(urt);
      root.userData = { headPivot, swing: 0, swingLR: 0 };
      // Smaller racket (again)
      root.scale.setScalar(0.76);
      return root;
    }

    // Ball + shadow + trail — size +50%
    const ballR = 0.076 * 1.5; // previously 0.076 -> now +50%
    const ball = buildBallURT();
    const s = ballR / 0.26;
    ball.scale.setScalar(s);
    scene.add(ball);

    const sC = document.createElement("canvas");
    sC.width = sC.height = 96;
    const sg = sC.getContext("2d");
    const rg = sg.createRadialGradient(48, 48, 8, 48, 48, 46);
    rg.addColorStop(0, "rgba(0,0,0,0.35)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    sg.fillStyle = rg;
    sg.fillRect(0, 0, 96, 96);
    const sT = new THREE.CanvasTexture(sC);
    const sM = new THREE.SpriteMaterial({
      map: sT,
      transparent: true,
      depthWrite: false
    });
    const shadow = new THREE.Sprite(sM);
    shadow.scale.set(ballR * 10, ballR * 10, 1);
    shadow.position.y = 0.01;
    scene.add(shadow);

    const trailN = 14;
    const trailGeom = new THREE.BufferGeometry();
    const trailPos = new Float32Array(trailN * 3);
    trailGeom.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
    const trail = new THREE.Line(
      trailGeom,
      new THREE.LineBasicMaterial({ transparent: true, opacity: 0.22 })
    );
    scene.add(trail);
    function updateTrail() {
      for (let i = trailN - 1; i > 0; i--) {
        trailPos[i * 3 + 0] = trailPos[(i - 1) * 3 + 0];
        trailPos[i * 3 + 1] = trailPos[(i - 1) * 3 + 1];
        trailPos[i * 3 + 2] = trailPos[(i - 1) * 3 + 2];
      }
      trailPos[0] = ball.position.x;
      trailPos[1] = ball.position.y;
      trailPos[2] = ball.position.z;
      trailGeom.attributes.position.needsUpdate = true;
    }

    // Bounce ring
    const hitRing = new THREE.Mesh(
      new THREE.RingGeometry(ballR * 0.86, ballR * 1.12, 36),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
    );
    hitRing.rotation.x = -Math.PI / 2;
    hitRing.position.y = 0.002;
    scene.add(hitRing);
    let hitTTL = 0;

    // Players (FIX ORIENTATION: player handle toward +Z, CPU handle toward -Z)
    const player = makeRacket();
    player.position.set(0, 0, playerZ);
    player.rotation.y = Math.PI / 2;
    scene.add(player);
    const cpu = makeRacket();
    cpu.position.set(0, 0, cpuZ);
    cpu.rotation.y = -Math.PI / 2;
    scene.add(cpu);

    // Game/physics state
    const state = {
      gravity: -9.81,
      drag: 0.48,
      cor: 0.8,
      fric: 0.18,
      live: false,
      serveBy: "player",
      serveSide: "deuce",
      attempts: 2
    };
    const pos = new THREE.Vector3(0, ballR + 0.01, playerZ - 1.0);
    const vel = new THREE.Vector3();
    let lastHitter = "player";
    ball.position.copy(pos);

    // ===== Helper: CPU projectile solver aiming into player's court =====
    function solveShot(from, to, g, tSec) {
      const t = tSec;
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const dy = to.y - from.y;
      const vx = dx / t;
      const vz = dz / t;
      const vy = (dy - 0.5 * g * t * t) / t; // g negative
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

    // Camera control — dynamic focus on ball while staying behind the player
    function placeCamera() {
      const servingDiag = !state.live && state.serveBy === "player";
      if (servingDiag) {
        const sideOffset = state.serveSide === "deuce" ? 1.25 : -1.25;
        const target = new THREE.Vector3(
          player.position.x + sideOffset,
          camHeight,
          player.position.z + camBack
        );
        camera.position.lerp(target, 0.25);
        camera.lookAt(new THREE.Vector3(0, 1.2, -halfL + 1.0));
        return;
      }
      // Lateral follows mix of player and ball X
      const followX = THREE.MathUtils.lerp(
        player.position.x * 0.25,
        ball.position.x * 0.55,
        0.65
      );
      // Height reacts to ball height a bit
      const followY =
        camHeight +
        THREE.MathUtils.clamp((ball.position.y - 1.0) * 0.35, -0.5, 1.8);
      // Always behind player's side
      const baseZ = player.position.z + camBack;
      const target = new THREE.Vector3(followX, followY, baseZ);
      camera.position.lerp(target, 0.18);
      const onOurHalf = ball.position.z > 0;
      const lookMix = onOurHalf ? 0.82 : 0.62;
      const look = new THREE.Vector3(
        THREE.MathUtils.lerp(
          player.position.x * 0.08,
          ball.position.x,
          lookMix
        ),
        THREE.MathUtils.lerp(1.15, Math.max(1.0, ball.position.y), lookMix),
        THREE.MathUtils.lerp(
          Math.max(0.2, player.position.z - 1.2),
          ball.position.z,
          lookMix
        )
      );
      camera.lookAt(look);
    }

    // Helpers
    function inSinglesX(x) {
      return Math.abs(x) <= halfW - 0.05;
    }

    // Serve prep
    let cpuSrvTO = null;
    function prepareServe(by) {
      state.serveBy = by;
      state.attempts = 2;
      state.live = false;
      const idleX = state.serveSide === "deuce" ? halfW - 0.2 : -halfW + 0.2;
      if (by === "player") {
        player.position.set(idleX, 0, halfL + 0.55);
        pos.set(idleX * 0.88, 1.34, halfL - 0.25);
      } else {
        cpu.position.set(-idleX, 0, -halfL - 0.55);
        pos.set(-idleX * 0.88, 1.34, -halfL + 0.25);
      }
      vel.set(0, 0, 0);
      ball.position.copy(pos);
      shadow.position.set(pos.x, 0.01, pos.z);
      setMsg(by === "player" ? `Serve (You) – ${state.serveSide}` : `Serve (CPU) – ${state.serveSide}`);
      lastHitter = by;
      if (cpuSrvTO) {
        clearTimeout(cpuSrvTO);
        cpuSrvTO = null;
      }
      if (by === "cpu") {
        cpuSrvTO = setTimeout(() => {
          if (state.live) return;
          const tx = THREE.MathUtils.randFloatSpread(1.2);
          const tz = THREE.MathUtils.randFloat(halfL - 1.8, halfL - 0.9);
          const to = new THREE.Vector3(tx, ballR + 0.06, tz);
          let v0 = solveShot(
            pos.clone(),
            to,
            state.gravity,
            THREE.MathUtils.randFloat(0.9, 1.15)
          );
          v0 = ensureNetClear(pos.clone(), v0, state.gravity, netH);
          vel.copy(v0.multiplyScalar(0.83));
          state.live = true;
          setMsg("CPU serve");
          cpu.userData.swing = 0.9;
          cpu.userData.swingLR = THREE.MathUtils.clamp(tx / halfW, -1, 1);
          lastHitter = "cpu";
        }, 750);
      }
    }

    // Input: swipe serve & hit (player) + move racket with swipe
    const el = renderer.domElement;
    el.style.touchAction = "none";
    let touching = false,
      sx = 0,
      sy = 0,
      lx = 0,
      ly = 0,
      st = 0;
    function onDown(e) {
      touching = true;
      sx = lx = e.clientX;
      sy = ly = e.clientY;
      st = performance.now();
    }
    function onMove(e) {
      if (!touching) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      // Move player racket with swipe (x/z) — mobile friendly
      player.position.x = THREE.MathUtils.clamp(
        player.position.x + dx * 0.006,
        -halfW * 0.95,
        halfW * 0.95
      );
      player.position.z = THREE.MathUtils.clamp(
        player.position.z + dy * 0.008,
        halfL - 3.0,
        halfL + 0.8
      );
    }
    function onUp() {
      if (!touching) return;
      touching = false;
      const dt = Math.max(1, performance.now() - st);
      const vx = ((lx - sx) / dt) * 1000;
      const vy = ((ly - sy) / dt) * 1000;
      const spd = Math.hypot(vx, vy);
      if (!state.live) {
        if (state.serveBy === "player") {
          const p = THREE.MathUtils.clamp(spd / 1050, 0.3, 0.9);
          const aimX = THREE.MathUtils.clamp(vx / 900, -1.5, 1.5);
          vel.set(aimX * 2.1, Math.max(1.6, -vy / 750 + 1.1), -19.4 * p);
          pos.y = 1.35;
          state.live = true;
          setMsg("Serve në ajër");
          player.userData.swing = 0.6 + 0.8 * p;
          player.userData.swingLR = THREE.MathUtils.clamp(vx / 1200, -1, 1);
          lastHitter = "player";
        }
      } else {
        const near = pos.z > 0 && Math.abs(pos.z - (playerZ - 0.75)) < 2.1;
        if (near && pos.y <= 2.05) {
          const p = THREE.MathUtils.clamp(spd / 1150, 0.2, 0.95);
          const aim = THREE.MathUtils.clamp(vx / 900, -1.6, 1.6);
          vel.set(
            aim * 2.0 + vx * 0.0012,
            Math.max(0.7, -vy * 0.001 + 1.1),
            -(7.6 + 12.2 * p)
          );
          player.userData.swing = 0.5 + 1.0 * p; // punch amount
          player.userData.swingLR = THREE.MathUtils.clamp(vx / 1200, -1, 1);
          lastHitter = "player";
        }
      }
    }
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    // CPU logic — wind-up then precise aim to player's court
    let cpuWind = 0; // seconds of pullback before hit
    let cpuPlan = null; // {tx,tz}
    function cpuTryHit(dt) {
      if (!state.live || vel.z >= 0) {
        cpuWind = Math.max(0, cpuWind - dt);
        return;
      }
      const t = Math.max(0.08, (pos.z - cpuZ) / -Math.max(-0.001, vel.z));
      const predX = pos.x + vel.x * t;
      cpu.position.x +=
        (THREE.MathUtils.clamp(predX, -halfW * 0.92, halfW * 0.92) -
          cpu.position.x) *
        0.26;
      const close =
        Math.abs(pos.z - cpuZ) < 1.8 &&
        Math.abs(predX - cpu.position.x) < 1.6 &&
        pos.y <= 1.95;
      if (close && cpuWind <= 0 && !cpuPlan) {
        // Plan target and start wind-up
        const tx = THREE.MathUtils.clamp(
          predX + THREE.MathUtils.randFloatSpread(0.6),
          -halfW + 0.35,
          halfW - 0.35
        );
        const tz = THREE.MathUtils.randFloat(halfL - 1.5, halfL - 0.7);
        cpuPlan = { tx, tz };
        cpuWind = 0.1;
        cpu.userData.swing = -0.6; // pull back
      }
      if (cpuWind > 0) {
        cpuWind -= dt;
        if (cpuWind <= 0 && cpuPlan) {
          const to = new THREE.Vector3(cpuPlan.tx, ballR + 0.05, cpuPlan.tz);
          let v0 = solveShot(
            pos.clone(),
            to,
            state.gravity,
            THREE.MathUtils.randFloat(0.85, 1.05)
          );
          v0 = ensureNetClear(pos.clone(), v0, state.gravity, netH);
          vel.copy(v0.multiplyScalar(0.92));
          cpu.userData.swing = 1.1;
          cpu.userData.swingLR = THREE.MathUtils.clamp(
            (cpuPlan.tx - cpu.position.x) / halfW,
            -1,
            1
          );
          lastHitter = "cpu";
          cpuPlan = null;
        }
      }
    }

    // ===== Stadium Billboards (moving ads) =====
    const adPanels = [];
    function makeAdTexture(
      line1 = "TonPlaygram · the future of peer-to-peer crypto gaming",
      line2 = "Earn · Play · Compete · Secure · Instant Payouts"
    ) {
      const w = 1024,
        h = 256;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#111827");
      grad.addColorStop(1, "#0ea5a1");
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.font = "700 44px system-ui,Segoe UI,Arial";
      g.fillStyle = "#ffffff";
      g.textBaseline = "middle";
      const block = `${line1}   •   ${line2}   •   `;
      let x = 20;
      for (let i = 0; i < 6; i++) {
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
      const postMat = new THREE.MeshStandardMaterial({
        color: 0x7c818c,
        roughness: 0.6,
        metalness: 0.2
      });
      const postH = height + 0.4;
      const cyl = new THREE.CylinderGeometry(0.04, 0.04, postH, 10);
      const p1 = new THREE.Mesh(cyl, postMat);
      const p2 = new THREE.Mesh(cyl, postMat);
      p1.position.set(
        pos.x - (width / 2) + 0.15 * Math.cos(rotY),
        (postH / 2) * 0.98,
        pos.z - (width / 2) * Math.sin(rotY)
      );
      p2.position.set(
        pos.x + (width / 2) - 0.15 * Math.cos(rotY),
        (postH / 2) * 0.98,
        pos.z + (width / 2) * Math.sin(rotY)
      );
      scene.add(p1);
      scene.add(p2);
      adPanels.push({ mesh, tex, speed });
    }

    // Place 3 billboards OUTSIDE the apron
    const apronSize = 2.6;
    const outerX = halfW + apronSize;
    const outerZ = halfL + apronSize;
    const offset = 0.25;
    const bbH = 1.1;
    const sideLenZ = courtL + 2 * apronSize;
    const endLenX = courtW + 2 * apronSize;
    makeBillboard(
      sideLenZ,
      bbH,
      0.055,
      new THREE.Vector3(-outerX - offset, bbH / 2, 0),
      Math.PI / 2
    );
    makeBillboard(
      endLenX,
      bbH,
      0.07,
      new THREE.Vector3(0, bbH / 2, -outerZ - offset),
      0
    );
    makeBillboard(
      sideLenZ,
      bbH,
      0.055,
      new THREE.Vector3(outerX + offset, bbH / 2, 0),
      -Math.PI / 2
    );

    // ——— Physics/Loop ———
    const FIXED = 1 / 120;
    let acc = 0,
      last = performance.now(),
      raf = 0;
    function step(dt) {
      // Auto player follow when inbound
      if (state.live && vel.z > 0) {
        const strikeZ = playerZ - 0.8;
        const t = Math.max(0.05, (strikeZ - pos.z) / (vel.z || 1e-6));
        const predX = pos.x + vel.x * t;
        player.position.x +=
          (THREE.MathUtils.clamp(predX, -halfW, halfW) - player.position.x) *
          0.22;
      }

      if (state.live) {
        const prevZ = pos.z;
        vel.y += state.gravity * dt;
        const vLen = vel.length();
        if (vLen > 1e-3)
          vel.addScaledVector(vel, -0.5 * 0.5 * ballR * vLen * dt);
        pos.addScaledVector(vel, dt);
        if (pos.y <= ballR) {
          pos.y = ballR;
          if (vel.y < 0) vel.y = -vel.y * state.cor;
          vel.x *= 1 - state.fric;
          vel.z *= 1 - state.fric;
          hitTTL = 1.0;
          hitRing.position.set(pos.x, 0.002, pos.z);
        }
        const denom = pos.z - prevZ || 1e-6;
        const tCross = (0 - prevZ) / denom;
        const yCross = THREE.MathUtils.lerp(
          ball.position.y,
          pos.y,
          THREE.MathUtils.clamp(tCross, 0, 1)
        );
        if (
          ((prevZ > 0 && pos.z <= 0) || (prevZ < 0 && pos.z >= 0)) &&
          yCross < 0.914 + ballR * 0.55
        ) {
          state.live = false;
          setMsg("NET · Swipe për serve");
          prepareServe(state.serveBy);
        }
        if (
          !inSinglesX(pos.x) ||
          pos.z > halfL + 0.6 ||
          pos.z < -halfL - 0.6
        ) {
          state.live = false;
          setMsg("OUT · Swipe për serve");
          prepareServe(state.serveBy);
        }
        // Racket motion (pull back negative, punch positive)
        player.userData.swing *= Math.exp(-5.0 * dt);
        cpu.userData.swing *= Math.exp(-5.0 * dt);
        const ps = player.userData.swing || 0,
          plrLR = THREE.MathUtils.clamp(
            player.userData.swingLR || 0,
            -1,
            1
          );
        const cs = cpu.userData.swing || 0,
          cpuLR = THREE.MathUtils.clamp(cpu.userData.swingLR || 0, -1, 1);
        if (player.userData.headPivot) {
          player.userData.headPivot.rotation.x = -0.45 * ps;
          player.userData.headPivot.rotation.z = -0.28 * plrLR * ps;
          player.userData.headPivot.position.z = -0.06 * ps;
        }
        if (cpu.userData.headPivot) {
          cpu.userData.headPivot.rotation.x = -0.55 * cs;
          cpu.userData.headPivot.rotation.z = -0.3 * cpuLR * cs;
          cpu.userData.headPivot.position.z = -0.07 * cs;
        }
      }

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

    // Start
    loadDeshadowedGrass(grassURL, (tex) => {
      matGrass.map = tex;
      matGrass.needsUpdate = true;
    });
    prepareServe("player");
    animate();

    // Resize
    function onResize() {
      W = Math.max(1, container.clientWidth || window.innerWidth || 1);
      H = Math.max(1, container.clientHeight || window.innerHeight || 1);
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", onResize);

    // Simple tests
    console.assert(
      Math.abs(new THREE.Vector3(0, 0, 1).length() - 1) < 1e-6,
      "vec length test"
    );
    console.assert(
      inSinglesX(0.0) && inSinglesX(halfW - 0.06) && !inSinglesX(halfW + 0.1),
      "bounds X test"
    );

    // Cleanup
    return () => {
      try {
        cancelAnimationFrame(raf);
      } catch {
        // ignore
      }
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (cpuSrvTO) {
        try {
          clearTimeout(cpuSrvTO);
        } catch {
          // ignore
        }
      }
      try {
        container.removeChild(renderer.domElement);
      } catch {
        // ignore
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "#0c1020"
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          right: 8,
          textAlign: "center",
          color: "#e5e7eb",
          fontFamily: "ui-sans-serif, system-ui",
          fontSize: 12,
          opacity: 0.9
        }}
      >
        {msg}
      </div>
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 560, height: "100%", width: "100%" }}
      />
    </div>
  );
}
