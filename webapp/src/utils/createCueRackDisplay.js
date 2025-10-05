import { CUE_STYLE_PRESETS } from '../constants/cueStyles.js';

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
* @param {Array} [params.cueStyles] - Optional cue style palette for the rack.
* @returns {{
*   group: import('three').Group,
*   dimensions: { width: number, height: number, depth: number },
*   dispose: () => void,
*   cues: import('three').Group[],
*   cueVerticalOffset: number,
*   cueHighlightLift: number
* }}
 */
export function createCueRackDisplay({
  THREE,
  ballRadius,
  cueLengthMultiplier,
  cueTipRadius,
  cueStyles = CUE_STYLE_PRESETS
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

  const styles =
    Array.isArray(cueStyles) && cueStyles.length > 0
      ? cueStyles
      : CUE_STYLE_PRESETS;

  // Frame dimensions tuned so the cues sit snugly in the rack
  const frameWidth = 5.25 * unit;
  const frameHeight = 2.85 * unit;
  const frameDepth = 0.16 * unit;

  const clothWidth = 4.85 * unit;
  const clothHeight = 2.6 * unit;
  const clothInset = 0.006 * unit;
  const clothDepth = frameDepth / 2 + clothInset;
  const cueDepth = clothDepth + 0.009 * unit;
  const cueRailWidth = clothWidth * 0.84;
  const cueVerticalOffset = clothHeight * 0.08;
  const cueHighlightLift = clothHeight * 0.12;

  const group = new THREE.Group();
  const disposables = [];

  const frameMat = new THREE.MeshPhysicalMaterial({
    color: 0x6a4b2f,
    roughness: 0.55,
    metalness: 0.12,
    clearcoat: 0.6
  });
  const frameGeom = new THREE.BoxGeometry(frameWidth, frameHeight, frameDepth);
  const frameMesh = new THREE.Mesh(frameGeom, frameMat);
  frameMesh.receiveShadow = true;
  group.add(frameMesh);
  disposables.push(frameGeom, frameMat);

  const clothCanvas = document.createElement('canvas');
  clothCanvas.width = 1024;
  clothCanvas.height = 1024;
  const ctx = clothCanvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, clothCanvas.width, clothCanvas.height);
    grad.addColorStop(0, '#4a0f19');
    grad.addColorStop(1, '#821c2a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, clothCanvas.width, clothCanvas.height);
  }
  const clothTexture = new THREE.CanvasTexture(clothCanvas);
  clothTexture.colorSpace = THREE.SRGBColorSpace;
  clothTexture.anisotropy = 4;
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

  const buttRadius = 0.025 * SCALE;
  const shaftRadius = buttRadius * 0.86;
  const tipRadius = cueTipRadius;
  const jointLength = 0.04 * unit;
  const connectorLength = 0.015 * unit * 1.5;
  const cueEndCapRadius = buttRadius * 1.1;

  const cues = [];

  const makeCue = (style, index) => {
    const cueGroup = new THREE.Group();
    const shaftColor = style?.rackShaftColor ?? style?.shaftColor ?? 0xcaa472;
    const accentColor = style?.rackAccentColor ?? style?.stripeColor ?? 0x222222;
    const connectorColor = style?.connectorColor ?? 0xcd7f32;
    const tipAccent = style?.tipColor ?? 0x5a7dc3;
    const buttColor = style?.buttColor ?? 0x111111;

    const woodMat = new THREE.MeshPhysicalMaterial({
      color: shaftColor,
      roughness: 0.25,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.12
    });
    woodMat.emissive = new THREE.Color(0x000000);
    woodMat.emissiveIntensity = 0.08;
    disposables.push(woodMat);

    const tipFaceMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.18,
      clearcoat: 1
    });
    const tipCapMat = new THREE.MeshPhysicalMaterial({
      color: tipAccent,
      roughness: 1,
      clearcoat: 0
    });
    const jointMat = new THREE.MeshPhysicalMaterial({
      color: connectorColor,
      metalness: 1,
      roughness: 0.35,
      clearcoat: 0.75
    });
    const buttCapMat = new THREE.MeshPhysicalMaterial({
      color: buttColor,
      roughness: 0.45,
      metalness: 0.2
    });
    const engraveMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.42,
      metalness: 0.55
    });
    disposables.push(tipFaceMat, tipCapMat, jointMat, buttCapMat, engraveMat);

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
      jointMat
    );
    joint.rotation.x = Math.PI / 2;
    joint.position.z = -shaftLength;
    cueGroup.add(joint);

    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(tipRadius, tipRadius, connectorLength * 0.65, 32),
      tipFaceMat
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = connectorLength * 0.32;
    cueGroup.add(tip);

    const tipCap = new THREE.Mesh(
      new THREE.SphereGeometry(tipRadius * 1.15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      tipCapMat
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

    const engrave = new THREE.Mesh(
      new THREE.TorusKnotGeometry(buttRadius * 0.7, 0.0025 * unit, 64, 8, 2 + index, 3),
      engraveMat
    );
    engrave.rotation.x = Math.PI / 2;
    engrave.position.z = -(shaftLength + buttLength * 0.5);
    cueGroup.add(engrave);

    const endCap = new THREE.Mesh(
      new THREE.SphereGeometry(cueEndCapRadius, 32, 16),
      buttCapMat
    );
    endCap.rotation.x = Math.PI / 2;
    endCap.position.z = -(shaftLength + buttLength);
    cueGroup.add(endCap);

    cueGroup.rotation.x = -Math.PI / 2;

    const bounds = new THREE.Box3().setFromObject(cueGroup);
    const center = new THREE.Vector3();
    bounds.getCenter(center);
    cueGroup.position.sub(center);
    cueGroup.castShadow = true;
    cueGroup.userData.cueStyleId = style?.id ?? `cue-${index}`;
    cueGroup.userData.isCueOption = true;
    cueGroup.userData.baseY = cueVerticalOffset;
    cueGroup.userData.highlightLift = cueHighlightLift;
    cueGroup.userData.highlightMaterials = [woodMat];
    cueGroup.userData.highlightEmissiveColor = accentColor;
    return cueGroup;
  };

  const cueCount = styles.length;
  const startX = cueCount > 1 ? -cueRailWidth / 2 : 0;
  const stepX = cueCount > 1 ? cueRailWidth / (cueCount - 1) : 0;

  for (let i = 0; i < cueCount; i += 1) {
    const cue = makeCue(styles[i % styles.length], i);
    cue.position.set(startX + i * stepX, cueVerticalOffset, cueDepth);
    cues.push(cue);
    group.add(cue);
  }

  const dimensions = { width: frameWidth, height: frameHeight, depth: frameDepth };
  group.userData.cueRackDimensions = dimensions;
  group.userData.cueGroups = cues;

  const dispose = () => {
    while (disposables.length) {
      const item = disposables.pop();
      if (item && typeof item.dispose === 'function') {
        item.dispose();
      }
    }
  };

  return { group, dimensions, dispose, cues, cueVerticalOffset, cueHighlightLift };
}
