import * as THREE from 'three';

/** Pool Royal's original wooden cue, shared by gameplay, avatars and inspection. */
export function createPoolRoyalCue({ ballRadius, length, tipRadius: tipRadiusInput,
  frontSectionRatio = 0.28, color = 0xdeb887, styleIndex: initialIndex = 0 }: {
  ballRadius: number; length: number; tipRadius: number;
  frontSectionRatio?: number; color?: number; styleIndex?: number;
}) {
  const SCALE = ballRadius / 0.0525, cueLen = length;
  const cueBody = new THREE.Group();
  cueBody.name = 'PoolRoyalOriginalCue';
  const shaftMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: null,
    normalMap: null,
    roughnessMap: null,
    bumpScale: 0.02 * SCALE,
    roughness: 0.4,
    metalness: 0.0,
    clearcoat: 0.48,
    clearcoatRoughness: 0.3
  });
  shaftMaterial.userData = shaftMaterial.userData || {};
  shaftMaterial.userData.isCueWood = true;
  shaftMaterial.userData.cueOptionIndex = initialIndex;
  shaftMaterial.userData.cueOptionColor = color;
  const frontLength = THREE.MathUtils.clamp(
    cueLen * frontSectionRatio,
    cueLen * 0.1,
    cueLen * 0.5
  );
  const rearLength = Math.max(cueLen - frontLength, 1e-4);
  const rearStart = -rearLength / 2 + frontLength / 2;
  const buttLength = Math.min(rearLength * 0.45, rearLength);
  const rearShaftLength = Math.max(rearLength - buttLength, 0);
  const tipShaftRadius = 0.008 * SCALE;
  const buttShaftRadius = 0.025 * SCALE;
  const joinRadius = THREE.MathUtils.lerp(
    tipShaftRadius,
    buttShaftRadius,
    THREE.MathUtils.clamp(frontLength / Math.max(cueLen, 1e-4), 0, 1)
  );

  if (rearShaftLength > 1e-4) {
    const rearShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(joinRadius, buttShaftRadius, rearShaftLength, 32, 24),
      shaftMaterial
    );
    rearShaft.rotation.x = -Math.PI / 2;
    rearShaft.position.z = rearStart + rearShaftLength / 2;
    cueBody.add(rearShaft);
  }

  // group for tip & front shaft so the whole thin end moves for spin
  const tipGroup = new THREE.Group();
  tipGroup.position.z = -cueLen / 2;
  cueBody.add(tipGroup);

  if (frontLength > 1e-4) {
    const frontShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(tipShaftRadius, joinRadius, frontLength, 32, 24),
      shaftMaterial
    );
    frontShaft.rotation.x = -Math.PI / 2;
    frontShaft.position.z = frontLength / 2;
    tipGroup.add(frontShaft);
  }

  // subtle leather-like texture for the tip
  const tipCanvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  if (tipCanvas) tipCanvas.width = tipCanvas.height = 64;
  const tipCtx = tipCanvas?.getContext('2d');
  if (tipCtx) {
  tipCtx.fillStyle = '#1b3f75';
  tipCtx.fillRect(0, 0, 64, 64);
  tipCtx.strokeStyle = 'rgba(255,255,255,0.08)';
  tipCtx.lineWidth = 2;
  for (let i = 0; i < 64; i += 8) {
    tipCtx.beginPath();
    tipCtx.moveTo(i, 0);
    tipCtx.lineTo(i, 64);
    tipCtx.stroke();
  }
  tipCtx.globalAlpha = 0.2;
  tipCtx.fillStyle = 'rgba(12, 24, 60, 0.65)';
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 64;
    const y = Math.random() * 64;
    const w = 6 + Math.random() * 10;
    const h = 2 + Math.random() * 4;
    tipCtx.beginPath();
    tipCtx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
    tipCtx.fill();
  }
  tipCtx.globalAlpha = 1;
  }
  const tipTex = tipCanvas ? new THREE.CanvasTexture(tipCanvas) : null;

  const connectorHeight = 0.015 * SCALE;
  const tipRadius = tipRadiusInput;
  const tipLen = 0.015 * SCALE * 1.5;
  const tipMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f3f73,
    roughness: 1,
    metalness: 0,
    map: tipTex
  });
  const tip = new THREE.Group();
  const tipBodyLength = Math.max(0, tipLen - tipRadius);
  if (tipBodyLength > 0) {
    const tipBody = new THREE.Mesh(
      new THREE.CylinderGeometry(tipRadius, tipRadius, tipBodyLength, 20),
      tipMaterial
    );
    tipBody.rotation.x = -Math.PI / 2;
    tipBody.position.z = -(tipBodyLength / 2);
    tip.add(tipBody);
  }
  const tipCapGeometry = new THREE.SphereGeometry(tipRadius, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  tipCapGeometry.rotateX(-Math.PI / 2);
  const tipCap = new THREE.Mesh(tipCapGeometry, tipMaterial);
  tipCap.position.z = -tipBodyLength;
  tip.add(tipCap);
  tip.position.z = -connectorHeight;
  tipGroup.add(tip);

  const connector = new THREE.Mesh(
    new THREE.CylinderGeometry(
      tipRadius,
      0.008 * SCALE,
      connectorHeight,
      32
    ),
    new THREE.MeshPhysicalMaterial({
      color: 0xcd7f32,
      metalness: 0.8,
      roughness: 0.5
    })
  );
  connector.rotation.x = -Math.PI / 2;
  connector.position.z = -connectorHeight / 2;
  tipGroup.add(connector);

  const buttMaterial = shaftMaterial;
  if (buttLength > 1e-4) {
    const butt = new THREE.Mesh(
      new THREE.CylinderGeometry(buttShaftRadius, buttShaftRadius, buttLength, 48, 12),
      buttMaterial
    );
    butt.rotation.x = -Math.PI / 2;
    butt.position.z = rearStart + rearShaftLength + buttLength / 2;
    cueBody.add(butt);
  }

  const stripeLength = rearLength * 0.42;
  const stripeCenter = frontLength / 2 + rearLength * 0.32;

  const buttCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.03 * SCALE, 32, 16),
    buttMaterial
  );
  buttCap.position.z = cueLen / 2;
  cueBody.add(buttCap);

  const stripeOverlay = new THREE.Mesh(
    new THREE.CylinderGeometry(
      buttShaftRadius * 1.001,
      buttShaftRadius * 1.001,
      stripeLength,
      64,
      1,
      true
    ),
    new THREE.MeshPhysicalMaterial({
      transparent: true,
      roughness: 0.32,
      metalness: 0.1,
      clearcoat: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -0.5,
      polygonOffsetUnits: -0.5
    })
  );
  stripeOverlay.rotation.x = -Math.PI / 2;
  stripeOverlay.position.z = stripeCenter;
  stripeOverlay.userData.isCueStripe = true;
  cueBody.add(stripeOverlay);

  return { body: cueBody, tipGroup, shaftMaterial, buttMaterial, buttCapMaterial: buttCap.material,
    stripeMaterial: stripeOverlay.material,
    tipLocal: new THREE.Vector3(0, 0, -cueLen / 2 - connectorHeight - tipLen),
    buttLocal: new THREE.Vector3(0, 0, cueLen / 2) };
}

export function posePoolRoyalCue(body: THREE.Object3D, back: THREE.Vector3, tip: THREE.Vector3,
  sourceTip: THREE.Vector3, sourceButt: THREE.Vector3) {
  const direction = tip.clone().sub(back);
  const scale = direction.length() / sourceTip.distanceTo(sourceButt);
  body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction.normalize());
  body.scale.setScalar(scale);
  body.position.copy(tip).sub(sourceTip.clone().multiplyScalar(scale).applyQuaternion(body.quaternion));
}
