import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useParams } from 'react-router-dom';
import { Table3D } from '../Games/PoolRoyale.jsx';

// Minimal three.js studio page used by the automated screenshot generator.
// Route: /tools/store-thumb/poolroyale/table-finish/:finishId
export default function StoreThumbnailStudioPoolRoyale() {
  const { finishId } = useParams();
  const mountRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    const mount = mountRef.current;
    if (!mount) return;

    // Signal to Playwright when ready.
    window.__thumbReady = false;

    const width = 768;
    const height = 768;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x0b1020, 1);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 200);
    camera.position.set(0.0, 2.2, 5.2);
    camera.lookAt(0, 0.8, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(4, 6, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x9aa9ff, 0.65);
    rim.position.set(-5, 3.5, -4);
    scene.add(rim);

    const floorGeom = new THREE.CircleGeometry(12, 128);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0b1226,
      metalness: 0.05,
      roughness: 0.95
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);

    // Add table with selected finish.
    const group = new THREE.Group();
    scene.add(group);
    try {
      Table3D(group, finishId, null, null, null, renderer);
    } catch (err) {
      // If an invalid finishId is passed, keep rendering a placeholder.
      console.error('[StoreThumbnailStudioPoolRoyale] Failed to build table:', err);
    }

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    let frame = 0;
    const maxWarmupFrames = 30;

    const render = () => {
      if (disposed) return;
      frame += 1;

      // Subtle rotation for nicer highlights.
      group.rotation.y = -0.35;

      renderer.render(scene, camera);

      if (frame >= maxWarmupFrames) {
        window.__thumbReady = true;
      } else {
        requestAnimationFrame(render);
      }
    };

    requestAnimationFrame(render);

    return () => {
      disposed = true;
      try {
        renderer.dispose();
      } catch {}
    };
  }, [finishId]);

  return (
    <div
      ref={mountRef}
      style={{
        width: 768,
        height: 768,
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        background: '#0b1020'
      }}
    />
  );
}
