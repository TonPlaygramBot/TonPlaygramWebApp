import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
declare const __SNAKE_TABLE_DATA__: string;
type Part = {
  p: number[];
  i: number[];
  c: string;
  opacity: number;
  map?: string;
  uv?: number[];
};
type Data = {
  parts: Part[];
  seat: number[];
  scenes: Record<string, { label: string; table: number[]; board: number[] }>;
};
function Preview() {
  const host = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Data | null>(null),
    [selected, setSelected] = useState('murlan-default');
  const [view, setView] = useState('table'),
    [error, setError] = useState('');
  useEffect(() => {
    const bytes = Uint8Array.from(atob(__SNAKE_TABLE_DATA__), (c) =>
      c.charCodeAt(0)
    );
    new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    )
      .json()
      .then(setData)
      .catch(() => setError('Unable to open the table review.'));
  }, []);
  useEffect(() => {
    if (!data || !host.current) return;
    const element = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError('WebGL is unavailable in this browser.');
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#26303a');
    scene.add(new THREE.HemisphereLight('#e5f2ff', '#75604a', 2.1));
    const light = new THREE.DirectionalLight('#fff0d8', 2.8);
    light.position.set(3, 7, 5);
    scene.add(light);
    const geometry: THREE.BufferGeometry[] = [],
      materials: THREE.Material[] = [],
      textures: THREE.Texture[] = [];
    const parts = data.parts.map((part) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          part.p.map((n) => n / 10000),
          3
        )
      );
      g.setIndex(part.i);
      g.computeVertexNormals();
      geometry.push(g);
      if (part.uv)
        g.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
      const m = new THREE.MeshStandardMaterial({
        color: '#' + part.c,
        roughness: 0.68,
        metalness: 0.08,
        side: THREE.DoubleSide,
        opacity: part.opacity,
        transparent: part.opacity < 1
      });
      materials.push(m);
      if (part.map && part.uv) {
        const texture = new THREE.TextureLoader().load(part.map, () =>
          render()
        );
        texture.colorSpace = THREE.SRGBColorSpace;
        m.map = texture;
        textures.push(texture);
      }
      return new THREE.Mesh(g, m);
    });
    const add = (ids: number[], parent: THREE.Object3D) =>
      ids.forEach((id) => parent.add(parts[id].clone()));
    for (let i = 0; i < 4; i++) {
      const seat = new THREE.Group();
      seat.rotation.y = (i * Math.PI) / 2;
      add(data.seat, seat);
      scene.add(seat);
    }
    add(data.scenes[selected].table, scene);
    add(data.scenes[selected].board, scene);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: '#444b50', roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.838;
    scene.add(floor);
    geometry.push(floor.geometry);
    materials.push(floor.material);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 80),
      controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 22;
    controls.maxPolarAngle = Math.PI * 0.49;
    const target = new THREE.Vector3(0, 0.04, 0);
    controls.target.copy(target);
    function render() {
      renderer.render(scene, camera);
    }
    function resize() {
      const width = element.clientWidth,
        height = element.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const half = Math.min(
        THREE.MathUtils.degToRad(24),
        Math.atan(Math.tan(THREE.MathUtils.degToRad(24)) * camera.aspect)
      );
      const distance = 4 / Math.sin(half);
      const direction =
        view === 'legs'
          ? new THREE.Vector3(6, 1.6, 7)
          : view === 'top'
            ? new THREE.Vector3(0, 1, 0.001)
            : new THREE.Vector3(6, 4.5, 7);
      camera.position
        .copy(target)
        .add(direction.normalize().multiplyScalar(distance));
      controls.update();
      render();
    }
    controls.addEventListener('change', render);
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => {
      observer.disconnect();
      controls.dispose();
      geometry.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [data, selected, view]);
  return (
    <div className="snake-table-inspector">
      <div className="snake-table-controls">
        <label>
          Table
          <select
            aria-label="Table"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {Object.entries(
              data?.scenes || { 'murlan-default': { label: 'Octagon Table' } }
            ).map(([id, item]) => (
              <option key={id} value={id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          View
          <select
            aria-label="View"
            value={view}
            onChange={(e) => setView(e.target.value)}
          >
            <option value="table">Table & chairs</option>
            <option value="legs">Leg clearance</option>
            <option value="top">Above table</option>
          </select>
        </label>
      </div>
      <div
        className="snake-table-canvas"
        ref={host}
        role="img"
        aria-label="Interactive Snake and Ladder table with four seated players"
      />
      <div className="snake-table-caption" role="status">
        {error ||
          (data ? 'Drag to inspect · Simplified materials' : 'Loading tables…')}
      </div>
    </div>
  );
}
createRoot(document.getElementById('snake-tables-preview')!).render(
  <Preview />
);
