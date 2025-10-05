import * as THREE from 'three';

const BASE_CUE_LENGTH = 2.5;
const BASE_TIP_RADIUS = 0.007;
const BASE_BUTT_RADIUS = 0.028;
const BASE_SHAFT_RATIO = 0.74;
const FRAME_WIDTH = 6;
const FRAME_HEIGHT = 3;
const FRAME_DEPTH = 0.15;
const CLOTH_WIDTH = 5.6;
const CLOTH_HEIGHT = 2.6;
const CLOTH_OFFSET = 0.081;
const CUE_Y = 1.17;
const CUE_Z = 0.09;
const INNER_WIDTH = 5.2;

const tipTextureCache = new Map();

const toHex = (value) => {
  if (typeof value === 'number') {
    return `#${value.toString(16).padStart(6, '0')}`;
  }
  return value;
};

export const getCueTipTexture = (color = '#1b3f75') => {
  const key = toHex(color).toLowerCase();
  if (tipTextureCache.has(key)) {
    return tipTextureCache.get(key);
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  for (let i = 0; i < canvas.width; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = 'rgba(12, 24, 60, 0.65)';
  for (let i = 0; i < 80; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const w = 6 + Math.random() * 10;
    const h = 2 + Math.random() * 4;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  tipTextureCache.set(key, texture);
  return texture;
};

const defaultClothTexture = (colors) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export function createCueDisplayFrame({
  styles = [],
  cueLength = BASE_CUE_LENGTH,
  tipRadius = BASE_TIP_RADIUS,
  buttRadius = BASE_BUTT_RADIUS,
  frameColor = 0x6a4b2f,
  clothColors = ['#4a0f19', '#821c2a']
} = {}) {
  const frameGroup = new THREE.Group();
  frameGroup.name = 'CueDisplayFrame';

  const frameMat = new THREE.MeshPhysicalMaterial({
    color: frameColor,
    roughness: 0.55,
    metalness: 0.12,
    clearcoat: 0.5
  });
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(FRAME_WIDTH, FRAME_HEIGHT, FRAME_DEPTH),
    frameMat
  );
  frame.castShadow = false;
  frame.receiveShadow = true;
  frameGroup.add(frame);

  const clothMat = new THREE.MeshPhysicalMaterial({
    map: defaultClothTexture(clothColors),
    roughness: 0.75,
    clearcoat: 0.5,
    metalness: 0.05
  });
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(CLOTH_WIDTH, CLOTH_HEIGHT),
    clothMat
  );
  cloth.position.z = FRAME_DEPTH / 2 + CLOTH_OFFSET;
  cloth.receiveShadow = false;
  frameGroup.add(cloth);

  const cueEntries = [];

  const makeCue = (style, index) => {
    const cueGroup = new THREE.Group();
    cueGroup.name = `CueStyle_${style.id}`;
    const shaftLength = cueLength * BASE_SHAFT_RATIO;
    const buttLength = Math.max(cueLength - shaftLength, 0);

    const woodMaterial = new THREE.MeshPhysicalMaterial({
      color: style.woodColor,
      roughness: 0.25,
      metalness: 0.12,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12
    });

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(tipRadius, buttRadius * 0.86, shaftLength, 48, 1, false),
      woodMaterial
    );
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -shaftLength / 2;
    cueGroup.add(shaft);

    const jointMaterial = new THREE.MeshPhysicalMaterial({
      color: style.jointColor ?? 0xcd7f32,
      metalness: 1,
      roughness: 0.25,
      clearcoat: 0.8
    });
    const joint = new THREE.Mesh(
      new THREE.CylinderGeometry(buttRadius * 0.9, buttRadius * 0.9, 0.04, 48),
      jointMaterial
    );
    joint.rotation.x = Math.PI / 2;
    joint.position.z = -shaftLength * 0.74;
    cueGroup.add(joint);

    const tipMaterial = new THREE.MeshStandardMaterial({
      color: style.tipColor ?? 0xffffff,
      roughness: 1,
      metalness: 0,
      map: getCueTipTexture(style.tipTextureColor)
    });

    const whiteTip = new THREE.Mesh(
      new THREE.CylinderGeometry(tipRadius, tipRadius, 0.02, 32),
      new THREE.MeshStandardMaterial({
        color: style.tipColor ?? 0xffffff,
        roughness: 0.6,
        metalness: 0.05
      })
    );
    whiteTip.rotation.x = Math.PI / 2;
    whiteTip.position.z = 0.01;
    cueGroup.add(whiteTip);

    const tipCapMaterial = new THREE.MeshPhysicalMaterial({
      color: style.tipCapColor ?? style.tipColor ?? 0xffffff,
      roughness: 0.35,
      metalness: 0.3,
      clearcoat: 1
    });
    const tipCap = new THREE.Mesh(
      new THREE.SphereGeometry(tipRadius * 1.15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      tipCapMaterial
    );
    tipCap.rotation.x = Math.PI / 2;
    tipCap.position.z = 0.018;
    cueGroup.add(tipCap);

    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(tipRadius * 1.02, tipRadius * 1.02, 0.018, 32),
      tipMaterial
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = -0.01;
    cueGroup.add(tip);

    const butt = new THREE.Mesh(
      new THREE.CylinderGeometry(buttRadius * 0.86, buttRadius, buttLength, 48, 1, false),
      woodMaterial
    );
    butt.rotation.x = Math.PI / 2;
    butt.position.z = -(shaftLength + buttLength / 2);
    cueGroup.add(butt);

    const accentMaterial = new THREE.MeshStandardMaterial({
      color: style.accentColor ?? 0x222222,
      roughness: 0.5,
      metalness: 0.35
    });
    const accent = new THREE.Mesh(
      new THREE.TorusKnotGeometry(buttRadius * 0.7, 0.0025, 64, 8, 2 + index, 3),
      accentMaterial
    );
    accent.rotation.x = Math.PI / 2;
    accent.position.z = -(shaftLength + buttLength * 0.5);
    cueGroup.add(accent);

    const buttCap = new THREE.Mesh(
      new THREE.SphereGeometry(buttRadius * 1.1, 32, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0x050505,
        roughness: 0.35,
        metalness: 0.6,
        clearcoat: 0.9
      })
    );
    buttCap.rotation.x = Math.PI / 2;
    buttCap.position.z = -(shaftLength + buttLength);
    cueGroup.add(buttCap);

    cueGroup.rotation.x = -Math.PI / 2;

    cueGroup.traverse((child) => {
      if (child.isMesh) {
        child.userData.cueStyleId = style.id;
        child.userData.isCueDisplay = true;
      }
    });

    cueEntries.push({
      group: cueGroup,
      style,
      woodMaterial,
      accentMaterial
    });

    return cueGroup;
  };

  const count = styles.length;
  if (count === 0) {
    return {
      group: frameGroup,
      setSelected: () => {},
      interactiveObjects: [],
      getBoundingBox: () => new THREE.Box3().setFromObject(frameGroup)
    };
  }

  const startX = count > 1 ? -INNER_WIDTH / 2 : 0;
  const step = count > 1 ? INNER_WIDTH / (count - 1) : 0;

  styles.forEach((style, index) => {
    const cue = makeCue(style, index);
    cue.position.set(count > 1 ? startX + index * step : 0, CUE_Y, CUE_Z);
    frameGroup.add(cue);
  });

  const scale = cueLength / BASE_CUE_LENGTH;
  frameGroup.scale.setScalar(scale);

  const selectedEmissive = new THREE.Color(0xf59e0b);
  const setSelected = (styleId) => {
    cueEntries.forEach((entry) => {
      const active = entry.style.id === styleId;
      entry.woodMaterial.emissive = active
        ? selectedEmissive
        : new THREE.Color(0x000000);
      entry.woodMaterial.emissiveIntensity = active ? 0.4 : 0;
      entry.accentMaterial.emissive = active
        ? selectedEmissive
        : new THREE.Color(0x000000);
      entry.accentMaterial.emissiveIntensity = active ? 0.6 : 0;
    });
  };

  const getBoundingBox = () => {
    frameGroup.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    return box.setFromObject(frameGroup);
  };

  return {
    group: frameGroup,
    setSelected,
    interactiveObjects: cueEntries.map((entry) => entry.group),
    getBoundingBox
  };
}
