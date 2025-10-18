import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const textureCache = {
  leather: null,
  rubber: null,
  brushed: null,
  anodized: null
};

function canvasTexture(draw, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function ensureTextures() {
  if (!textureCache.leather) {
    textureCache.leather = canvasTexture((g, S) => {
      g.fillStyle = '#2a2f3c';
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < S * 8; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const r = Math.random() * 1.2 + 0.3;
        const a = 0.08 + Math.random() * 0.06;
        g.fillStyle = `rgba(255,255,255,${a})`;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      const grd = g.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.7);
      grd.addColorStop(0, 'rgba(255,255,255,0.02)');
      grd.addColorStop(1, 'rgba(0,0,0,0.15)');
      g.fillStyle = grd;
      g.fillRect(0, 0, S, S);
    });
  }
  if (!textureCache.rubber) {
    textureCache.rubber = canvasTexture((g, S) => {
      g.fillStyle = '#1a1d24';
      g.fillRect(0, 0, S, S);
      g.strokeStyle = 'rgba(255,255,255,0.06)';
      g.lineWidth = 2;
      for (let y = 0; y < S; y += 24) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(S, y);
        g.stroke();
      }
      for (let x = 0; x < S; x += 24) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, S);
        g.stroke();
      }
    });
  }
  if (!textureCache.brushed) {
    textureCache.brushed = canvasTexture((g, S) => {
      const base = g.createLinearGradient(0, 0, S, 0);
      base.addColorStop(0, '#b7bcc4');
      base.addColorStop(1, '#8c939c');
      g.fillStyle = base;
      g.fillRect(0, 0, S, S);
      g.globalAlpha = 0.17;
      g.fillStyle = '#ffffff';
      for (let i = 0; i < S * 2; i++) {
        const y = Math.random() * S;
        g.fillRect(0, y, S, 1);
      }
      g.globalAlpha = 1;
    }, 1024);
  }
  if (!textureCache.anodized) {
    textureCache.anodized = canvasTexture((g, S) => {
      const base = g.createLinearGradient(0, 0, 0, S);
      base.addColorStop(0, '#3a4a5f');
      base.addColorStop(1, '#1e2430');
      g.fillStyle = base;
      g.fillRect(0, 0, S, S);
      g.globalAlpha = 0.12;
      g.fillStyle = '#ffffff';
      for (let i = 0; i < S; i++) {
        const x = Math.random() * S;
        g.fillRect(x, 0, 1, S);
      }
      g.globalAlpha = 1;
    });
  }
  return textureCache;
}

function createLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.font = '36px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.strokeText(text, canvas.width / 2, canvas.height / 2);
  g.fillStyle = '#e6ebff';
  g.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.95, 0.48, 1);
  return sprite;
}

function createPocketJaw(style, materials) {
  const steps = 16;
  const scale = style.mouthR > 0 ? 1 : 1;
  const rInnerTop = style.mouthR * scale;
  const flare = style.flare * scale;
  const depth = style.depth * scale;
  const wallTop = 0.14 * scale;
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const radius = rInnerTop - t * wallTop + Math.sin(t * Math.PI) * flare * 0.2;
    const y = -t * depth;
    pts.push(new THREE.Vector2(radius, y));
  }
  const lipRadius = rInnerTop + flare + 0.02 * scale;
  pts.push(new THREE.Vector2(rInnerTop + flare, 0.03 * scale));
  pts.push(new THREE.Vector2(lipRadius, 0.06 * scale));
  const lathe = new THREE.LatheGeometry(pts, 48, 0, Math.PI);
  lathe.computeVertexNormals();
  const group = new THREE.Group();
  const jaw = new THREE.Mesh(lathe, materials.body);
  jaw.rotation.y = Math.PI;
  group.add(jaw);
  const rimInner = rInnerTop;
  const rimOuter = lipRadius;
  const tube = Math.max(0.004 * scale, (rimOuter - rimInner) * 0.5);
  const major = (rimOuter + rimInner) * 0.5;
  const rimGeo = new THREE.TorusGeometry(major, tube, 22, 96, Math.PI);
  const rim = new THREE.Mesh(rimGeo, materials.rim);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.06 * scale;
  group.add(rim);
  const baseR = rimOuter + 0.02 * scale;
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(baseR, baseR, 0.03 * scale, 48, 1, false, 0, Math.PI),
    materials.base
  );
  plate.position.y = -0.03 * scale;
  group.add(plate);
  const label = createLabel(`${style.label}`);
  label.position.set(0, 0.5, 0);
  group.add(label);
  return group;
}

function resolveMaterials(style) {
  const textures = ensureTextures();
  const bodyTexture = style.surface === 'rubber' ? textures.rubber : textures.leather;
  const rimTexture = style.rimFinish === 'anodized' ? textures.anodized : textures.brushed;
  const body = new THREE.MeshStandardMaterial({
    map: bodyTexture,
    roughness: style.surface === 'rubber' ? 0.9 : 0.82,
    metalness: style.surface === 'rubber' ? 0.05 : 0.12
  });
  const rim = new THREE.MeshStandardMaterial({
    map: rimTexture,
    metalness: style.rimFinish === 'anodized' ? 0.6 : 0.9,
    roughness: style.rimFinish === 'anodized' ? 0.5 : 0.35
  });
  const base = new THREE.MeshStandardMaterial({
    color: 0x2b3142,
    roughness: 0.95,
    metalness: 0
  });
  return { body, rim, base };
}

export default function PocketJawsGallery({ variant, className = '', animate = true }) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rafRef = useRef(0);
  const jawRef = useRef(null);
  const controlsRef = useRef({ dragging: false, x: 0, y: 0, theta: 0.6, phi: 0.8, dTheta: 0, dPhi: 0, dist: 5.2 });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return () => {};

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.05, 100);
    camera.position.set(3.5, 2.9, 4.5);
    cameraRef.current = camera;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.1).texture;
    scene.environment = env;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x303844, 0.65);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 5, 4);
    scene.add(dir);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshStandardMaterial({ color: 0x0e1220, roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.001;
    scene.add(ground);

    function updateCamera() {
      const ctl = controlsRef.current;
      ctl.theta += ctl.dTheta;
      ctl.phi += ctl.dPhi;
      ctl.phi = clamp(ctl.phi, 0.2, Math.PI - 0.2);
      ctl.dTheta *= 0.92;
      ctl.dPhi *= 0.92;
      const r = ctl.dist;
      const x = r * Math.sin(ctl.phi) * Math.cos(ctl.theta);
      const y = r * Math.cos(ctl.phi);
      const z = r * Math.sin(ctl.phi) * Math.sin(ctl.theta);
      camera.position.set(x, y, z);
      camera.lookAt(0, 0.2, 0);
    }

    function firstTouch(e) {
      const rect = mount.getBoundingClientRect();
      if (e.touches && e.touches[0]) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top
        };
      }
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    const handleDown = (e) => {
      const ctl = controlsRef.current;
      ctl.dragging = true;
      const p = firstTouch(e);
      ctl.x = p.x;
      ctl.y = p.y;
      mount.setPointerCapture?.(e.pointerId ?? 0);
    };

    const handleMove = (e) => {
      const ctl = controlsRef.current;
      if (!ctl.dragging) return;
      const p = firstTouch(e);
      const dx = p.x - ctl.x;
      const dy = p.y - ctl.y;
      ctl.x = p.x;
      ctl.y = p.y;
      ctl.dTheta = -dx * 0.01;
      ctl.dPhi = dy * 0.01;
    };

    const handleUp = (e) => {
      const ctl = controlsRef.current;
      ctl.dragging = false;
      mount.releasePointerCapture?.(e.pointerId ?? 0);
    };

    const handleWheel = (e) => {
      e.preventDefault();
      const ctl = controlsRef.current;
      ctl.dist = clamp(ctl.dist + (e.deltaY > 0 ? 0.4 : -0.4), 3.5, 8.5);
    };

    mount.addEventListener('pointerdown', handleDown, { passive: true });
    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleUp, { passive: true });
    mount.addEventListener('wheel', handleWheel, { passive: false });

    const resizeObserver = new ResizeObserver(() => {
      if (!rendererRef.current || !cameraRef.current) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / Math.max(height, 1);
      cameraRef.current.updateProjectionMatrix();
    });
    resizeObserver.observe(mount);

    function animate() {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      updateCamera();
      if (animate && jawRef.current) {
        jawRef.current.rotation.y += 0.0025;
      }
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      rafRef.current = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      mount.removeEventListener('pointerdown', handleDown);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      mount.removeEventListener('wheel', handleWheel);
      if (jawRef.current) {
        scene.remove(jawRef.current);
        disposeJaw(jawRef.current);
        jawRef.current = null;
      }
      renderer.dispose();
      scene.environment?.dispose?.();
      pmrem.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [animate]);

  useEffect(() => {
    if (!variant || !sceneRef.current) return;
    const scene = sceneRef.current;
    if (jawRef.current) {
      scene.remove(jawRef.current);
      disposeJaw(jawRef.current);
      jawRef.current = null;
    }
    const materials = resolveMaterials(variant);
    const group = createPocketJaw(variant, materials);
    group.position.set(0, 0, 0);
    jawRef.current = group;
    scene.add(group);
    return () => {
      if (jawRef.current === group) {
        scene.remove(group);
        disposeJaw(group);
        jawRef.current = null;
      }
    };
  }, [variant]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{
        width: '100%',
        height: '180px',
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        background: 'linear-gradient(180deg,#0b0f1a,#0e1422)'
      }}
    />
  );
}

function disposeJaw(group) {
  group.traverse((obj) => {
    if (obj.isMesh) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material && !obj.material.isSpriteMaterial) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          if (!mat) return;
          mat.dispose();
        });
      }
    }
    if (obj.isSprite) {
      const map = obj.material?.map;
      obj.material?.dispose();
      map?.dispose?.();
    }
  });
}

