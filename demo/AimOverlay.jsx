import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const TWO_PI = Math.PI * 2;
const ARC_SEGMENTS = 48;
const RADIUS_MIN = 0.25;

function buildArcGeometry(start, end, radius) {
  const clampedEnd = Math.max(start, end);
  const points = [];
  const span = clampedEnd - start;
  const segments = Math.max(2, Math.ceil((ARC_SEGMENTS * span) / TWO_PI));
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = start + span * t;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return geometry;
}

function updateArcs(group, intervals, material, radius) {
  const existing = group.children.slice();
  existing.forEach((child) => {
    if (child.geometry) child.geometry.dispose();
    group.remove(child);
  });
  intervals.forEach((interval) => {
    const { start, end } = interval;
    if (end <= start) return;
    const geometry = buildArcGeometry(start, end, radius);
    const line = new THREE.Line(geometry, material);
    group.add(line);
  });
}

export function AimOverlay({ C, angleMask, phi, thetaChosen, L, table }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rootRef = useRef(null);
  const blockedRef = useRef(null);
  const allowedRef = useRef(null);
  const shaftRef = useRef(null);
  const materialsRef = useRef({});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    const { clientWidth, clientHeight } = container;
    renderer.setSize(clientWidth, clientHeight, false);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
    camera.position.set(0, 5, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    const root = new THREE.Group();
    scene.add(root);

    const blockedGroup = new THREE.Group();
    const allowedGroup = new THREE.Group();
    const allowedMaterial = new THREE.LineBasicMaterial({ color: 0x3ed64c, linewidth: 2 });
    const blockedMaterial = new THREE.LineBasicMaterial({ color: 0xd94141, linewidth: 2 });
    materialsRef.current.allowed = allowedMaterial;
    materialsRef.current.blocked = blockedMaterial;
    root.add(blockedGroup);
    root.add(allowedGroup);

    const chosenMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });
    const chosenGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, -1)
    ]);
    const chosenLine = new THREE.Line(chosenGeo, chosenMaterial);
    const phiMaterial = new THREE.LineBasicMaterial({ color: 0x4aa3ff, linewidth: 2 });
    const phiGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, -1)
    ]);
    const phiLine = new THREE.Line(phiGeo, phiMaterial);
    root.add(phiLine);
    root.add(chosenLine);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    rootRef.current = root;
    blockedRef.current = blockedGroup;
    allowedRef.current = allowedGroup;
    shaftRef.current = {
      chosen: { line: chosenLine, geometry: chosenGeo },
      phi: { line: phiLine, geometry: phiGeo }
    };

    const handleResize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      renderer.setSize(w, h, false);
      const viewSize = 1;
      const aspect = w / Math.max(h, 1);
      camera.left = -viewSize * aspect;
      camera.right = viewSize * aspect;
      camera.top = viewSize;
      camera.bottom = -viewSize;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      Object.values(materialsRef.current).forEach((material) => material?.dispose?.());
      if (shaftRef.current) {
        Object.values(shaftRef.current).forEach((entry) => {
          entry.line.material.dispose();
          entry.geometry.dispose();
        });
      }
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!rootRef.current || !sceneRef.current || !cameraRef.current || !rendererRef.current)
      return;
    const root = rootRef.current;
    root.position.set(C.x, C.y, C.z);

    const intervalsAllowed = angleMask?.allowed || [];
    const intervalsBlocked = angleMask?.blocked || [];
    const radius = Math.max(L, RADIUS_MIN);
    updateArcs(
      allowedRef.current,
      intervalsAllowed,
      materialsRef.current.allowed,
      radius
    );
    updateArcs(
      blockedRef.current,
      intervalsBlocked,
      materialsRef.current.blocked,
      radius
    );

    const shaft = shaftRef.current;
    if (shaft?.chosen) {
      const chosenPoints = shaft.chosen.geometry.attributes.position;
      chosenPoints.setXYZ(0, 0, 0, 0);
      const chosenEndX = Math.cos(thetaChosen) * -L;
      const chosenEndZ = Math.sin(thetaChosen) * -L;
      chosenPoints.setXYZ(1, chosenEndX, 0, chosenEndZ);
      chosenPoints.needsUpdate = true;
      shaft.chosen.geometry.computeBoundingSphere();
    }

    const renderer = rendererRef.current;
    const camera = cameraRef.current;

    if (table) {
      const extent = Math.max(table.maxX - table.minX, table.maxZ - table.minZ, radius * 2);
      const viewSize = extent > 0 ? extent * 0.6 : 1;
      const canvas = renderer.domElement;
      const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
      camera.left = -viewSize * aspect;
      camera.right = viewSize * aspect;
      camera.top = viewSize;
      camera.bottom = -viewSize;
      camera.updateProjectionMatrix();
    }

    renderer.render(sceneRef.current, camera);
  }, [C, angleMask, thetaChosen, L, table]);

  useEffect(() => {
    if (!shaftRef.current || !rendererRef.current || !cameraRef.current || !sceneRef.current)
      return;
    const shaft = shaftRef.current;
    if (!shaft?.phi) return;
    const points = shaft.phi.geometry.attributes.position;
    points.setXYZ(0, 0, 0, 0);
    const endX = Math.cos(phi) * -L;
    const endZ = Math.sin(phi) * -L;
    points.setXYZ(1, endX, 0, endZ);
    points.needsUpdate = true;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, [phi, L]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
