import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
// Snooker uses its own slimmer power slider
import { SnookerPowerSlider } from '../../../../snooker-power-slider.js';
import '../../../../snooker-power-slider.css';
import {
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { UnitySnookerRules } from '../../../../src/rules/UnitySnookerRules.ts';
import { useAimCalibration } from '../../hooks/useAimCalibration.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import currentRimsReference from '../../assets/snooker/current-rims-reference.svg';
import targetRimsReference from '../../assets/snooker/target-rims-reference.svg';

// --------------------------------------------------
// Pocket jaws
// --------------------------------------------------
const JAW_H = 2.1;
const JAW_T = 1.15;
const JAW_INNER_SCALE = 0.052;
const JAW_CENTER_PULL_SCALE = 0.03;
const SECTOR_SWEEP = Math.PI * 0.52;
const SIDE_SECTOR_SWEEP = Math.PI * 0.32;
const SECTOR_START = -SECTOR_SWEEP;
const SECTOR_END = SECTOR_SWEEP;
const jawMat = new THREE.MeshPhysicalMaterial({
  color: 0x1c1c1c,
  roughness: 0.42,
  metalness: 0.12,
  clearcoat: 0.45
});
const jawCapMat = new THREE.MeshPhysicalMaterial({
  color: 0x050505,
  roughness: 0.32,
  metalness: 0.65,
  clearcoat: 0.25,
  clearcoatRoughness: 0.32,
  envMapIntensity: 0.9
});
const plasticRimMat = new THREE.MeshPhysicalMaterial({
  color: 0x050505,
  roughness: 0.42,
  metalness: 0.08,
  clearcoat: 0.2,
  clearcoatRoughness: 0.38,
  sheen: 0.12,
  sheenRoughness: 0.68,
  envMapIntensity: 0.55
});
const chromePlateMat = new THREE.MeshPhysicalMaterial({
  color: 0xf4f6fb,
  roughness: 0.045,
  metalness: 1,
  clearcoat: 0.95,
  clearcoatRoughness: 0.06,
  reflectivity: 1,
  envMapIntensity: 3.4,
  side: THREE.DoubleSide
});
chromePlateMat.polygonOffset = true;
chromePlateMat.polygonOffsetFactor = -0.75;
chromePlateMat.polygonOffsetUnits = -2;

function makeCornerChromePlateGeometry({
  innerRadius,
  extensionX,
  extensionZ,
  outerFillet,
  thickness
}) {
  const shape = new THREE.Shape();
  const outerX = innerRadius + extensionX;
  const outerZ = innerRadius + extensionZ;
  const fillet = Math.min(Math.min(outerFillet, extensionX), extensionZ);
  shape.moveTo(innerRadius, 0);
  shape.lineTo(outerX - fillet, 0);
  shape.quadraticCurveTo(outerX, 0, outerX, fillet);
  shape.lineTo(outerX, outerZ - fillet);
  shape.quadraticCurveTo(outerX, outerZ, outerX - fillet, outerZ);
  shape.lineTo(fillet, outerZ);
  shape.quadraticCurveTo(0, outerZ, 0, outerZ - fillet);
  shape.lineTo(0, innerRadius);
  shape.lineTo(innerRadius, innerRadius);
  shape.lineTo(innerRadius, 0);
  shape.closePath();

  const pocketCut = new THREE.Path();
  pocketCut.moveTo(innerRadius, 0);
  pocketCut.absarc(0, 0, innerRadius, 0, Math.PI / 2, false);
  pocketCut.lineTo(0, innerRadius);
  pocketCut.lineTo(0, 0);
  pocketCut.lineTo(innerRadius, 0);
  pocketCut.closePath();
  shape.holes.push(pocketCut);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 96
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  const bbox = geo.boundingBox;
  if (bbox) {
    const shift = -bbox.max.y;
    if (Math.abs(shift) > 1e-6) geo.translate(0, shift, 0);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeSideChromePlateGeometry({
  innerRadius,
  halfSpan,
  extension,
  endFillet,
  thickness
}) {
  const shape = new THREE.Shape();
  const depth = innerRadius + extension;
  const fillet = Math.min(endFillet, halfSpan);
  shape.moveTo(-halfSpan + fillet, 0);
  shape.lineTo(halfSpan - fillet, 0);
  shape.quadraticCurveTo(halfSpan, 0, halfSpan, fillet);
  shape.lineTo(halfSpan, depth - fillet);
  shape.quadraticCurveTo(halfSpan, depth, halfSpan - fillet, depth);
  shape.lineTo(-halfSpan + fillet, depth);
  shape.quadraticCurveTo(-halfSpan, depth, -halfSpan, depth - fillet);
  shape.lineTo(-halfSpan, fillet);
  shape.quadraticCurveTo(-halfSpan, 0, -halfSpan + fillet, 0);
  shape.closePath();

  const pocketCut = new THREE.Path();
  pocketCut.moveTo(-innerRadius, 0);
  pocketCut.absarc(0, 0, innerRadius, Math.PI, 0, false);
  pocketCut.lineTo(innerRadius, 0);
  pocketCut.lineTo(-innerRadius, 0);
  pocketCut.closePath();
  shape.holes.push(pocketCut);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 96
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  const bbox = geo.boundingBox;
  if (bbox) {
    const shift = -bbox.max.y;
    if (Math.abs(shift) > 1e-6) geo.translate(0, shift, 0);
  }
  geo.computeVertexNormals();
  return geo;
}

function makePocketSkirtGeometry({
  innerRadius,
  outerRadius,
  height,
  startAngle,
  endAngle
}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, startAngle, endAngle, false);
  shape.absarc(0, 0, innerRadius, endAngle, startAngle, true);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 96
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -height, 0);
  geo.computeVertexNormals();
  return geo;
}
function makeJawSector(
  R = POCKET_VIS_R,
  T = JAW_T,
  start = SECTOR_START,
  end = SECTOR_END,
  depth = JAW_H
) {
  const outer = R + T;
  const inner = R + Math.max(T * 0.32, R * JAW_INNER_SCALE);
  const chamfer = Math.min((end - start) * 0.35, Math.PI * 0.18);
  const innerStart = end - chamfer;
  const innerEnd = start + chamfer;
  const s = new THREE.Shape();
  s.absarc(0, 0, outer, start, end, false);
  const innerStartVec = new THREE.Vector2(
    inner * Math.cos(innerStart),
    inner * Math.sin(innerStart)
  );
  s.lineTo(innerStartVec.x, innerStartVec.y);
  s.absarc(0, 0, inner, innerStart, innerEnd, true);
  const outerStartVec = new THREE.Vector2(
    outer * Math.cos(start),
    outer * Math.sin(start)
  );
  s.lineTo(outerStartVec.x, outerStartVec.y);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: false
  });
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}
function addPocketJaws(parent, playW, playH) {
  const HALF_PLAY_W = playW * 0.5;
  const HALF_PLAY_H = playH * 0.5;
  const POCKET_MAP = [
    { id: 'corner_tl', type: 'corner', pos: [-HALF_PLAY_W, -HALF_PLAY_H] },
    { id: 'corner_tr', type: 'corner', pos: [HALF_PLAY_W, -HALF_PLAY_H] },
    { id: 'corner_bl', type: 'corner', pos: [-HALF_PLAY_W, HALF_PLAY_H] },
    { id: 'corner_br', type: 'corner', pos: [HALF_PLAY_W, HALF_PLAY_H] },
    { id: 'side_left', type: 'side', pos: [-HALF_PLAY_W, 0] },
    { id: 'side_right', type: 'side', pos: [HALF_PLAY_W, 0] }
  ];
  const jaws = [];
  const jawTopLocal = POCKET_JAW_LIP_HEIGHT;
  const jawDepthTarget = CLOTH_THICKNESS;
  const capHeight = CLOTH_THICKNESS * 0.36;
  const capLift = CLOTH_THICKNESS * 0.24; // keep jaw caps hovering slightly above the lowered cloth level
  const rimDeckHeight = capHeight * 0.72;
  const rimLipHeight = capHeight * 0.36;
  const surfaceRimThickness = capHeight * 0.18;
  const rimSurfaceLift = capLift + capHeight;
  const rimLipTopY = rimSurfaceLift + POCKET_RIM_LIFT;
  const rimBaseTopY = rimLipTopY - rimLipHeight;
  const rimSkirtTopY = rimBaseTopY - rimDeckHeight;
  const cornerJawGeo = makeJawSector();
  const sideJawGeo = makeJawSector(
    POCKET_VIS_R * 0.94,
    JAW_T * 0.72,
    -SIDE_SECTOR_SWEEP,
    SIDE_SECTOR_SWEEP
  );
  const cornerCapGeo = makeJawSector(
    POCKET_VIS_R,
    JAW_T,
    SECTOR_START,
    SECTOR_END,
    capHeight
  );
  const sideCapGeo = makeJawSector(
    POCKET_VIS_R,
    JAW_T * 0.82,
    -SIDE_SECTOR_SWEEP,
    SIDE_SECTOR_SWEEP,
    capHeight
  );
  const cornerRimGeo = makeJawSector(
    POCKET_VIS_R * 1.2,
    JAW_T * 1.04,
    SECTOR_START,
    SECTOR_END,
    rimDeckHeight
  );
  cornerRimGeo.computeBoundingBox();
  const cornerRimBox = cornerRimGeo.boundingBox;
  if (cornerRimBox) {
    const rimShift = -cornerRimBox.max.y;
    if (Math.abs(rimShift) > 1e-6) cornerRimGeo.translate(0, rimShift, 0);
  }
  cornerRimGeo.computeBoundingSphere();
  cornerRimGeo.computeVertexNormals();
  const cornerRimTopGeo = makeJawSector(
    POCKET_VIS_R * 1.24,
    JAW_T * 1.12,
    SECTOR_START,
    SECTOR_END,
    rimLipHeight
  );
  cornerRimTopGeo.computeBoundingBox();
  const cornerRimTopBox = cornerRimTopGeo.boundingBox;
  if (cornerRimTopBox) {
    const rimTopShift = -cornerRimTopBox.max.y;
    if (Math.abs(rimTopShift) > 1e-6) cornerRimTopGeo.translate(0, rimTopShift, 0);
  }
  cornerRimTopGeo.computeBoundingSphere();
  cornerRimTopGeo.computeVertexNormals();
  const sideRimBaseGeo = makeJawSector(
    POCKET_VIS_R * 0.96,
    JAW_T * 0.36,
    -SIDE_SECTOR_SWEEP,
    SIDE_SECTOR_SWEEP,
    rimDeckHeight * 0.92
  );
  sideRimBaseGeo.computeBoundingBox();
  const sideRimBox = sideRimBaseGeo.boundingBox;
  if (sideRimBox) {
    const rimShift = -sideRimBox.max.y;
    if (Math.abs(rimShift) > 1e-6) sideRimBaseGeo.translate(0, rimShift, 0);
  }
  sideRimBaseGeo.computeBoundingSphere();
  sideRimBaseGeo.computeVertexNormals();
  const sideRimTopGeo = makeJawSector(
    POCKET_VIS_R * 0.98,
    JAW_T * 0.4,
    -SIDE_SECTOR_SWEEP,
    SIDE_SECTOR_SWEEP,
    rimLipHeight * 0.9
  );
  sideRimTopGeo.computeBoundingBox();
  const sideRimTopBox = sideRimTopGeo.boundingBox;
  if (sideRimTopBox) {
    const rimTopShift = -sideRimTopBox.max.y;
    if (Math.abs(rimTopShift) > 1e-6) sideRimTopGeo.translate(0, rimTopShift, 0);
  }
  sideRimTopGeo.computeBoundingSphere();
  sideRimTopGeo.computeVertexNormals();
  const cornerSurfaceRimGeo = makeJawSector(
    POCKET_VIS_R * 1.26,
    JAW_T * 0.78,
    SECTOR_START,
    SECTOR_END,
    surfaceRimThickness
  );
  cornerSurfaceRimGeo.computeBoundingBox();
  const cornerSurfaceRimBox = cornerSurfaceRimGeo.boundingBox;
  if (cornerSurfaceRimBox) {
    const rimShift = -cornerSurfaceRimBox.max.y;
    if (Math.abs(rimShift) > 1e-6) cornerSurfaceRimGeo.translate(0, rimShift, 0);
  }
  cornerSurfaceRimGeo.computeBoundingSphere();
  cornerSurfaceRimGeo.computeVertexNormals();
  const sideSurfaceRimGeo = makeJawSector(
    POCKET_VIS_R * 0.88,
    JAW_T * 0.16,
    -SIDE_SECTOR_SWEEP,
    SIDE_SECTOR_SWEEP,
    surfaceRimThickness * 0.82
  );
  sideSurfaceRimGeo.computeBoundingBox();
  const sideSurfaceRimBox = sideSurfaceRimGeo.boundingBox;
  if (sideSurfaceRimBox) {
    const rimShift = -sideSurfaceRimBox.max.y;
    if (Math.abs(rimShift) > 1e-6) sideSurfaceRimGeo.translate(0, rimShift, 0);
  }
  sideSurfaceRimGeo.computeBoundingSphere();
  sideSurfaceRimGeo.computeVertexNormals();
  const rimSkirtHeight = POCKET_RECESS_DEPTH * 0.62;
  const cornerSkirtGeo = makePocketSkirtGeometry({
    innerRadius: cornerPocketRadius + surfaceRimThickness * 0.22,
    outerRadius: cornerPocketRadius + surfaceRimThickness * 1.34,
    height: rimSkirtHeight,
    startAngle: 0,
    endAngle: Math.PI / 2
  });
  const sideSkirtGeo = makePocketSkirtGeometry({
    innerRadius: sidePocketRadius + surfaceRimThickness * 0.26,
    outerRadius: sidePocketRadius + surfaceRimThickness * 0.8,
    height: rimSkirtHeight,
    startAngle: -Math.PI / 2,
    endAngle: Math.PI / 2
  });
  const chromePlateThickness = capHeight * 1.6;
  const cornerChromeGeo = makeCornerChromePlateGeometry({
    innerRadius: cornerPocketRadius + surfaceRimThickness * 1.42,
    extensionX: longRailW * 1.18 + cornerChamfer * 0.55,
    extensionZ: endRailW * 1.12 + cornerChamfer * 0.55,
    outerFillet: Math.min(longRailW, endRailW) * 0.64,
    thickness: chromePlateThickness
  });
  const sideChromeGeo = makeSideChromePlateGeometry({
    innerRadius: sidePocketRadius + surfaceRimThickness * 0.9,
    halfSpan: POCKET_VIS_R * 1.48,
    extension: longRailW * 1.05,
    endFillet: longRailW * 0.42,
    thickness: chromePlateThickness
  });
  const chromeGroup = new THREE.Group();
  parent.add(chromeGroup);
  // Keep the chrome caps sitting on top of the rail surface so that all six plates remain visible.
  const chromeLift = rimSurfaceLift + chromePlateThickness * 0.45 + MICRO_EPS * 12;
  const chromeTopY = TABLE_RAIL_TOP_Y + chromeLift;
  for (const entry of POCKET_MAP) {
    const p = new THREE.Vector2(entry.pos[0], entry.pos[1]);
    const centerPull =
      entry.type === 'corner' ? POCKET_VIS_R * JAW_CENTER_PULL_SCALE : 0;
    const pullDir =
      entry.type === 'side'
        ? new THREE.Vector2(entry.pos[0] >= 0 ? -1 : 1, 0)
        : p.clone().multiplyScalar(-1);
    const pShift = p.clone();
    if (centerPull > 0 && pullDir.lengthSq() > 1e-6) {
      pullDir.normalize();
      pShift.add(pullDir.multiplyScalar(centerPull));
    }
    const geom = (entry.type === 'side' ? sideJawGeo : cornerJawGeo).clone();
    geom.computeBoundingBox();
    const bbox = geom.boundingBox;
    const topShift = bbox ? -bbox.max.y : 0;
    if (Math.abs(topShift) > 1e-6) {
      geom.translate(0, topShift, 0);
      geom.computeBoundingBox();
    }
    const adjustedBox = geom.boundingBox;
    const currentDepth = adjustedBox
      ? Math.abs(adjustedBox.min.y)
      : jawDepthTarget;
    if (currentDepth > 1e-6 && Math.abs(currentDepth - jawDepthTarget) > 1e-6) {
      const depthScale = jawDepthTarget / currentDepth;
      geom.scale(1, depthScale, 1);
    }
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    const jaw = new THREE.Group();
    jaw.position.set(pShift.x, jawTopLocal, pShift.y);
    const lookTarget = (() => {
      if (entry.type === 'side') {
        const dir = entry.pos[0] >= 0 ? -1 : 1;
        return new THREE.Vector3(
          jaw.position.x + dir * POCKET_VIS_R * 1.5,
          jaw.position.y - 0.05,
          jaw.position.z
        );
      }
      const towardCenter = new THREE.Vector3(
        pShift.x * 0.35,
        jaw.position.y - 0.08,
        pShift.y * 0.35
      );
      return towardCenter;
    })();
    jaw.lookAt(lookTarget);
    const capMeshes = [];
    if (entry.type === 'side') {
      const width = adjustedBox
        ? adjustedBox.max.x - adjustedBox.min.x
        : POCKET_VIS_R * 1.2;
      const segmentScale = 0.56;
      const offset = width * 0.18;
      for (const dir of [-1, 1]) {
        const segmentGeom = geom.clone();
        segmentGeom.scale(segmentScale, 1, 1);
        segmentGeom.computeVertexNormals();
        const segment = new THREE.Mesh(segmentGeom, jawMat);
        segment.castShadow = true;
        segment.receiveShadow = true;
        segment.position.x = offset * dir;
        jaw.add(segment);

        const segCapGeo = (entry.type === 'side' ? sideCapGeo : cornerCapGeo)
          .clone()
          .scale(segmentScale, 1, 1);
        segCapGeo.computeBoundingBox();
        segCapGeo.computeBoundingSphere();
        segCapGeo.computeVertexNormals();
        const segCap = new THREE.Mesh(segCapGeo, jawCapMat);
        segCap.castShadow = false;
        segCap.receiveShadow = true;
        segCap.position.set(segment.position.x, capLift, 0);
        jaw.add(segCap);
        capMeshes.push(segCap);

        const rimGeo = sideRimBaseGeo.clone();
        rimGeo.scale(segmentScale, 1, 1);
        rimGeo.computeVertexNormals();
        const rim = new THREE.Mesh(rimGeo, plasticRimMat);
        rim.castShadow = false;
        rim.receiveShadow = true;
        rim.position.set(
          segment.position.x,
          rimBaseTopY,
          0
        );
        jaw.add(rim);

        const rimTopGeo = sideRimTopGeo.clone();
        rimTopGeo.scale(segmentScale, 1, 1);
        rimTopGeo.computeVertexNormals();
        const rimTop = new THREE.Mesh(rimTopGeo, plasticRimMat);
        rimTop.castShadow = false;
        rimTop.receiveShadow = true;
        rimTop.position.set(
          segment.position.x,
          rimLipTopY,
          0
        );
        jaw.add(rimTop);

        const surfaceRimGeo = sideSurfaceRimGeo.clone();
        surfaceRimGeo.computeVertexNormals();
        const surfaceRim = new THREE.Mesh(surfaceRimGeo, plasticRimMat);
        surfaceRim.castShadow = false;
        surfaceRim.receiveShadow = true;
        surfaceRim.position.set(
          segment.position.x,
          rimLipTopY,
          0
        );
        surfaceRim.scale.set(segmentScale, 1, 1);
        jaw.add(surfaceRim);

        const skirtGeo = sideSkirtGeo.clone();
        const skirt = new THREE.Mesh(skirtGeo, plasticRimMat);
        skirt.castShadow = false;
        skirt.receiveShadow = true;
        skirt.position.set(segment.position.x, rimSkirtTopY, 0);
        skirt.scale.set(segmentScale, 1, 1);
        jaw.add(skirt);
      }
    } else {
      const mesh = new THREE.Mesh(geom, jawMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      jaw.add(mesh);
      const capGeo = cornerCapGeo.clone();
      capGeo.computeBoundingBox();
      capGeo.computeBoundingSphere();
      capGeo.computeVertexNormals();
      const cap = new THREE.Mesh(capGeo, jawCapMat);
      cap.castShadow = false;
      cap.receiveShadow = true;
      cap.position.y = capLift;
      mesh.add(cap);
      capMeshes.push(cap);

      const rimGeo = cornerRimGeo.clone();
      rimGeo.scale(1, 1, 1);
      rimGeo.computeVertexNormals();
      const rim = new THREE.Mesh(rimGeo, plasticRimMat);
      rim.castShadow = false;
      rim.receiveShadow = true;
      rim.position.y = rimBaseTopY;
      mesh.add(rim);

      const rimTopGeo = cornerRimTopGeo.clone();
      rimTopGeo.scale(1, 1, 1);
      rimTopGeo.computeVertexNormals();
      const rimTop = new THREE.Mesh(rimTopGeo, plasticRimMat);
      rimTop.castShadow = false;
      rimTop.receiveShadow = true;
      rimTop.position.y = rimLipTopY;
      mesh.add(rimTop);

      const surfaceRimGeo = cornerSurfaceRimGeo.clone();
      surfaceRimGeo.computeVertexNormals();
      const surfaceRim = new THREE.Mesh(surfaceRimGeo, plasticRimMat);
      surfaceRim.castShadow = false;
      surfaceRim.receiveShadow = true;
      surfaceRim.position.y = rimLipTopY;
      surfaceRim.scale.set(1, 1, 1);
      mesh.add(surfaceRim);

      const skirt = new THREE.Mesh(cornerSkirtGeo.clone(), plasticRimMat);
      skirt.castShadow = false;
      skirt.receiveShadow = true;
      skirt.position.y = rimSkirtTopY;
      mesh.add(skirt);
    }
    const chromeMesh = new THREE.Mesh(
      entry.type === 'corner' ? cornerChromeGeo : sideChromeGeo,
      chromePlateMat
    );
    chromeMesh.castShadow = false;
    chromeMesh.receiveShadow = true;
    chromeMesh.renderOrder = 6;
    chromeMesh.position.set(pShift.x, chromeTopY, pShift.y);
    if (entry.type === 'corner') {
      const signX = Math.sign(entry.pos[0]);
      const signZ = Math.sign(entry.pos[1]);
      let rotation = 0;
      if (signX > 0 && signZ < 0) {
        rotation = Math.PI / 2;
      } else if (signX > 0 && signZ > 0) {
        rotation = Math.PI;
      } else if (signX < 0 && signZ > 0) {
        rotation = -Math.PI / 2;
      }
      chromeMesh.rotation.y = rotation;
    } else {
      chromeMesh.rotation.y = entry.pos[0] >= 0 ? Math.PI : 0;
    }
    chromeGroup.add(chromeMesh);
    jaw.userData = {
      ...(jaw.userData || {}),
      cap: capMeshes[0] ?? null,
      caps: capMeshes,
      capHeight,
      capLift
    };
    parent.add(jaw);
    jaws.push(jaw);
  }
  return jaws;
}

function addPocketCuts(parent, clothPlane) {
  const cuts = [];
  const sideDepth = POCKET_VIS_R * 1.12 * POCKET_CUT_EXPANSION;
  const sideHalfWidth = POCKET_VIS_R * 0.9 * POCKET_CUT_EXPANSION;
  const halfW = PLAY_W / 2;
  const halfH = PLAY_H / 2;
  const mat = new THREE.MeshStandardMaterial({
    color: 0x060606,
    roughness: 0.78,
    metalness: 0.12,
    emissive: new THREE.Color(0x090909),
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide
  });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  mat.polygonOffsetUnits = -6;
  mat.depthWrite = false;
  mat.depthTest = true;
  const cornerShape = (() => {
    const innerR = POCKET_VIS_R * 0.98 * POCKET_CUT_EXPANSION;
    const outerR = innerR + sideDepth;
    const arcInset = Math.PI * 0.04;
    const startAngle = arcInset;
    const endAngle = Math.PI / 2 - arcInset;
    const innerStart = new THREE.Vector2(
      innerR * Math.cos(startAngle),
      innerR * Math.sin(startAngle)
    );
    const outerEnd = new THREE.Vector2(
      outerR * Math.cos(endAngle),
      outerR * Math.sin(endAngle)
    );
    const s = new THREE.Shape();
    s.moveTo(innerStart.x, innerStart.y);
    s.absarc(0, 0, innerR, startAngle, endAngle, false);
    s.lineTo(outerEnd.x, outerEnd.y);
    s.absarc(0, 0, outerR, endAngle, startAngle, true);
    s.lineTo(innerStart.x, innerStart.y);
    s.closePath();
    return s;
  })();
  const sideShape = (() => {
    const lipInset = POCKET_VIS_R * 0.32 * POCKET_CUT_EXPANSION;
    const throatHalfWidth = POCKET_VIS_R * 0.58 * POCKET_CUT_EXPANSION;
    const s = new THREE.Shape();
    s.moveTo(-sideHalfWidth, 0);
    s.lineTo(sideHalfWidth, 0);
    s.quadraticCurveTo(
      sideHalfWidth + lipInset,
      sideDepth * 0.35,
      throatHalfWidth,
      sideDepth * 0.92
    );
    s.quadraticCurveTo(0, sideDepth * 1.1, -throatHalfWidth, sideDepth * 0.92);
    s.quadraticCurveTo(
      -sideHalfWidth - lipInset,
      sideDepth * 0.35,
      -sideHalfWidth,
      0
    );
    s.closePath();
    return s;
  })();
  const cornerGeo = new THREE.ShapeGeometry(cornerShape);
  const sideGeo = new THREE.ShapeGeometry(sideShape);
  pocketCenters().forEach((p) => {
    const isCorner =
      Math.abs(Math.abs(p.x) - PLAY_W / 2) < 1e-3 &&
      Math.abs(Math.abs(p.y) - PLAY_H / 2) < 1e-3;
    const geom = isCorner ? cornerGeo.clone() : sideGeo.clone();
    const mesh = new THREE.Mesh(geom, mat.clone());
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(p.x, clothPlane + POCKET_RIM_LIFT, p.y);
    mesh.renderOrder = 6;
    if (isCorner) {
      const sx = Math.sign(p.x) || 1;
      const sy = Math.sign(p.y) || 1;
      const outward = new THREE.Vector2(sx, sy).normalize();
      const radialOffset = POCKET_VIS_R * 0.58 * POCKET_CUT_EXPANSION;
      const railInset = ORIGINAL_RAIL_WIDTH * 0.35;
      // mirror the profile so local axes always point toward the playing surface
      mesh.scale.set(-sx, -sy, 1);
      mesh.position.set(
        sx * (halfW + railInset) + outward.x * radialOffset,
        clothPlane + POCKET_RIM_LIFT,
        sy * (halfH + railInset) + outward.y * radialOffset
      );
    } else {
      const sy = Math.sign(p.y) || 1;
      mesh.scale.z = sy >= 0 ? -1 : 1;
      mesh.position.z += sy * POCKET_VIS_R * 0.12 * POCKET_CUT_EXPANSION;
    }
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    cuts.push(mesh);
  });
  return cuts;
}

/**
 * NEW SNOOKER GAME — fresh build (keep ONLY Guret for balls)
 * Per kërkesën tënde:
 *  • Kamera rotullohet si një person te tavolina (orbit e butë), me kënd pak të ulët, pa rënë në nivelin e cloth.
 *  • 6 gropa të prera realisht në cloth (Shape.holes + Extrude) + kapje (capture radius) → guret bien brenda.
 *  • Power slider i RI: i madh, djathtas ekranit, me gjest **PULL** (tërhiq POSHTË sa fort do → fuqi), dhe **gjuan në release**.
 *  • Playable: aiming line + tick, përplasje, kapje në xhepa, logjikë bazë snooker (reds→colour, pastaj colours in order, fouls, in‑hand).
 */

// --------------------------------------------------
// Config
// --------------------------------------------------
// separate scales for table and balls
// Dimensions enlarged for a roomier snooker table but globally reduced by 30%
const SIZE_REDUCTION = 0.7;
const GLOBAL_SIZE_FACTOR = 0.85 * SIZE_REDUCTION; // apply uniform 30% shrink from previous tuning
// shrink the entire 3D world to ~70% of its previous footprint while preserving
// the HUD scale and gameplay math that rely on worldScaleFactor conversions
const WORLD_SCALE = 0.85 * GLOBAL_SIZE_FACTOR * 0.7;
const BALL_SCALE = 0.97;
const TABLE_SCALE = 1.3;
const TABLE = {
  W: 66 * TABLE_SCALE,
  H: 132 * TABLE_SCALE,
  THICK: 1.8 * TABLE_SCALE,
  WALL: 2.6 * TABLE_SCALE
};
const RAIL_HEIGHT = TABLE.THICK * 1.82;
const FRAME_TOP_Y = -TABLE.THICK + 0.01;
const TABLE_RAIL_TOP_Y = FRAME_TOP_Y + RAIL_HEIGHT;
const CLOTH_LIFT = (() => {
  const ballR = 2 * BALL_SCALE;
  const microEpsRatio = 0.022857142857142857;
  const eps = ballR * microEpsRatio;
  return Math.max(0, RAIL_HEIGHT - ballR - eps);
})();
// shrink the inside rails so their exposed width is roughly 30% of the cushion depth
const SIDE_RAIL_INNER_REDUCTION = 0.8;
const SIDE_RAIL_INNER_SCALE = 1 - SIDE_RAIL_INNER_REDUCTION;
const SIDE_RAIL_INNER_THICKNESS = TABLE.WALL * SIDE_RAIL_INNER_SCALE;
const END_RAIL_INNER_REDUCTION = SIDE_RAIL_INNER_REDUCTION;
const END_RAIL_INNER_SCALE = 1 - END_RAIL_INNER_REDUCTION;
const END_RAIL_INNER_THICKNESS = TABLE.WALL * END_RAIL_INNER_SCALE;
const ORIGINAL_PLAY_W = TABLE.W - 2 * TABLE.WALL;
const ORIGINAL_HALF_W = ORIGINAL_PLAY_W / 2;
const PLAY_W = TABLE.W - 2 * SIDE_RAIL_INNER_THICKNESS;
const PLAY_H = TABLE.H - 2 * END_RAIL_INNER_THICKNESS;
const ACTION_CAMERA_START_BLEND = 1;
const BALL_R = 2 * BALL_SCALE;
const CLOTH_DROP = BALL_R * 0.18; // lower the cloth surface slightly for added depth
const CLOTH_TOP_LOCAL = FRAME_TOP_Y + BALL_R * 0.09523809523809523;
const MICRO_EPS = BALL_R * 0.022857142857142857;
const POCKET_R = BALL_R * 1.82; // pockets tightened for a smaller opening
// slightly larger visual radius so rails align with pocket rings
const POCKET_VIS_R = POCKET_R / 0.985;
const POCKET_CUT_EXPANSION = 1.12; // widen cloth openings further to trim stray cloth around the pockets
const POCKET_HOLE_R =
  POCKET_VIS_R * 1.3 * POCKET_CUT_EXPANSION; // cloth cutout radius for pocket openings
const BALL_CENTER_Y =
  CLOTH_TOP_LOCAL + CLOTH_LIFT + BALL_R - CLOTH_DROP; // rest balls directly on the lowered cloth plane
const BALL_SEGMENTS = Object.freeze({ width: 64, height: 48 });
const BALL_GEOMETRY = new THREE.SphereGeometry(
  BALL_R,
  BALL_SEGMENTS.width,
  BALL_SEGMENTS.height
);
const BALL_MATERIAL_CACHE = new Map();
// Slightly faster surface to keep balls rolling realistically on the snooker cloth
// Slightly reduce per-frame friction so rolls feel livelier on high refresh
// rate displays (e.g. 90 Hz) instead of drifting into slow motion.
const FRICTION = 0.993;
const CUSHION_RESTITUTION = 0.99;
const STOP_EPS = 0.02;
const TARGET_FPS = 90;
const TARGET_FRAME_TIME_MS = 1000 / TARGET_FPS;
const MAX_FRAME_TIME_MS = TARGET_FRAME_TIME_MS * 3; // allow up to 3 frames of catch-up
const MIN_FRAME_SCALE = 1e-6; // prevent zero-length frames from collapsing physics updates
const MAX_PHYSICS_SUBSTEPS = 5; // keep catch-up updates smooth without exploding work per frame
const CAPTURE_R = POCKET_R; // pocket capture radius
const CLOTH_THICKNESS = TABLE.THICK * 0.12; // render a thinner cloth so the playing surface feels lighter
const POCKET_JAW_LIP_HEIGHT =
  CLOTH_TOP_LOCAL +
  CLOTH_LIFT -
  CLOTH_THICKNESS * 0.24; // recess the pocket lips so they sit almost flush with the cloth while staying visible
const CUSHION_OVERLAP = SIDE_RAIL_INNER_THICKNESS * 0.35; // overlap between cushions and rails to hide seams
const SIDE_RAIL_EXTRA_DEPTH = TABLE.THICK * 1.12; // deepen side aprons so the lower edge flares out more prominently
const END_RAIL_EXTRA_DEPTH = SIDE_RAIL_EXTRA_DEPTH; // drop the end rails to match the side apron depth
const RAIL_OUTER_EDGE_RADIUS_RATIO = 0.18; // soften the exterior rail corners with a shallow curve
const POCKET_RIM_LIFT = 0; // keep pocket rims level with the surrounding cloth
const POCKET_RECESS_DEPTH =
  BALL_R * 0.24; // keep the pocket throat visible without sinking the rim
const POCKET_DROP_ANIMATION_MS = 420;
const POCKET_DROP_MIN_MS = Math.round(POCKET_DROP_ANIMATION_MS * 0.57);
const POCKET_DROP_MAX_MS = Math.round(POCKET_DROP_ANIMATION_MS * 1.285);
const POCKET_DROP_SPEED_REFERENCE = 1.4;
const POCKET_DROP_DEPTH = TABLE.THICK * 0.9;
const POCKET_DROP_SCALE = 0.55;
const POCKET_CLOTH_TOP_RADIUS = POCKET_VIS_R * 0.84;
const POCKET_CLOTH_BOTTOM_RADIUS = POCKET_CLOTH_TOP_RADIUS * 0.62;
const POCKET_DROP_TOP_SCALE = 0.82;
const POCKET_DROP_BOTTOM_SCALE = 0.48;
const POCKET_CLOTH_DEPTH = POCKET_RECESS_DEPTH * 1.05;
const POCKET_CAM = Object.freeze({
  triggerDist: CAPTURE_R * 9.5,
  dotThreshold: 0.3,
  minOutside:
    Math.max(SIDE_RAIL_INNER_THICKNESS, END_RAIL_INNER_THICKNESS) * 1.95 +
    POCKET_VIS_R * 3.4 +
    BALL_R * 3.1,
  maxOutside: BALL_R * 30,
  heightOffset: BALL_R * 11.4,
  outwardOffset:
    Math.max(SIDE_RAIL_INNER_THICKNESS, END_RAIL_INNER_THICKNESS) * 2.4 +
    POCKET_VIS_R * 3.6 +
    BALL_R * 2.4,
  heightDrop: BALL_R * 1.6,
  distanceScale: 1.14,
  heightScale: 1.28
});
const POCKET_CHAOS_MOVING_THRESHOLD = 3;
const POCKET_GUARANTEED_ALIGNMENT = 0.82;
const POCKET_INTENT_TIMEOUT_MS = 4200;
const ACTION_CAM = Object.freeze({
  pairMinDistance: BALL_R * 28,
  pairMaxDistance: BALL_R * 72,
  pairDistanceScale: 1.05,
  sideBias: 1.24,
  forwardBias: 0.1,
  shortRailBias: 0.52,
  followShortRailBias: 0.42,
  heightOffset: BALL_R * 10.5,
  smoothingTime: 0.32,
  followSmoothingTime: 0.24,
  followDistance: BALL_R * 54,
  followHeightOffset: BALL_R * 8.4,
  followHoldMs: 900
});
/**
 * Regji Kamera Snooker
 *
 * 0–2s (Opening Pan)
 * • Kamera nis nga lart, kënd diagonal mbi tavolinë (rreth 60°).
 * • Pan i ngadaltë djathtas → majtas që tregon gjithë tavolinën.
 *
 * 2–4s (Focus on Cue Ball)
 * • Kamera afrohet tek topi i bardhë dhe shkopi.
 * • Këndi ulet në 20–25° mbi tavolinë, direkt pas shkopit.
 * • Zoom i lehtë / shtrëngim i kornizës.
 *
 * 4–6s (Strike Tracking)
 * • Në momentin e goditjes kamera dridhet lehtë për impakt.
 * • Pastaj ndjek topin e bardhë përgjatë tavolinës duke e mbajtur në qendër.
 *
 * 6–9s (Impact & Spread)
 * • Kur topat përplasen, kamera ngrihet gradualisht (top-down).
 * • Hapet FOV që të futen të gjithë topat në kornizë.
 * • Bën lëvizje orbitale të shpejtë rreth tavolinës (rreth 30° rrotullim).
 *
 * 9–12s (Potting Shot)
 * • Kamera bën një dolly-in tek xhepi ku bie topi.
 * • Ndjek topin brenda xhepit për ~1 sekondë.
 * • Pastaj fade-out ose rikthim tek pamja e plotë.
 *
 * 12s+ (Reset)
 * • Kamera kthehet në overview fillestar (45° mbi tavolinë).
 * • Mban pan shumë të ngadaltë si looping idle derisa të ndodhë goditja tjetër.
 *
 * 🎮 Triggers
 * • Fillim loje → Opening Pan.
 * • Kur lojtari përgatitet → Focus on Cue Ball.
 * • Moment goditjeje → Strike Tracking.
 * • Kur topat përplasen → Impact & Spread.
 * • Kur një top bie në xhep → Potting Shot.
 * • Pas çdo raundi → Reset.
 */
const SHORT_RAIL_CAMERA_DISTANCE = PLAY_H / 2 + BALL_R * 18;
const SIDE_RAIL_CAMERA_DISTANCE = PLAY_W / 2 + BALL_R * 18;
const CAMERA_LATERAL_CLAMP = Object.freeze({
  short: PLAY_W * 0.4,
  side: PLAY_H * 0.45
});
const POCKET_VIEW_MIN_DURATION_MS = 560;
const POCKET_VIEW_ACTIVE_EXTENSION_MS = 300;
const POCKET_VIEW_POST_POT_HOLD_MS = 160;
const SPIN_STRENGTH = BALL_R * 0.03125;
const SPIN_DECAY = 0.88;
const SPIN_ROLL_STRENGTH = BALL_R * 0.0175;
const SPIN_ROLL_DECAY = 0.978;
const SPIN_AIR_DECAY = 0.997; // hold spin energy while the cue ball travels straight pre-impact
const SWERVE_THRESHOLD = 0.85; // outer 15% of the spin control activates swerve behaviour
const SWERVE_TRAVEL_MULTIPLIER = 0.55; // dampen sideways drift while swerve is active so it stays believable
const PRE_IMPACT_SPIN_DRIFT = 0.06; // reapply stored sideways swerve once the cue ball is rolling after impact
// Base shot speed tuned for livelier pace while keeping slider sensitivity manageable.
const SHOT_FORCE_BOOST = 1.2; // trim strike strength by 20% to soften shots
const SHOT_BASE_SPEED = 3.3 * 0.3 * 1.65 * SHOT_FORCE_BOOST;
const SHOT_MIN_FACTOR = 0.25;
const SHOT_POWER_RANGE = 0.75;
// Make the four round legs dramatically taller so the table surface rides higher
const LEG_SCALE = 6.2;
const LEG_HEIGHT_FACTOR = 4;
const LEG_HEIGHT_MULTIPLIER = 2.25;
const BASE_TABLE_LIFT = 3.6;
const TABLE_DROP = 0.4;
const TABLE_H = 0.75 * LEG_SCALE; // physical height of table used for legs/skirt
const TABLE_LIFT =
  BASE_TABLE_LIFT + TABLE_H * (LEG_HEIGHT_FACTOR - 1);
// raise overall table position so the longer legs are visible and the playfield sits higher off the floor
const TABLE_Y = -2 + (TABLE_H - 0.75) + TABLE_H + TABLE_LIFT - TABLE_DROP;
const BASE_LEG_HEIGHT = TABLE.THICK * 2 * 3 * 1.15 * LEG_HEIGHT_MULTIPLIER;
const LEG_RADIUS_SCALE = 1.2; // 20% thicker cylindrical legs
const LEG_LENGTH_SCALE = 0.72; // lengthen the visible legs by 20% to elevate the table stance
const LEG_HEIGHT_OFFSET = FRAME_TOP_Y - 0.3; // relationship between leg room and visible leg height
const LEG_ROOM_HEIGHT_RAW = BASE_LEG_HEIGHT + TABLE_LIFT;
const LEG_ROOM_HEIGHT =
  (LEG_ROOM_HEIGHT_RAW + LEG_HEIGHT_OFFSET) * LEG_LENGTH_SCALE - LEG_HEIGHT_OFFSET;
const LEG_TOP_OVERLAP = TABLE.THICK * 0.25; // sink legs slightly into the apron so they appear connected
const SKIRT_DROP_MULTIPLIER = 3.2; // double the apron drop so the base reads much deeper beneath the rails
const SKIRT_SIDE_OVERHANG = 0; // keep the lower base flush with the rail footprint (no horizontal flare)
const SKIRT_RAIL_GAP_FILL = TABLE.THICK * 0.04; // lift the apron to close the gap beneath the rails
const FLOOR_Y = TABLE_Y - TABLE.THICK - LEG_ROOM_HEIGHT + 0.3;
const CUE_TIP_GAP = BALL_R * 1.45; // pull cue stick slightly farther back for a more natural stance
const CUE_PULL_BASE = BALL_R * 10 * 0.65 * 1.2;
const CUE_Y = BALL_CENTER_Y; // keep cue stick level with the cue ball center
const CUE_TIP_RADIUS = (BALL_R / 0.0525) * 0.006 * 1.5;
const CUE_MARKER_RADIUS = CUE_TIP_RADIUS; // cue ball dots match the cue tip footprint
const CUE_MARKER_DEPTH = CUE_TIP_RADIUS * 0.2;
const CUE_BUTT_LIFT = BALL_R * 0.42;
const MAX_BACKSPIN_TILT = THREE.MathUtils.degToRad(8.5);
const CUE_FRONT_SECTION_RATIO = 0.28;
const MAX_SPIN_CONTACT_OFFSET = Math.max(0, BALL_R - CUE_TIP_RADIUS);
const MAX_SPIN_FORWARD = BALL_R * 0.88;
const MAX_SPIN_SIDE = BALL_R * 0.62;
const MAX_SPIN_VERTICAL = BALL_R * 0.48;
const SPIN_BOX_FILL_RATIO =
  BALL_R > 0
    ? THREE.MathUtils.clamp(
        MAX_SPIN_CONTACT_OFFSET / BALL_R,
        0,
        1
      )
    : 1;
const SPIN_CLEARANCE_MARGIN = BALL_R * 0.4;
const SPIN_TIP_MARGIN = CUE_TIP_RADIUS * 1.6;
// angle for cushion cuts guiding balls into pockets
const CUSHION_CUT_ANGLE = 32;
const CUSHION_BACK_TRIM = 0.8; // trim 20% off the cushion back that meets the rails
const CUSHION_FACE_INSET = SIDE_RAIL_INNER_THICKNESS * 0.09; // pull cushions slightly closer to centre for a tighter pocket entry

// shared UI reduction factor so overlays and controls shrink alongside the table
const UI_SCALE = SIZE_REDUCTION;

// Updated colors for dark cloth and standard balls
// keep rails and frame in the same warm wood tone so the finish matches reference tables
const WOOD_TONE = 0x8b5a2b;
const RAIL_WOOD_COLOR = WOOD_TONE;
const BASE_WOOD_COLOR = WOOD_TONE;
const CLOTH_TEXTURE_INTENSITY = 0.56;
const CLOTH_BUMP_INTENSITY = 0.48;

const COLORS = Object.freeze({
  cloth: 0x339a5a,
  rail: RAIL_WOOD_COLOR,
  base: BASE_WOOD_COLOR,
  markings: 0xffffff,
  cue: 0xffffff,
  red: 0xff0000,
  yellow: 0xffff00,
  green: 0x006400,
  brown: 0x8b4513,
  blue: 0x0000ff,
  pink: 0xff69b4,
  black: 0x000000
});

const ORIGINAL_RAIL_WIDTH = TABLE.WALL * 0.7;
const ORIGINAL_FRAME_WIDTH = ORIGINAL_RAIL_WIDTH * 2.5;
const ORIGINAL_OUTER_HALF_W =
  ORIGINAL_HALF_W + ORIGINAL_RAIL_WIDTH * 2 + ORIGINAL_FRAME_WIDTH;
const ORIGINAL_PLAY_H = TABLE.H - 2 * TABLE.WALL;
const ORIGINAL_HALF_H = ORIGINAL_PLAY_H / 2;
const ORIGINAL_OUTER_HALF_H =
  ORIGINAL_HALF_H + ORIGINAL_RAIL_WIDTH * 2 + ORIGINAL_FRAME_WIDTH;

const CLOTH_TEXTURE_SIZE = 4096;
const CLOTH_THREAD_PITCH = 12;
const CLOTH_THREADS_PER_TILE = CLOTH_TEXTURE_SIZE / CLOTH_THREAD_PITCH;

const createClothTextures = (() => {
  let cache = null;
  const clamp255 = (value) => Math.max(0, Math.min(255, value));
  return () => {
    if (cache) return cache;
    if (typeof document === 'undefined') {
      cache = { map: null, bump: null };
      return cache;
    }

    const SIZE = CLOTH_TEXTURE_SIZE;
    const THREAD_PITCH = CLOTH_THREAD_PITCH;
    const DIAG = Math.PI / 4;
    const COS = Math.cos(DIAG);
    const SIN = Math.sin(DIAG);
    const TAU = Math.PI * 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      cache = { map: null, bump: null };
      return cache;
    }

    const image = ctx.createImageData(SIZE, SIZE);
    const data = image.data;
    const shadow = { r: 0x1a, g: 0x5b, b: 0x36 };
    const base = { r: 0x2c, g: 0x86, b: 0x45 };
    const accent = { r: 0x3b, g: 0x9d, b: 0x52 };
    const highlight = { r: 0x5d, g: 0xc8, b: 0x79 };
    const hashNoise = (x, y, seedX, seedY, phase = 0) =>
      Math.sin((x * seedX + y * seedY + phase) * 0.02454369260617026) * 0.5 + 0.5;
    const fiberNoise = (x, y) =>
      hashNoise(x, y, 12.9898, 78.233, 1.5) * 0.7 +
      hashNoise(x, y, 32.654, 23.147, 15.73) * 0.2 +
      hashNoise(x, y, 63.726, 12.193, -9.21) * 0.1;
    const microNoise = (x, y) =>
      hashNoise(x, y, 41.12, 27.43, -4.5) * 0.5 +
      hashNoise(x, y, 19.71, 55.83, 23.91) * 0.5;
    const sparkleNoise = (x, y) =>
      hashNoise(x, y, 73.19, 11.17, 7.2) * 0.45 +
      hashNoise(x, y, 27.73, 61.91, -14.4) * 0.55;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const u = ((x * COS + y * SIN) / THREAD_PITCH) * TAU;
        const v = ((x * COS - y * SIN) / THREAD_PITCH) * TAU;
        const warp = 0.5 + 0.5 * Math.cos(u);
        const weft = 0.5 + 0.5 * Math.cos(v);
        const weave = Math.pow((warp + weft) * 0.5, 1.68);
        const cross = Math.pow(warp * weft, 0.9);
        const diamond = Math.pow(Math.abs(Math.sin(u) * Math.sin(v)), 0.6);
        const fiber = fiberNoise(x, y);
        const micro = microNoise(x + 31.8, y + 17.3);
        const sparkle = sparkleNoise(x * 0.6 + 11.8, y * 0.7 - 4.1);
        const fuzz = Math.pow(fiber, 1.2);
    const tonal = THREE.MathUtils.clamp(
      0.56 +
        (weave - 0.5) * 0.6 * CLOTH_TEXTURE_INTENSITY +
        (cross - 0.5) * 0.48 * CLOTH_TEXTURE_INTENSITY +
        (diamond - 0.5) * 0.54 * CLOTH_TEXTURE_INTENSITY +
        (fiber - 0.5) * 0.32 * CLOTH_TEXTURE_INTENSITY +
        (fuzz - 0.5) * 0.24 * CLOTH_TEXTURE_INTENSITY +
        (micro - 0.5) * 0.18 * CLOTH_TEXTURE_INTENSITY,
      0,
      1
    );
    const tonalEnhanced = THREE.MathUtils.clamp(
      0.5 + (tonal - 0.5) * (1 + (1.56 - 1) * CLOTH_TEXTURE_INTENSITY),
      0,
      1
    );
    const highlightMix = THREE.MathUtils.clamp(
      0.34 +
        (cross - 0.5) * 0.44 * CLOTH_TEXTURE_INTENSITY +
        (diamond - 0.5) * 0.66 * CLOTH_TEXTURE_INTENSITY +
        (sparkle - 0.5) * 0.38 * CLOTH_TEXTURE_INTENSITY,
      0,
      1
    );
    const accentMix = THREE.MathUtils.clamp(
      0.48 +
        (diamond - 0.5) * 1.12 * CLOTH_TEXTURE_INTENSITY +
        (fuzz - 0.5) * 0.3 * CLOTH_TEXTURE_INTENSITY,
      0,
      1
    );
    const highlightEnhanced = THREE.MathUtils.clamp(
      0.38 + (highlightMix - 0.5) * (1 + (1.68 - 1) * CLOTH_TEXTURE_INTENSITY),
      0,
      1
    );
        const baseR = shadow.r + (base.r - shadow.r) * tonalEnhanced;
        const baseG = shadow.g + (base.g - shadow.g) * tonalEnhanced;
        const baseB = shadow.b + (base.b - shadow.b) * tonalEnhanced;
        const accentR = baseR + (accent.r - baseR) * accentMix;
        const accentG = baseG + (accent.g - baseG) * accentMix;
        const accentB = baseB + (accent.b - baseB) * accentMix;
        const r = accentR + (highlight.r - accentR) * highlightEnhanced;
        const g = accentG + (highlight.g - accentG) * highlightEnhanced;
        const b = accentB + (highlight.b - accentB) * highlightEnhanced;
        const i = (y * SIZE + x) * 4;
        data[i + 0] = clamp255(r);
        data[i + 1] = clamp255(g);
        data[i + 2] = clamp255(b);
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);

    const colorMap = new THREE.CanvasTexture(canvas);
    colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(16, 64);
    colorMap.anisotropy = 64;
    colorMap.generateMipmaps = true;
    colorMap.minFilter = THREE.LinearMipmapLinearFilter;
    colorMap.magFilter = THREE.LinearFilter;
    if ('colorSpace' in colorMap) colorMap.colorSpace = THREE.SRGBColorSpace;
    else colorMap.encoding = THREE.sRGBEncoding;
    colorMap.needsUpdate = true;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = bumpCanvas.height = SIZE;
    const bumpCtx = bumpCanvas.getContext('2d');
    if (!bumpCtx) {
      cache = { map: colorMap, bump: null };
      return cache;
    }
    const bumpImage = bumpCtx.createImageData(SIZE, SIZE);
    const bumpData = bumpImage.data;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const u = ((x * COS + y * SIN) / THREAD_PITCH) * TAU;
        const v = ((x * COS - y * SIN) / THREAD_PITCH) * TAU;
        const warp = 0.5 + 0.5 * Math.cos(u);
        const weft = 0.5 + 0.5 * Math.cos(v);
        const weave = Math.pow((warp + weft) * 0.5, 1.58);
        const cross = Math.pow(warp * weft, 0.94);
        const diamond = Math.pow(Math.abs(Math.sin(u) * Math.sin(v)), 0.68);
        const fiber = fiberNoise(x, y);
        const micro = microNoise(x + 31.8, y + 17.3);
        const fuzz = Math.pow(fiber, 1.22);
        const bump = THREE.MathUtils.clamp(
          0.56 +
            (weave - 0.5) * 0.9 * CLOTH_BUMP_INTENSITY +
            (cross - 0.5) * 0.46 * CLOTH_BUMP_INTENSITY +
            (diamond - 0.5) * 0.58 * CLOTH_BUMP_INTENSITY +
            (fiber - 0.5) * 0.36 * CLOTH_BUMP_INTENSITY +
            (fuzz - 0.5) * 0.24 * CLOTH_BUMP_INTENSITY +
            (micro - 0.5) * 0.26 * CLOTH_BUMP_INTENSITY,
          0,
          1
        );
        const value = clamp255(130 + (bump - 0.5) * 234);
        const i = (y * SIZE + x) * 4;
        bumpData[i + 0] = value;
        bumpData[i + 1] = value;
        bumpData[i + 2] = value;
        bumpData[i + 3] = 255;
      }
    }
    bumpCtx.putImageData(bumpImage, 0, 0);

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.repeat.copy(colorMap.repeat);
    bumpMap.anisotropy = colorMap.anisotropy;
    bumpMap.generateMipmaps = true;
    bumpMap.minFilter = THREE.LinearMipmapLinearFilter;
    bumpMap.magFilter = THREE.LinearFilter;

    cache = { map: colorMap, bump: bumpMap };
    return cache;
  };
})();

const createWoodTexture = (() => {
  let cache = null;
  const clamp255 = (value) => Math.max(0, Math.min(255, value));
  return () => {
    if (cache) return cache;
    if (typeof document === 'undefined') {
      cache = { map: null, roughness: null };
      return cache;
    }

    const SIZE = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      cache = { map: null, roughness: null };
      return cache;
    }

    const baseColor = new THREE.Color(BASE_WOOD_COLOR);
    const baseHSL = { h: 0, s: 0, l: 0 };
    baseColor.getHSL(baseHSL);
    const tempColor = new THREE.Color();
    for (let x = 0; x < SIZE; x += 1) {
      const t = x / SIZE;
      const wave1 = Math.sin(t * Math.PI * 6);
      const wave2 = Math.sin((t + 0.2) * Math.PI * 18);
      const hue = THREE.MathUtils.euclideanModulo(
        baseHSL.h + wave1 * 0.014 + wave2 * 0.006,
        1
      );
      const sat = THREE.MathUtils.clamp(
        baseHSL.s + wave1 * 0.08 + wave2 * 0.03,
        0.12,
        0.75
      );
      const light = THREE.MathUtils.clamp(
        baseHSL.l + wave1 * 0.12 + wave2 * 0.05,
        0.26,
        0.72
      );
      tempColor.setHSL(hue, sat, light);
      ctx.fillStyle = `#${tempColor.getHexString()}`;
      ctx.fillRect(x, 0, 1, SIZE);
    }

    const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
    const { data } = imageData;
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const idx = (y * SIZE + x) * 4;
        const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const noise = (seed - Math.floor(seed) - 0.5) * 10;
        data[idx] = clamp255(data[idx] + noise);
        data[idx + 1] = clamp255(data[idx + 1] + noise * 0.55);
        data[idx + 2] = clamp255(data[idx + 2] + noise * 0.3);
      }
    }
    ctx.putImageData(imageData, 0, 0);

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = roughCanvas.height = SIZE;
    const roughCtx = roughCanvas.getContext('2d');
    if (!roughCtx) {
      cache = { map: null, roughness: null };
      return cache;
    }
    const roughImage = roughCtx.createImageData(SIZE, SIZE);
    const roughData = roughImage.data;
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const idx = (y * SIZE + x) * 4;
        const seed = Math.sin((x + 11.2) * 10.123 + y * 53.321) * 19341.17;
        const n = (seed - Math.floor(seed) - 0.5) * 28;
        const stripe = Math.sin((x / SIZE) * Math.PI * 4) * 16;
        const value = clamp255(178 + n + stripe);
        roughData[idx] = value;
        roughData[idx + 1] = value;
        roughData[idx + 2] = value;
        roughData[idx + 3] = 255;
      }
    }
    roughCtx.putImageData(roughImage, 0, 0);

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 8;
    map.needsUpdate = true;
    if ('colorSpace' in map) {
      map.colorSpace = THREE.SRGBColorSpace;
    } else {
      map.encoding = THREE.sRGBEncoding;
    }

    const roughness = new THREE.CanvasTexture(roughCanvas);
    roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;
    roughness.anisotropy = 4;
    roughness.needsUpdate = true;
    if ('colorSpace' in roughness) {
      roughness.colorSpace = THREE.LinearSRGBColorSpace;
    }

    cache = { map, roughness };
    return cache;
  };
})();

const createCarpetTextures = (() => {
  let cache = null;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const noise = (x, y) => {
    const value = Math.sin(x * 2.142 + y * 3.741) * 43758.5453;
    return value - Math.floor(value);
  };
  return () => {
    if (cache) return cache;
    if (typeof document === 'undefined') {
      cache = { map: null, bump: null };
      return cache;
    }
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const base = new THREE.Color(0x8c2f2f).convertLinearToSRGB();
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const ring = Math.sin(((x * x + y * y) / (size * size)) * Math.PI * 1.4);
        const fibers =
          Math.sin((x / size) * Math.PI * 14) * 0.18 +
          Math.cos((y / size) * Math.PI * 16) * 0.16;
        const grain = noise(x + ring * 12.5, y + ring * 18.5) * 0.55 - 0.28;
        const shading = clamp01(0.55 + fibers * 0.6 + ring * 0.12 + grain);
        image.data[idx] = clamp01(base.r + shading * 0.25) * 255;
        image.data[idx + 1] = clamp01(base.g + shading * 0.18) * 255;
        image.data[idx + 2] = clamp01(base.b + shading * 0.15) * 255;
        image.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
    else texture.encoding = THREE.sRGBEncoding;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = bumpCanvas.height = size;
    const bumpCtx = bumpCanvas.getContext('2d');
    const bumpImage = bumpCtx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const weaveX = Math.sin((x / size) * Math.PI * 18) * 0.5;
        const weaveY = Math.cos((y / size) * Math.PI * 20) * 0.45;
        const speckle = noise(x * 1.4, y * 1.7) * 0.8 - 0.4;
        const shade = clamp01(0.5 + weaveX + weaveY + speckle);
        const value = shade * 255;
        bumpImage.data[idx] = value;
        bumpImage.data[idx + 1] = value;
        bumpImage.data[idx + 2] = value;
        bumpImage.data[idx + 3] = 255;
      }
    }
    bumpCtx.putImageData(bumpImage, 0, 0);
    const bump = new THREE.CanvasTexture(bumpCanvas);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.anisotropy = 6;
    bump.minFilter = THREE.LinearMipMapLinearFilter;
    bump.magFilter = THREE.LinearFilter;
    bump.generateMipmaps = true;

    cache = { map: texture, bump };
    return cache;
  };
})();

function spotPositions(baulkZ) {
  const halfH = PLAY_H / 2;
  return {
    yellow: [-PLAY_W * 0.22, baulkZ],
    green: [PLAY_W * 0.22, baulkZ],
    brown: [0, baulkZ],
    blue: [0, 0],
    pink: [0, PLAY_H * 0.25],
    black: [0, halfH - PLAY_H * 0.09]
  };
}

// Kamera: ruaj kënd komod që mos shtrihet poshtë cloth-it, por lejo pak më shumë lartësi kur ngrihet
const STANDING_VIEW_PHI = 0.9;
const CUE_SHOT_PHI = Math.PI / 2 - 0.26;
const STANDING_VIEW_MARGIN = 0.18;
const STANDING_VIEW_FOV = 66;
const CAMERA_ABS_MIN_PHI = 0.3;
const CAMERA_MIN_PHI = Math.max(CAMERA_ABS_MIN_PHI, STANDING_VIEW_PHI - 0.18);
const CAMERA_MAX_PHI = CUE_SHOT_PHI - 0.24; // keep orbit camera from dipping below the table surface
const PLAYER_CAMERA_DISTANCE_FACTOR = 0.44;
const BROADCAST_RADIUS_LIMIT_MULTIPLIER = 1.08;
const BROADCAST_DISTANCE_MULTIPLIER = 1.02;
const BROADCAST_RADIUS_PADDING = TABLE.THICK * 0.26;
const CAMERA = {
  fov: STANDING_VIEW_FOV,
  near: 0.04,
  far: 4000,
  minR: 18 * TABLE_SCALE * GLOBAL_SIZE_FACTOR * PLAYER_CAMERA_DISTANCE_FACTOR,
  maxR: 260 * TABLE_SCALE * GLOBAL_SIZE_FACTOR * BROADCAST_RADIUS_LIMIT_MULTIPLIER,
  minPhi: CAMERA_MIN_PHI,
  // keep the camera slightly above the horizontal plane but allow a lower sweep
  maxPhi: CAMERA_MAX_PHI
};
const CAMERA_CUSHION_CLEARANCE = TABLE.THICK * 0.92; // keep orbit height safely above cushion lip
const STANDING_VIEW = Object.freeze({
  phi: STANDING_VIEW_PHI,
  margin: STANDING_VIEW_MARGIN
});
const STANDING_VIEW_COT = (() => {
  const sinPhi = Math.sin(STANDING_VIEW_PHI);
  return sinPhi > 1e-6 ? Math.cos(STANDING_VIEW_PHI) / sinPhi : 0;
})();
const DEFAULT_RAIL_LIMIT_X = PLAY_W / 2 - BALL_R - CUSHION_FACE_INSET;
const DEFAULT_RAIL_LIMIT_Y = PLAY_H / 2 - BALL_R - CUSHION_FACE_INSET;
let RAIL_LIMIT_X = DEFAULT_RAIL_LIMIT_X;
let RAIL_LIMIT_Y = DEFAULT_RAIL_LIMIT_Y;
const RAIL_LIMIT_PADDING = 0.1;
const BREAK_VIEW = Object.freeze({
  radius: CAMERA.minR, // start the intro framing closer to the table surface
  phi: CAMERA.maxPhi - 0.01
});
const CAMERA_RAIL_SAFETY = 0.02;
const CUE_VIEW_RADIUS_RATIO = 0.4;
const CUE_VIEW_MIN_RADIUS = CAMERA.minR;
const CUE_VIEW_MIN_PHI = Math.min(
  CAMERA.maxPhi - CAMERA_RAIL_SAFETY,
  STANDING_VIEW_PHI + 0.22
);
const CUE_VIEW_PHI_LIFT = 0.08;
const CUE_VIEW_TARGET_PHI = CUE_VIEW_MIN_PHI + CUE_VIEW_PHI_LIFT * 0.5;
const CAMERA_RAIL_APPROACH_PHI = Math.min(
  STANDING_VIEW_PHI + 0.32,
  CAMERA_MAX_PHI - 0.02
); // ensure rail clamp activates within the lowered camera tilt limit
const CAMERA_MIN_HORIZONTAL =
  ((Math.max(PLAY_W, PLAY_H) / 2 + SIDE_RAIL_INNER_THICKNESS) * WORLD_SCALE) +
  CAMERA_RAIL_SAFETY;
const CAMERA_DOWNWARD_PULL = 1.9;
const CAMERA_DYNAMIC_PULL_RANGE = CAMERA.minR * 0.18;
const CUE_VIEW_AIM_SLOW_FACTOR = 0.35; // slow pointer rotation while blended toward cue view for finer aiming
const POCKET_VIEW_SMOOTH_TIME = 0.24; // seconds to ease pocket camera transitions
const POCKET_CAMERA_FOV = STANDING_VIEW_FOV;
const LONG_SHOT_DISTANCE = PLAY_H * 0.5;
const LONG_SHOT_ACTIVATION_DELAY_MS = 220;
const LONG_SHOT_ACTIVATION_TRAVEL = PLAY_H * 0.28;
const LONG_SHOT_SPEED_SWITCH_THRESHOLD =
  SHOT_BASE_SPEED * 0.82; // skip long-shot cam switch if cue ball launches faster
const LONG_SHOT_SHORT_RAIL_OFFSET = BALL_R * 18;
const RAIL_NEAR_BUFFER = BALL_R * 3.5;
const SHORT_SHOT_CAMERA_DISTANCE = BALL_R * 24; // keep camera in standing view for close shots
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const signed = (value, fallback = 1) =>
  value > 0 ? 1 : value < 0 ? -1 : fallback;
const computeStandingViewHeight = (
  targetHeight,
  horizontalDistance,
  minHeight = TABLE_Y + TABLE.THICK
) => {
  if (!Number.isFinite(horizontalDistance) || horizontalDistance <= 0) {
    return Math.max(minHeight, targetHeight);
  }
  const lift = horizontalDistance * STANDING_VIEW_COT;
  const desiredHeight = targetHeight + lift;
  return Math.max(minHeight, desiredHeight);
};
const applyStandingViewElevation = (
  desired,
  focus,
  minHeight = TABLE_Y + TABLE.THICK
) => {
  if (!desired || !focus) return;
  const horizontalDistance = Math.hypot(
    desired.x - focus.x,
    desired.z - focus.z
  );
  const targetHeight = focus.y;
  const minStandingHeight = computeStandingViewHeight(
    targetHeight,
    horizontalDistance,
    minHeight
  );
  if (desired.y < minStandingHeight) {
    desired.y = minStandingHeight;
  }
};
const TMP_SPIN = new THREE.Vector2();
const TMP_SPH = new THREE.Spherical();
const TMP_VEC2_A = new THREE.Vector2();
const TMP_VEC2_B = new THREE.Vector2();
const TMP_VEC2_C = new THREE.Vector2();
const TMP_VEC2_D = new THREE.Vector2();
const TMP_VEC2_SPIN = new THREE.Vector2();
const TMP_VEC2_FORWARD = new THREE.Vector2();
const TMP_VEC2_LATERAL = new THREE.Vector2();
const TMP_VEC2_LIMIT = new THREE.Vector2();
const TMP_VEC2_AXIS = new THREE.Vector2();
const TMP_VEC2_VIEW = new THREE.Vector2();
const CORNER_SIGNS = [
  { sx: -1, sy: -1 },
  { sx: 1, sy: -1 },
  { sx: -1, sy: 1 },
  { sx: 1, sy: 1 }
];
const fitRadius = (camera, margin = 1.1) => {
  const a = camera.aspect,
    f = THREE.MathUtils.degToRad(camera.fov);
  const halfW = (TABLE.W / 2) * margin,
    halfH = (TABLE.H / 2) * margin;
  const dzH = halfH / Math.tan(f / 2);
  const dzW = halfW / (Math.tan(f / 2) * a);
  // Keep a little more distance so rails remain visible while fitting the table
  const r = Math.max(dzH, dzW) * 0.68 * GLOBAL_SIZE_FACTOR;
  return clamp(r, CAMERA.minR, CAMERA.maxR);
};
const lerpAngle = (start = 0, end = 0, t = 0.5) => {
  const delta = Math.atan2(Math.sin(end - start), Math.cos(end - start));
  return start + delta * THREE.MathUtils.clamp(t ?? 0, 0, 1);
};


// --------------------------------------------------
// Utilities
// --------------------------------------------------
const DEFAULT_SPIN_LIMITS = Object.freeze({
  minX: -1,
  maxX: 1,
  minY: -1,
  maxY: 1
});
const clampSpinValue = (value) => clamp(value, -1, 1);
const SPIN_INPUT_DEAD_ZONE = 0.06;
const SPIN_CUSHION_EPS = BALL_R * 0.5;

const clampToUnitCircle = (x, y) => {
  const L = Math.hypot(x, y);
  if (!Number.isFinite(L) || L <= 1) {
    return { x, y };
  }
  const scale = L > 1e-6 ? 1 / L : 0;
  return { x: x * scale, y: y * scale };
};

const prepareSpinAxes = (aimDir) => {
  if (!aimDir) {
    return {
      axis: new THREE.Vector2(0, 1),
      perp: new THREE.Vector2(1, 0)
    };
  }
  const axis = new THREE.Vector2(aimDir.x ?? 0, aimDir.y ?? 0);
  if (axis.lengthSq() < 1e-8) axis.set(0, 1);
  else axis.normalize();
  const perp = new THREE.Vector2(-axis.y, axis.x);
  if (perp.lengthSq() < 1e-8) perp.set(1, 0);
  else perp.normalize();
  return { axis, perp };
};

const computeCueViewVector = (cueBall, camera) => {
  if (!cueBall?.pos || !camera?.position) return null;
  const cx = camera.position.x - cueBall.pos.x;
  const cz = camera.position.z - cueBall.pos.y;
  TMP_VEC2_VIEW.set(cx, cz);
  if (TMP_VEC2_VIEW.lengthSq() < 1e-8) return null;
  return TMP_VEC2_VIEW.clone().normalize();
};

function checkSpinLegality2D(cueBall, spinVec, balls = [], options = {}) {
  if (!cueBall || !cueBall.pos) {
    return { blocked: false, reason: '' };
  }
  const sx = spinVec?.x ?? 0;
  const sy = spinVec?.y ?? 0;
  const magnitude = Math.hypot(sx, sy);
  if (magnitude < SPIN_INPUT_DEAD_ZONE) {
    return { blocked: false, reason: '' };
  }
  const axes = options.axes;
  TMP_VEC2_SPIN.set(0, 0);
  if (axes?.perp) TMP_VEC2_SPIN.addScaledVector(axes.perp, sx);
  if (axes?.axis) TMP_VEC2_SPIN.addScaledVector(axes.axis, sy);
  if (!axes) TMP_VEC2_SPIN.set(sx, sy);
  if (TMP_VEC2_SPIN.lengthSq() < 1e-8) {
    return { blocked: false, reason: '' };
  }
  TMP_VEC2_SPIN.normalize();
  const contact = cueBall.pos
    .clone()
    .add(TMP_VEC2_SPIN.clone().multiplyScalar(BALL_R));
  const cushionClearX = RAIL_LIMIT_X - SPIN_CUSHION_EPS;
  const cushionClearY = RAIL_LIMIT_Y - SPIN_CUSHION_EPS;
  if (
    Math.abs(contact.x) > cushionClearX ||
    Math.abs(contact.y) > cushionClearY
  ) {
    return { blocked: true, reason: 'Cushion blocks that strike point' };
  }
  const view = options.view;
  if (view) {
    TMP_VEC2_LIMIT.set(view.x ?? 0, view.y ?? 0);
    if (TMP_VEC2_LIMIT.lengthSq() > 1e-8) {
      TMP_VEC2_LIMIT.normalize();
      if (TMP_VEC2_SPIN.dot(TMP_VEC2_LIMIT) <= 0) {
        return { blocked: true, reason: 'Contact point not visible' };
      }
    }
  }
  const blockingRadius = BALL_R + CUE_TIP_RADIUS * 1.05;
  const blockingRadiusSq = blockingRadius * blockingRadius;
  const combinedRadius = BALL_R * 2 + 0.003;
  for (const other of balls) {
    if (!other || other === cueBall || !other.active) continue;
    const offset = other.pos.clone().sub(cueBall.pos);
    const dist = offset.length();
    if (dist >= combinedRadius) continue;
    const proj = offset.dot(TMP_VEC2_SPIN);
    if (!(proj > 0)) continue;
    const lateralSq = Math.max(offset.lengthSq() - proj * proj, 0);
    if (lateralSq < blockingRadiusSq) {
      return { blocked: true, reason: 'Another ball blocks that side' };
    }
  }
  return { blocked: false, reason: '' };
}

function distanceToTableEdge(pos, dir) {
  let minT = Infinity;
  if (Math.abs(dir.x) > 1e-6) {
    const boundX = dir.x > 0 ? RAIL_LIMIT_X : -RAIL_LIMIT_X;
    const tx = (boundX - pos.x) / dir.x;
    if (tx > 0) minT = Math.min(minT, tx);
  }
  if (Math.abs(dir.y) > 1e-6) {
    const boundY = dir.y > 0 ? RAIL_LIMIT_Y : -RAIL_LIMIT_Y;
    const ty = (boundY - pos.y) / dir.y;
    if (ty > 0) minT = Math.min(minT, ty);
  }
  return minT;
}

function applyAxisClearance(
  limits,
  key,
  positive,
  clearance,
  { margin = SPIN_TIP_MARGIN, soft = false } = {}
) {
  if (!Number.isFinite(clearance)) return;
  if (soft) {
    const total = MAX_SPIN_CONTACT_OFFSET + margin;
    if (total <= 0) return;
    if (clearance <= 0) {
      if (positive) {
        if (key === 'maxX') limits.maxX = Math.min(limits.maxX, 0);
        if (key === 'maxY') limits.maxY = Math.min(limits.maxY, 0);
      } else {
        if (key === 'minX') limits.minX = Math.max(limits.minX, 0);
        if (key === 'minY') limits.minY = Math.max(limits.minY, 0);
      }
      return;
    }
    const normalized = clamp(clearance / total, 0, 1);
    if (positive) {
      if (key === 'maxX') limits.maxX = Math.min(limits.maxX, normalized);
      if (key === 'maxY') limits.maxY = Math.min(limits.maxY, normalized);
    } else {
      const limit = -normalized;
      if (key === 'minX') limits.minX = Math.max(limits.minX, limit);
      if (key === 'minY') limits.minY = Math.max(limits.minY, limit);
    }
    return;
  }
  const safeClearance = clearance - margin;
  if (safeClearance <= 0) {
    if (positive) {
      if (key === 'maxX') limits.maxX = Math.min(limits.maxX, 0);
      if (key === 'maxY') limits.maxY = Math.min(limits.maxY, 0);
    } else {
      if (key === 'minX') limits.minX = Math.max(limits.minX, 0);
      if (key === 'minY') limits.minY = Math.max(limits.minY, 0);
    }
    return;
  }
  const normalized = clamp(safeClearance / MAX_SPIN_CONTACT_OFFSET, 0, 1);
  if (positive) {
    if (key === 'maxX') limits.maxX = Math.min(limits.maxX, normalized);
    if (key === 'maxY') limits.maxY = Math.min(limits.maxY, normalized);
  } else {
    const limit = -normalized;
    if (key === 'minX') limits.minX = Math.max(limits.minX, limit);
    if (key === 'minY') limits.minY = Math.max(limits.minY, limit);
  }
}

function computeSpinLimits(cueBall, aimDir, balls = [], axesInput = null) {
  if (!cueBall || !aimDir) return { ...DEFAULT_SPIN_LIMITS };
  const spinAxes = axesInput || prepareSpinAxes(aimDir);
  const forward = spinAxes.axis;
  const lateral = spinAxes.perp;
  const axes = [
    { key: 'maxX', dir: lateral.clone(), positive: true },
    { key: 'minX', dir: lateral.clone().multiplyScalar(-1), positive: false },
    { key: 'minY', dir: forward.clone(), positive: false },
    { key: 'maxY', dir: forward.clone().multiplyScalar(-1), positive: true }
  ];
  const limits = { ...DEFAULT_SPIN_LIMITS };
  const cueCenter = new THREE.Vector2(cueBall.pos.x, cueBall.pos.y);
  const combinedRadius = BALL_R * 2 + CUE_TIP_RADIUS * 1.1;
  const combinedRadiusSq = combinedRadius * combinedRadius;

  for (const axis of axes) {
    const centerToEdge = distanceToTableEdge(cueBall.pos, axis.dir);
    if (centerToEdge !== Infinity) {
      const clearance = centerToEdge - BALL_R;
      applyAxisClearance(limits, axis.key, axis.positive, clearance, {
        soft: true,
        margin: SPIN_TIP_MARGIN * 0.75
      });
    }
    let nearest = Infinity;
    for (const other of balls) {
      if (!other || other === cueBall || !other.active) continue;
      const otherPos = new THREE.Vector2(other.pos.x, other.pos.y);
      const offset = otherPos.sub(cueCenter);
      const proj = offset.dot(axis.dir);
      if (!(proj > 0)) continue;
      const offsetSq = offset.lengthSq();
      const lateralSq = Math.max(offsetSq - proj * proj, 0);
      if (lateralSq >= combinedRadiusSq) continue;
      const penetration = Math.sqrt(Math.max(combinedRadiusSq - lateralSq, 0));
      const clearance = proj - penetration;
      if (clearance < nearest) nearest = clearance;
    }
    if (nearest !== Infinity) {
      applyAxisClearance(limits, axis.key, axis.positive, nearest);
    }
  }

  limits.minX = clampSpinValue(limits.minX);
  limits.maxX = clampSpinValue(limits.maxX);
  limits.minY = clampSpinValue(limits.minY);
  limits.maxY = clampSpinValue(limits.maxY);
  if (limits.minX > limits.maxX) limits.minX = limits.maxX = 0;
  if (limits.minY > limits.maxY) limits.minY = limits.maxY = 0;
  return limits;
}

const pocketCenters = () => [
  new THREE.Vector2(-PLAY_W / 2, -PLAY_H / 2),
  new THREE.Vector2(PLAY_W / 2, -PLAY_H / 2),
  new THREE.Vector2(-PLAY_W / 2, PLAY_H / 2),
  new THREE.Vector2(PLAY_W / 2, PLAY_H / 2),
  new THREE.Vector2(-PLAY_W / 2, 0),
  new THREE.Vector2(PLAY_W / 2, 0)
];
const POCKET_IDS = ['TL', 'TR', 'BL', 'BR', 'TM', 'BM'];
const getPocketCenterById = (id) => {
  switch (id) {
    case 'TL':
      return new THREE.Vector2(-PLAY_W / 2, -PLAY_H / 2);
    case 'TR':
      return new THREE.Vector2(PLAY_W / 2, -PLAY_H / 2);
    case 'BL':
      return new THREE.Vector2(-PLAY_W / 2, PLAY_H / 2);
    case 'BR':
      return new THREE.Vector2(PLAY_W / 2, PLAY_H / 2);
    case 'TM':
      return new THREE.Vector2(-PLAY_W / 2, 0);
    case 'BM':
      return new THREE.Vector2(PLAY_W / 2, 0);
    default:
      return null;
  }
};
const POCKET_CAMERA_IDS = ['TL', 'TR', 'BL', 'BR'];
const POCKET_CAMERA_OUTWARD = Object.freeze({
  TL: new THREE.Vector2(-1, -1).normalize(),
  TR: new THREE.Vector2(1, -1).normalize(),
  BL: new THREE.Vector2(-1, 1).normalize(),
  BR: new THREE.Vector2(1, 1).normalize()
});
const getPocketCameraOutward = (id) =>
  POCKET_CAMERA_OUTWARD[id] ? POCKET_CAMERA_OUTWARD[id].clone() : null;
const resolvePocketCameraAnchor = (pocketId, center, approachDir, ballPos) => {
  if (!pocketId) return null;
  switch (pocketId) {
    case 'TL':
    case 'TR':
    case 'BL':
    case 'BR':
      return pocketId;
    case 'TM': {
      const ballY = ballPos?.y ?? 0;
      if (ballY > 0.01) return 'BL';
      if (ballY < -0.01) return 'TL';
      const dirY = approachDir?.y ?? 0;
      return dirY >= 0 ? 'BL' : 'TL';
    }
    case 'BM': {
      const ballY = ballPos?.y ?? 0;
      if (ballY > 0.01) return 'BR';
      if (ballY < -0.01) return 'TR';
      const dirY = approachDir?.y ?? 0;
      return dirY >= 0 ? 'BR' : 'TR';
    }
    default:
      return pocketId;
  }
};
const pocketIdFromCenter = (center) => {
  const epsilon = BALL_R * 0.2;
  if (Math.abs(center.y) < epsilon) {
    return center.x < 0 ? 'TM' : 'BM';
  }
  if (center.y < 0) {
    return center.x < 0 ? 'TL' : 'TR';
  }
  return center.x < 0 ? 'BL' : 'BR';
};
const allStopped = (balls) => balls.every((b) => b.vel.length() < STOP_EPS);

function makeClothTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const clothColor = new THREE.Color(COLORS.cloth);
  const baseCloth = `#${clothColor.getHexString()}`;
  ctx.fillStyle = baseCloth;
  ctx.fillRect(0, 0, size, size);

  const diagonalShade = ctx.createLinearGradient(0, 0, size, size);
  diagonalShade.addColorStop(0, 'rgba(255,255,255,0.05)');
  diagonalShade.addColorStop(0.6, 'rgba(0,0,0,0.1)');
  diagonalShade.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = diagonalShade;
  ctx.fillRect(0, 0, size, size);

  const threadStep = 4; // emphasise the primary warp/weft directions
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  for (let x = -threadStep; x < size + threadStep; x += threadStep) {
    ctx.beginPath();
    ctx.moveTo(x + threadStep * 0.35, 0);
    ctx.lineTo(x + threadStep * 0.35, size);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.24)';
  for (let y = -threadStep; y < size + threadStep; y += threadStep) {
    ctx.beginPath();
    ctx.moveTo(0, y + threadStep * 0.6);
    ctx.lineTo(size, y + threadStep * 0.6);
    ctx.stroke();
  }

  const weaveSpacing = 2;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let y = 0; y < size; y += weaveSpacing) {
    const offset = (y / weaveSpacing) % 2 === 0 ? 0 : weaveSpacing * 0.5;
    for (let x = 0; x < size; x += weaveSpacing) {
      ctx.fillRect(x + offset, y, 0.7, 1);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 0; x < size; x += weaveSpacing) {
    const offset = (x / weaveSpacing) % 2 === 0 ? 0 : weaveSpacing * 0.5;
    for (let y = 0; y < size; y += weaveSpacing) {
      ctx.fillRect(x, y + offset, 1, 0.7);
    }
  }

  ctx.lineWidth = 0.35;
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 180000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const horizontal = Math.random() > 0.5;
    const length = Math.random() * 0.6 + 0.25;
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(x - length / 2, y);
      ctx.lineTo(x + length / 2, y);
    } else {
      ctx.moveTo(x, y - length / 2);
      ctx.lineTo(x, y + length / 2);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  for (let i = 0; i < 120000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const horizontal = Math.random() > 0.5;
    const length = Math.random() * 0.5 + 0.15;
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(x - length / 2, y);
      ctx.lineTo(x + length / 2, y);
    } else {
      ctx.moveTo(x, y - length / 2);
      ctx.lineTo(x, y + length / 2);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i < 48000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const baseRepeat = 7.2;
  const repeatX = baseRepeat * (PLAY_W / TABLE.W);
  const repeatY = baseRepeat * (PLAY_H / TABLE.H);
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 48;
  if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
  else texture.encoding = THREE.sRGBEncoding;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function makeWoodTexture({
  base = '#2d1a0f',
  mid = '#4b2c16',
  highlight = '#7a4a24',
  repeatX = 3,
  repeatY = 1.5
} = {}) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const horizontal = ctx.createLinearGradient(0, 0, size, 0);
  horizontal.addColorStop(0, base);
  horizontal.addColorStop(0.5, mid);
  horizontal.addColorStop(1, base);
  ctx.fillStyle = horizontal;
  ctx.fillRect(0, 0, size, size);

  ctx.globalAlpha = 0.28;
  ctx.fillStyle = highlight;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;

  const tint = ctx.createLinearGradient(0, 0, 0, size);
  tint.addColorStop(0, 'rgba(255,255,255,0.08)');
  tint.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);

  ctx.lineWidth = size / 320;
  for (let y = 0; y < size; y += size / 64) {
    const wave = Math.sin(y * 0.045) * size * 0.012;
    const secondary = Math.cos(y * 0.11) * size * 0.008;
    ctx.strokeStyle = 'rgba(145, 95, 52, 0.28)';
    ctx.beginPath();
    ctx.moveTo(-wave, y + secondary);
    ctx.bezierCurveTo(
      size * 0.3,
      y + wave,
      size * 0.7,
      y - wave,
      size + wave,
      y + secondary
    );
    ctx.stroke();

    ctx.strokeStyle = 'rgba(35, 20, 10, 0.22)';
    ctx.beginPath();
    ctx.moveTo(-wave * 0.5, y + size / 128 + secondary * 0.5);
    ctx.bezierCurveTo(
      size * 0.3,
      y + wave * 0.5,
      size * 0.7,
      y - wave * 0.5,
      size + wave * 0.5,
      y + size / 128 + secondary * 0.5
    );
    ctx.stroke();
  }

  const pseudoRandom = (seed) => {
    const x = Math.sin(seed) * 43758.5453;
    return x - Math.floor(x);
  };

  for (let i = 0; i < 16; i++) {
    const cx = pseudoRandom(i * 12.9898) * size;
    const cy = pseudoRandom(i * 78.233) * size;
    const r = size * (0.015 + pseudoRandom(i * 3.7) * 0.035);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(70, 40, 20, 0.55)');
    grad.addColorStop(0.65, 'rgba(70, 40, 20, 0.26)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
  else texture.encoding = THREE.sRGBEncoding;
  texture.needsUpdate = true;
  return texture;
}
function reflectRails(ball) {
  const limX = RAIL_LIMIT_X;
  const limY = RAIL_LIMIT_Y;
  const rad = THREE.MathUtils.degToRad(CUSHION_CUT_ANGLE);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const pocketGuard = POCKET_VIS_R * 0.85;
  const cornerDepthLimit = POCKET_VIS_R * 1.45;
  for (const { sx, sy } of CORNER_SIGNS) {
    TMP_VEC2_C.set(sx * limX, sy * limY);
    TMP_VEC2_B.set(-sx * cos, -sy * sin);
    TMP_VEC2_A.copy(ball.pos).sub(TMP_VEC2_C);
    const distNormal = TMP_VEC2_A.dot(TMP_VEC2_B);
    if (distNormal >= BALL_R) continue;
    TMP_VEC2_D.set(-TMP_VEC2_B.y, TMP_VEC2_B.x);
    const lateral = Math.abs(TMP_VEC2_A.dot(TMP_VEC2_D));
    if (lateral < pocketGuard) continue;
    if (distNormal < -cornerDepthLimit) continue;
    const push = BALL_R - distNormal;
    ball.pos.addScaledVector(TMP_VEC2_B, push);
    const vn = ball.vel.dot(TMP_VEC2_B);
    if (vn < 0) {
      ball.vel.addScaledVector(TMP_VEC2_B, -2 * vn);
    }
    ball.vel.multiplyScalar(0.2);
    if (ball.spin?.lengthSq() > 0) {
      applySpinImpulse(ball, 0.6);
    }
    const stamp =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    ball.lastRailHitAt = stamp;
    ball.lastRailHitType = 'corner';
    return 'corner';
  }

  // If the ball is entering a pocket capture zone, skip straight rail reflections
  const nearPocket = pocketCenters().some(
    (c) => ball.pos.distanceTo(c) < POCKET_VIS_R + BALL_R * 0.5
  );
  if (nearPocket) return null;
  let collided = null;
  if (ball.pos.x < -limX && ball.vel.x < 0) {
    const overshoot = -limX - ball.pos.x;
    ball.pos.x = -limX + overshoot;
    ball.vel.x = Math.abs(ball.vel.x) * CUSHION_RESTITUTION;
    collided = 'rail';
  }
  if (ball.pos.x > limX && ball.vel.x > 0) {
    const overshoot = ball.pos.x - limX;
    ball.pos.x = limX - overshoot;
    ball.vel.x = -Math.abs(ball.vel.x) * CUSHION_RESTITUTION;
    collided = 'rail';
  }
  if (ball.pos.y < -limY && ball.vel.y < 0) {
    const overshoot = -limY - ball.pos.y;
    ball.pos.y = -limY + overshoot;
    ball.vel.y = Math.abs(ball.vel.y) * CUSHION_RESTITUTION;
    collided = 'rail';
  }
  if (ball.pos.y > limY && ball.vel.y > 0) {
    const overshoot = ball.pos.y - limY;
    ball.pos.y = limY - overshoot;
    ball.vel.y = -Math.abs(ball.vel.y) * CUSHION_RESTITUTION;
    collided = 'rail';
  }
  if (collided) {
    const stamp =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    ball.lastRailHitAt = stamp;
    ball.lastRailHitType = collided;
  }
  return collided;
}

function applySpinImpulse(ball, scale = 1) {
  if (!ball?.spin) return false;
  if (ball.spin.lengthSq() < 1e-6) return false;
  TMP_SPIN.copy(ball.spin).multiplyScalar(SPIN_STRENGTH * scale);
  ball.vel.add(TMP_SPIN);
  if (ball.id === 'cue' && ball.spinMode === 'swerve') {
    ball.spinMode = 'standard';
  }
  const decayFactor = Math.pow(SPIN_DECAY, Math.max(scale, 0.5));
  ball.spin.multiplyScalar(decayFactor);
  if (ball.spin.lengthSq() < 1e-6) {
    ball.spin.set(0, 0);
    if (ball.pendingSpin) ball.pendingSpin.set(0, 0);
  }
  return true;
}

// calculate impact point and post-collision direction for aiming guide
function calcTarget(cue, dir, balls) {
  const cuePos = cue.pos.clone();
  let tHit = Infinity;
  let targetBall = null;
  let railNormal = null;

  const limX = RAIL_LIMIT_X;
  const limY = RAIL_LIMIT_Y;
  const checkRail = (t, normal) => {
    if (t >= 0 && t < tHit) {
      tHit = t;
      railNormal = normal;
      targetBall = null;
    }
  };
  if (dir.x < 0) checkRail((-limX - cuePos.x) / dir.x, new THREE.Vector2(1, 0));
  if (dir.x > 0) checkRail((limX - cuePos.x) / dir.x, new THREE.Vector2(-1, 0));
  if (dir.y < 0) checkRail((-limY - cuePos.y) / dir.y, new THREE.Vector2(0, 1));
  if (dir.y > 0) checkRail((limY - cuePos.y) / dir.y, new THREE.Vector2(0, -1));

  const diam = BALL_R * 2;
  const diam2 = diam * diam;
  balls.forEach((b) => {
    if (!b.active || b === cue) return;
    const v = b.pos.clone().sub(cuePos);
    const proj = v.dot(dir);
    if (proj <= 0) return;
    const perp2 = v.lengthSq() - proj * proj;
    if (perp2 > diam2) return;
    const thc = Math.sqrt(diam2 - perp2);
    const t = proj - thc;
    if (t >= 0 && t < tHit) {
      tHit = t;
      targetBall = b;
      railNormal = null;
    }
  });

  const impact = cuePos.clone().add(dir.clone().multiplyScalar(tHit));
  let afterDir = null;
  if (targetBall) {
    afterDir = targetBall.pos.clone().sub(impact).normalize();
  } else if (railNormal) {
    const n = railNormal.clone().normalize();
    afterDir = dir
      .clone()
      .sub(n.clone().multiplyScalar(2 * dir.dot(n)))
      .normalize();
  }
  return { impact, afterDir, targetBall, railNormal, tHit };
}

// --------------------------------------------------
// ONLY kept component: Guret (balls factory)
// --------------------------------------------------
function Guret(parent, id, color, x, y) {
  if (!BALL_MATERIAL_CACHE.has(color)) {
    BALL_MATERIAL_CACHE.set(
      color,
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.12
      })
    );
  }
  const material = BALL_MATERIAL_CACHE.get(color);
  const mesh = new THREE.Mesh(BALL_GEOMETRY, material);
  mesh.position.set(x, BALL_CENTER_Y, y);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (id === 'cue') {
    const markerGeom = new THREE.CircleGeometry(CUE_MARKER_RADIUS, 48);
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0xff2f2f,
      emissive: 0x550000,
      roughness: 0.28,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    markerMat.depthWrite = false;
    markerMat.needsUpdate = true;
    const markerOffset = BALL_R - CUE_MARKER_DEPTH * 0.5;
    const localForward = new THREE.Vector3(0, 0, 1);
    [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ].forEach((normal) => {
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.position.copy(normal).multiplyScalar(markerOffset);
      marker.quaternion.setFromUnitVectors(localForward, normal);
      marker.castShadow = false;
      marker.receiveShadow = false;
      marker.renderOrder = 2;
      mesh.add(marker);
    });
  }
  mesh.traverse((node) => {
    node.userData = node.userData || {};
    node.userData.ballId = id;
  });
  parent.add(mesh);
  return {
    id,
    color,
    mesh,
    pos: new THREE.Vector2(x, y),
    vel: new THREE.Vector2(),
    spin: new THREE.Vector2(),
    spinMode: 'standard',
    impacted: false,
    launchDir: null,
    pendingSpin: new THREE.Vector2(),
    active: true
  };
}

const toBallColorId = (id) => {
  if (!id) return null;
  if (id === 'cue' || id === 'CUE') return 'CUE';
  if (typeof id === 'string' && id.toLowerCase().startsWith('red')) return 'RED';
  return typeof id === 'string' ? id.toUpperCase() : null;
};

function alignRailsToCushions(table, frame) {
  if (!frame || !table?.userData?.cushions?.length) return;
  table.updateMatrixWorld(true);
  const sampleCushion = table.userData.cushions[0];
  if (!sampleCushion) return;
  const cushionBox = new THREE.Box3().setFromObject(sampleCushion);
  const frameBox = new THREE.Box3().setFromObject(frame);
  const diff = frameBox.max.y - cushionBox.max.y;
  const tolerance = 1e-3;
  if (Math.abs(diff) > tolerance) {
    frame.position.y -= diff;
  }
}

function updateRailLimitsFromTable(table) {
  if (!table?.userData?.cushions?.length) return;
  table.updateMatrixWorld(true);
  let minAbsX = Infinity;
  let minAbsZ = Infinity;
  for (const cushion of table.userData.cushions) {
    const data = cushion.userData || {};
    if (typeof data.horizontal !== 'boolean' || !data.side) continue;
    const box = new THREE.Box3().setFromObject(cushion);
    if (data.horizontal) {
      const inner = data.side < 0 ? box.max.z : box.min.z;
      minAbsZ = Math.min(minAbsZ, Math.abs(inner));
    } else {
      const inner = data.side < 0 ? box.max.x : box.min.x;
      minAbsX = Math.min(minAbsX, Math.abs(inner));
    }
  }
  if (minAbsX !== Infinity) {
    const computedX = Math.max(0, minAbsX - BALL_R - RAIL_LIMIT_PADDING);
    if (computedX > 0) {
      RAIL_LIMIT_X = Math.min(DEFAULT_RAIL_LIMIT_X, computedX);
    }
  }
  if (minAbsZ !== Infinity) {
    const computedZ = Math.max(0, minAbsZ - BALL_R - RAIL_LIMIT_PADDING);
    if (computedZ > 0) {
      RAIL_LIMIT_Y = Math.min(DEFAULT_RAIL_LIMIT_Y, computedZ);
    }
  }
}

// --------------------------------------------------
// Table with CUT pockets + markings (fresh)
// --------------------------------------------------

function Table3D(parent) {
  const table = new THREE.Group();
  table.userData = table.userData || {};
  table.userData.cushions = [];

  const halfW = PLAY_W / 2;
  const halfH = PLAY_H / 2;
  const baulkLineZ = -PLAY_H / 4;
  const frameTopY = FRAME_TOP_Y;
  const clothPlaneLocal = CLOTH_TOP_LOCAL + CLOTH_LIFT;

  const { map: clothMap, bump: clothBump } = createClothTextures();
  const clothPrimary = new THREE.Color(COLORS.cloth);
  const clothMat = new THREE.MeshPhysicalMaterial({
    color: clothPrimary,
    roughness: 0.8,
    sheen: 0.85,
    sheenRoughness: 0.46,
    clearcoat: 0.05,
    clearcoatRoughness: 0.26,
    emissive: clothPrimary.clone().multiplyScalar(0.07),
    emissiveIntensity: 0.65
  });
  const ballDiameter = BALL_R * 2;
  const ballsAcrossWidth = PLAY_W / ballDiameter;
  const threadsPerBallTarget = 10; // tighten the weave slightly while keeping detail visible
  const clothTextureScale = 0.032; // keep the weave legible after increasing texture resolution
  const baseRepeat =
    ((threadsPerBallTarget * ballsAcrossWidth) / CLOTH_THREADS_PER_TILE) *
    clothTextureScale;
  const repeatRatio = 3.25;
  const baseBumpScale = 0.52;
  if (clothMap) {
    clothMat.map = clothMap;
    clothMat.map.repeat.set(baseRepeat, baseRepeat * repeatRatio);
    clothMat.map.needsUpdate = true;
  }
  if (clothBump) {
    clothMat.bumpMap = clothBump;
    clothMat.bumpMap.repeat.set(baseRepeat, baseRepeat * repeatRatio);
    clothMat.bumpScale = baseBumpScale;
    clothMat.bumpMap.needsUpdate = true;
  } else {
    clothMat.bumpScale = baseBumpScale;
  }
  clothMat.userData = {
    ...(clothMat.userData || {}),
    baseRepeat,
    repeatRatio,
    nearRepeat: baseRepeat * 1.12,
    farRepeat: baseRepeat * 0.48,
    bumpScale: clothMat.bumpScale
  };

  const cushionMat = clothMat.clone();
  const { map: woodMap, roughness: woodRoughness } = createWoodTexture();
  const woodMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.base,
    metalness: 0.28,
    roughness: 0.38,
    clearcoat: 0.35,
    clearcoatRoughness: 0.18,
    sheen: 0.1,
    sheenRoughness: 0.55,
    reflectivity: 0.45,
    envMapIntensity: 0.9
  });
  if (woodMap) {
    woodMat.map = woodMap;
    woodMat.map.repeat.set(2.6, 1.6);
    woodMat.map.needsUpdate = true;
  }
  if (woodRoughness) {
    woodMat.roughnessMap = woodRoughness;
    woodMat.roughnessMap.repeat.set(2.6, 1.6);
    woodMat.roughnessMap.needsUpdate = true;
  }
  woodMat.needsUpdate = true;
  const railWoodMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.rail,
    metalness: 0.32,
    roughness: 0.42,
    clearcoat: 0.32,
    clearcoatRoughness: 0.2,
    sheen: 0.12,
    sheenRoughness: 0.6,
    reflectivity: 0.48,
    envMapIntensity: 1.0
  });
  if (woodMap) {
    railWoodMat.map = woodMap;
    railWoodMat.map.repeat.set(2.6, 1.6);
    railWoodMat.map.needsUpdate = true;
  }
  if (woodRoughness) {
    railWoodMat.roughnessMap = woodRoughness;
    railWoodMat.roughnessMap.repeat.set(2.6, 1.6);
    railWoodMat.roughnessMap.needsUpdate = true;
  }

  const clothExtendBase = Math.max(
    SIDE_RAIL_INNER_THICKNESS * 0.34,
    Math.min(PLAY_W, PLAY_H) * 0.009
  );
  const clothExtend =
    clothExtendBase +
    Math.min(PLAY_W, PLAY_H) * 0.0032; // extend the cloth slightly more so rails meet the cloth with no gaps
  const clothShape = new THREE.Shape();
  const halfWext = halfW + clothExtend;
  const halfHext = halfH + clothExtend;
  clothShape.moveTo(-halfWext, -halfHext);
  clothShape.lineTo(halfWext, -halfHext);
  clothShape.lineTo(halfWext, halfHext);
  clothShape.lineTo(-halfWext, halfHext);
  clothShape.lineTo(-halfWext, -halfHext);
  const clothHoleRadius = POCKET_HOLE_R;
  pocketCenters().forEach((p) => {
    const hole = new THREE.Path();
    hole.absellipse(p.x, p.y, clothHoleRadius, clothHoleRadius, 0, Math.PI * 2);
    clothShape.holes.push(hole);
  });
  const clothGeo = new THREE.ExtrudeGeometry(clothShape, {
    depth: CLOTH_THICKNESS,
    bevelEnabled: false,
    curveSegments: 64,
    steps: 1
  });
  clothGeo.translate(0, 0, -CLOTH_THICKNESS);
  const cloth = new THREE.Mesh(clothGeo, clothMat);
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.y = clothPlaneLocal - CLOTH_DROP;
  cloth.renderOrder = 3;
  cloth.receiveShadow = true;
  table.add(cloth);

  const markingsGroup = new THREE.Group();
  const markingMat = new THREE.MeshBasicMaterial({
    color: COLORS.markings,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });
  const markingHeight = clothPlaneLocal - CLOTH_DROP + MICRO_EPS * 2;
  const lineThickness = Math.max(BALL_R * 0.08, 0.1);
  const baulkLineLength = PLAY_W - SIDE_RAIL_INNER_THICKNESS * 0.4;
  const baulkLineGeom = new THREE.PlaneGeometry(baulkLineLength, lineThickness);
  const baulkLine = new THREE.Mesh(baulkLineGeom, markingMat);
  baulkLine.rotation.x = -Math.PI / 2;
  baulkLine.position.set(0, markingHeight, baulkLineZ);
  markingsGroup.add(baulkLine);

  const dRadius = PLAY_W * 0.164;
  const dThickness = Math.max(lineThickness * 0.75, BALL_R * 0.07);
  const dGeom = new THREE.RingGeometry(
    Math.max(0.001, dRadius - dThickness),
    dRadius,
    64,
    1,
    0,
    Math.PI
  );
  const dArc = new THREE.Mesh(dGeom, markingMat.clone());
  dArc.rotation.x = -Math.PI / 2;
  dArc.position.set(0, markingHeight, baulkLineZ);
  markingsGroup.add(dArc);

  const spotRadius = BALL_R * 0.26;
  const addSpot = (x, z) => {
    const spotGeo = new THREE.CircleGeometry(spotRadius, 32);
    const spot = new THREE.Mesh(spotGeo, markingMat.clone());
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(x, markingHeight, z);
    markingsGroup.add(spot);
  };
  addSpot(-PLAY_W * 0.25, baulkLineZ);
  addSpot(0, baulkLineZ);
  addSpot(PLAY_W * 0.25, baulkLineZ);
  addSpot(0, 0);
  addSpot(0, PLAY_H * 0.25);
  addSpot(0, PLAY_H * 0.5 - POCKET_VIS_R * 1.3);
  markingsGroup.traverse((child) => {
    if (child.isMesh) {
      child.renderOrder = cloth.renderOrder + 1;
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
  table.add(markingsGroup);

  const POCKET_TOP_R = POCKET_VIS_R * 0.96;
  const POCKET_BOTTOM_R = POCKET_TOP_R * 0.7;
  const pocketSurfaceOffset = TABLE.THICK * 0.06;
  const pocketGeo = new THREE.CylinderGeometry(
    POCKET_TOP_R,
    POCKET_BOTTOM_R,
    TABLE.THICK,
    48
  );
  const pocketMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    metalness: 0.45,
    roughness: 0.6
  });
  const pocketMeshes = [];
  pocketCenters().forEach((p) => {
    const pocket = new THREE.Mesh(pocketGeo, pocketMat);
    pocket.position.set(
      p.x,
      clothPlaneLocal - TABLE.THICK / 2 - pocketSurfaceOffset,
      p.y
    );
    pocket.receiveShadow = true;
    table.add(pocket);
    pocketMeshes.push(pocket);
  });

  const railH = RAIL_HEIGHT;
  const railsTopY = frameTopY + railH;
  const longRailW = ORIGINAL_RAIL_WIDTH; // keep the long rail caps as wide as the end rails so side pockets match visually
  const endRailW = ORIGINAL_RAIL_WIDTH;
  const frameExpansion = TABLE.WALL * 0.08;
  const frameWidthLong =
    Math.max(0, ORIGINAL_OUTER_HALF_W - halfW - 2 * longRailW) + frameExpansion;
  const frameWidthEnd =
    Math.max(0, ORIGINAL_OUTER_HALF_H - halfH - 2 * endRailW) + frameExpansion;
  const outerHalfW = halfW + 2 * longRailW + frameWidthLong;
  const outerHalfH = halfH + 2 * endRailW + frameWidthEnd;
  const railsGroup = new THREE.Group();
  const outerCornerRadius = Math.min(
    Math.min(longRailW, endRailW) * 1.6,
    Math.min(outerHalfW, outerHalfH) * 0.2
  );

  const innerHalfW = halfWext;
  const innerHalfH = halfHext;
  const cornerPocketRadius = POCKET_VIS_R * 1.08;
  const cornerChamfer = POCKET_VIS_R * 0.42;
  const cornerInset = POCKET_VIS_R * 0.5;
  const sidePocketRadius = POCKET_VIS_R * 0.92;
  const sideInset = POCKET_VIS_R * 0.42;

  const circlePoly = (cx, cz, r, seg = 96) => {
    const pts = [];
    for (let i = 0; i < seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      pts.push([cx + Math.cos(t) * r, cz + Math.sin(t) * r]);
    }
    pts.push(pts[0]);
    return [[pts]];
  };
  const rectPoly = (w, h) => [[[
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
    [-w / 2, -h / 2]
  ]]];
  const boxPoly = (minx, minz, maxx, maxz) => [[[
    [minx, minz],
    [maxx, minz],
    [maxx, maxz],
    [minx, maxz],
    [minx, minz]
  ]]];
  const ringArea = (ring) => {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, z1] = ring[i];
      const [x2, z2] = ring[i + 1];
      area += x1 * z2 - x2 * z1;
    }
    return area * 0.5;
  };

  const cornerNotchMP = (sx, sz) => {
    const cx = sx * (innerHalfW - cornerInset);
    const cz = sz * (innerHalfH - cornerInset);
    const notchCircle = circlePoly(cx, cz, cornerPocketRadius);
    const x1 = cx;
    const x2 = cx + sx * cornerChamfer;
    const z1 = cz - sz * cornerChamfer;
    const z2 = cz + sz * cornerChamfer;
    const boxX = boxPoly(Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2));
    const x3 = cx - sx * cornerChamfer;
    const x4 = cx + sx * cornerChamfer;
    const z3 = cz;
    const z4 = cz + sz * cornerChamfer;
    const boxZ = boxPoly(Math.min(x3, x4), Math.min(z3, z4), Math.max(x3, x4), Math.max(z3, z4));
    return polygonClipping.union(notchCircle, boxX, boxZ);
  };

  let openingMP = polygonClipping.union(
    rectPoly(innerHalfW * 2, innerHalfH * 2),
    ...circlePoly(-(innerHalfW - sideInset), 0, sidePocketRadius),
    ...circlePoly(innerHalfW - sideInset, 0, sidePocketRadius)
  );
  openingMP = polygonClipping.union(
    openingMP,
    ...cornerNotchMP(1, 1),
    ...cornerNotchMP(-1, 1),
    ...cornerNotchMP(-1, -1),
    ...cornerNotchMP(1, -1)
  );

  const railsOuter = new THREE.Shape();
  railsOuter.moveTo(-outerHalfW + outerCornerRadius, -outerHalfH);
  railsOuter.lineTo(outerHalfW - outerCornerRadius, -outerHalfH);
  railsOuter.absarc(
    outerHalfW - outerCornerRadius,
    -outerHalfH + outerCornerRadius,
    outerCornerRadius,
    -Math.PI / 2,
    0,
    false
  );
  railsOuter.lineTo(outerHalfW, outerHalfH - outerCornerRadius);
  railsOuter.absarc(
    outerHalfW - outerCornerRadius,
    outerHalfH - outerCornerRadius,
    outerCornerRadius,
    0,
    Math.PI / 2,
    false
  );
  railsOuter.lineTo(-outerHalfW + outerCornerRadius, outerHalfH);
  railsOuter.absarc(
    -outerHalfW + outerCornerRadius,
    outerHalfH - outerCornerRadius,
    outerCornerRadius,
    Math.PI / 2,
    Math.PI,
    false
  );
  railsOuter.lineTo(-outerHalfW, -outerHalfH + outerCornerRadius);
  railsOuter.absarc(
    -outerHalfW + outerCornerRadius,
    -outerHalfH + outerCornerRadius,
    outerCornerRadius,
    Math.PI,
    1.5 * Math.PI,
    false
  );

  openingMP.forEach((poly) => {
    if (!poly?.length) return;
    const ring = poly[0];
    if (!ring?.length) return;
    const pts = ring.slice(0, -1);
    if (!pts.length) return;
    const clockwise = ringArea(ring) < 0;
    const ordered = clockwise ? pts : pts.slice().reverse();
    const hole = new THREE.Path();
    hole.moveTo(ordered[0][0], ordered[0][1]);
    for (let i = 1; i < ordered.length; i++) {
      hole.lineTo(ordered[i][0], ordered[i][1]);
    }
    hole.closePath();
    railsOuter.holes.push(hole);
  });

  const railsGeom = new THREE.ExtrudeGeometry(railsOuter, {
    depth: railH,
    bevelEnabled: false,
    curveSegments: 96
  });
  const railsMesh = new THREE.Mesh(railsGeom, railWoodMat);
  railsMesh.rotation.x = -Math.PI / 2;
  railsMesh.position.y = frameTopY;
  railsMesh.castShadow = true;
  railsMesh.receiveShadow = true;
  railsGroup.add(railsMesh);

  const rimMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x050505,
    roughness: 0.38,
    metalness: 0.12,
    clearcoat: 0.4,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.9
  });
  const rimTubeR = POCKET_VIS_R * 0.18;
  const rimVerticalScale = 1.6;
  const rimTopY = railsTopY + MICRO_EPS * 1.5;
  const rimY = rimTopY - rimTubeR;

  class ArcXZ extends THREE.Curve {
    constructor(cx, cz, r, a0, a1) {
      super();
      this.cx = cx;
      this.cz = cz;
      this.r = r;
      this.a0 = a0;
      this.a1 = a1;
    }
    getPoint(t) {
      const angle = this.a0 + (this.a1 - this.a0) * t;
      return new THREE.Vector3(
        this.cx + Math.cos(angle) * this.r,
        rimY,
        this.cz + Math.sin(angle) * this.r
      );
    }
  }

  const addRimArc = (cx, cz, r, a0, a1) => {
    if (!isFinite(a0) || !isFinite(a1) || a0 === a1) return;
    const path = new ArcXZ(cx, cz, r, a0, a1);
    const geom = new THREE.TubeGeometry(path, 64, rimTubeR, 24, false);
    const posAttr = geom.attributes.position;
    if (posAttr) {
      for (let i = 0; i < posAttr.count; i++) {
        const originalY = posAttr.getY(i);
        const offsetFromTop = rimTopY - originalY;
        posAttr.setY(i, rimTopY - offsetFromTop * rimVerticalScale);
      }
      posAttr.needsUpdate = true;
      geom.computeVertexNormals();
    }
    const mesh = new THREE.Mesh(geom, rimMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    railsGroup.add(mesh);
  };

  const wrapAngle = (a) => {
    const twoPi = Math.PI * 2;
    let out = a % twoPi;
    if (out < 0) out += twoPi;
    return out;
  };
  const adjustArc = (start, end) => {
    const twoPi = Math.PI * 2;
    let a0 = wrapAngle(start);
    let a1 = wrapAngle(end);
    if (end - start >= twoPi) {
      a1 = a0 + twoPi;
    } else if (a1 <= a0) {
      a1 += twoPi;
    }
    return { a0, a1 };
  };

  const cornerGap = Math.atan2(cornerChamfer, cornerPocketRadius);
  const cornerExtend = Math.PI * 0.08;
  const cornerAngles = [
    { sx: 1, sz: 1, start: 0, end: Math.PI / 2 },
    { sx: -1, sz: 1, start: Math.PI / 2, end: Math.PI },
    { sx: -1, sz: -1, start: Math.PI, end: 1.5 * Math.PI },
    { sx: 1, sz: -1, start: 1.5 * Math.PI, end: Math.PI * 2 }
  ];
  cornerAngles.forEach(({ sx, sz, start, end }) => {
    const cx = sx * (innerHalfW - cornerInset);
    const cz = sz * (innerHalfH - cornerInset);
    const { a0, a1 } = adjustArc(
      start + cornerGap - cornerExtend,
      end - cornerGap + cornerExtend
    );
    const rimPathRadius = Math.max(MICRO_EPS, cornerPocketRadius - rimTubeR);
    addRimArc(cx, cz, rimPathRadius, a0, a1);
  });

  const sideGap = Math.atan2(sideInset * 0.5, sidePocketRadius);
  const sideAngles = [
    { sx: -1, start: Math.PI / 2, end: 1.5 * Math.PI },
    { sx: 1, start: -Math.PI / 2, end: Math.PI / 2 }
  ];
  sideAngles.forEach(({ sx, start, end }) => {
    const cx = sx * (innerHalfW - sideInset);
    const cz = 0;
    const { a0, a1 } = adjustArc(start + sideGap, end - sideGap);
    const rimPathRadius = Math.max(MICRO_EPS, sidePocketRadius - rimTubeR);
    addRimArc(cx, cz, rimPathRadius, a0, a1);
  });

  table.add(railsGroup);

  const FACE_SHRINK_LONG = 0.955;
  const FACE_SHRINK_SHORT = FACE_SHRINK_LONG;
  const NOSE_REDUCTION = 0.75;
  const CUSHION_UNDERCUT_BASE_LIFT = 0.32;
  const CUSHION_UNDERCUT_FRONT_REMOVAL = 0.54;
  const cushionRaiseY = CLOTH_TOP_LOCAL - MICRO_EPS;

  function cushionProfileAdvanced(len, horizontal) {
    const halfLen = len / 2;
    const thicknessScale = horizontal ? FACE_SHRINK_LONG : FACE_SHRINK_SHORT;
    const baseRailWidth = horizontal ? longRailW : endRailW;
    const baseThickness = baseRailWidth * thicknessScale;
    const backY = baseRailWidth / 2;
    const noseThickness = baseThickness * NOSE_REDUCTION;
    const frontY = backY - noseThickness;
    const rad = THREE.MathUtils.degToRad(CUSHION_CUT_ANGLE);
    const straightCut = Math.max(baseThickness * 0.25, noseThickness / Math.tan(rad));

    const shape = new THREE.Shape();
    shape.moveTo(-halfLen, backY);
    shape.lineTo(halfLen, backY);
    shape.lineTo(halfLen - straightCut, frontY);
    shape.lineTo(-halfLen + straightCut, frontY);
    shape.lineTo(-halfLen, backY);

    const cushionBevel = Math.min(railH, baseThickness) * 0.12;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: railH,
      bevelEnabled: true,
      bevelThickness: cushionBevel * 0.6,
      bevelSize: cushionBevel,
      bevelSegments: 2,
      curveSegments: 8
    });

    const pos = geo.attributes.position;
    const arr = pos.array;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < arr.length; i += 3) {
      const z = arr[i + 2];
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const depth = maxZ - minZ;
    const frontSpan = backY - frontY;
    for (let i = 0; i < arr.length; i += 3) {
      const y = arr[i + 1];
      const z = arr[i + 2];
      const frontFactor = THREE.MathUtils.clamp((backY - y) / frontSpan, 0, 1);
      if (frontFactor <= 0) continue;
      const taperedLift = CUSHION_UNDERCUT_FRONT_REMOVAL * frontFactor;
      const lift = Math.min(CUSHION_UNDERCUT_BASE_LIFT + taperedLift, 0.94);
      const minAllowedZ = minZ + depth * lift;
      if (z < minAllowedZ) arr[i + 2] = minAllowedZ;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  function addCushion(x, z, len, horizontal, flip = false) {
    const geo = cushionProfileAdvanced(len, horizontal);
    const mesh = new THREE.Mesh(geo, cushionMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 2;
    const group = new THREE.Group();
    group.add(mesh);
    group.position.set(x, cushionRaiseY, z);
    if (!horizontal) group.rotation.y = Math.PI / 2;
    if (flip) group.rotation.y += Math.PI;

    const EDGE_BIAS = MICRO_EPS;
    if (horizontal) {
      group.position.z = z > 0 ? halfH + EDGE_BIAS : -halfH - EDGE_BIAS;
    } else {
      group.position.x = x > 0 ? halfW + EDGE_BIAS : -halfW - EDGE_BIAS;
    }

    group.userData = group.userData || {};
    group.userData.horizontal = horizontal;
    group.userData.side = horizontal ? (z >= 0 ? 1 : -1) : x >= 0 ? 1 : -1;
    table.add(group);
    table.userData.cushions.push(group);
  }

  const POCKET_GAP = POCKET_VIS_R * 0.92; // shorten cushions so they finish where the frame arcs begin
  const LONG_CUSHION_TRIM = POCKET_VIS_R * 0.75; // trim the straight rails to line up with the start of the chrome arc
  const SIDE_CUSHION_POCKET_CLEARANCE = POCKET_VIS_R * 0.08; // extend side cushions until they meet the pocket arcs
  const horizLen = PLAY_W - 2 * POCKET_GAP - LONG_CUSHION_TRIM;
  const vertSeg =
    PLAY_H / 2 - 2 * (POCKET_GAP + SIDE_CUSHION_POCKET_CLEARANCE);
  const bottomZ = -halfH;
  const topZ = halfH;
  const leftX = -halfW;
  const rightX = halfW;

  addCushion(0, bottomZ, horizLen, true, false);
  addCushion(0, topZ, horizLen, true, true);
  const sideCushionOffset = POCKET_GAP + SIDE_CUSHION_POCKET_CLEARANCE;

  addCushion(
    leftX,
    -halfH + sideCushionOffset + vertSeg / 2,
    vertSeg,
    false,
    false
  );
  addCushion(
    leftX,
    halfH - sideCushionOffset - vertSeg / 2,
    vertSeg,
    false,
    false
  );
  addCushion(
    rightX,
    -halfH + sideCushionOffset + vertSeg / 2,
    vertSeg,
    false,
    true
  );
  addCushion(
    rightX,
    halfH - sideCushionOffset - vertSeg / 2,
    vertSeg,
    false,
    true
  );

  const frameOuterX = outerHalfW;
  const frameOuterZ = outerHalfH;
  const skirtH = TABLE_H * 0.68 * SKIRT_DROP_MULTIPLIER;
  const baseRailWidth = endRailW;
  const baseOverhang = baseRailWidth * SKIRT_SIDE_OVERHANG;
  const skirtShape = new THREE.Shape();
  const outW = frameOuterX + baseOverhang;
  const outZ = frameOuterZ + baseOverhang;
  skirtShape.moveTo(-outW, -outZ);
  skirtShape.lineTo(outW, -outZ);
  skirtShape.lineTo(outW, outZ);
  skirtShape.lineTo(-outW, outZ);
  skirtShape.lineTo(-outW, -outZ);
  const inner = new THREE.Path();
  inner.moveTo(-frameOuterX, -frameOuterZ);
  inner.lineTo(frameOuterX, -frameOuterZ);
  inner.lineTo(frameOuterX, frameOuterZ);
  inner.lineTo(-frameOuterX, frameOuterZ);
  inner.lineTo(-frameOuterX, -frameOuterZ);
  skirtShape.holes.push(inner);
  const skirtGeo = new THREE.ExtrudeGeometry(skirtShape, {
    depth: skirtH,
    bevelEnabled: false
  });
  const skirt = new THREE.Mesh(skirtGeo, woodMat);
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = frameTopY - skirtH + SKIRT_RAIL_GAP_FILL + MICRO_EPS * 0.5;
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  table.add(skirt);

  const legR = Math.min(TABLE.W, TABLE.H) * 0.055 * LEG_RADIUS_SCALE;
  const legTopLocal = frameTopY - TABLE.THICK;
  const legTopWorld = legTopLocal + TABLE_Y;
  const legBottomWorld = FLOOR_Y;
  const legReach = Math.max(legTopWorld - legBottomWorld, TABLE_H);
  const legH = legReach + LEG_TOP_OVERLAP;
  const legGeo = new THREE.CylinderGeometry(legR, legR, legH, 64);
  const legInset = baseRailWidth * 2.2;
  const legPositions = [
    [-frameOuterX + legInset, -frameOuterZ + legInset],
    [frameOuterX - legInset, -frameOuterZ + legInset],
    [-frameOuterX + legInset, 0],
    [frameOuterX - legInset, 0],
    [-frameOuterX + legInset, frameOuterZ - legInset],
    [frameOuterX - legInset, frameOuterZ - legInset]
  ];
  const legY = legTopLocal + LEG_TOP_OVERLAP - legH / 2;
  legPositions.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(lx, legY, lz);
    leg.castShadow = true;
    leg.receiveShadow = true;
    table.add(leg);
  });

  table.updateMatrixWorld(true);
  let cushionTopLocal = frameTopY;
  if (table.userData.cushions.length) {
    const box = new THREE.Box3();
    table.userData.cushions.forEach((cushion) => {
      box.setFromObject(cushion);
      cushionTopLocal = Math.max(cushionTopLocal, box.max.y);
    });
  }
  const clothPlaneWorld = cloth.position.y;

  table.userData.pockets = [];
  pocketCenters().forEach((p) => {
    const marker = new THREE.Object3D();
    marker.position.set(p.x, clothPlaneWorld - POCKET_VIS_R, p.y);
    marker.userData.captureRadius = CAPTURE_R;
    table.add(marker);
    table.userData.pockets.push(marker);
  });

  pocketMeshes.forEach((mesh) => {
    mesh.position.y = clothPlaneLocal - TABLE.THICK / 2 - pocketSurfaceOffset;
  });

  alignRailsToCushions(table, railsGroup);
  table.updateMatrixWorld(true);
  updateRailLimitsFromTable(table);

  table.position.y = TABLE_Y;
  table.userData.cushionTopLocal = cushionTopLocal;
  table.userData.cushionTopWorld = cushionTopLocal + TABLE_Y;
  table.userData.cushionLipClearance = clothPlaneWorld;
  parent.add(table);

  const baulkZ = baulkLineZ;

  return {
    centers: pocketCenters(),
    baulkZ,
    group: table,
    clothMat,
    cushionMat
  };
}

// --------------------------------------------------
// NEW Engine (no globals). Camera feels like standing at the side.
// --------------------------------------------------
function SnookerGame() {
  const mountRef = useRef(null);
  const rafRef = useRef(null);
  const rules = useMemo(() => new UnitySnookerRules(), []);
  const [frameState, setFrameState] = useState(() =>
    rules.getInitialFrame('Player', 'AI')
  );
  const frameRef = useRef(frameState);
  useEffect(() => {
    frameRef.current = frameState;
  }, [frameState]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const loadingClearedRef = useRef(false);
  useEffect(() => {
    let raf = null;
    let active = true;
    if (!loading) {
      setLoadingProgress(100);
      return () => {};
    }
    const start = performance.now();
    const duration = 2200;
    const tick = (now) => {
      if (!active) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.min(95, Math.max(0, Math.round(eased * 95)));
      setLoadingProgress((prev) => (prev >= next ? prev : next));
      if (loading) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      active = false;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [loading]);
  const [hud, setHud] = useState({
    power: 0.65,
    A: 0,
    B: 0,
    turn: 0,
    phase: 'reds',
    next: 'red',
    inHand: false,
    over: false
  });
  const powerRef = useRef(hud.power);
  useEffect(() => {
    powerRef.current = hud.power;
  }, [hud.power]);
  const [err, setErr] = useState(null);
  const fireRef = useRef(() => {}); // set from effect so slider can trigger fire()
  const cameraRef = useRef(null);
  const sphRef = useRef(null);
  const initialOrbitRef = useRef(null);
  const aimFocusRef = useRef(null);
  const [pocketCameraActive, setPocketCameraActive] = useState(false);
  const pocketCameraStateRef = useRef(false);
  const pocketCamerasRef = useRef(new Map());
  const activeRenderCameraRef = useRef(null);
  const pocketSwitchIntentRef = useRef(null);
  const lastPocketBallRef = useRef(null);
  const cameraBlendRef = useRef(ACTION_CAMERA_START_BLEND);
  const initialCuePhi = THREE.MathUtils.clamp(
    CUE_VIEW_MIN_PHI + CUE_VIEW_PHI_LIFT * 0.5,
    CAMERA.minPhi,
    CAMERA.maxPhi
  );
  const initialCueRadius = Math.max(BREAK_VIEW.radius, CUE_VIEW_MIN_RADIUS);
  const cameraBoundsRef = useRef({
    cueShot: { phi: initialCuePhi, radius: initialCueRadius },
    standing: { phi: STANDING_VIEW.phi, radius: BREAK_VIEW.radius }
  });
  const rendererRef = useRef(null);
  const last3DRef = useRef({ phi: CAMERA.maxPhi, theta: Math.PI });
  const cushionHeightRef = useRef(TABLE.THICK + 0.4);
  const fitRef = useRef(() => {});
  const topViewRef = useRef(false);
  const [topView, setTopView] = useState(false);
  const aimDirRef = useRef(new THREE.Vector2(0, 1));
  const playerOffsetRef = useRef(0);
  const orbitFocusRef = useRef({
    target: new THREE.Vector3(0, TABLE_Y + 0.05, 0),
    ballId: null
  });
  const orbitRadiusLimitRef = useRef(null);
  const [timer, setTimer] = useState(60);
  const timerRef = useRef(null);
  const spinRef = useRef({ x: 0, y: 0 });
  const spinRequestRef = useRef({ x: 0, y: 0 });
  const resetSpinRef = useRef(() => {});
  const tipGroupRef = useRef(null);
  const cueBodyRef = useRef(null);
  const spinRangeRef = useRef({
    side: 0,
    forward: 0,
    offsetSide: 0,
    offsetVertical: 0
  });
  const spinLimitsRef = useRef({ ...DEFAULT_SPIN_LIMITS });
  const spinAppliedRef = useRef({ x: 0, y: 0, mode: 'standard', magnitude: 0 });
  const spinDotElRef = useRef(null);
  const spinLegalityRef = useRef({ blocked: false, reason: '' });
  const lastCameraTargetRef = useRef(new THREE.Vector3(0, TABLE_Y + 0.05, 0));
  const updateSpinDotPosition = useCallback((value, blocked) => {
    if (!value) value = { x: 0, y: 0 };
    const dot = spinDotElRef.current;
    if (!dot) return;
    const x = clamp(value.x ?? 0, -1, 1);
    const y = clamp(value.y ?? 0, -1, 1);
    const ranges = spinRangeRef.current || {};
    const maxSide = Math.max(ranges.offsetSide ?? MAX_SPIN_CONTACT_OFFSET, 1e-6);
    const maxVertical = Math.max(ranges.offsetVertical ?? MAX_SPIN_VERTICAL, 1e-6);
    const largest = Math.max(maxSide, maxVertical);
    const scaledX = (x * maxSide) / largest;
    const scaledY = (y * maxVertical) / largest;
    dot.style.left = `${50 + scaledX * 50}%`;
    dot.style.top = `${50 + scaledY * 50}%`;
    const magnitude = Math.hypot(x, y);
    const showBlocked = blocked ?? spinLegalityRef.current?.blocked;
    dot.style.backgroundColor = showBlocked
      ? '#9ca3af'
      : magnitude >= SWERVE_THRESHOLD
        ? '#facc15'
        : '#dc2626';
    dot.dataset.blocked = showBlocked ? '1' : '0';
  }, []);
  const cueRef = useRef(null);
  const ballsRef = useRef([]);
  const pocketDropRef = useRef(new Map());
  const [player, setPlayer] = useState({ name: '', avatar: '' });
  const panelsRef = useRef(null);
  const { mapDelta } = useAimCalibration();
  useEffect(() => {
    document.title = '3D Snooker';
  }, []);
  useEffect(() => {
    setPlayer({
      name: getTelegramUsername() || 'Player',
      avatar: getTelegramPhotoUrl()
    });
  }, []);
  useEffect(() => {
    setFrameState((prev) => {
      const nextName = player.name || 'Player';
      if (prev.players.A.name === nextName) return prev;
      return {
        ...prev,
        players: {
          ...prev.players,
          A: { ...prev.players.A, name: nextName }
        }
      };
    });
  }, [player.name]);
  useEffect(() => {
    setHud((prev) => {
      const nextTargets = frameState.ballOn.map((c) => c.toLowerCase());
      let nextLabel = prev.next;
      if (nextTargets.length === 1) {
        nextLabel = nextTargets[0];
      } else if (nextTargets.length > 1) {
        nextLabel = nextTargets.includes('red')
          ? 'red'
          : nextTargets[0];
      } else if (frameState.phase === 'COLORS_ORDER') {
        nextLabel = 'yellow';
      }
      return {
        ...prev,
        A: frameState.players.A.score,
        B: frameState.players.B.score,
        turn: frameState.activePlayer === 'A' ? 0 : 1,
        phase:
          frameState.phase === 'REDS_AND_COLORS' ? 'reds' : 'colors',
        next: nextLabel,
        over: frameState.frameOver
      };
    });
  }, [frameState]);
  useEffect(() => {
    let wakeLock;
    const request = async () => {
      try {
        wakeLock = await navigator.wakeLock?.request('screen');
      } catch (e) {
        console.warn('wakeLock request failed', e);
      }
    };
    request();
    const handleVis = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      try {
        wakeLock?.release();
      } catch {}
    };
  }, []);
  const aiFlag = useMemo(
    () => FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)],
    []
  );
  const aiShoot = useRef(() => {
    aimDirRef.current.set(Math.random() - 0.5, Math.random() - 0.5).normalize();
    powerRef.current = 0.5;
    setHud((s) => ({ ...s, power: 0.5 }));
    fireRef.current?.();
  });

  const drawHudPanel = (ctx, logo, avatarImg, name, score, t, emoji) => {
    const c = ctx.canvas;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, w, h);
    if (logo && logo.complete) ctx.drawImage(logo, w / 2 - 64, 5, 128, 64);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '28px sans-serif';
    if (avatarImg && avatarImg.complete)
      ctx.drawImage(avatarImg, 20, 100, 64, 64);
    else if (emoji) {
      ctx.font = '48px serif';
      ctx.fillText(emoji, 52, 150);
    }
    ctx.textAlign = 'left';
    ctx.font = '24px sans-serif';
    ctx.fillText(name, 100, 120);
    ctx.fillText(`Score: ${score}`, 100, 160);
    ctx.fillText(`Time: ${t}`, 100, 200);
  };

  const updateHudPanels = useCallback(() => {
    const panels = panelsRef.current;
    if (!panels) return;
    const { A, B, C, D, logo, playerImg } = panels;
    drawHudPanel(A.ctx, logo, playerImg, player.name, hud.A, timer);
    A.tex.needsUpdate = true;
    drawHudPanel(B.ctx, logo, null, 'AI', hud.B, timer, aiFlag);
    B.tex.needsUpdate = true;
    drawHudPanel(C.ctx, logo, playerImg, player.name, hud.A, timer);
    C.tex.needsUpdate = true;
    drawHudPanel(D.ctx, logo, null, 'AI', hud.B, timer, aiFlag);
    D.tex.needsUpdate = true;
  }, [hud.A, hud.B, timer, player.name, aiFlag]);

  useEffect(() => {
    updateHudPanels();
  }, [updateHudPanels]);

  // Removed camera rotation helpers previously triggered by UI buttons

  const toggleView = () => {
    const cam = cameraRef.current;
    const sph = sphRef.current;
    const fit = fitRef.current;
    if (!cam || !sph || !fit) return;
    const next = !topViewRef.current;
    const start = {
      radius: sph.radius,
      phi: sph.phi,
      theta: sph.theta
    };
    if (next) last3DRef.current = { phi: sph.phi, theta: sph.theta };
      const targetMargin = next
        ? 1.05
        : window.innerHeight > window.innerWidth
          ? 1.6
          : 1.4;
    const targetRadius = fitRadius(cam, targetMargin);
    const target = {
      radius: next ? targetRadius : clampOrbitRadius(targetRadius),
      phi: next ? 0.0001 : last3DRef.current.phi,
      theta: next ? sph.theta : last3DRef.current.theta
    };
    const duration = 600;
    const t0 = performance.now();
    function anim(t) {
      const k = Math.min(1, (t - t0) / duration);
      const ease = k * (2 - k);
      sph.radius = start.radius + (target.radius - start.radius) * ease;
      sph.phi = start.phi + (target.phi - start.phi) * ease;
      sph.theta = start.theta + (target.theta - start.theta) * ease;
      const targetPos = new THREE.Vector3(
        playerOffsetRef.current,
        TABLE_Y + 0.05,
        0
      ).multiplyScalar(worldScaleFactor);
      const tmpSphAnim = sph.clone
        ? sph.clone()
        : new THREE.Spherical(sph.radius, sph.phi, sph.theta);
      cam.position.setFromSpherical(tmpSphAnim).add(targetPos);
      cam.lookAt(targetPos);
      if (k < 1) requestAnimationFrame(anim);
      else {
        topViewRef.current = next;
        setTopView(next);
        if (rendererRef.current) {
          rendererRef.current.domElement.style.transform = next
            ? 'scale(0.9)'
            : 'scale(1)';
        }
        fit(targetMargin);
      }
    }
    requestAnimationFrame(anim);
  };

  useEffect(() => {
    if (hud.over) return;
    const playerTurn = hud.turn;
    const duration = playerTurn === 0 ? 60 : 5;
    setTimer(duration);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (playerTurn === 0) {
            setHud((s) => ({ ...s, turn: 1 - s.turn }));
          } else {
            aiShoot.current();
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [hud.turn, hud.over]);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    let loadTimer = null;
    try {
      const updatePocketCameraState = (active) => {
        if (pocketCameraStateRef.current === active) return;
        pocketCameraStateRef.current = active;
        setPocketCameraActive(active);
      };
      updatePocketCameraState(false);
      screen.orientation?.lock?.('portrait').catch(() => {});
      // Renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      renderer.useLegacyLights = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      const devicePixelRatio = window.devicePixelRatio || 1;
      const mobilePixelCap = window.innerWidth <= 1366 ? 1.5 : 2;
      renderer.setPixelRatio(Math.min(mobilePixelCap, devicePixelRatio));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // Ensure the canvas fills the host element so the table is centered and
      // scaled correctly on all view modes.
      renderer.setSize(host.clientWidth, host.clientHeight);
      host.appendChild(renderer.domElement);
      renderer.domElement.addEventListener('webglcontextlost', (e) =>
        e.preventDefault()
      );
      rendererRef.current = renderer;
      renderer.domElement.style.transformOrigin = 'top left';

      // Scene & Camera
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050505);
      const world = new THREE.Group();
      scene.add(world);
      let worldScaleFactor = 1;
      let cue;
      let clothMat;
      let cushionMat;
      let shooting = false; // track when a shot is in progress
      let activeShotView = null;
      let suspendedActionView = null;
      let shotPrediction = null;
      let cueAnimating = false; // forward stroke animation state
      const legHeight = LEG_ROOM_HEIGHT;
      const floorY = FLOOR_Y;
      const roomDepth = TABLE.H * 3.6;
      const sideClearance = roomDepth / 2 - TABLE.H / 2;
      const roomWidth = TABLE.W + sideClearance * 2;
      const wallThickness = 1.2;
      const wallHeight = legHeight + TABLE.THICK + 40;
      const carpetThickness = 1.2;
      const carpetInset = wallThickness * 0.02;
      const carpetWidth = roomWidth - wallThickness + carpetInset;
      const carpetDepth = roomDepth - wallThickness + carpetInset;
      const carpetTextures = createCarpetTextures();
      const carpetMat = new THREE.MeshStandardMaterial({
        color: 0x8c2f2f,
        roughness: 0.92,
        metalness: 0.04
      });
      const carpetRepeatX = Math.max(1.5, (carpetWidth / TABLE.W) * 1.2);
      const carpetRepeatZ = Math.max(1.5, (carpetDepth / TABLE.H) * 1.2);
      if (carpetTextures.map) {
        carpetMat.map = carpetTextures.map;
        carpetMat.map.repeat.set(carpetRepeatX, carpetRepeatZ);
        carpetMat.map.needsUpdate = true;
      }
      if (carpetTextures.bump) {
        carpetMat.bumpMap = carpetTextures.bump;
        carpetMat.bumpMap.repeat.set(carpetRepeatX, carpetRepeatZ);
        carpetMat.bumpScale = 0.35;
        carpetMat.bumpMap.needsUpdate = true;
      }
      const carpet = new THREE.Mesh(
        new THREE.BoxGeometry(carpetWidth, carpetThickness, carpetDepth),
        carpetMat
      );
      carpet.castShadow = false;
      carpet.receiveShadow = true;
      carpet.position.set(0, floorY - carpetThickness / 2, 0);
      world.add(carpet);

      const wallMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        roughness: 0.88,
        metalness: 0.06
      });

      const makeWall = (width, height, depth) => {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          wallMat
        );
        wall.castShadow = false;
        wall.receiveShadow = true;
        wall.position.y = floorY + height / 2;
        world.add(wall);
        return wall;
      };

      const backWall = makeWall(roomWidth, wallHeight, wallThickness);
      backWall.position.z = roomDepth / 2;

      const frontWall = makeWall(roomWidth, wallHeight, wallThickness);
      frontWall.position.z = -roomDepth / 2;

      const leftWall = makeWall(wallThickness, wallHeight, roomDepth);
      leftWall.position.x = -roomWidth / 2;

      const rightWall = makeWall(wallThickness, wallHeight, roomDepth);
      rightWall.position.x = roomWidth / 2;
        const aspect = host.clientWidth / host.clientHeight;
        const camera = new THREE.PerspectiveCamera(
          CAMERA.fov,
          aspect,
          CAMERA.near,
          CAMERA.far
        );
        const standingPhi = THREE.MathUtils.clamp(
          STANDING_VIEW.phi,
          CAMERA.minPhi,
          CAMERA.maxPhi
        );
        const standingRadius = clamp(
          fitRadius(camera, STANDING_VIEW.margin),
          CAMERA.minR,
          CAMERA.maxR
        );
        const sph = new THREE.Spherical(
          standingRadius,
          standingPhi,
          Math.PI
        );
        cameraBoundsRef.current = {
          cueShot: { phi: initialCuePhi, radius: initialCueRadius },
          standing: { phi: standingPhi, radius: standingRadius }
        };

        const ensurePocketCamera = (id, center) => {
          if (!id) return null;
          let entry = pocketCamerasRef.current.get(id);
          if (!entry) {
            const pocketCamera = new THREE.PerspectiveCamera(
              POCKET_CAMERA_FOV,
              aspect,
              CAMERA.near,
              CAMERA.far
            );
            pocketCamera.up.set(0, 1, 0);
            entry = { camera: pocketCamera, center: center?.clone() ?? null };
            pocketCamerasRef.current.set(id, entry);
          } else if (entry.camera.aspect !== aspect) {
            entry.camera.aspect = aspect;
            entry.camera.updateProjectionMatrix();
          }
          if (entry.camera.fov !== POCKET_CAMERA_FOV) {
            entry.camera.fov = POCKET_CAMERA_FOV;
            entry.camera.updateProjectionMatrix();
          }
          if (center) {
            entry.center = center.clone();
          }
          return entry.camera;
        };

        POCKET_CAMERA_IDS.forEach((anchorId) => {
          const center = getPocketCenterById(anchorId);
          if (center) ensurePocketCamera(anchorId, center);
        });

        const getPocketCameraEntry = (anchorId) => {
          if (!anchorId) return null;
          return pocketCamerasRef.current.get(anchorId) ?? null;
        };

        const getDefaultOrbitTarget = () =>
          new THREE.Vector3(playerOffsetRef.current, TABLE_Y + 0.05, 0);

        activeRenderCameraRef.current = camera;

        const ensureOrbitFocus = () => {
          const store = orbitFocusRef.current;
          if (store?.target) return store;
          const target = getDefaultOrbitTarget();
          orbitFocusRef.current = { ballId: null, target };
          return orbitFocusRef.current;
        };

        const setOrbitFocusToDefault = () => {
          const store = ensureOrbitFocus();
          store.ballId = null;
          store.target.copy(getDefaultOrbitTarget());
        };

        const setOrbitFocusToBall = (ball) => {
          if (!ball) {
            setOrbitFocusToDefault();
            return;
          }
          const store = ensureOrbitFocus();
          store.ballId = ball.id;
          store.target.set(ball.pos.x, BALL_CENTER_Y, ball.pos.y);
        };

        const getMaxOrbitRadius = () =>
          topViewRef.current
            ? CAMERA.maxR
            : Math.min(CAMERA.maxR, orbitRadiusLimitRef.current ?? CAMERA.maxR);

        const clampOrbitRadius = (value) =>
          clamp(value, CAMERA.minR, getMaxOrbitRadius());

        const syncBlendToSpherical = () => {
          const bounds = cameraBoundsRef.current;
          if (!bounds) return;
          const { standing, cueShot } = bounds;
          const phiRange = standing.phi - cueShot.phi;
          if (Math.abs(phiRange) > 1e-5) {
            const normalized = (sph.phi - cueShot.phi) / phiRange;
            cameraBlendRef.current = THREE.MathUtils.clamp(
              normalized,
              0,
              1
            );
          } else {
            cameraBlendRef.current = 0;
          }
        };

        const applyCameraBlend = (nextBlend) => {
          const bounds = cameraBoundsRef.current;
          if (!bounds) return;
          const { standing, cueShot } = bounds;
          const blend = THREE.MathUtils.clamp(
            nextBlend ?? cameraBlendRef.current,
            0,
            1
          );
          cameraBlendRef.current = blend;
          const rawPhi = THREE.MathUtils.lerp(cueShot.phi, standing.phi, blend);
          const baseRadius = THREE.MathUtils.lerp(
            cueShot.radius,
            standing.radius,
            blend
          );
          let radius = clampOrbitRadius(baseRadius);
          if (CAMERA_DOWNWARD_PULL > 0) {
            const pull = CAMERA_DOWNWARD_PULL * (1 - blend);
            if (pull > 0) {
              radius = clampOrbitRadius(radius - pull);
            }
          }
          const cushionHeight = cushionHeightRef.current ?? TABLE.THICK;
          const minHeightFromTarget = Math.max(
            TABLE.THICK,
            cushionHeight + CAMERA_CUSHION_CLEARANCE
          );
          const phiRailLimit = Math.acos(
            THREE.MathUtils.clamp(minHeightFromTarget / Math.max(radius, 1e-3), -1, 1)
          );
          const safePhi = Math.min(rawPhi, phiRailLimit - CAMERA_RAIL_SAFETY);
          const clampedPhi = clamp(safePhi, CAMERA.minPhi, CAMERA.maxPhi);
          let finalRadius = radius;
          let minRadiusForRails = null;
          if (clampedPhi >= CAMERA_RAIL_APPROACH_PHI) {
            const sinPhi = Math.sin(clampedPhi);
            if (sinPhi > 1e-4) {
              minRadiusForRails = clampOrbitRadius(CAMERA_MIN_HORIZONTAL / sinPhi);
              finalRadius = Math.max(finalRadius, minRadiusForRails);
            }
          }
          const phiSpan = standing.phi - cueShot.phi;
          let phiProgress = 0;
          if (Math.abs(phiSpan) > 1e-5) {
            phiProgress = THREE.MathUtils.clamp(
              (clampedPhi - cueShot.phi) / phiSpan,
              0,
              1
            );
          }
          const dynamicPull = CAMERA_DYNAMIC_PULL_RANGE * (1 - phiProgress);
          if (dynamicPull > 1e-5) {
            const adjusted = clampOrbitRadius(finalRadius - dynamicPull);
            finalRadius =
              minRadiusForRails != null
                ? Math.max(adjusted, minRadiusForRails)
                : adjusted;
          }
          sph.phi = clampedPhi;
          sph.radius = clampOrbitRadius(finalRadius);
          syncBlendToSpherical();
        };


        const updateCamera = () => {
          let renderCamera = camera;
          let lookTarget = null;
          if (topViewRef.current) {
            lookTarget = getDefaultOrbitTarget().multiplyScalar(
              worldScaleFactor
            );
            camera.position.set(lookTarget.x, sph.radius, lookTarget.z);
            camera.lookAt(lookTarget);
            renderCamera = camera;
          } else if (activeShotView?.mode === 'action') {
            const ballsList = ballsRef.current || [];
            const cueBall = ballsList.find((b) => b.id === activeShotView.cueId);
            if (!cueBall?.active) {
              activeShotView = null;
            } else {
              const now = performance.now();
              const lastUpdate = activeShotView.lastUpdate ?? now;
              const dt = Math.min(0.25, Math.max(0, (now - lastUpdate) / 1000));
              activeShotView.lastUpdate = now;
              const smoothTime =
                activeShotView.stage === 'followCue'
                  ? ACTION_CAM.followSmoothingTime
                  : ACTION_CAM.smoothingTime;
              const lerpT =
                smoothTime > 0
                  ? THREE.MathUtils.clamp(1 - Math.exp(-dt / smoothTime), 0, 1)
                  : 1;
              const cuePos2 = new THREE.Vector2(cueBall.pos.x, cueBall.pos.y);
              let focusTargetVec3 = null;
              let desiredPosition = null;
              const axis = activeShotView.axis ?? 'short';
              let railDir = activeShotView.railDir;
              if (!Number.isFinite(railDir) || railDir === 0) {
                railDir =
                  axis === 'side'
                    ? signed(
                        cueBall.pos.x ??
                          cueBall.launchDir?.x ??
                          activeShotView.railNormal?.x ??
                          1
                      )
                    : signed(
                        cueBall.pos.y ??
                          cueBall.launchDir?.y ??
                          activeShotView.railNormal?.y ??
                          1
                      );
                activeShotView.railDir = railDir;
              }
              if (!activeShotView.hasSwitchedRail) {
                const cueMoving = cueBall.vel.lengthSq() > STOP_EPS * STOP_EPS;
                if (shooting || cueMoving) {
                  const fallbackRailDir =
                    axis === 'side'
                      ? signed(
                          cueBall.pos.x ??
                            cueBall.launchDir?.x ??
                            activeShotView.railNormal?.x ??
                            1,
                          1
                        )
                      : signed(
                          cueBall.pos.y ??
                            cueBall.launchDir?.y ??
                            activeShotView.railNormal?.y ??
                            1,
                          1
                        );
                  const currentDir = signed(railDir, fallbackRailDir);
                  railDir = -currentDir;
                  activeShotView.railDir = railDir;
                  activeShotView.hasSwitchedRail = true;
                }
              }
              const heightBase = TABLE_Y + TABLE.THICK;
              if (activeShotView.stage === 'pair') {
                const targetBall =
                  activeShotView.targetId != null
                    ? ballsList.find((b) => b.id === activeShotView.targetId)
                    : null;
                let targetPos2;
                if (targetBall?.active) {
                  targetPos2 = new THREE.Vector2(targetBall.pos.x, targetBall.pos.y);
                  activeShotView.targetLastPos = targetPos2.clone();
                } else if (activeShotView.targetLastPos) {
                  targetPos2 = activeShotView.targetLastPos.clone();
                } else {
                  targetPos2 = cuePos2.clone().add(new THREE.Vector2(0, BALL_R * 6));
                }
                const mid = cuePos2.clone().add(targetPos2).multiplyScalar(0.5);
                const span = Math.max(targetPos2.distanceTo(cuePos2), BALL_R * 4);
                const forward = targetPos2.clone().sub(cuePos2);
                if (forward.lengthSq() < 1e-6) forward.set(0, 1);
                forward.normalize();
                const side = new THREE.Vector2(-forward.y, forward.x);
                const distance = THREE.MathUtils.clamp(
                  span * ACTION_CAM.pairDistanceScale + BALL_R * 8,
                  ACTION_CAM.pairMinDistance,
                  ACTION_CAM.pairMaxDistance
                );
                const offsetSide = side.multiplyScalar(distance * ACTION_CAM.sideBias);
                const offsetBack = forward.multiplyScalar(
                  -distance * ACTION_CAM.forwardBias
                );
                const anchor = new THREE.Vector3(
                  mid.x,
                  BALL_CENTER_Y + BALL_R * 0.3,
                  mid.y
                );
                if (axis === 'short') {
                  const lateralClamp = CAMERA_LATERAL_CLAMP.short;
                  const baseX = THREE.MathUtils.clamp(
                    anchor.x + offsetSide.x * 0.6 + offsetBack.x * 0.25,
                    -lateralClamp,
                    lateralClamp
                  );
                  const longShotPullback =
                    activeShotView.longShot ? LONG_SHOT_SHORT_RAIL_OFFSET : 0;
                  const heightLift =
                    activeShotView.longShot ? BALL_R * 2.5 : 0;
                  const desired = new THREE.Vector3(
                    baseX,
                    heightBase + ACTION_CAM.heightOffset + heightLift,
                    railDir * (SHORT_RAIL_CAMERA_DISTANCE + longShotPullback)
                  );
                  const lookAnchor = anchor.clone();
                  if (activeShotView.longShot) {
                    lookAnchor.x = THREE.MathUtils.lerp(
                      lookAnchor.x,
                      0,
                      0.35
                    );
                  }
                  lookAnchor.x +=
                    signed(baseX, 0) * BALL_R * (activeShotView.longShot ? 1.8 : 2.5);
                  lookAnchor.z +=
                    -railDir * BALL_R * (activeShotView.longShot ? 6.5 : 4);
                  applyStandingViewElevation(desired, lookAnchor, heightBase);
                  focusTargetVec3 = lookAnchor.multiplyScalar(worldScaleFactor);
                  desiredPosition = desired.multiplyScalar(worldScaleFactor);
                } else {
                  const lateralClamp = CAMERA_LATERAL_CLAMP.side;
                  const baseZ = THREE.MathUtils.clamp(
                    anchor.z + offsetSide.y * 0.6 + offsetBack.y * 0.25,
                    -lateralClamp,
                    lateralClamp
                  );
                  const desired = new THREE.Vector3(
                    railDir * SIDE_RAIL_CAMERA_DISTANCE,
                    heightBase + ACTION_CAM.heightOffset,
                    baseZ
                  );
                  const lookAnchor = anchor.clone();
                  lookAnchor.x = THREE.MathUtils.lerp(lookAnchor.x, 0, 0.65);
                  lookAnchor.x += -railDir * BALL_R * 4;
                  lookAnchor.z = THREE.MathUtils.lerp(lookAnchor.z, baseZ, 0.4);
                  applyStandingViewElevation(desired, lookAnchor, heightBase);
                  focusTargetVec3 = lookAnchor.multiplyScalar(worldScaleFactor);
                  desiredPosition = desired.multiplyScalar(worldScaleFactor);
                }
              } else {
                const cueVel = cueBall.vel.clone();
                let dir = cueVel.clone();
                if (dir.lengthSq() > 1e-6) {
                  dir.normalize();
                  activeShotView.lastCueDir = dir.clone();
                } else if (activeShotView.lastCueDir) {
                  dir.copy(activeShotView.lastCueDir);
                } else if (cueBall.launchDir) {
                  dir.copy(cueBall.launchDir.clone().normalize());
                  activeShotView.lastCueDir = dir.clone();
                } else {
                  dir.set(0, 1);
                }
                const lookAhead = activeShotView.cueLookAhead ?? BALL_R * 6;
                const anchor = new THREE.Vector3(
                  cueBall.pos.x + dir.x * lookAhead,
                  BALL_CENTER_Y + BALL_R * 0.3,
                  cueBall.pos.y + dir.y * lookAhead
                );
                const perp = new THREE.Vector2(-dir.y, dir.x);
                const distance = THREE.MathUtils.clamp(
                  ACTION_CAM.followDistance,
                  ACTION_CAM.pairMinDistance,
                  ACTION_CAM.pairMaxDistance
                );
                const lateral = perp.multiplyScalar(BALL_R * 6);
                if (axis === 'short') {
                  const lateralClamp = CAMERA_LATERAL_CLAMP.short;
                  const baseX = THREE.MathUtils.clamp(
                    anchor.x - dir.x * BALL_R * 6 + lateral.x,
                    -lateralClamp,
                    lateralClamp
                  );
                  const longShotPullback =
                    activeShotView.longShot ? LONG_SHOT_SHORT_RAIL_OFFSET : 0;
                  const heightLift =
                    activeShotView.longShot ? BALL_R * 2.2 : 0;
                  const desired = new THREE.Vector3(
                    baseX,
                    heightBase + ACTION_CAM.followHeightOffset + heightLift,
                    railDir * (SHORT_RAIL_CAMERA_DISTANCE + longShotPullback)
                  );
                  const lookAnchor = anchor.clone();
                  if (activeShotView.longShot) {
                    lookAnchor.x = THREE.MathUtils.lerp(
                      lookAnchor.x,
                      0,
                      0.35
                    );
                  }
                  lookAnchor.x +=
                    signed(baseX, 0) * BALL_R * (activeShotView.longShot ? 1.8 : 2.5);
                  lookAnchor.z +=
                    -railDir * BALL_R * (activeShotView.longShot ? 7.5 : 5);
                  applyStandingViewElevation(desired, lookAnchor, heightBase);
                  focusTargetVec3 = lookAnchor.multiplyScalar(worldScaleFactor);
                  desiredPosition = desired.multiplyScalar(worldScaleFactor);
                } else {
                  const lateralClamp = CAMERA_LATERAL_CLAMP.side;
                  const baseZ = THREE.MathUtils.clamp(
                    anchor.z - dir.y * distance + lateral.y,
                    -lateralClamp,
                    lateralClamp
                  );
                  const desired = new THREE.Vector3(
                    railDir * SIDE_RAIL_CAMERA_DISTANCE,
                    heightBase + ACTION_CAM.followHeightOffset,
                    baseZ
                  );
                  const lookAnchor = anchor.clone();
                  lookAnchor.x = THREE.MathUtils.lerp(lookAnchor.x, 0, 0.65);
                  lookAnchor.x += -railDir * BALL_R * 4;
                  lookAnchor.z = THREE.MathUtils.lerp(lookAnchor.z, baseZ, 0.4);
                  applyStandingViewElevation(desired, lookAnchor, heightBase);
                  focusTargetVec3 = lookAnchor.multiplyScalar(worldScaleFactor);
                  desiredPosition = desired.multiplyScalar(worldScaleFactor);
                }
              }
              if (focusTargetVec3 && desiredPosition) {
                if (!activeShotView.smoothedPos) {
                  activeShotView.smoothedPos = desiredPosition.clone();
                } else {
                  activeShotView.smoothedPos.lerp(desiredPosition, lerpT);
                }
                if (!activeShotView.smoothedTarget) {
                  activeShotView.smoothedTarget = focusTargetVec3.clone();
                } else {
                  activeShotView.smoothedTarget.lerp(focusTargetVec3, lerpT);
                }
                camera.position.copy(activeShotView.smoothedPos);
                camera.lookAt(activeShotView.smoothedTarget);
                lookTarget = activeShotView.smoothedTarget;
                renderCamera = camera;
              }
            }
          } else if (activeShotView?.mode === 'pocket') {
            const ballsList = ballsRef.current || [];
            const focusBall = ballsList.find(
              (b) => b.id === activeShotView.ballId
            );
            if (focusBall?.active) {
              activeShotView.lastBallPos.set(
                focusBall.pos.x,
                focusBall.pos.y
              );
            }
            const pocketCenter = activeShotView.pocketCenter;
            const anchorType =
              activeShotView.anchorType ??
              (activeShotView.isSidePocket ? 'side' : 'short');
            let railDir =
              activeShotView.railDir ??
              (anchorType === 'side'
                ? signed(pocketCenter.x, 1)
                : signed(pocketCenter.y, 1));
            if (!Number.isFinite(activeShotView.railDir) || activeShotView.railDir === 0) {
              activeShotView.railDir = railDir;
            } else {
              railDir = activeShotView.railDir;
            }
            const heightScale =
              activeShotView.heightScale ?? POCKET_CAM.heightScale ?? 1;
            let approachDir = activeShotView.approach
              ? activeShotView.approach.clone()
              : new THREE.Vector2(0, -railDir);
            if (approachDir.lengthSq() < 1e-6) {
              approachDir.set(0, -railDir);
            }
            approachDir.normalize();
            if (activeShotView.approach) {
              activeShotView.approach.copy(approachDir);
            } else {
              activeShotView.approach = approachDir.clone();
            }
            const resolvedAnchorId = resolvePocketCameraAnchor(
              activeShotView.pocketId ?? pocketIdFromCenter(pocketCenter),
              pocketCenter,
              approachDir,
              activeShotView.lastBallPos ?? pocketCenter
            );
            const anchorId =
              resolvedAnchorId ??
              activeShotView.anchorId ??
              pocketIdFromCenter(pocketCenter);
            if (anchorId !== activeShotView.anchorId) {
              activeShotView.anchorId = anchorId;
              const latestOutward = getPocketCameraOutward(anchorId);
              if (latestOutward) {
                activeShotView.anchorOutward = latestOutward;
              }
            }
            let pocketCamEntry = getPocketCameraEntry(anchorId);
            const anchorCenter = getPocketCenterById(anchorId);
            const pocketCamera = pocketCamEntry
              ? pocketCamEntry.camera
              : ensurePocketCamera(anchorId, anchorCenter);
            if (!pocketCamEntry) {
              pocketCamEntry = getPocketCameraEntry(anchorId) ?? null;
            }
            const pocketCenter2D = pocketCenter.clone();
            const outward = activeShotView.anchorOutward
              ? activeShotView.anchorOutward.clone()
              : getPocketCameraOutward(anchorId) ?? pocketCenter2D.clone();
            if (outward.lengthSq() < 1e-6) {
              outward.set(
                anchorType === 'side' ? railDir : 0,
                anchorType === 'side' ? 0 : railDir
              );
            }
            outward.normalize();
            if (!activeShotView.anchorOutward) {
              activeShotView.anchorOutward = outward.clone();
            }
            const cameraBounds = cameraBoundsRef.current ?? null;
            const cueBounds = cameraBounds?.cueShot ?? null;
            const standingBounds = cameraBounds?.standing ?? null;
            const focusHeightLocal = BALL_CENTER_Y + BALL_R * 0.25;
            const focusTarget = new THREE.Vector3(
              0,
              focusHeightLocal,
              0
            ).multiplyScalar(worldScaleFactor);
            const pocketDirection2D = pocketCenter2D.clone();
            if (pocketDirection2D.lengthSq() < 1e-6) {
              pocketDirection2D.copy(outward.lengthSq() > 1e-6 ? outward : new THREE.Vector2(0, -1));
            }
            const azimuth = Math.atan2(pocketDirection2D.x, pocketDirection2D.y);
            const baseRadius = (() => {
              const fallback = clamp(
                fitRadius(camera, STANDING_VIEW.margin),
                CAMERA.minR,
                CAMERA.maxR
              );
              const standingRadius = standingBounds?.radius ?? fallback;
              const pocketRadius = pocketDirection2D.length();
              return Math.max(standingRadius, pocketRadius + POCKET_CAM.minOutside);
            })();
            const cuePhi = cueBounds?.phi ?? CUE_VIEW_TARGET_PHI;
            const spherical = new THREE.Spherical(
              baseRadius * worldScaleFactor,
              cuePhi,
              azimuth
            );
            const desiredPosition = focusTarget
              .clone()
              .add(new THREE.Vector3().setFromSpherical(spherical));
            if (POCKET_CAM.outwardOffset) {
              const outwardOffset = new THREE.Vector3(outward.x, 0, outward.y);
              if (outwardOffset.lengthSq() > 1e-6) {
                outwardOffset
                  .normalize()
                  .multiplyScalar(POCKET_CAM.outwardOffset * worldScaleFactor);
                desiredPosition.add(outwardOffset);
              }
            }
            const minHeightWorld =
              (TABLE_Y + TABLE.THICK + activeShotView.heightOffset * heightScale) *
              worldScaleFactor;
            const loweredY =
              desiredPosition.y -
              (POCKET_CAM.heightDrop ?? 0) * worldScaleFactor;
            desiredPosition.y =
              loweredY < minHeightWorld ? minHeightWorld : loweredY;
            const now = performance.now();
            if (focusBall?.active) {
              activeShotView.completed = false;
              const extendTo = now + POCKET_VIEW_ACTIVE_EXTENSION_MS;
              activeShotView.holdUntil =
                activeShotView.holdUntil != null
                  ? Math.max(activeShotView.holdUntil, extendTo)
                  : extendTo;
            }
            const lastUpdate = activeShotView.lastUpdate ?? now;
            const dt = Math.min(0.2, Math.max(0, (now - lastUpdate) / 1000));
            activeShotView.lastUpdate = now;
            const smooth =
              POCKET_VIEW_SMOOTH_TIME > 0
                ? 1 - Math.exp(-dt / POCKET_VIEW_SMOOTH_TIME)
                : 1;
            const lerpT = THREE.MathUtils.clamp(smooth, 0, 1);
            if (!activeShotView.smoothedPos) {
              activeShotView.smoothedPos = desiredPosition.clone();
            } else {
              activeShotView.smoothedPos.lerp(desiredPosition, lerpT);
            }
            if (!activeShotView.smoothedTarget) {
              activeShotView.smoothedTarget = focusTarget.clone();
            } else {
              activeShotView.smoothedTarget.lerp(focusTarget, lerpT);
            }
            if (pocketCamera) {
              pocketCamera.position.copy(activeShotView.smoothedPos);
              pocketCamera.lookAt(activeShotView.smoothedTarget);
              pocketCamera.updateMatrixWorld();
              renderCamera = pocketCamera;
            }
            lookTarget = activeShotView.smoothedTarget;
          } else {
            const aimFocus = !shooting && cue?.active ? aimFocusRef.current : null;
            let focusTarget;
            if (
              aimFocus &&
              Number.isFinite(aimFocus.x) &&
              Number.isFinite(aimFocus.y) &&
              Number.isFinite(aimFocus.z)
            ) {
              focusTarget = aimFocus.clone();
            } else if (cue?.active && !shooting) {
              focusTarget = new THREE.Vector3(cue.pos.x, BALL_CENTER_Y, cue.pos.y);
            } else {
              const store = ensureOrbitFocus();
              if (store.ballId) {
                const ballsList =
                  ballsRef.current?.length > 0 ? ballsRef.current : balls;
                const focusBall = ballsList.find((b) => b.id === store.ballId);
                if (focusBall?.active) {
                  store.target.set(
                    focusBall.pos.x,
                    BALL_CENTER_Y,
                    focusBall.pos.y
                  );
                } else {
                  setOrbitFocusToDefault();
                }
              }
              focusTarget = store.target.clone();
            }
            focusTarget.multiplyScalar(worldScaleFactor);
            lookTarget = focusTarget;
            TMP_SPH.copy(sph);
            camera.position.setFromSpherical(TMP_SPH).add(lookTarget);
            camera.lookAt(lookTarget);
            renderCamera = camera;
          }
          if (lookTarget) {
            lastCameraTargetRef.current.copy(lookTarget);
          }
          if (clothMat && lookTarget) {
            const dist = renderCamera.position.distanceTo(lookTarget);
            const fade = THREE.MathUtils.clamp((120 - dist) / 45, 0, 1);
            const nearRepeat = clothMat.userData?.nearRepeat ?? 32;
            const farRepeat = clothMat.userData?.farRepeat ?? 18;
            const ratio = clothMat.userData?.repeatRatio ?? 1;
            const targetRepeat = THREE.MathUtils.lerp(farRepeat, nearRepeat, fade);
            const targetRepeatY = targetRepeat * ratio;
            if (clothMat.map) {
              clothMat.map.repeat.set(targetRepeat, targetRepeatY);
            }
            if (clothMat.bumpMap) {
              clothMat.bumpMap.repeat.set(targetRepeat, targetRepeatY);
            }
            if (Number.isFinite(clothMat.userData?.bumpScale)) {
              const base = clothMat.userData.bumpScale;
              clothMat.bumpScale = THREE.MathUtils.lerp(base * 0.55, base * 1.4, fade);
            }
          }
          activeRenderCameraRef.current = renderCamera;
          return renderCamera;
        };
        const lerpAngle = (a, b, t) => {
          const delta =
            THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) -
            Math.PI;
          return a + delta * t;
        };
        const animateCamera = ({
          radius,
          phi,
          theta,
          duration = 600
        } = {}) => {
          if (radius !== undefined) {
            radius = clampOrbitRadius(radius);
          }
          const start = {
            radius: sph.radius,
            phi: sph.phi,
            theta: sph.theta
          };
          const startTime = performance.now();
          const ease = (k) => k * k * (3 - 2 * k);
          const step = (now) => {
            const t = Math.min(1, (now - startTime) / duration);
            const eased = ease(t);
            if (radius !== undefined) {
              sph.radius = THREE.MathUtils.lerp(start.radius, radius, eased);
            }
            if (phi !== undefined) {
              sph.phi = THREE.MathUtils.lerp(start.phi, phi, eased);
            }
            if (theta !== undefined) {
              sph.theta = lerpAngle(start.theta, theta, eased);
            }
            syncBlendToSpherical();
            updateCamera();
            if (t < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        };
        const restoreOrbitCamera = (view, immediate = false) => {
          if (!view) return;
          const sph = sphRef.current;
          if (!sph) return;
          const orbit =
            view.resumeOrbit ??
            view.orbitSnapshot ??
            initialOrbitRef.current ??
            (cameraBoundsRef.current?.standing
              ? {
                  radius: cameraBoundsRef.current.standing.radius,
                  phi: cameraBoundsRef.current.standing.phi,
                  theta: sph.theta
                }
              : {
                  radius: sph.radius,
                  phi: sph.phi,
                  theta: sph.theta
                });
          const radius = clampOrbitRadius(orbit.radius ?? sph.radius);
          const phi = clamp(
            orbit.phi ?? sph.phi,
            CAMERA.minPhi,
            CAMERA.maxPhi
          );
          const theta = orbit.theta ?? sph.theta;
          const cushionLimit = Math.max(
            TABLE.THICK * 0.5,
            (cushionHeightRef.current ?? TABLE.THICK) + CAMERA_CUSHION_CLEARANCE
          );
          const phiCap = Math.acos(
            THREE.MathUtils.clamp(cushionLimit / radius, -1, 1)
          );
          const safePhi = Math.min(phi, phiCap);
          if (immediate) {
            sph.radius = radius;
            sph.phi = Math.max(CAMERA.minPhi, safePhi);
            sph.theta = theta;
            syncBlendToSpherical();
            updateCamera();
          } else {
            animateCamera({
              radius,
              phi: Math.max(CAMERA.minPhi, safePhi),
              theta,
              duration: 500
            });
          }
        };
        const resumeAfterPocket = (pocketView, now) => {
          updatePocketCameraState(false);
          const resumeAction =
            pocketView?.resumeAction?.mode === 'action'
              ? pocketView.resumeAction
              : suspendedActionView?.mode === 'action'
                ? suspendedActionView
                : null;
          if (resumeAction) {
            resumeAction.stage = 'followCue';
            resumeAction.lastUpdate = now;
            resumeAction.holdUntil = now + ACTION_CAM.followHoldMs;
            resumeAction.pendingActivation = false;
            resumeAction.activationDelay = null;
            resumeAction.activationTravel = 0;
            if (cameraRef.current) {
              resumeAction.smoothedPos = cameraRef.current.position.clone();
              const storedTarget = lastCameraTargetRef.current?.clone();
              if (storedTarget) {
                resumeAction.smoothedTarget = storedTarget;
              }
            }
            activeShotView = resumeAction;
            suspendedActionView = null;
          } else {
            activeShotView = null;
            restoreOrbitCamera(pocketView);
          }
        };
        const makeActionCameraView = (
          cueBall,
          targetId,
          followView,
          railNormal,
          { longShot = false, travelDistance = 0 } = {}
        ) => {
          if (!cueBall) return null;
          const ballsList = ballsRef.current || [];
          const targetBall =
            targetId != null
              ? ballsList.find((b) => b.id === targetId) || null
              : null;
          const orbitSnapshot = followView?.orbitSnapshot
            ? {
                radius: followView.orbitSnapshot.radius,
                phi: followView.orbitSnapshot.phi,
                theta: followView.orbitSnapshot.theta
              }
            : null;
          const baseAxis =
            railNormal && Math.abs(railNormal.x) > Math.abs(railNormal.y)
              ? 'side'
              : 'short';
          const nearRailThresholdX = RAIL_LIMIT_X - RAIL_NEAR_BUFFER;
          const nearRailThresholdY = RAIL_LIMIT_Y - RAIL_NEAR_BUFFER;
          const cueNearRail =
            Math.abs(cueBall.pos.x) > nearRailThresholdX ||
            Math.abs(cueBall.pos.y) > nearRailThresholdY;
          const targetNearRail = targetBall
            ? Math.abs(targetBall.pos.x) > nearRailThresholdX ||
              Math.abs(targetBall.pos.y) > nearRailThresholdY
            : false;
          const axis = longShot || cueNearRail || targetNearRail ? 'short' : baseAxis;
          const initialRailDir =
            axis === 'side'
              ? signed(
                  railNormal?.x ?? cueBall.pos.x ?? cueBall.launchDir?.x ?? 1
                )
              : signed(
                  cueBall.pos.y ??
                    cueBall.launchDir?.y ??
                    railNormal?.y ??
                    1
                );
          const now = performance.now();
          const activationDelay = longShot
            ? now + LONG_SHOT_ACTIVATION_DELAY_MS
            : null;
          const activationTravel = longShot
            ? Math.max(
                BALL_R * 12,
                Math.min(travelDistance * 0.5, LONG_SHOT_ACTIVATION_TRAVEL)
              )
            : 0;
          return {
            mode: 'action',
            cueId: cueBall.id,
            targetId: targetId ?? null,
            stage: targetId ? 'pair' : 'followCue',
            resume: followView ?? null,
            orbitSnapshot,
            lastUpdate: now,
            smoothedPos: null,
            smoothedTarget: null,
            targetLastPos: targetBall
              ? new THREE.Vector2(targetBall.pos.x, targetBall.pos.y)
              : null,
            holdUntil: null,
            hitConfirmed: false,
            lastCueDir: cueBall.vel.clone(),
            cueLookAhead: longShot ? BALL_R * 9 : BALL_R * 6,
            axis,
            railDir: initialRailDir,
            hasSwitchedRail: false,
            railNormal: railNormal ? railNormal.clone() : null,
            longShot,
            travelDistance,
            activationDelay,
            activationTravel,
            pendingActivation: longShot,
            startCuePos: new THREE.Vector2(cueBall.pos.x, cueBall.pos.y),
            targetInitialPos: targetBall
              ? new THREE.Vector2(targetBall.pos.x, targetBall.pos.y)
              : null
          };
        };
        const makePocketCameraView = (ballId, followView, options = {}) => {
          if (!followView) return null;
          const { forceEarly = false } = options;
          if (forceEarly && shotPrediction?.ballId !== ballId) return null;
          const ballsList = ballsRef.current || [];
          const targetBall = ballsList.find((b) => b.id === ballId);
          if (!targetBall) return null;
          const dir = targetBall.vel.clone();
          if (dir.lengthSq() < 1e-6 && shotPrediction?.ballId === ballId) {
            dir.copy(shotPrediction.dir ?? new THREE.Vector2());
          }
          if (dir.lengthSq() < 1e-6) return null;
          dir.normalize();
          const centers = pocketCenters();
          const pos = targetBall.pos.clone();
          let best = null;
          let bestScore = -Infinity;
          for (const center of centers) {
            const toPocket = center.clone().sub(pos);
            const dist = toPocket.length();
            if (dist < BALL_R * 1.5) continue;
            const pocketDir = toPocket.clone().normalize();
            const score = pocketDir.dot(dir);
            if (score > bestScore) {
              bestScore = score;
              best = { center, dist, pocketDir };
            }
          }
          if (!best || bestScore < POCKET_CAM.dotThreshold) return null;
          const predictedTravelForBall =
            shotPrediction?.ballId === ballId
              ? shotPrediction?.travel ?? null
              : null;
          if (
            (predictedTravelForBall != null &&
              predictedTravelForBall < SHORT_SHOT_CAMERA_DISTANCE) ||
            best.dist < SHORT_SHOT_CAMERA_DISTANCE
          ) {
            return null;
          }
          const anchorPocketId = pocketIdFromCenter(best.center);
          const approachDir = best.pocketDir.clone();
          const anchorId = resolvePocketCameraAnchor(
            anchorPocketId,
            best.center,
            approachDir,
            pos
          );
          const anchorOutward = getPocketCameraOutward(anchorId);
          const isSidePocket = anchorPocketId === 'TM' || anchorPocketId === 'BM';
          const forcedEarly = forceEarly && shotPrediction?.ballId === ballId;
          if (best.dist > POCKET_CAM.triggerDist && !forcedEarly) return null;
          const baseHeightOffset = POCKET_CAM.heightOffset;
          const heightOffset = isSidePocket
            ? baseHeightOffset * 0.92
            : baseHeightOffset;
          const railDir = isSidePocket
            ? signed(best.center.x, 1)
            : signed(best.center.y, 1);
          const lateralSign = isSidePocket
            ? signed(best.center.y, 1)
            : signed(best.center.x, 1);
          const fallbackOutward = isSidePocket
            ? new THREE.Vector2(-railDir, -lateralSign * 0.45).normalize()
            : new THREE.Vector2(-lateralSign * 0.45, -railDir).normalize();
          const resumeOrbit = followView?.orbitSnapshot
            ? {
                radius: followView.orbitSnapshot.radius,
                phi: followView.orbitSnapshot.phi,
                theta: followView.orbitSnapshot.theta
              }
            : null;
          const now = performance.now();
          const effectiveDist = forcedEarly
            ? Math.min(best.dist, POCKET_CAM.triggerDist)
            : best.dist;
          const predictedAlignment =
            shotPrediction?.ballId === ballId && shotPrediction?.dir
              ? shotPrediction.dir.clone().normalize().dot(best.pocketDir)
              : null;
          const cameraDistance = THREE.MathUtils.clamp(
            effectiveDist * POCKET_CAM.distanceScale,
            POCKET_CAM.minOutside,
            POCKET_CAM.maxOutside
          );
          return {
            mode: 'pocket',
            ballId,
            pocketId: anchorPocketId,
            pocketCenter: best.center.clone(),
            approach: approachDir,
            heightOffset,
            heightScale: POCKET_CAM.heightScale,
            lastBallPos: pos.clone(),
            score: bestScore,
            resume: followView,
            resumeOrbit,
            startedAt: now,
            holdUntil: now + POCKET_VIEW_MIN_DURATION_MS,
            completed: false,
            isSidePocket,
            anchorType: isSidePocket ? 'side' : 'short',
            railDir,
            anchorId: anchorId ?? anchorPocketId,
            anchorOutward:
              anchorOutward?.normalize() ?? fallbackOutward,
            cameraDistance,
            lastRailHitAt: targetBall.lastRailHitAt ?? null,
            lastRailHitType: targetBall.lastRailHitType ?? null,
            predictedAlignment,
            forcedEarly
          };
        };
        const fit = (m = STANDING_VIEW.margin) => {
          camera.aspect = host.clientWidth / host.clientHeight;
          const standingRadiusRaw = fitRadius(camera, m);
          const cueBase = clampOrbitRadius(BREAK_VIEW.radius);
          const playerRadiusBase = Math.max(standingRadiusRaw, cueBase);
          const broadcastRadius =
            playerRadiusBase * BROADCAST_DISTANCE_MULTIPLIER +
            BROADCAST_RADIUS_PADDING;
          const standingRadius = clamp(
            broadcastRadius,
            CAMERA.minR,
            CAMERA.maxR
          );
          const standingPhi = THREE.MathUtils.clamp(
            STANDING_VIEW.phi,
            CAMERA.minPhi,
            CAMERA.maxPhi - CAMERA_RAIL_SAFETY
          );
          const cueRadius = clampOrbitRadius(
            Math.max(
              playerRadiusBase * CUE_VIEW_RADIUS_RATIO,
              CUE_VIEW_MIN_RADIUS
            )
          );
          const cuePhi = THREE.MathUtils.clamp(
            CUE_VIEW_MIN_PHI + CUE_VIEW_PHI_LIFT * 0.5,
            CAMERA.minPhi,
            CAMERA.maxPhi - CAMERA_RAIL_SAFETY
          );
          cameraBoundsRef.current = {
            cueShot: { phi: cuePhi, radius: cueRadius },
            standing: { phi: standingPhi, radius: standingRadius }
          };
          applyCameraBlend();
          orbitRadiusLimitRef.current = standingRadius;
          const cushionLimit = Math.max(
            TABLE.THICK * 0.5,
            (cushionHeightRef.current ?? TABLE.THICK) + CAMERA_CUSHION_CLEARANCE
          );
          const phiCap = Math.acos(
            THREE.MathUtils.clamp(cushionLimit / sph.radius, -1, 1)
          );
          if (sph.phi > phiCap) {
            sph.phi = Math.max(CAMERA.minPhi, phiCap);
            syncBlendToSpherical();
          }
          updateCamera();
          camera.updateProjectionMatrix();
        };
        cameraRef.current = camera;
        sphRef.current = sph;
        fitRef.current = fit;
        topViewRef.current = false;
        setTopView(false);
        const margin = Math.max(
          STANDING_VIEW.margin,
          topViewRef.current
            ? 1.05
            : window.innerHeight > window.innerWidth
              ? 1.45
              : 1.32
        );
        fit(margin);
        syncBlendToSpherical();
        setOrbitFocusToDefault();
        orbitRadiusLimitRef.current = sph.radius;
        if (!initialOrbitRef.current) {
          initialOrbitRef.current = {
            radius: sph.radius,
            phi: sph.phi,
            theta: sph.theta
          };
        }
        const dom = renderer.domElement;
        dom.style.touchAction = 'none';
        const balls = [];
        let project;
        const clampSpinToLimits = () => {
          const limits = spinLimitsRef.current || DEFAULT_SPIN_LIMITS;
          const current = spinRef.current || { x: 0, y: 0 };
          const clamped = {
            x: clamp(current.x ?? 0, limits.minX, limits.maxX),
            y: clamp(current.y ?? 0, limits.minY, limits.maxY)
          };
          spinRef.current = clamped;
          return clamped;
        };
        const applySpinConstraints = (aimVec, updateUi = false) => {
          const cueBall = cueRef.current || cue;
          let legality = spinLegalityRef.current || { blocked: false, reason: '' };
          const ballsList = ballsRef.current?.length ? ballsRef.current : balls;
          if (cueBall && aimVec) {
            const axes = prepareSpinAxes(aimVec);
            const activeCamera = activeRenderCameraRef.current ?? camera;
            const viewVec = computeCueViewVector(cueBall, activeCamera);
            spinLimitsRef.current = computeSpinLimits(cueBall, aimVec, balls, axes);
            const requested = spinRequestRef.current || spinRef.current || {
              x: 0,
              y: 0
            };
            legality = checkSpinLegality2D(cueBall, requested, ballsList, {
              axes,
              view: viewVec
                ? { x: viewVec.x, y: viewVec.y }
                : null
            });
            spinLegalityRef.current = legality;
          }
          const applied = clampSpinToLimits();
          if (updateUi) {
            updateSpinDotPosition(applied, legality.blocked);
          }
          const result = legality.blocked ? { x: 0, y: 0 } : applied;
          const magnitude = Math.hypot(result.x ?? 0, result.y ?? 0);
          const mode = magnitude >= SWERVE_THRESHOLD ? 'swerve' : 'standard';
          spinAppliedRef.current = { ...result, magnitude, mode };
          return result;
        };
        const drag = { on: false, x: 0, y: 0, moved: false };
        let lastInteraction = performance.now();
        const registerInteraction = () => {
          lastInteraction = performance.now();
        };
        const down = (e) => {
          registerInteraction();
          if (e.touches?.length === 2) return;
          if (topViewRef.current) return;
          drag.on = true;
          drag.moved = false;
          drag.x = e.clientX || e.touches?.[0]?.clientX || 0;
          drag.y = e.clientY || e.touches?.[0]?.clientY || 0;
        };
        const move = (e) => {
          if (topViewRef.current || !drag.on) return;
          const x = e.clientX || e.touches?.[0]?.clientX || drag.x;
          const y = e.clientY || e.touches?.[0]?.clientY || drag.y;
          const dx = x - drag.x;
          const dy = y - drag.y;
          if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
          if (drag.moved) {
            drag.x = x;
            drag.y = y;
            const blend = THREE.MathUtils.clamp(
              cameraBlendRef.current ?? 1,
              0,
              1
            );
            const precisionScale = THREE.MathUtils.lerp(
              CUE_VIEW_AIM_SLOW_FACTOR,
              1,
              blend
            );
            sph.theta -= dx * 0.0035 * precisionScale;
            const phiRange = CAMERA.maxPhi - CAMERA.minPhi;
            const phiDelta = dy * 0.0025 * precisionScale;
            const blendDelta =
              phiRange > 1e-5 ? phiDelta / phiRange : 0;
            applyCameraBlend(cameraBlendRef.current - blendDelta);
            updateCamera();
            registerInteraction();
          }
        };
        const up = (e) => {
          registerInteraction();
          const moved = drag.moved;
          drag.on = false;
          drag.moved = false;
          if (
            !moved &&
            !topViewRef.current &&
            !hud.inHand &&
            !shooting
          ) {
            if (e?.button !== undefined && e.button !== 0) return;
            pickOrbitFocus(e);
          }
        };
        dom.addEventListener('mousedown', down);
        dom.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        dom.addEventListener('touchstart', down, { passive: true });
        dom.addEventListener('touchmove', move, { passive: true });
        window.addEventListener('touchend', up);
        const keyRot = (e) => {
          if (topViewRef.current) return;
          const step = e.shiftKey ? 0.08 : 0.035;
          if (e.code === 'ArrowLeft') {
            sph.theta += step;
          } else if (e.code === 'ArrowRight') {
            sph.theta -= step;
          } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
            const phiRange = CAMERA.maxPhi - CAMERA.minPhi;
            const dir = e.code === 'ArrowUp' ? -1 : 1;
            const blendDelta =
              phiRange > 1e-5 ? (step * dir) / phiRange : 0;
            applyCameraBlend(cameraBlendRef.current - blendDelta);
          } else return;
          registerInteraction();
          updateCamera();
        };
        window.addEventListener('keydown', keyRot);

      // Lights
      // Adopt the lighting rig from the standalone snooker demo and scale all
      // authored coordinates so they sit correctly over the larger table.
      const addMobileLighting = () => {
        const lightingRig = new THREE.Group();
        world.add(lightingRig);

        const tableSurfaceY = TABLE_Y - TABLE.THICK + 0.01;
        const SAMPLE_PLAY_W = 1.216;
        const SAMPLE_PLAY_H = 2.536;
        const SAMPLE_TABLE_HEIGHT = 0.75;

        const LIGHT_DIMENSION_SCALE = 0.8; // reduce fixture footprint by 20%
        const LIGHT_HEIGHT_SCALE = 1.4; // lift the rig further above the table
        const LIGHT_HEIGHT_LIFT_MULTIPLIER = 5.8; // bring fixtures closer so the spot highlight reads on the balls
        const LIGHT_LATERAL_SCALE = 0.45; // pull shadow-casting lights nearer the table centre

        const baseWidthScale = (PLAY_W / SAMPLE_PLAY_W) * LIGHT_DIMENSION_SCALE;
        const baseLengthScale = (PLAY_H / SAMPLE_PLAY_H) * LIGHT_DIMENSION_SCALE;
        const fixtureScale = Math.max(baseWidthScale, baseLengthScale);
        const heightScale = Math.max(0.001, TABLE_H / SAMPLE_TABLE_HEIGHT);
        const scaledHeight = heightScale * LIGHT_HEIGHT_SCALE;

        const hemisphere = new THREE.HemisphereLight(0xdde7ff, 0x0b1020, 0.85);
        const lightHeightLift = scaledHeight * LIGHT_HEIGHT_LIFT_MULTIPLIER; // lift the lighting rig higher above the table
        const triangleHeight = tableSurfaceY + 6.6 * scaledHeight + lightHeightLift;
        const triangleRadius = fixtureScale * 0.98;
        hemisphere.position.set(0, triangleHeight, -triangleRadius * 0.6);
        lightingRig.add(hemisphere);

        const hemisphereRig = new THREE.HemisphereLight(0xdde7ff, 0x0b1020, 0.48);
        hemisphereRig.position.set(0, triangleHeight, 0);
        lightingRig.add(hemisphereRig);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.12);
        dirLight.position.set(
          -triangleRadius * LIGHT_LATERAL_SCALE,
          triangleHeight,
          triangleRadius * LIGHT_LATERAL_SCALE * 0.4
        );
        dirLight.target.position.set(0, tableSurfaceY + BALL_R * 0.05, 0);
        lightingRig.add(dirLight);
        lightingRig.add(dirLight.target);

        const spot = new THREE.SpotLight(
          0xffffff,
          18,
          0,
          Math.PI * 0.36,
          0.42,
          1
        );
        spot.position.set(
          triangleRadius * LIGHT_LATERAL_SCALE,
          triangleHeight,
          triangleRadius * LIGHT_LATERAL_SCALE * 0.35
        );
        spot.target.position.set(0, tableSurfaceY + TABLE_H * 0.18, 0);
        spot.decay = 1.0;
        spot.castShadow = true;
        spot.shadow.mapSize.set(2048, 2048);
        spot.shadow.bias = -0.00004;
        spot.shadow.normalBias = 0.006;
        lightingRig.add(spot);
        lightingRig.add(spot.target);

        const ambient = new THREE.AmbientLight(0xffffff, 0.025);
        ambient.position.set(
          0,
          tableSurfaceY + scaledHeight * 1.95 + lightHeightLift,
          0
        );
        lightingRig.add(ambient);
      };

      addMobileLighting();

      // Table
      const {
        centers,
        baulkZ,
        group: table,
        clothMat: tableCloth,
        cushionMat: tableCushion
      } = Table3D(world);
      clothMat = tableCloth;
      cushionMat = tableCushion;
      if (table?.userData) {
        const cushionLip = table.userData.cushionTopLocal ?? TABLE.THICK;
        cushionHeightRef.current = Math.max(TABLE.THICK + 0.1, cushionLip - 0.02);
      }
      // ensure the camera respects the configured zoom limits
      sph.radius = clampOrbitRadius(sph.radius);
      worldScaleFactor = WORLD_SCALE;
      world.scale.setScalar(worldScaleFactor);
      world.updateMatrixWorld(true);
      updateCamera();
      fit(
        topViewRef.current
          ? 1.05
          : window.innerHeight > window.innerWidth
            ? 1.6
            : 1.4
      );

      // Balls (ONLY Guret)
      const add = (id, color, x, z) => {
        const b = Guret(table, id, color, x, z);
        balls.push(b);
        return b;
      };
      cue = add('cue', COLORS.cue, -BALL_R * 2, baulkZ);
      const SPOTS = spotPositions(baulkZ);

      // 15 red balls arranged in triangle behind the pink
      const startZ = SPOTS.pink[1] + BALL_R * 2;
      let rid = 0;
      for (let row = 0; row < 5; row++) {
        for (let i = 0; i <= row; i++) {
          if (rid >= 15) break;
          const x = (i - row / 2) * (BALL_R * 2 + 0.002 * (BALL_R / 0.0525));
          const z = startZ + row * (BALL_R * 1.9);
          add(`red_${rid++}`, COLORS.red, x, z);
        }
      }

      // colours
      const colors = Object.fromEntries(
        Object.entries(SPOTS).map(([k, [x, z]]) => [k, add(k, COLORS[k], x, z)])
      );

      cueRef.current = cue;
      ballsRef.current = balls;

      // Aiming visuals
      const aimMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2,
        transparent: true,
        opacity: 0.9
      });
      const aimGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const aim = new THREE.Line(aimGeom, aimMat);
      aim.visible = false;
      table.add(aim);
      const tickGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const tick = new THREE.Line(
        tickGeom,
        new THREE.LineBasicMaterial({ color: 0xffffff })
      );
      tick.visible = false;
      table.add(tick);

      const targetGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const target = new THREE.Line(
        targetGeom,
        new THREE.LineDashedMaterial({
          color: 0xffffff,
          dashSize: 1,
          gapSize: 1,
          transparent: true,
          opacity: 0.5
        })
      );
      target.visible = false;
      table.add(target);

      // Cue stick behind cueball
      const SCALE = BALL_R / 0.0525;
      const cueLen = 1.5 * SCALE;
      const cueStick = new THREE.Group();
      const cueBody = new THREE.Group();
      cueStick.add(cueBody);
      cueStick.userData.body = cueBody;
      cueBodyRef.current = cueBody;
      const buttLift = Math.min(CUE_BUTT_LIFT, cueLen);
      const buttTilt = Math.asin(
        Math.min(1, buttLift / Math.max(cueLen, 1e-4))
      );
      const buttTipComp = Math.sin(buttTilt) * cueLen * 0.5;
      const applyCueButtTilt = (group, extraTilt = 0) => {
        if (!group) return;
        const info = group.userData?.buttTilt;
        const baseTilt = info?.angle ?? buttTilt;
        const len = info?.length ?? cueLen;
        const totalTilt = baseTilt + extraTilt;
        group.rotation.x = totalTilt;
        const tipComp = Math.sin(totalTilt) * len * 0.5;
        group.position.y += tipComp;
        if (info) {
          info.tipCompensation = tipComp;
          info.current = totalTilt;
          info.extra = extraTilt;
        }
      };
      cueStick.userData.buttTilt = {
        angle: buttTilt,
        tipCompensation: buttTipComp,
        length: cueLen
      };

      const shaftMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xdeb887,
        roughness: 0.6
      });
      const frontLength = THREE.MathUtils.clamp(
        cueLen * CUE_FRONT_SECTION_RATIO,
        cueLen * 0.1,
        cueLen * 0.5
      );
      const rearLength = Math.max(cueLen - frontLength, 1e-4);
      const tipShaftRadius = 0.008 * SCALE;
      const buttShaftRadius = 0.025 * SCALE;
      const joinRadius = THREE.MathUtils.lerp(
        tipShaftRadius,
        buttShaftRadius,
        THREE.MathUtils.clamp(frontLength / Math.max(cueLen, 1e-4), 0, 1)
      );

      const rearShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(joinRadius, buttShaftRadius, rearLength, 32),
        shaftMaterial
      );
      rearShaft.rotation.x = -Math.PI / 2;
      rearShaft.position.z = frontLength / 2;
      cueBody.add(rearShaft);

      // group for tip & front shaft so the whole thin end moves for spin
      const tipGroup = new THREE.Group();
      tipGroup.position.z = -cueLen / 2;
      cueBody.add(tipGroup);
      tipGroupRef.current = tipGroup;

      if (frontLength > 1e-4) {
        const frontShaft = new THREE.Mesh(
          new THREE.CylinderGeometry(tipShaftRadius, joinRadius, frontLength, 32),
          shaftMaterial
        );
        frontShaft.rotation.x = -Math.PI / 2;
        frontShaft.position.z = frontLength / 2;
        tipGroup.add(frontShaft);
      }

      // subtle leather-like texture for the tip
      const tipCanvas = document.createElement('canvas');
      tipCanvas.width = tipCanvas.height = 64;
      const tipCtx = tipCanvas.getContext('2d');
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
      const tipTex = new THREE.CanvasTexture(tipCanvas);

      const connectorHeight = 0.015 * SCALE;
      const tipRadius = CUE_TIP_RADIUS;
      const tipLen = 0.015 * SCALE * 1.5;
      const tipCylinderLen = Math.max(0, tipLen - tipRadius * 2);
      const tip = new THREE.Mesh(
        tipCylinderLen > 0
          ? new THREE.CapsuleGeometry(tipRadius, tipCylinderLen, 8, 16)
          : new THREE.SphereGeometry(tipRadius, 16, 16),
        new THREE.MeshStandardMaterial({
          color: 0x1f3f73,
          roughness: 1,
          metalness: 0,
          map: tipTex
        })
      );
      tip.rotation.x = -Math.PI / 2;
      tip.position.z = -(tipCylinderLen / 2 + tipRadius + connectorHeight);
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

      const buttCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.03 * SCALE, 32, 16),
        new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.5 })
      );
      buttCap.position.z = cueLen / 2;
      cueBody.add(buttCap);

      const stripeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      for (let i = 0; i < 12; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.01 * SCALE, 0.001 * SCALE, 0.35 * SCALE),
          stripeMat
        );
        const angle = (i / 12) * Math.PI * 2;
        stripe.position.x = Math.cos(angle) * 0.02 * SCALE;
        stripe.position.y = Math.sin(angle) * 0.02 * SCALE;
        stripe.position.z = 0.55 * SCALE;
        stripe.rotation.z = angle;
        cueBody.add(stripe);
      }

      cueStick.position.set(cue.pos.x, CUE_Y, cue.pos.y + 1.2 * SCALE);
      applyCueButtTilt(cueStick);
      // thin side already faces the cue ball so no extra rotation
      cueStick.visible = false;
      table.add(cueStick);

      spinRangeRef.current = {
        side: MAX_SPIN_SIDE,
        forward: MAX_SPIN_FORWARD,
        offsetSide: MAX_SPIN_CONTACT_OFFSET,
        offsetVertical: MAX_SPIN_VERTICAL
      };

      // Pointer → XZ plane
      const pointer = new THREE.Vector2();
      const ray = new THREE.Raycaster();
      const plane = new THREE.Plane(
        new THREE.Vector3(0, 1, 0),
        -TABLE_Y * worldScaleFactor
      );
      project = (ev) => {
        const r = dom.getBoundingClientRect();
        const cx =
          (((ev.clientX ?? ev.touches?.[0]?.clientX ?? 0) - r.left) / r.width) *
            2 -
          1;
        const cy = -(
          (((ev.clientY ?? ev.touches?.[0]?.clientY ?? 0) - r.top) / r.height) *
            2 -
          1
        );
        pointer.set(cx, cy);
        const activeCamera = activeRenderCameraRef.current ?? camera;
        ray.setFromCamera(pointer, activeCamera);
        const pt = new THREE.Vector3();
        ray.ray.intersectPlane(plane, pt);
        return new THREE.Vector2(
          pt.x / worldScaleFactor,
          pt.z / worldScaleFactor
        );
      };

      const pickOrbitFocus = (ev) => {
        if (hud.inHand || shooting) return;
        const rect = dom.getBoundingClientRect();
        const clientX =
          ev?.clientX ?? ev?.changedTouches?.[0]?.clientX ?? drag.x;
        const clientY =
          ev?.clientY ?? ev?.changedTouches?.[0]?.clientY ?? drag.y;
        if (clientX == null || clientY == null) return;
        if (
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          return;
        }
        const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
        pointer.set(nx, ny);
        const currentCamera = activeRenderCameraRef.current ?? camera;
        ray.setFromCamera(pointer, currentCamera);
        const ballsList =
          ballsRef.current?.length > 0 ? ballsRef.current : balls;
        const intersects = ray.intersectObjects(
          ballsList.map((b) => b.mesh),
          true
        );
        if (intersects.length > 0) {
          let obj = intersects[0].object;
          let ballId = obj.userData?.ballId;
          while (!ballId && obj.parent) {
            obj = obj.parent;
            ballId = obj.userData?.ballId;
          }
          if (ballId) {
            const ball = ballsList.find((b) => b.id === ballId);
            if (ball) {
              setOrbitFocusToBall(ball);
              return;
            }
          }
        }
        setOrbitFocusToDefault();
      };

      const aimDir = aimDirRef.current;
      const camFwd = new THREE.Vector3();
      const shotSph = new THREE.Spherical();
      const tmpAim = new THREE.Vector2();

      // In-hand placement
      const free = (x, z) =>
        balls.every(
          (b) =>
            !b.active ||
            b === cue ||
            new THREE.Vector2(x, z).distanceTo(b.pos) > BALL_R * 2.1
        );
      const onPlace = (e) => {
        if (!hud.inHand) return;
        const p = project(e);
        if (
          p.y <= baulkZ &&
          Math.abs(p.x) <= PLAY_W / 2 - BALL_R * 2 &&
          free(p.x, p.y)
        ) {
          cue.active = true;
          cue.mesh.visible = true;
          cue.pos.set(p.x, p.y);
          cue.mesh.position.set(p.x, BALL_CENTER_Y, p.y);
          setHud((s) => ({ ...s, inHand: false }));
        }
      };
      dom.addEventListener('pointerdown', onPlace);

      // Shot lifecycle
      let potted = [];
      let firstHit = null;

      const alignStandingCameraToAim = (cueBall, aimDir) => {
        if (!cueBall || !aimDir) return;
        const dir = aimDir.clone();
        if (dir.lengthSq() < 1e-6) return;
        dir.normalize();
        const sph = sphRef.current;
        if (!sph) return;
        const standingBounds = cameraBoundsRef.current?.standing;
        if (standingBounds) {
          sph.radius = clampOrbitRadius(standingBounds.radius);
          sph.phi = THREE.MathUtils.clamp(
            standingBounds.phi,
            CAMERA.minPhi,
            CAMERA.maxPhi
          );
        }
        const aimTheta = Math.atan2(dir.x, dir.y) + Math.PI;
        sph.theta = aimTheta;
        syncBlendToSpherical();
        const focusStore = ensureOrbitFocus();
        const focusDistance = Math.max(
          BALL_R * 28,
          Math.min(LONG_SHOT_DISTANCE, PLAY_H * 0.5)
        );
        const focusTarget = new THREE.Vector3(
          THREE.MathUtils.clamp(
            cueBall.pos.x + dir.x * focusDistance,
            -PLAY_W / 2,
            PLAY_W / 2
          ),
          BALL_CENTER_Y,
          THREE.MathUtils.clamp(
            cueBall.pos.y + dir.y * focusDistance,
            -PLAY_H / 2,
            PLAY_H / 2
          )
        );
        focusStore.ballId = cueBall.id ?? null;
        focusStore.target.copy(focusTarget);
        lastCameraTargetRef.current.copy(
          focusTarget.clone().multiplyScalar(worldScaleFactor)
        );
      };

      // Fire (slider e thërret në release)
      const fire = () => {
        if (!cue?.active || hud.inHand || !allStopped(balls) || hud.over)
          return;
        alignStandingCameraToAim(cue, aimDirRef.current);
        applyCameraBlend(1);
        updateCamera();
        shooting = true;
          activeShotView = null;
          aimFocusRef.current = null;
          potted = [];
          firstHit = null;
          clearInterval(timerRef.current);
          const aimDir = aimDirRef.current.clone();
          const prediction = calcTarget(cue, aimDir.clone(), balls);
          const predictedTravelRaw = prediction.targetBall
            ? cue.pos.distanceTo(prediction.targetBall.pos)
            : prediction.tHit;
          const predictedTravel = Number.isFinite(predictedTravelRaw)
            ? predictedTravelRaw
            : 0;
          const isShortShot =
            predictedTravel > 0 &&
            predictedTravel < SHORT_SHOT_CAMERA_DISTANCE;
          const isLongShot = predictedTravel > LONG_SHOT_DISTANCE;
          shotPrediction = {
            ballId: prediction.targetBall?.id ?? null,
            dir: prediction.afterDir ? prediction.afterDir.clone() : null,
            impact: prediction.impact
              ? new THREE.Vector2(prediction.impact.x, prediction.impact.y)
              : null,
            railNormal: prediction.railNormal
              ? prediction.railNormal.clone()
              : null,
            travel: predictedTravel,
            longShot: isLongShot,
            targetInitialPos: prediction.targetBall
              ? prediction.targetBall.pos.clone()
              : null
          };
          const intentTimestamp = performance.now();
          if (shotPrediction.ballId && !isShortShot) {
            const isDirectHit =
              shotPrediction.railNormal === null || shotPrediction.railNormal === undefined;
            pocketSwitchIntentRef.current = {
              ballId: shotPrediction.ballId,
              allowEarly: isDirectHit,
              forced: isDirectHit,
              createdAt: intentTimestamp
            };
          } else {
            pocketSwitchIntentRef.current = null;
          }
          lastPocketBallRef.current = null;
          const clampedPower = THREE.MathUtils.clamp(powerRef.current, 0, 1);
          const powerScale = SHOT_MIN_FACTOR + SHOT_POWER_RANGE * clampedPower;
          const base = aimDir
            .clone()
            .multiplyScalar(SHOT_BASE_SPEED * powerScale);
          const predictedCueSpeed = base.length();
          shotPrediction.speed = predictedCueSpeed;
          const allowLongShotCameraSwitch =
            !isShortShot &&
            (!isLongShot || predictedCueSpeed <= LONG_SHOT_SPEED_SWITCH_THRESHOLD);
          const orbitSnapshot = sphRef.current
            ? {
                radius: sphRef.current.radius,
                phi: sphRef.current.phi,
                theta: sphRef.current.theta
              }
            : null;
          const standingBounds = cameraBoundsRef.current?.standing;
          const followView = standingBounds
            ? {
                orbitSnapshot: {
                  radius: clampOrbitRadius(
                    standingBounds.radius ?? sphRef.current?.radius ?? BREAK_VIEW.radius
                  ),
                  phi: THREE.MathUtils.clamp(
                    standingBounds.phi,
                    CAMERA.minPhi,
                    CAMERA.maxPhi
                  ),
                  theta: sphRef.current?.theta ?? 0
                }
              }
            : orbitSnapshot
              ? { orbitSnapshot }
              : null;
          const actionView = allowLongShotCameraSwitch
            ? makeActionCameraView(
                cue,
                shotPrediction.ballId,
                followView,
                shotPrediction.railNormal,
                {
                  longShot: isLongShot,
                  travelDistance: predictedTravel
                }
              )
            : null;
          if (actionView) {
            if (cameraRef.current) {
              actionView.smoothedPos = cameraRef.current.position.clone();
              const storedTarget = lastCameraTargetRef.current?.clone();
              if (storedTarget) actionView.smoothedTarget = storedTarget;
            }
            if (isLongShot) {
              suspendedActionView = actionView;
            } else {
              suspendedActionView = null;
              activeShotView = actionView;
              updateCamera();
            }
          }
          const appliedSpin = applySpinConstraints(aimDir, true);
          const ranges = spinRangeRef.current || {};
          const spinSide = appliedSpin.x * (ranges.side ?? 0);
          const spinTop = -appliedSpin.y * (ranges.forward ?? 0);
          const perp = new THREE.Vector2(-aimDir.y, aimDir.x);
          cue.vel.copy(base);
          if (cue.spin) {
            cue.spin.set(
              perp.x * spinSide + aimDir.x * spinTop,
              perp.y * spinSide + aimDir.y * spinTop
            );
          }
          if (cue.pendingSpin) cue.pendingSpin.set(0, 0);
          cue.spinMode =
            spinAppliedRef.current?.mode === 'swerve' ? 'swerve' : 'standard';
          resetSpinRef.current?.();
          cue.impacted = false;
          cue.launchDir = aimDir.clone().normalize();

          if (cameraRef.current && sphRef.current) {
            topViewRef.current = false;
            const sph = sphRef.current;
            const bounds = cameraBoundsRef.current;
            const standingView = bounds?.standing;
            if (standingView) {
              sph.radius = clampOrbitRadius(standingView.radius);
              sph.phi = THREE.MathUtils.clamp(
                standingView.phi,
                CAMERA.minPhi,
                CAMERA.maxPhi
              );
              syncBlendToSpherical();
            }
            updateCamera();
          }

          // animate cue stick forward
          const dir = new THREE.Vector3(aimDir.x, 0, aimDir.y).normalize();
          const backInfo = calcTarget(
            cue,
            aimDir.clone().multiplyScalar(-1),
            balls
          );
          const rawMaxPull = Math.max(0, backInfo.tHit - cueLen - CUE_TIP_GAP);
          const maxPull = Number.isFinite(rawMaxPull) ? rawMaxPull : CUE_PULL_BASE;
          const pull = Math.min(maxPull, CUE_PULL_BASE) * clampedPower;
          cueAnimating = true;
          const startPos = cueStick.position.clone();
          const endPos = startPos.clone().add(dir.clone().multiplyScalar(pull));
          let animFrame = 0;
          const animSteps = 5;
          const animateCue = () => {
            animFrame++;
            cueStick.position.lerpVectors(
              startPos,
              endPos,
              animFrame / animSteps
            );
            if (animFrame < animSteps) {
              requestAnimationFrame(animateCue);
            } else {
              let backFrame = 0;
              const animateBack = () => {
                backFrame++;
                cueStick.position.lerpVectors(
                  endPos,
                  startPos,
                  backFrame / animSteps
                );
                if (backFrame < animSteps) requestAnimationFrame(animateBack);
                else {
                  cueStick.visible = false;
                  cueAnimating = false;
                  if (cameraRef.current && sphRef.current) {
                    topViewRef.current = false;
                    const sph = sphRef.current;
                    sph.theta = Math.atan2(aimDir.x, aimDir.y) + Math.PI;
                    updateCamera();
                  }
                }
              };
              requestAnimationFrame(animateBack);
            }
          };
          animateCue();
        };
        fireRef.current = fire;

      // Resolve shot
      function resolve() {
        const shotEvents = [];
        const firstContactColor = toBallColorId(firstHit);
        shotEvents.push({ type: 'HIT', firstContact: firstContactColor });
        potted.forEach((entry) => {
          const pocket = entry.pocket ?? 'TM';
          shotEvents.push({
            type: 'POTTED',
            ball: entry.color,
            pocket
          });
        });
        const currentState = frameRef.current ?? frameState;
        const nextState = rules.applyShot(currentState, shotEvents);
        frameRef.current = nextState;
        setFrameState(nextState);
        const cueBallPotted =
          potted.some((entry) => entry.color === 'CUE') || !cue.active;
        const colourNames = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
        colourNames.forEach((name) => {
          const simBall = colors[name];
          const stateBall = nextState.balls.find(
            (b) => b.color === name.toUpperCase()
          );
          if (!simBall || !stateBall) return;
          if (stateBall.onTable) {
            if (!simBall.active) {
              pocketDropRef.current.delete(simBall.id);
              simBall.mesh.scale.set(1, 1, 1);
              const [sx, sy] = SPOTS[name];
              simBall.active = true;
              simBall.mesh.visible = true;
              simBall.pos.set(sx, sy);
              simBall.mesh.position.set(sx, BALL_CENTER_Y, sy);
              simBall.vel.set(0, 0);
              simBall.spin?.set(0, 0);
              simBall.pendingSpin?.set(0, 0);
              simBall.spinMode = 'standard';
            }
          } else {
            simBall.active = false;
            pocketDropRef.current.delete(simBall.id);
            simBall.mesh.visible = false;
          }
        });
        if (cueBallPotted) {
          cue.active = false;
          pocketDropRef.current.delete(cue.id);
          cue.mesh.visible = false;
          cue.vel.set(0, 0);
          cue.spin?.set(0, 0);
          cue.pendingSpin?.set(0, 0);
          cue.spinMode = 'standard';
          cue.impacted = false;
          cue.launchDir = null;
        }
        setHud((prev) => ({ ...prev, inHand: cueBallPotted }));
        shooting = false;
        shotPrediction = null;
        activeShotView = null;
        suspendedActionView = null;
        pocketSwitchIntentRef.current = null;
        lastPocketBallRef.current = null;
        updatePocketCameraState(false);
          if (cameraRef.current && sphRef.current) {
            const cuePos = cue?.pos
              ? new THREE.Vector2(cue.pos.x, cue.pos.y)
              : new THREE.Vector2();
            const toCenter = new THREE.Vector2(-cuePos.x, -cuePos.y);
            if (toCenter.lengthSq() < 1e-4) toCenter.set(0, 1);
            else toCenter.normalize();
            const behindTheta = Math.atan2(toCenter.x, toCenter.y) + Math.PI;
            const standingView = cameraBoundsRef.current?.standing;
            const behindPhi = clamp(
              standingView?.phi ?? CAMERA.minPhi,
              CAMERA.minPhi,
              CAMERA.maxPhi
            );
            const behindRadius = clampOrbitRadius(
              standingView?.radius ?? BREAK_VIEW.radius
            );
            applyCameraBlend(1);
            animateCamera({
              radius: behindRadius,
              phi: behindPhi,
              theta: behindTheta,
              duration: 600
            });
          }
          potted = [];
          firstHit = null;
        }

      // Loop
      let lastStepTime = performance.now();
      const step = (now) => {
        const rawDelta = Math.max(now - lastStepTime, 0);
        const deltaMs = Math.min(rawDelta, MAX_FRAME_TIME_MS);
        const frameScaleBase = deltaMs / TARGET_FRAME_TIME_MS;
        const frameScale = Math.max(frameScaleBase, MIN_FRAME_SCALE);
        const physicsSubsteps = Math.min(
          MAX_PHYSICS_SUBSTEPS,
          Math.max(1, Math.ceil(frameScale))
        );
        const subStepScale = frameScale / physicsSubsteps;
        lastStepTime = now;
        camera.getWorldDirection(camFwd);
        tmpAim.set(camFwd.x, camFwd.z).normalize();
        aimDir.lerp(tmpAim, 0.2);
        const appliedSpin = applySpinConstraints(aimDir, true);
        const ranges = spinRangeRef.current || {};
        // Aiming vizual
        if (allStopped(balls) && !hud.inHand && cue?.active && !hud.over) {
          const { impact, afterDir, targetBall, railNormal } = calcTarget(
            cue,
            aimDir,
            balls
          );
          const start = new THREE.Vector3(cue.pos.x, BALL_CENTER_Y, cue.pos.y);
          let end = new THREE.Vector3(impact.x, BALL_CENTER_Y, impact.y);
          const dir = new THREE.Vector3(aimDir.x, 0, aimDir.y).normalize();
          if (start.distanceTo(end) < 1e-4) {
            end = start.clone().add(dir.clone().multiplyScalar(BALL_R));
          }
          aimGeom.setFromPoints([start, end]);
          aim.visible = true;
          const targetBallColor = targetBall ? toBallColorId(targetBall.id) : null;
          const legalTargetsRaw =
            frameRef.current?.ballOn ?? frameState.ballOn ?? [];
          const legalTargets = Array.isArray(legalTargetsRaw)
            ? legalTargetsRaw
                .map((entry) =>
                  typeof entry === 'string' ? entry.toUpperCase() : entry
                )
                .filter(Boolean)
            : [];
          const aimingWrong =
            targetBall &&
            !railNormal &&
            targetBallColor &&
            legalTargets.length > 0 &&
            !legalTargets.includes(targetBallColor);
          aim.material.color.set(
            aimingWrong
              ? 0xff3333
              : targetBall && !railNormal
                ? 0xffff00
                : 0xffffff
          );
          const perp = new THREE.Vector3(-dir.z, 0, dir.x);
          tickGeom.setFromPoints([
            end.clone().add(perp.clone().multiplyScalar(1.4)),
            end.clone().add(perp.clone().multiplyScalar(-1.4))
          ]);
          tick.visible = true;
          const desiredPull = powerRef.current * BALL_R * 10 * 0.65 * 1.2;
          const backInfo = calcTarget(
            cue,
            aimDir.clone().multiplyScalar(-1),
            balls
          );
          const maxPull = Math.max(0, backInfo.tHit - cueLen - CUE_TIP_GAP);
          const pull = Math.min(desiredPull, maxPull);
          const side = appliedSpin.x * (ranges.offsetSide ?? 0);
          const vert = -appliedSpin.y * (ranges.offsetVertical ?? 0);
          const spinWorld = new THREE.Vector3(
            perp.x * side,
            vert,
            perp.z * side
          );
          cueStick.position.set(
            cue.pos.x - dir.x * (cueLen / 2 + pull + CUE_TIP_GAP) + spinWorld.x,
            CUE_Y + spinWorld.y,
            cue.pos.y - dir.z * (cueLen / 2 + pull + CUE_TIP_GAP) + spinWorld.z
          );
          const tiltAmount = Math.abs(appliedSpin.y || 0);
          const extraTilt = MAX_BACKSPIN_TILT * tiltAmount;
          applyCueButtTilt(cueStick, extraTilt);
          cueStick.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
          if (tipGroupRef.current) {
            tipGroupRef.current.position.set(0, 0, -cueLen / 2);
          }
          cueStick.visible = true;
          if (afterDir) {
            const tEnd = new THREE.Vector3(
              end.x + afterDir.x * 30,
              BALL_R,
              end.z + afterDir.y * 30
            );
            targetGeom.setFromPoints([end, tEnd]);
            target.visible = true;
            target.computeLineDistances();
          } else {
            target.visible = false;
          }
        } else {
          aimFocusRef.current = null;
          aim.visible = false;
          tick.visible = false;
          target.visible = false;
          if (tipGroupRef.current) {
            tipGroupRef.current.position.set(0, 0, -cueLen / 2);
          }
          if (!cueAnimating) cueStick.visible = false;
        }

        // Fizika
        for (let stepIndex = 0; stepIndex < physicsSubsteps; stepIndex++) {
          const stepScale = subStepScale;
          balls.forEach((b) => {
            if (!b.active) return;
            const isCue = b.id === 'cue';
            const hasSpin = b.spin?.lengthSq() > 1e-6;
            if (hasSpin) {
              const swerveTravel = isCue && b.spinMode === 'swerve' && !b.impacted;
              const allowRoll = !isCue || b.impacted || swerveTravel;
              const preImpact = isCue && !b.impacted;
              if (allowRoll) {
                const rollMultiplier = swerveTravel ? SWERVE_TRAVEL_MULTIPLIER : 1;
                TMP_VEC2_SPIN.copy(b.spin).multiplyScalar(
                  SPIN_ROLL_STRENGTH * rollMultiplier * stepScale
                );
                if (preImpact && b.launchDir && b.launchDir.lengthSq() > 1e-8) {
                  const launchDir = TMP_VEC2_FORWARD.copy(b.launchDir).normalize();
                  const forwardMag = TMP_VEC2_SPIN.dot(launchDir);
                  TMP_VEC2_AXIS.copy(launchDir).multiplyScalar(forwardMag);
                  b.vel.add(TMP_VEC2_AXIS);
                  TMP_VEC2_LATERAL.copy(TMP_VEC2_SPIN).sub(TMP_VEC2_AXIS);
                  if (b.spinMode === 'swerve' && b.pendingSpin) {
                    b.pendingSpin.add(TMP_VEC2_LATERAL);
                  }
                  const alignedSpeed = b.vel.dot(launchDir);
                  TMP_VEC2_AXIS.copy(launchDir).multiplyScalar(alignedSpeed);
                  b.vel.copy(TMP_VEC2_AXIS);
                } else {
                  b.vel.add(TMP_VEC2_SPIN);
                  if (
                    isCue &&
                    b.spinMode === 'swerve' &&
                    b.pendingSpin &&
                    b.pendingSpin.lengthSq() > 0
                  ) {
                    b.vel.addScaledVector(b.pendingSpin, PRE_IMPACT_SPIN_DRIFT);
                    b.pendingSpin.multiplyScalar(0);
                  }
                }
                const rollDecay = Math.pow(SPIN_ROLL_DECAY, stepScale);
                b.spin.multiplyScalar(rollDecay);
              } else {
                const airDecay = Math.pow(SPIN_AIR_DECAY, stepScale);
                b.spin.multiplyScalar(airDecay);
              }
              if (b.spin.lengthSq() < 1e-6) {
                b.spin.set(0, 0);
                if (b.pendingSpin) b.pendingSpin.set(0, 0);
                if (isCue) b.spinMode = 'standard';
              }
            }
            b.pos.addScaledVector(b.vel, stepScale);
            b.vel.multiplyScalar(Math.pow(FRICTION, stepScale));
            const speed = b.vel.length();
            const scaledSpeed = speed * stepScale;
            const hasSpinAfter = b.spin?.lengthSq() > 1e-6;
            if (scaledSpeed < STOP_EPS) {
              b.vel.set(0, 0);
              if (!hasSpinAfter && b.spin) b.spin.set(0, 0);
              if (!hasSpinAfter && b.pendingSpin) b.pendingSpin.set(0, 0);
              if (isCue && !hasSpinAfter) {
                b.impacted = false;
                b.spinMode = 'standard';
              }
              b.launchDir = null;
            }
            const hitRail = reflectRails(b);
            if (hitRail && b.id === 'cue') b.impacted = true;
            if (hitRail === 'rail' && b.spin?.lengthSq() > 0) {
              applySpinImpulse(b, 1);
            }
            b.mesh.position.set(b.pos.x, BALL_CENTER_Y, b.pos.y);
            if (scaledSpeed > 0) {
              const axis = new THREE.Vector3(b.vel.y, 0, -b.vel.x).normalize();
              const angle = scaledSpeed / BALL_R;
              b.mesh.rotateOnWorldAxis(axis, angle);
            }
          });
          // Kolizione + regjistro firstHit
          for (let i = 0; i < balls.length; i++)
            for (let j = i + 1; j < balls.length; j++) {
              const a = balls[i],
                b = balls[j];
              if (!a.active || !b.active) continue;
              const dx = b.pos.x - a.pos.x,
                dy = b.pos.y - a.pos.y;
              const d2 = dx * dx + dy * dy;
              const min = (BALL_R * 2) ** 2;
              if (d2 > 0 && d2 < min) {
                const d = Math.sqrt(d2) || 1e-4;
                const nx = dx / d,
                  ny = dy / d;
                const overlap = (BALL_R * 2 - d) / 2;
                a.pos.x -= nx * overlap;
                a.pos.y -= ny * overlap;
                b.pos.x += nx * overlap;
                b.pos.y += ny * overlap;
                const avn = a.vel.x * nx + a.vel.y * ny;
                const bvn = b.vel.x * nx + b.vel.y * ny;
                const at = a.vel
                  .clone()
                  .sub(new THREE.Vector2(nx, ny).multiplyScalar(avn));
                const bt = b.vel
                  .clone()
                  .sub(new THREE.Vector2(nx, ny).multiplyScalar(bvn));
                a.vel.copy(at.add(new THREE.Vector2(nx, ny).multiplyScalar(bvn)));
                b.vel.copy(bt.add(new THREE.Vector2(nx, ny).multiplyScalar(avn)));
                const cueBall = a.id === 'cue' ? a : b.id === 'cue' ? b : null;
                if (!firstHit) {
                  if (a.id === 'cue' && b.id !== 'cue') firstHit = b.id;
                  else if (b.id === 'cue' && a.id !== 'cue') firstHit = a.id;
                }
                const hitBallId =
                  a.id === 'cue' && b.id !== 'cue'
                    ? b.id
                    : b.id === 'cue' && a.id !== 'cue'
                      ? a.id
                      : null;
                if (
                  hitBallId &&
                  activeShotView?.mode === 'action' &&
                  activeShotView.targetId === hitBallId
                ) {
                  activeShotView.hitConfirmed = true;
                }
                if (cueBall && cueBall.spin?.lengthSq() > 0) {
                  cueBall.impacted = true;
                  applySpinImpulse(cueBall, 1.1);
                }
              }
            }
        }
        if (
          !activeShotView &&
          suspendedActionView?.mode === 'action' &&
          suspendedActionView.pendingActivation
        ) {
          const cueBall = balls.find((b) => b.id === suspendedActionView.cueId);
          if (cueBall?.active) {
            const cuePos = new THREE.Vector2(cueBall.pos.x, cueBall.pos.y);
            const travelStart =
              suspendedActionView.startCuePos || cuePos.clone();
            const travel = cuePos.distanceTo(travelStart);
            const now = performance.now();
            const travelReady =
              travel >= (suspendedActionView.activationTravel ?? 0);
            const delayReady =
              !suspendedActionView.activationDelay ||
              now >= suspendedActionView.activationDelay;
            if (travelReady && delayReady) {
              const pending = suspendedActionView;
              pending.pendingActivation = false;
              pending.activationDelay = null;
              pending.activationTravel = 0;
              pending.lastUpdate = now;
              if (cameraRef.current) {
                pending.smoothedPos = cameraRef.current.position.clone();
                const storedTarget = lastCameraTargetRef.current?.clone();
                if (storedTarget) pending.smoothedTarget = storedTarget;
              }
              activeShotView = pending;
              suspendedActionView = null;
              updateCamera();
            }
          }
        }
        if (activeShotView?.mode === 'action') {
          const now = performance.now();
          const cueBall = balls.find((b) => b.id === activeShotView.cueId);
          if (!cueBall?.active) {
            const restoreView = activeShotView;
            activeShotView = null;
            suspendedActionView = null;
            restoreOrbitCamera(restoreView);
          } else {
            if (cueBall.vel.lengthSq() > 1e-6) {
              activeShotView.lastCueDir = cueBall.vel.clone().normalize();
            }
            if (activeShotView.stage === 'pair') {
              const targetBall =
                activeShotView.targetId != null
                  ? balls.find((b) => b.id === activeShotView.targetId)
                  : null;
              if (!targetBall?.active) {
                activeShotView.stage = 'followCue';
                activeShotView.holdUntil = now + ACTION_CAM.followHoldMs;
              } else if (activeShotView.hitConfirmed) {
                const targetSpeed = targetBall.vel.length() * frameScale;
                if (targetSpeed <= STOP_EPS) {
                  activeShotView.stage = 'followCue';
                  activeShotView.holdUntil = now + ACTION_CAM.followHoldMs;
                }
              }
            } else if (activeShotView.stage === 'followCue') {
              const cueSpeed = cueBall.vel.length() * frameScale;
              if (cueSpeed > STOP_EPS) {
                activeShotView.holdUntil = now + ACTION_CAM.followHoldMs;
              } else if (
                activeShotView.holdUntil != null &&
                now >= activeShotView.holdUntil
              ) {
                const restoreView = activeShotView;
                activeShotView = null;
                suspendedActionView = null;
                restoreOrbitCamera(restoreView);
              }
            }
          }
        }
        if (
          shooting &&
          !topViewRef.current &&
          (activeShotView?.mode !== 'pocket' || !activeShotView)
        ) {
          const ballsList = ballsRef.current?.length > 0 ? ballsRef.current : balls;
          const sph = sphRef.current;
          const orbitSnapshot = sph
            ? { radius: sph.radius, phi: sph.phi, theta: sph.theta }
            : null;
          const actionResume =
            activeShotView?.mode === 'action'
              ? activeShotView
              : suspendedActionView?.mode === 'action'
                ? suspendedActionView
                : null;
          const now = performance.now();
          let pocketIntent = pocketSwitchIntentRef.current;
          if (pocketIntent && now - pocketIntent.createdAt > POCKET_INTENT_TIMEOUT_MS) {
            pocketIntent = null;
            pocketSwitchIntentRef.current = null;
          }
          const movingBalls = ballsList.filter(
            (b) => b.active && b.vel.length() * frameScale >= STOP_EPS
          );
          const movingCount = movingBalls.length;
          const lastPocketBall = lastPocketBallRef.current;
          let bestPocketView = null;
          for (const ball of ballsList) {
            if (!ball.active) continue;
            const resumeView = orbitSnapshot ? { orbitSnapshot } : null;
            const matchesIntent = pocketIntent?.ballId === ball.id;
            const candidate = makePocketCameraView(ball.id, resumeView, {
              forceEarly: matchesIntent && pocketIntent?.allowEarly
            });
            if (!candidate) continue;
            const matchesPrediction = shotPrediction?.ballId === ball.id;
            const predictedAlignment = candidate.predictedAlignment ?? candidate.score ?? 0;
            const isDirectPrediction =
              matchesPrediction &&
              (shotPrediction?.railNormal === null ||
                shotPrediction?.railNormal === undefined);
            const qualifiesAsGuaranteed =
              isDirectPrediction && predictedAlignment >= POCKET_GUARANTEED_ALIGNMENT;
            const allowDuringChaos =
              movingCount <= POCKET_CHAOS_MOVING_THRESHOLD ||
              matchesIntent ||
              qualifiesAsGuaranteed ||
              (lastPocketBall && lastPocketBall === ball.id);
            if (!allowDuringChaos) continue;
            if (
              movingCount > POCKET_CHAOS_MOVING_THRESHOLD &&
              !matchesIntent &&
              !qualifiesAsGuaranteed &&
              lastPocketBall &&
              lastPocketBall !== ball.id
            ) {
              continue;
            }
            const baseScore = candidate.score ?? 0;
            let priority = baseScore;
            if (matchesIntent && (pocketIntent?.forced ?? false)) priority += 1.2;
            else if (matchesIntent) priority += 0.6;
            if (qualifiesAsGuaranteed) priority += 0.4;
            if (candidate.forcedEarly) priority += 0.3;
            candidate.priority = priority;
            candidate.intentMatched = matchesIntent;
            candidate.guaranteed = qualifiesAsGuaranteed;
            if (
              !bestPocketView ||
              (candidate.priority ?? baseScore) >
                (bestPocketView.priority ?? bestPocketView.score ?? 0)
            ) {
              bestPocketView = candidate;
            }
          }
          if (bestPocketView) {
            if (bestPocketView.intentMatched) {
              pocketSwitchIntentRef.current = null;
            }
            lastPocketBallRef.current = bestPocketView.ballId;
            bestPocketView.lastUpdate = performance.now();
            if (cameraRef.current) {
              const cam = cameraRef.current;
              bestPocketView.smoothedPos = cam.position.clone();
              const storedTarget = lastCameraTargetRef.current?.clone();
              if (storedTarget) {
                bestPocketView.smoothedTarget = storedTarget;
              }
            }
            if (actionResume) {
              suspendedActionView = actionResume;
              bestPocketView.resumeAction = actionResume;
            } else {
              suspendedActionView = null;
            }
            updatePocketCameraState(true);
            activeShotView = bestPocketView;
          }
        }
        // Kapje në xhepa
        balls.forEach((b) => {
          if (!b.active) return;
          for (let pocketIndex = 0; pocketIndex < centers.length; pocketIndex++) {
            const c = centers[pocketIndex];
            if (b.pos.distanceTo(c) < CAPTURE_R) {
              const entrySpeed = b.vel.length();
              b.active = false;
              b.vel.set(0, 0);
              if (b.spin) b.spin.set(0, 0);
              if (b.pendingSpin) b.pendingSpin.set(0, 0);
              b.spinMode = 'standard';
              b.launchDir = null;
              if (b.id === 'cue') b.impacted = false;
              const dropStart = performance.now();
              const fromX = b.pos.x;
              const fromZ = b.pos.y;
              const speedFactor = THREE.MathUtils.clamp(
                entrySpeed / POCKET_DROP_SPEED_REFERENCE,
                0,
                1
              );
              const dropDuration = THREE.MathUtils.lerp(
                POCKET_DROP_MAX_MS,
                POCKET_DROP_MIN_MS,
                speedFactor
              );
              const dropEntry = {
                start: dropStart,
                duration: dropDuration,
                fromY: BALL_CENTER_Y,
                toY: BALL_CENTER_Y - POCKET_DROP_DEPTH,
                fromX,
                fromZ,
                toX: c.x,
                toZ: c.y,
                mesh: b.mesh,
                endScale: POCKET_DROP_SCALE,
                entrySpeed
              };
              b.mesh.visible = true;
              b.mesh.scale.set(1, 1, 1);
              b.mesh.position.set(fromX, BALL_CENTER_Y, fromZ);
              pocketDropRef.current.set(b.id, dropEntry);
              const pocketId = POCKET_IDS[pocketIndex] ?? 'TM';
              const colorId = b.id === 'cue'
                ? 'CUE'
                : b.id.startsWith('red')
                  ? 'RED'
                  : b.id.toUpperCase();
              potted.push({ id: b.id, color: colorId, pocket: pocketId });
              if (
                activeShotView?.mode === 'pocket' &&
                activeShotView.ballId === b.id
              ) {
                const pocketView = activeShotView;
                pocketView.completed = true;
                const now = performance.now();
                pocketView.holdUntil = Math.max(
                  pocketView.holdUntil ?? now,
                  now + POCKET_VIEW_POST_POT_HOLD_MS
                );
                pocketView.lastBallPos.set(
                  pocketView.pocketCenter.x,
                  pocketView.pocketCenter.y
                );
              }
              break;
            }
          }
        });
        if (activeShotView?.mode === 'pocket') {
          const pocketView = activeShotView;
          const focusBall = balls.find((b) => b.id === pocketView.ballId);
          const now = performance.now();
          if (!focusBall?.active) {
            if (pocketView.holdUntil == null) {
              pocketView.holdUntil = now + POCKET_VIEW_POST_POT_HOLD_MS;
            }
            if (now >= pocketView.holdUntil) {
              resumeAfterPocket(pocketView, now);
            }
          } else {
            const newRailHit =
              focusBall.lastRailHitAt != null &&
              (pocketView.lastRailHitAt == null ||
                focusBall.lastRailHitAt > pocketView.lastRailHitAt);
            if (newRailHit) {
              pocketView.lastRailHitAt = focusBall.lastRailHitAt;
              pocketView.lastRailHitType =
                focusBall.lastRailHitType ?? pocketView.lastRailHitType ?? 'rail';
              resumeAfterPocket(pocketView, now);
            } else {
              const toPocket = pocketView.pocketCenter.clone().sub(focusBall.pos);
              const dist = toPocket.length();
              if (dist > 1e-4) {
                const approachDir = toPocket.clone().normalize();
                pocketView.approach.copy(approachDir);
                const speedAlong = focusBall.vel.dot(approachDir);
                if (speedAlong * frameScale < -STOP_EPS) {
                  if (now >= (pocketView.holdUntil ?? now)) {
                    resumeAfterPocket(pocketView, now);
                  }
                }
              }
            }
          }
        }
        // Fund i goditjes
          if (shooting) {
            const any = balls.some(
              (b) => b.active && b.vel.length() * frameScale >= STOP_EPS
            );
            if (!any) resolve();
          }
          if (pocketDropRef.current.size > 0) {
            pocketDropRef.current.forEach((entry, key) => {
              const { mesh } = entry;
              if (!mesh) {
                pocketDropRef.current.delete(key);
                return;
              }
              const elapsed = now - entry.start;
              const duration = entry.duration > 0 ? entry.duration : 1;
              const t = THREE.MathUtils.clamp(elapsed / duration, 0, 1);
              const speedFactor = THREE.MathUtils.clamp(
                (entry.entrySpeed ?? 0) / POCKET_DROP_SPEED_REFERENCE,
                0,
                1
              );
              const gravityEase = THREE.MathUtils.lerp(t * t, t, speedFactor * 0.25);
              const fall = THREE.MathUtils.clamp(gravityEase, 0, 1);
              const y = THREE.MathUtils.lerp(entry.fromY, entry.toY, fall);
              const lateralT = THREE.MathUtils.clamp(t, 0, 1);
              const x = THREE.MathUtils.lerp(entry.fromX, entry.toX, lateralT);
              const z = THREE.MathUtils.lerp(entry.fromZ, entry.toZ, lateralT);
              mesh.position.set(x, y, z);
              const scale = THREE.MathUtils.lerp(1, entry.endScale ?? 1, fall);
              mesh.scale.set(scale, scale, scale);
              if (t >= 1) {
                mesh.visible = false;
                mesh.scale.set(1, 1, 1);
                mesh.position.set(entry.toX, BALL_CENTER_Y, entry.toZ);
                pocketDropRef.current.delete(key);
              }
            });
          }
          const fit = fitRef.current;
          if (fit && cue?.active && !shooting) {
            const limX =
              PLAY_W / 2 - BALL_R - SIDE_RAIL_INNER_THICKNESS;
            const limY =
              PLAY_H / 2 - BALL_R - SIDE_RAIL_INNER_THICKNESS;
            const edgeX = Math.max(0, Math.abs(cue.pos.x) - (limX - 5));
            const edgeY = Math.max(0, Math.abs(cue.pos.y) - (limY - 5));
            const edge = Math.min(1, Math.max(edgeX, edgeY) / 5);
            fit(1 + edge * 0.08);
          }
          const frameCamera = updateCamera();
          renderer.render(scene, frameCamera ?? camera);
          if (!loadingClearedRef.current) {
            loadingClearedRef.current = true;
            loadTimer = window.setTimeout(() => {
              setLoading(false);
              setLoadingProgress(100);
            }, 120);
          }
          rafRef.current = requestAnimationFrame(step);
        };
        step(performance.now());

      // Resize
        const onResize = () => {
          // Update canvas dimensions when the window size changes so the table
          // remains fully visible.
          renderer.setSize(host.clientWidth, host.clientHeight);
          const margin = Math.max(
            STANDING_VIEW.margin,
            topViewRef.current
              ? 1.05
              : window.innerHeight > window.innerWidth
                ? 1.6
                : 1.4
          );
          fit(margin);
          const resizeAspect = host.clientWidth / host.clientHeight;
          pocketCamerasRef.current.forEach((entry) => {
            if (!entry?.camera) return;
            entry.camera.aspect = resizeAspect;
            entry.camera.updateProjectionMatrix();
          });
        };
      window.addEventListener('resize', onResize);

        return () => {
          cancelAnimationFrame(rafRef.current);
          window.removeEventListener('resize', onResize);
          updatePocketCameraState(false);
          pocketCamerasRef.current.clear();
          pocketDropRef.current.clear();
          activeRenderCameraRef.current = null;
          cueBodyRef.current = null;
          tipGroupRef.current = null;
          try {
            host.removeChild(renderer.domElement);
          } catch {}
          dom.removeEventListener('mousedown', down);
          dom.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
          dom.removeEventListener('touchstart', down);
          dom.removeEventListener('touchmove', move);
          window.removeEventListener('touchend', up);
          window.removeEventListener('keydown', keyRot);
          dom.removeEventListener('pointerdown', onPlace);
          if (loadTimer) {
            clearTimeout(loadTimer);
          }
        };
      } catch (e) {
        console.error(e);
        setErr(e?.message || String(e));
        setLoading(false);
        setLoadingProgress(100);
      }
  }, [hud.inHand, hud.over]);

  // --------------------------------------------------
  // NEW Big Pull Slider (right side): drag DOWN to set power, releases → fire()
  // --------------------------------------------------
  const sliderRef = useRef(null);
  useEffect(() => {
    const mount = sliderRef.current;
    if (!mount) return;
    const slider = new SnookerPowerSlider({
      mount,
      value: powerRef.current * 100,
      cueSrc: '/assets/snooker/cue.webp',
      labels: true,
      onChange: (v) => setHud((s) => ({ ...s, power: v / 100 })),
      onCommit: () => {
        fireRef.current?.();
        requestAnimationFrame(() => {
          slider.set(slider.min, { animate: true });
        });
      }
    });
    return () => {
      slider.destroy();
    };
  }, []);

  // Spin controller interactions
  useEffect(() => {
    const box = document.getElementById('spinBox');
    const dot = document.getElementById('spinDot');
    if (!box || !dot) return;
    spinDotElRef.current = dot;

    box.style.transition = 'transform 0.18s ease';
    box.style.transformOrigin = '50% 50%';
    box.style.touchAction = 'none';

    let revertTimer = null;
    let activePointer = null;
    let moved = false;

    const clampToLimits = (nx, ny) => {
      const limits = spinLimitsRef.current || DEFAULT_SPIN_LIMITS;
      return {
        x: clamp(nx, limits.minX, limits.maxX),
        y: clamp(ny, limits.minY, limits.maxY)
      };
    };

    const setSpin = (nx, ny) => {
      const normalized = clampToUnitCircle(nx, ny);
      spinRequestRef.current = normalized;
      const limited = clampToLimits(normalized.x, normalized.y);
      spinRef.current = limited;
      const cueBall = cueRef.current;
      const ballsList = ballsRef.current?.length
        ? ballsRef.current
        : undefined;
      const aimVec = aimDirRef.current;
      const axes = aimVec ? prepareSpinAxes(aimVec) : null;
      const activeCamera = activeRenderCameraRef.current ?? cameraRef.current;
      const viewVec = cueBall && activeCamera
        ? computeCueViewVector(cueBall, activeCamera)
        : null;
      const legality = checkSpinLegality2D(
        cueBall,
        normalized,
        ballsList || [],
        {
          axes,
          view: viewVec ? { x: viewVec.x, y: viewVec.y } : null
        }
      );
      spinLegalityRef.current = legality;
      updateSpinDotPosition(limited, legality.blocked);
    };
    const resetSpin = () => setSpin(0, 0);
    resetSpin();
    resetSpinRef.current = resetSpin;

    const updateSpin = (clientX, clientY) => {
      const rect = box.getBoundingClientRect();
      const cx = clientX ?? rect.left + rect.width / 2;
      const cy = clientY ?? rect.top + rect.height / 2;
      let nx = ((cx - rect.left) / rect.width) * 2 - 1;
      let ny = ((cy - rect.top) / rect.height) * 2 - 1;
      setSpin(nx, ny);
    };

    const scaleBox = (value) => {
      box.style.transform = `scale(${value})`;
    };
    scaleBox(1);

    const clearTimer = () => {
      if (revertTimer) {
        clearTimeout(revertTimer);
        revertTimer = null;
      }
    };

    const releasePointer = () => {
      if (activePointer !== null) {
        try {
          box.releasePointerCapture(activePointer);
        } catch {}
        activePointer = null;
      }
    };

    const handlePointerDown = (e) => {
      if (activePointer !== null) releasePointer();
      activePointer = e.pointerId;
      moved = false;
      clearTimer();
      scaleBox(1.35);
      updateSpin(e.clientX, e.clientY);
      box.setPointerCapture(activePointer);
      revertTimer = window.setTimeout(() => {
        if (!moved) scaleBox(1);
      }, 1500);
    };

    const handlePointerMove = (e) => {
      if (activePointer !== e.pointerId) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) return;
      updateSpin(e.clientX, e.clientY);
      moved = true;
    };

    const finishInteraction = (restoreDelay = 60) => {
      releasePointer();
      clearTimer();
      revertTimer = window.setTimeout(() => scaleBox(1), restoreDelay);
    };

    const handlePointerUp = (e) => {
      if (activePointer !== e.pointerId) return;
      finishInteraction(50);
    };

    const handlePointerCancel = (e) => {
      if (activePointer !== e.pointerId) return;
      releasePointer();
      clearTimer();
      scaleBox(1);
    };

    box.addEventListener('pointerdown', handlePointerDown);
    box.addEventListener('pointermove', handlePointerMove);
    box.addEventListener('pointerup', handlePointerUp);
    box.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      spinDotElRef.current = null;
      releasePointer();
      clearTimer();
      resetSpinRef.current = () => {};
      spinRequestRef.current = { x: 0, y: 0 };
      spinLegalityRef.current = { blocked: false, reason: '' };
      box.removeEventListener('pointerdown', handlePointerDown);
      box.removeEventListener('pointermove', handlePointerMove);
      box.removeEventListener('pointerup', handlePointerUp);
      box.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [updateSpinDotPosition]);

  const displayedProgress = Math.min(
    100,
    Math.max(0, Math.round(loadingProgress))
  );
  const cueStrikeProgress = Math.min(1, displayedProgress / 12);
  const cueBaseOffset = 16;
  const cueDrawBack = 18;
  const cueTrackWidth = 200;
  const ballOffsetStart = cueBaseOffset + 28;
  const cueBallRadius = 12;
  const ballTravel = Math.max(0, Math.min(1, (displayedProgress - 12) / 88));
  const cuePosition = cueBaseOffset - cueDrawBack * (1 - cueStrikeProgress);
  const cueBallPosition = ballOffsetStart + cueTrackWidth * ballTravel;
  const referenceImages = useMemo(
    () => [
      {
        key: 'current',
        src: currentRimsReference,
        alt: 'Pamja aktuale e tavolinës në lojë',
        caption:
          'Aktualisht xhepat anësorë janë më të ngushtë dhe pllakat e kromit nuk dallohen.'
      },
      {
        key: 'target',
        src: targetRimsReference,
        alt: 'Pamja e dëshiruar e tavolinës me krom',
        caption:
          'Synimi: rime të hapura në cepat dhe pllakat e kromit të ekspozuara mbi rail.'
      }
    ],
    []
  );

  return (
    <div className="w-full h-[100vh] bg-black text-white overflow-hidden select-none">
      {/* Canvas host now stretches full width so table reaches the slider */}
      <div ref={mountRef} className="absolute inset-0" />

      {(loading || displayedProgress < 100) && (
        <div className="absolute inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-black via-black/95 to-black text-white">
          <div className="relative w-64 h-24">
            <div className="absolute left-0 top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-white/15" />
            <div
              className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-emerald-400/80 transition-all duration-150 ease-out"
              style={{ width: `${displayedProgress}%` }}
            />
            <div
              className="absolute left-0 top-1/2 h-2 w-28 rounded-r-full bg-amber-300 shadow-lg shadow-amber-500/40 transition-transform duration-150 ease-out"
              style={{ transform: `translate(${cuePosition}px, -50%)` }}
            />
            <div
              className="absolute left-0 top-1/2 h-6 w-6 rounded-full border border-emerald-200 bg-white shadow-[0_0_16px_rgba(74,222,128,0.5)] transition-transform duration-150 ease-out"
              style={{
                transform: `translate(${cueBallPosition - cueBallRadius}px, -50%)`
              }}
            />
          </div>
          <div className="text-sm tracking-[0.3em] uppercase text-emerald-200">
            Loading {displayedProgress}%
          </div>
        </div>
      )}

      {/* Top HUD */}
      <div
        className={`absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-50 transition-opacity duration-200 ${pocketCameraActive ? 'opacity-0' : 'opacity-100'}`}
        aria-hidden={pocketCameraActive}
      >
        <div
          className="bg-gray-800 px-4 py-2 rounded-b flex flex-col items-center text-white"
          style={{
            transform: `scale(${UI_SCALE})`,
            transformOrigin: 'top center'
          }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <img
                src={player.avatar || '/assets/icons/profile.svg'}
                alt="player"
                className="w-10 h-10 rounded-full object-cover border-2 border-yellow-400"
              />
              <span className={hud.turn === 0 ? 'text-yellow-400' : ''}>
                {player.name}
              </span>
            </div>
            <div className="text-xl font-bold">
              {hud.A} - {hud.B}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full border-2 border-yellow-400 flex items-center justify-center">
                <span className="text-3xl leading-none">{aiFlag}</span>
              </div>
              <span className={hud.turn === 1 ? 'text-yellow-400' : ''}>
                AI
              </span>
            </div>
          </div>
          <div className="mt-1 text-sm">Time: {timer}</div>
        </div>
      </div>

      <div
        className={`absolute top-20 left-0 right-0 z-40 flex justify-center px-4 transition-opacity duration-300 ${pocketCameraActive ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="pointer-events-none w-full max-w-sm flex flex-col gap-3">
          {referenceImages.map(({ key, src, alt, caption }) => (
            <figure
              key={key}
              className="pointer-events-none overflow-hidden rounded-xl border border-white/15 bg-black/70 backdrop-blur-sm shadow-lg shadow-black/40"
            >
              <img src={src} alt={alt} className="w-full h-auto object-cover" loading="lazy" />
              <figcaption className="px-3 py-2 text-xs leading-relaxed text-emerald-100">
                {caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      {err && (
        <div className="absolute inset-0 bg-black/80 text-white text-xs flex items-center justify-center p-4 z-50">
          Init error: {String(err)}
        </div>
      )}
      {/* Power Slider */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <div
          ref={sliderRef}
          style={{
            transform: `scale(${UI_SCALE})`,
            transformOrigin: 'top right'
          }}
        />
      </div>

      {/* Spin controller */}
      <div
        className="absolute bottom-4 right-4"
        style={{
          transform: `scale(${UI_SCALE})`,
          transformOrigin: 'bottom right'
        }}
      >
        <div
          id="spinBox"
          className="relative w-32 h-32 rounded-full shadow-lg border border-white/70"
          style={{
            background: `radial-gradient(circle, #ffffff 0%, #ffffff ${
              SPIN_BOX_FILL_RATIO * 100
            }%, #facc15 ${SPIN_BOX_FILL_RATIO * 100}%, #facc15 100%)`
          }}
        >
          <div
            id="spinDot"
            className="absolute w-3 h-3 rounded-full bg-red-600 -translate-x-1/2 -translate-y-1/2"
            style={{ left: '50%', top: '50%' }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default function NewSnookerGame() {
  const isMobileOrTablet = useIsMobile(1366);

  if (!isMobileOrTablet) {
    return (
      <div className="flex items-center justify-center w-full h-full p-4 text-center">
        <p>This game is available on mobile phones and tablets only.</p>
      </div>
    );
  }

  return <SnookerGame />;
}
