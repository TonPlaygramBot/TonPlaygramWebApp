import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  CAMERA_FAR,
  CAMERA_FOV_DEG,
  CAMERA_NEAR,
  ORBIT_DEFAULT_THETA,
  ORBIT_MAX_THETA,
  ORBIT_MIN_THETA,
  ORBIT_SMOOTHING,
  alignCueRollToUp,
  clamp,
  computeRFit,
  shortestAngleDelta,
} from '../lib/poolCamera';

type Spin = { x: number; y: number };

type PoolRoyalOrbitSceneProps = {
  tableW: number;
  tableH: number;
  cueBallRadius: number;
  spin: Spin;
  className?: string;
};

type PointerState = {
  ids: number[];
  positions: { x: number; y: number }[];
  count: number;
  rotateId: number;
  lastX: number;
  lastY: number;
  pinchStartDistance: number;
  pinchStartRadius: number;
};

const UP = new THREE.Vector3(0, 1, 0);
const BASE_FORWARD = new THREE.Vector3(0, 0, -1);

const ZERO_VECTOR = new THREE.Vector3();

export default function PoolRoyalOrbitScene({
  tableW,
  tableH,
  cueBallRadius,
  spin,
  className,
}: PoolRoyalOrbitSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const spinRef = useRef<Spin>({ x: 0, y: 0 });

  spinRef.current = spin;

  const pointerState = useMemo<PointerState>(() => ({
    ids: [-1, -1],
    positions: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
    count: 0,
    rotateId: -1,
    lastX: 0,
    lastY: 0,
    pinchStartDistance: 0,
    pinchStartRadius: 0,
  }), []);

  const temps = useMemo(() => ({
    offset: new THREE.Vector3(),
    contact: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    diff: new THREE.Vector3(),
    tipCurrent: new THREE.Vector3(),
    tipTarget: new THREE.Vector3(),
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040b13);

    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV_DEG,
      host.clientWidth / Math.max(1, host.clientHeight),
      CAMERA_NEAR,
      CAMERA_FAR,
    );

    const hemi = new THREE.HemisphereLight(0xffffff, 0x10121f, 0.75);
    scene.add(hemi);
    const spot = new THREE.SpotLight(0xffffff, 0.7, 0, Math.PI / 4, 0.35, 1.4);
    spot.position.set(0, 6, 0);
    spot.target.position.set(0, 0, 0);
    scene.add(spot);
    scene.add(spot.target);

    const tableGroup = new THREE.Group();
    scene.add(tableGroup);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(tableW + 0.24, 0.18, tableH + 0.24),
      new THREE.MeshStandardMaterial({ color: 0x332012, roughness: 0.35 }),
    );
    frame.position.y = -0.09;
    tableGroup.add(frame);

    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(tableW, tableH),
      new THREE.MeshStandardMaterial({ color: 0x0c7f42, roughness: 0.7, metalness: 0.04 }),
    );
    cloth.rotation.x = -Math.PI / 2;
    tableGroup.add(cloth);

    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x135c34,
      roughness: 0.6,
      metalness: 0.03,
    });
    const cushionGeom = new THREE.BoxGeometry(0.12, 0.08, tableH + 0.18);
    const cushionL = new THREE.Mesh(cushionGeom, cushionMat);
    cushionL.position.set(-tableW / 2 - 0.06, 0.04, 0);
    tableGroup.add(cushionL);
    const cushionR = cushionL.clone();
    cushionR.position.x = tableW / 2 + 0.06;
    tableGroup.add(cushionR);

    const cushionShortGeom = new THREE.BoxGeometry(tableW + 0.18, 0.08, 0.12);
    const cushionNear = new THREE.Mesh(cushionShortGeom, cushionMat);
    cushionNear.position.set(0, 0.04, tableH / 2 + 0.06);
    tableGroup.add(cushionNear);
    const cushionFar = cushionNear.clone();
    cushionFar.position.z = -tableH / 2 - 0.06;
    tableGroup.add(cushionFar);

    const cueBall = new THREE.Mesh(
      new THREE.SphereGeometry(cueBallRadius, 36, 24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
    );
    cueBall.position.set(0, cueBallRadius, 0);
    scene.add(cueBall);

    const cueLength = tableH * 1.6;
    const cueGeometry = new THREE.CylinderGeometry(
      cueBallRadius * 0.32,
      cueBallRadius * 0.14,
      cueLength,
      20,
      1,
      true,
    );
    cueGeometry.rotateX(Math.PI / 2);
    cueGeometry.translate(0, 0, -cueLength / 2);
    const cueMaterial = new THREE.MeshStandardMaterial({ color: 0xcaa06a, roughness: 0.28 });
    const cueMesh = new THREE.Mesh(cueGeometry, cueMaterial);
    const cue = new THREE.Group();
    cue.add(cueMesh);
    scene.add(cue);

    temps.tipCurrent.set(0, cueBallRadius, -cueBallRadius * 3);
    temps.tipTarget.copy(temps.tipCurrent);
    cue.position.copy(temps.tipCurrent);
    cue.quaternion.setFromUnitVectors(BASE_FORWARD, BASE_FORWARD);

    const state = {
      phi: 0,
      theta: ORBIT_DEFAULT_THETA,
      r: 0,
      phiTarget: 0,
      thetaTarget: ORBIT_DEFAULT_THETA,
      rTarget: 0,
      rFit: 0,
      viewW: Math.max(1, host.clientWidth),
      viewH: Math.max(1, host.clientHeight),
      lastTime: performance.now(),
    };

    state.rFit = computeRFit(state.viewH, state.viewW, tableW, tableH, state.theta);
    state.r = state.rTarget = Math.max(state.rFit, state.r);

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver((entries) => {
          if (!entries.length) return;
          const entry = entries[0];
          state.viewW = Math.max(1, entry.contentRect.width);
          state.viewH = Math.max(1, entry.contentRect.height);
          renderer.setSize(state.viewW, state.viewH, false);
          camera.aspect = state.viewW / state.viewH;
          camera.updateProjectionMatrix();
        })
      : null;
    resizeObserver?.observe(host);

    const updateCamera = (alpha: number) => {
      state.rFit = computeRFit(state.viewH, state.viewW, tableW, tableH, state.theta);
      const minR = state.rFit;
      const maxR = minR * 1.5;
      state.rTarget = clamp(state.rTarget, minR, maxR);
      state.r = clamp(state.r, minR, maxR);

      state.phi += shortestAngleDelta(state.phiTarget, state.phi) * alpha;
      state.theta += (clamp(state.thetaTarget, ORBIT_MIN_THETA, ORBIT_MAX_THETA) - state.theta) * alpha;
      state.r += (state.rTarget - state.r) * alpha;

      const cosTheta = Math.cos(state.theta);
      const sinTheta = Math.sin(state.theta);
      const sinPhi = Math.sin(state.phi);
      const cosPhi = Math.cos(state.phi);

      camera.position.set(
        state.r * cosTheta * sinPhi,
        state.r * sinTheta,
        state.r * cosTheta * cosPhi,
      );
      camera.up.copy(UP);
      camera.lookAt(ZERO_VECTOR);
    };

    const updateCue = (alpha: number) => {
      const sx = clamp(spinRef.current.x, -1, 1);
      const sy = clamp(spinRef.current.y, -1, 1);
      const k = 0.6;
      const R = cueBallRadius;
      const ox = sx * k * R;
      const oy = sy * k * R;
      const cap = Math.max(0, R * R - (ox * ox + oy * oy));
      const nz = -Math.sqrt(cap);

      temps.offset.set(ox, 0, oy);
      temps.contact.copy(cueBall.position).add(temps.offset);
      temps.contact.y += nz;
      temps.tipTarget.copy(temps.contact);

      temps.diff.copy(temps.tipTarget).sub(temps.tipCurrent);
      temps.tipCurrent.addScaledVector(temps.diff, Math.min(1, alpha * 3.2));

      temps.dir.copy(temps.tipCurrent).sub(cueBall.position);
      if (temps.dir.lengthSq() < 1e-8) {
        temps.dir.set(0, 0, -1);
      } else {
        temps.dir.normalize();
      }

      cue.quaternion.setFromUnitVectors(BASE_FORWARD, temps.dir);
      alignCueRollToUp(cue, UP, alpha);
      cue.position.copy(temps.tipCurrent);
    };

    const animate = () => {
      rafRef.current = window.requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min(now - state.lastTime, 32);
      state.lastTime = now;
      const step = clamp(delta / 16.7, 0.5, 2.2);
      const alpha = 1 - Math.pow(1 - ORBIT_SMOOTHING, step);
      updateCamera(alpha);
      updateCue(alpha);
      renderer.render(scene, camera);
    };

    animate();

    const getPointerIndex = (id: number) => {
      if (pointerState.ids[0] === id) return 0;
      if (pointerState.ids[1] === id) return 1;
      return -1;
    };

    const updatePinchDistance = () => {
      if (pointerState.count < 2) return;
      const p0 = pointerState.positions[0];
      const p1 = pointerState.positions[1];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 0) return;
      const scale = distance / Math.max(1e-3, pointerState.pinchStartDistance);
      const minR = state.rFit;
      const maxR = minR * 1.5;
      state.rTarget = clamp(pointerState.pinchStartRadius * scale, minR, maxR);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const idx = getPointerIndex(event.pointerId);
      if (idx === -1) return;
      pointerState.positions[idx].x = event.clientX;
      pointerState.positions[idx].y = event.clientY;

      if (pointerState.count === 1 && pointerState.rotateId === event.pointerId) {
        const dx = event.clientX - pointerState.lastX;
        const dy = event.clientY - pointerState.lastY;
        pointerState.lastX = event.clientX;
        pointerState.lastY = event.clientY;
        state.phiTarget -= dx * 0.0042;
        state.thetaTarget -= dy * 0.0028;
        if (state.phiTarget > Math.PI) state.phiTarget -= Math.PI * 2;
        if (state.phiTarget < -Math.PI) state.phiTarget += Math.PI * 2;
        state.thetaTarget = clamp(state.thetaTarget, ORBIT_MIN_THETA, ORBIT_MAX_THETA);
      } else if (pointerState.count >= 2) {
        updatePinchDistance();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      renderer.domElement.setPointerCapture(event.pointerId);
      const idx = getPointerIndex(event.pointerId);
      if (idx === -1 && pointerState.count < 2) {
        const newIndex = pointerState.count;
        pointerState.ids[newIndex] = event.pointerId;
        pointerState.positions[newIndex].x = event.clientX;
        pointerState.positions[newIndex].y = event.clientY;
        pointerState.count += 1;
      }
      if (pointerState.count === 1) {
        pointerState.rotateId = event.pointerId;
        pointerState.lastX = event.clientX;
        pointerState.lastY = event.clientY;
      } else if (pointerState.count === 2) {
        const p0 = pointerState.positions[0];
        const p1 = pointerState.positions[1];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        pointerState.pinchStartDistance = Math.hypot(dx, dy);
        pointerState.pinchStartRadius = state.rTarget || state.rFit;
        pointerState.rotateId = -1;
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      renderer.domElement.releasePointerCapture(event.pointerId);
      const idx = getPointerIndex(event.pointerId);
      if (idx === -1) return;
      if (pointerState.count === 2 && idx === 0) {
        pointerState.ids[0] = pointerState.ids[1];
        pointerState.positions[0].x = pointerState.positions[1].x;
        pointerState.positions[0].y = pointerState.positions[1].y;
      }
      pointerState.ids[Math.max(0, pointerState.count - 1)] = -1;
      pointerState.count = Math.max(0, pointerState.count - 1);
      if (pointerState.count === 1) {
        pointerState.rotateId = pointerState.ids[0];
        pointerState.lastX = pointerState.positions[0].x;
        pointerState.lastY = pointerState.positions[0].y;
        pointerState.pinchStartDistance = 0;
      } else {
        pointerState.rotateId = -1;
        pointerState.pinchStartDistance = 0;
      }
    };

    const wheelOptions = { passive: false } as const;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const minR = state.rFit;
      const maxR = minR * 1.5;
      const delta = clamp(event.deltaY * 0.0015, -0.15, 0.15);
      state.rTarget = clamp(state.rTarget + delta * (maxR - minR), minR, maxR);
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerUp);
    renderer.domElement.addEventListener('wheel', handleWheel, wheelOptions);

    return () => {
      window.cancelAnimationFrame(rafRef.current);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerUp);
      renderer.domElement.removeEventListener('wheel', handleWheel, wheelOptions);
      host.removeChild(renderer.domElement);
      cueGeometry.dispose();
      cueMaterial.dispose();
      (cueMesh.material as THREE.Material).dispose?.();
      frame.geometry.dispose();
      (frame.material as THREE.Material).dispose?.();
      cloth.geometry.dispose();
      (cloth.material as THREE.Material).dispose?.();
      cushionGeom.dispose();
      cushionMat.dispose();
      cushionShortGeom.dispose();
      (cueBall.material as THREE.Material).dispose?.();
      cueBall.geometry.dispose();
      renderer.dispose();
    };
  }, [cueBallRadius, pointerState, tableH, tableW, temps]);

  return <div ref={hostRef} className={className} />;
}
