import {
  WOOD_FINISH_PRESETS,
  createWoodMaterial,
  disposeMaterialWithWood,
  hslToHexNumber,
  shiftLightness,
  shiftSaturation
} from './woodMaterials.js';
import { applySRGBColorSpace } from './colorSpace.js';

export const CUE_RACK_PALETTE = WOOD_FINISH_PRESETS.map((preset) =>
  hslToHexNumber(preset.hue, preset.sat, preset.light)
);

/**
 * Build a wall-mounted cue rack display consisting of a wooden frame,
 * a cloth backdrop, and a lineup of ornamental cues. The geometry is
 * scaled so each cue matches the in-game cue length.
 *
 * @param {Object} params
 * @param {typeof import('three')} params.THREE
 * @param {number} params.ballRadius - Radius of a single ball in world units.
 * @param {number} params.cueLengthMultiplier - Multiplier used for the active cue.
 * @param {number} params.cueTipRadius - Radius of the cue tip in world units.
 * @param {number} [params.cueCount=8] - Number of cues to place inside the rack.
 * @returns {{ group: import('three').Group, dimensions: { width: number, height: number, depth: number }, dispose: () => void }}
 */
export function createCueRackDisplay({
  THREE,
  ballRadius,
  cueLengthMultiplier,
  cueTipRadius,
  cueCount = WOOD_FINISH_PRESETS.length
} = {}) {
  if (!THREE) {
    throw new Error('THREE is required to create the cue rack display.');
  }
  if (typeof ballRadius !== 'number' || ballRadius <= 0) {
    throw new Error('ballRadius must be a positive number.');
  }
  if (typeof cueLengthMultiplier !== 'number' || cueLengthMultiplier <= 0) {
    throw new Error('cueLengthMultiplier must be a positive number.');
  }
  if (typeof cueTipRadius !== 'number' || cueTipRadius <= 0) {
    throw new Error('cueTipRadius must be a positive number.');
  }

  const SCALE = ballRadius / 0.0525;
  const cueLength = 1.5 * SCALE * cueLengthMultiplier;
  const baseCueLength = 2.5; // length used by the reference rack prompt
  const unit = cueLength / baseCueLength;

  // Frame dimensions tuned so the cues sit snugly within the display
  const frameWidth = 5.5 * unit;
  const frameHeight = 3.05 * unit;
  const frameDepth = 0.16 * unit;

  const clothWidth = 5.1 * unit;
  const clothHeight = 2.78 * unit;
  const clothInset = 0.006 * unit;
  const clothDepth = frameDepth / 2 + clothInset;
  const cueDepth = frameDepth / 2 + 0.0045 * unit;
  const cueSideMargin = 0.2 * unit;
  const cueRailWidth = Math.max(
    clothWidth - cueSideMargin * 2,
    clothWidth * 0.5
  );

  const group = new THREE.Group();
  const disposables = [];

  const framePreset =
    WOOD_FINISH_PRESETS.find((preset) => preset.id === 'walnut') ??
    WOOD_FINISH_PRESETS[WOOD_FINISH_PRESETS.length - 2];
  const frameMat = createWoodMaterial({
    hue: framePreset.hue,
    sat: framePreset.sat,
    light: framePreset.light,
    contrast: framePreset.contrast,
    repeat: { x: 1.4, y: 0.9 },
    roughnessBase: 0.22,
    roughnessVariance: 0.28,
    roughness: 0.34,
    metalness: 0.2,
    clearcoat: 0.55,
    clearcoatRoughness: 0.22,
    sheen: 0.18,
    sheenRoughness: 0.48,
    envMapIntensity: 1.1
  });
  const frameGeom = new THREE.BoxGeometry(frameWidth, frameHeight, frameDepth);
  const frameMesh = new THREE.Mesh(frameGeom, frameMat);
  frameMesh.receiveShadow = true;
  frameMesh.userData = frameMesh.userData || {};
  frameMesh.userData.isCueRackFrame = true;
  group.add(frameMesh);
  disposables.push(frameGeom, { dispose: () => disposeMaterialWithWood(frameMat) });

  const clothCanvas = document.createElement('canvas');
  clothCanvas.width = 1024;
  clothCanvas.height = 1024;
  const ctx = clothCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1c4a85';
    ctx.fillRect(0, 0, clothCanvas.width, clothCanvas.height);

    const grad = ctx.createLinearGradient(0, 0, clothCanvas.width, clothCanvas.height);
    grad.addColorStop(0, '#215b9d');
    grad.addColorStop(0.5, '#2a66aa');
    grad.addColorStop(1, '#194979');
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, clothCanvas.width, clothCanvas.height);
    ctx.globalAlpha = 1;

    const imageData = ctx.getImageData(0, 0, clothCanvas.width, clothCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const grain = (Math.random() - 0.5) * 12;
      data[i] = Math.max(0, Math.min(255, data[i] + grain));
      data[i + 1] = Math.max(
        0,
        Math.min(255, data[i + 1] + grain * 0.7)
      );
      data[i + 2] = Math.max(
        0,
        Math.min(255, data[i + 2] + grain * 0.35)
      );
    }
    ctx.putImageData(imageData, 0, 0);

    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < clothCanvas.height; y += 8) {
      ctx.fillRect(0, y, clothCanvas.width, 1);
    }
    ctx.globalAlpha = 0.03;
    for (let x = 0; x < clothCanvas.width; x += 8) {
      ctx.fillRect(x, 0, 1, clothCanvas.height);
    }
    ctx.globalAlpha = 1;
  }
  const clothTexture = new THREE.CanvasTexture(clothCanvas);
  applySRGBColorSpace(clothTexture);
  clothTexture.wrapS = THREE.RepeatWrapping;
  clothTexture.wrapT = THREE.RepeatWrapping;
  clothTexture.anisotropy = 8;
  const clothMat = new THREE.MeshPhysicalMaterial({
    map: clothTexture,
    roughness: 0.75,
    clearcoat: 0.6,
    metalness: 0.05
  });
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(clothWidth, clothHeight),
    clothMat
  );
  cloth.position.z = clothDepth;
  cloth.receiveShadow = true;
  group.add(cloth);
  disposables.push(cloth.geometry, clothMat, clothTexture);

  const mWhite = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.18,
    clearcoat: 1
  });
  const mLeatherBlue = new THREE.MeshPhysicalMaterial({
    color: 0x5a7dc3,
    roughness: 1,
    clearcoat: 0
  });
  const mBlack = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.35
  });
  const mBronze = new THREE.MeshPhysicalMaterial({
    color: 0xcd7f32,
    metalness: 1,
    roughness: 0.25,
    clearcoat: 0.8
  });
  const mEngrave = new THREE.MeshStandardMaterial({
    color: 0x1b1b1b,
    roughness: 0.35,
    metalness: 0.55
  });
  const mCuePick = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  disposables.push(mWhite, mLeatherBlue, mBlack, mBronze, mEngrave, mCuePick);

  const buttRadius = 0.025 * SCALE;
  const shaftRadius = buttRadius * 0.86;
  const tipRadius = cueTipRadius;
  const jointLength = 0.04 * unit;
  const connectorLength = 0.015 * unit * 1.5;
  const cueEndCapRadius = buttRadius * 1.1;

  const makeCue = (preset, index) => {
    const color = CUE_RACK_PALETTE[index % CUE_RACK_PALETTE.length];
    const cueGroup = new THREE.Group();
    const woodMat = createWoodMaterial({
      hue: preset.hue,
      sat: shiftSaturation(preset.sat, 0.02),
      light: shiftLightness(preset.light, -0.04),
      contrast: preset.contrast,
      repeat: { x: 1, y: 4.5 },
      roughnessBase: 0.16,
      roughnessVariance: 0.22,
      roughness: 0.34,
      metalness: 0.16,
      clearcoat: 0.56,
      clearcoatRoughness: 0.18,
      sheen: 0.2,
      sheenRoughness: 0.46,
      envMapIntensity: 1.05
    });
    woodMat.userData = woodMat.userData || {};
    woodMat.userData.isCueWood = true;
    woodMat.userData.cueOptionIndex = index;
    woodMat.userData.cueOptionColor = color;
    disposables.push({ dispose: () => disposeMaterialWithWood(woodMat) });

    const shaftLength = cueLength * 0.74;
    const buttLength = Math.max(cueLength - shaftLength, 0);

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(tipRadius, shaftRadius, shaftLength, 48, 1, false),
      woodMat
    );
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -shaftLength / 2;
    cueGroup.add(shaft);

    const joint = new THREE.Mesh(
      new THREE.CylinderGeometry(shaftRadius * 1.02, shaftRadius * 1.02, jointLength, 32),
      mBronze
    );
    joint.rotation.x = Math.PI / 2;
    joint.position.z = -shaftLength;
    cueGroup.add(joint);

    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(tipRadius, tipRadius, connectorLength * 0.65, 32),
      mWhite
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = connectorLength * 0.32;
    cueGroup.add(tip);

    const tipCap = new THREE.Mesh(
      new THREE.SphereGeometry(tipRadius * 1.15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      mLeatherBlue
    );
    tipCap.rotation.x = Math.PI / 2;
    tipCap.position.z = connectorLength * 0.8;
    cueGroup.add(tipCap);

    const butt = new THREE.Mesh(
      new THREE.CylinderGeometry(shaftRadius, buttRadius, buttLength, 48, 1, false),
      woodMat
    );
    butt.rotation.x = Math.PI / 2;
    butt.position.z = -(shaftLength + buttLength / 2);
    cueGroup.add(butt);

    const localRadius = THREE.MathUtils.lerp(shaftRadius, buttRadius, 0.5);
    const ringRadius = Math.max(localRadius * 0.99, tipRadius * 1.4);
    const ringThickness = Math.max(shaftRadius * 0.08, 0.001 * unit);
    const engrave = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, ringThickness, 48, 96),
      mEngrave
    );
    engrave.rotation.x = Math.PI / 2;
    engrave.position.z = -(shaftLength + buttLength * 0.5);
    cueGroup.add(engrave);

    const endCap = new THREE.Mesh(
      new THREE.SphereGeometry(cueEndCapRadius, 32, 16),
      mBlack
    );
    endCap.rotation.x = Math.PI / 2;
    endCap.position.z = -(shaftLength + buttLength);
    cueGroup.add(endCap);

    cueGroup.rotation.x = -Math.PI / 2;
    cueGroup.userData = cueGroup.userData || {};
    cueGroup.userData.isCueOption = true;
    cueGroup.userData.cueOptionIndex = index;
    cueGroup.userData.cueOptionColor = color;

    const bounds = new THREE.Box3().setFromObject(cueGroup);
    const center = new THREE.Vector3();
    bounds.getCenter(center);
    const maxY = bounds.max.y;
    cueGroup.position.x -= center.x;
    cueGroup.position.y -= maxY;
    cueGroup.position.z -= center.z;
    const cueHeight = bounds.max.y - bounds.min.y;
    cueGroup.userData.cueHalfHeight = cueHeight / 2;
    cueGroup.userData.cueHeight = cueHeight;

    const pickGeom = new THREE.BoxGeometry(
      Math.max(buttRadius * 3.2, tipRadius * 6),
      cueHeight * 1.06,
      Math.max(tipRadius * 12, buttRadius * 2)
    );
    const pickMesh = new THREE.Mesh(pickGeom, mCuePick);
    pickMesh.position.y = -cueHeight / 2;
    pickMesh.userData = pickMesh.userData || {};
    pickMesh.userData.isCueOption = true;
    pickMesh.userData.cueOptionIndex = index;
    pickMesh.userData.cueOptionColor = color;
    pickMesh.visible = true;
    cueGroup.add(pickMesh);
    disposables.push(pickGeom);

    cueGroup.traverse((child) => {
      if (!child) return;
      child.userData = child.userData || {};
      child.userData.isCueOption = true;
      child.userData.cueOptionIndex = index;
      child.userData.cueOptionColor = color;
    });

    cueGroup.castShadow = true;
    return cueGroup;
  };

  const startX = -cueRailWidth / 2;
  const stepX = cueCount > 1 ? cueRailWidth / (cueCount - 1) : 0;
  const cueTopMargin = clothHeight * 0.05;
  const cueTop = clothHeight / 2 - cueTopMargin;

  for (let i = 0; i < cueCount; i += 1) {
    const preset = WOOD_FINISH_PRESETS[i % WOOD_FINISH_PRESETS.length];
    const cue = makeCue(preset, i);
    cue.position.set(startX + i * stepX, cueTop, cueDepth);
    group.add(cue);
  }

  group.userData = group.userData || {};
  group.userData.isCueRack = true;

  const dimensions = { width: frameWidth, height: frameHeight, depth: frameDepth };
  group.userData.cueRackDimensions = dimensions;

  const dispose = () => {
    while (disposables.length) {
      const item = disposables.pop();
      if (item && typeof item.dispose === 'function') {
        item.dispose();
      }
    }
  };

  return { group, dimensions, dispose };
}
