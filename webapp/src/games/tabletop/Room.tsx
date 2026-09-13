import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import {
  buildDominoArena,
  DOMINO_TABLE_DIMENSIONS
} from '../../utils/dominoArena.js';
import { boardTexture, perimeter } from './boardTexture';
import { ROOM_OPTIONS } from './roomOptions';
import { PLAYER_COLORS, TILE_COLORS, GEM_COLORS } from './shared/catalog.mjs';
import type { GameView } from './types';
type Props = {
  view: GameView;
  roomId: string;
  viewer: number;
  onSelect: (cell: number) => void;
};
export default function TabletopRoom({
  view,
  roomId,
  viewer,
  onSelect
}: Props) {
  const host = useRef<HTMLDivElement>(null),
    update = useRef<null | ((v: GameView) => void)>(null),
    zoom = useRef<null | ((near: boolean) => void)>(null),
    select = useRef(onSelect);
  select.current = onSelect;
  const current = useRef(view);
  current.current = view;
  const [near, setNear] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'low-power'
      });
    } catch {
      setError(
        '3D is unavailable on this device. All moves remain available below.'
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0c151c');
    const camera = new THREE.PerspectiveCamera(39, 1, 0.05, 70),
      arena = buildDominoArena({ scene, renderer });
    const board = new THREE.Group();
    scene.add(board);
    const top = DOMINO_TABLE_DIMENSIONS.clothTop + 0.045;
    const geometries = new Map<string, THREE.BufferGeometry>();
    let dead = false,
      nearView = true,
      hdr: THREE.Texture | null = null,
      pmrem: THREE.WebGLRenderTarget | null = null;
    const hits: THREE.Mesh[] = [];
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    // All game pieces share Blender-authored geometry. Existing arena supplies chairs/table.
    const clear = () => {
      board.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if ((m as THREE.MeshStandardMaterial).map)
              (m as THREE.MeshStandardMaterial).map!.dispose();
            m.dispose();
          });
        }
      });
      board.clear();
      hits.length = 0;
    };
    const render = () => {
      if (!dead) renderer.render(scene, camera);
    };
    function resize() {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const distance =
        Math.max(5.5, 4.7 / camera.aspect) * (nearView ? 1 : 1.35);
      camera.position.set(0, top + distance * 0.91, distance * 0.52);
      camera.lookAt(0, top, 0);
      camera.updateProjectionMatrix();
      render();
    }
    function piece(
      kind: string,
      x: number,
      z: number,
      color: string,
      scale: THREE.Vector3 | number = 1,
      y = top + 0.09
    ) {
      const geometry = geometries.get(kind);
      if (!geometry) return null;
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.38,
          metalness: 0.16
        })
      );
      mesh.position.set(x, y, z);
      if (typeof scale === 'number') mesh.scale.setScalar(scale);
      else mesh.scale.copy(scale);
      board.add(mesh);
      return mesh;
    }
    function draw(v: GameView) {
      if (dead || !geometries.size) return;
      clear();
      const base = piece(
        'tile',
        0,
        0,
        '#ffffff',
        new THREE.Vector3(3.25, 1, 3.25),
        top
      );
      if (base) {
        const material = base.material as THREE.MeshStandardMaterial;
        material.map = boardTexture(v, viewer);
        material.roughness = 0.75;
        base.userData.board = true;
        hits.push(base);
      }
      const coord = (n: number) => ((n + 0.5) / 7 - 0.5) * 3.25;
      if (v.gameId === 'oligarchs') {
        v.board!.forEach((cell, i) => {
          const [cx, cy] = perimeter(i);
          if (cell.owner >= 0) {
            piece(
              cell.level >= 2 ? 'tower' : 'house',
              coord(cx),
              coord(cy),
              PLAYER_COLORS[cell.owner],
              0.55 + cell.level * 0.12
            );
          }
        });
        v.players.forEach((p, i) => {
          if (p.out) return;
          const [cx, cy] = perimeter(p.position);
          piece(
            'token',
            coord(cx) + ((i % 2) - 0.5) * 0.13,
            coord(cy) + (Math.floor(i / 2) - 0.5) * 0.13,
            PLAYER_COLORS[i],
            0.75,
            top + 0.13
          );
        });
      } else if (v.gameId === 'harborempires') {
        v.board!.forEach((cell, i) => {
          if (cell.owner >= 0)
            piece(
              cell.level === 2 ? 'tower' : 'house',
              (((i % 4) + 0.5) / 4 - 0.5) * 2.95,
              ((Math.floor(i / 4) + 0.5) / 4 - 0.5) * 2.95,
              PLAYER_COLORS[cell.owner],
              1.15
            );
        });
      } else if (v.gameId === 'railkingdoms') {
        v.routes!.forEach((r) => {
          if (r.owner < 0) return;
          const ax = ((170 + (r.a % 4) * 350) / 1400) * 3.25 - 1.625,
            az = ((180 + Math.floor(r.a / 4) * 500) / 1400) * 3.25 - 1.625,
            bx = ((170 + (r.b % 4) * 350) / 1400) * 3.25 - 1.625,
            bz = ((180 + Math.floor(r.b / 4) * 500) / 1400) * 3.25 - 1.625;
          for (let i = 0; i < r.length; i++) {
            const f = (i + 0.5) / r.length,
              m = piece(
                'train',
                ax + (bx - ax) * f,
                az + (bz - az) * f,
                PLAYER_COLORS[r.owner],
                0.85
              );
            if (m) m.rotation.y = -Math.atan2(bz - az, bx - ax);
          }
        });
      } else if (v.gameId === 'mosaicroyal') {
        v.factories!.forEach((tiles, i) => {
          const x = ((i % 3) - 1) * 0.9,
            z = -0.87 + Math.floor(i / 3) * 0.68;
          const tray = piece(
            'tile',
            x,
            z,
            '#a7b6b9',
            new THREE.Vector3(0.69, 0.5, 0.55)
          );
          tiles.forEach((c, j) =>
            piece(
              'tile',
              x + ((j % 2) - 0.5) * 0.24,
              z + (Math.floor(j / 2) - 0.5) * 0.24,
              TILE_COLORS[c],
              new THREE.Vector3(0.2, 1, 0.2),
              top + 0.15
            )
          );
          if (tray) tray.userData.source = i;
        });
        v.center
          ?.slice(0, 25)
          .forEach((c, i) =>
            piece(
              'tile',
              ((i % 9) - 4) * 0.19,
              0.19 + Math.floor(i / 9) * 0.19,
              TILE_COLORS[c],
              new THREE.Vector3(0.16, 1, 0.16),
              top + 0.12
            )
          );
      } else
        v.market?.forEach((c, i) =>
          piece(
            'gem',
            ((i % 3) - 1) * 1.0,
            -0.43 + Math.floor(i / 3) * 1.23,
            GEM_COLORS[c.color],
            1.8
          )
        );
      render();
    }
    update.current = draw;
    zoom.current = (near) => {
      nearView = near;
      resize();
    };
    new GLTFLoader().load(
      '/assets/tabletop/tabletop-pieces.glb',
      (gltf) => {
        if (dead) {
          gltf.scene.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.geometry.dispose();
              (o.material as THREE.Material).dispose();
            }
          });
          return;
        }
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
            if (o.name === 'tile') {
              const pos = geometry.getAttribute('position'),
                uv = geometry.getAttribute('uv');
              for (let i = 0; i < pos.count; i++)
                uv.setXY(i, pos.getX(i) + 0.5, 0.5 - pos.getZ(i));
              uv.needsUpdate = true;
            }
            geometries.set(o.name, geometry);
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
        draw(current.current);
      },
      undefined,
      () => {
        if (!dead)
          setError('Game pieces could not load. Use the move controls below.');
      }
    );
    const room = ROOM_OPTIONS.find((r) => r.id === roomId) || ROOM_OPTIONS[0];
    new RGBELoader().load(
      room.hdri,
      (texture) => {
        if (dead) {
          texture.dispose();
          return;
        }
        hdr = texture;
        const generator = new THREE.PMREMGenerator(renderer);
        pmrem = generator.fromEquirectangular(texture);
        scene.environment = pmrem.texture;
        scene.background = texture;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.backgroundBlurriness = 0.4;
        scene.backgroundIntensity = 0.3;
        generator.dispose();
        render();
      },
      undefined,
      () => {}
    );
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const click = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(hits)[0];
      if (!hit) return;
      const x = (hit.point.x + 1.625) / 3.25,
        z = (hit.point.z + 1.625) / 3.25;
      const v = current.current;
      if (v.gameId === 'oligarchs') {
        const cx = Math.floor(x * 7),
          cy = Math.floor(z * 7);
        const index = Array.from({ length: 24 }, (_, i) => i).find((i) => {
          const [a, b] = perimeter(i);
          return a === cx && b === cy;
        });
        if (index !== undefined) select.current(index);
      } else if (v.gameId === 'harborempires')
        select.current(Math.min(15, Math.floor(z * 4) * 4 + Math.floor(x * 4)));
      else if (v.gameId === 'gemsyndicate') {
        const col = Math.floor((x * 1400 - 85) / 430),
          row = Math.floor((z * 1400 - 230) / 530);
        if (col >= 0 && col < 3 && row >= 0 && row < 2)
          select.current(row * 3 + col);
      }
    };
    renderer.domElement.addEventListener('pointerup', click);
    const contextLost = (e: Event) => {
      e.preventDefault();
      setError('3D paused. Your match continues with the move controls below.');
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    return () => {
      dead = true;
      observer.disconnect();
      update.current = null;
      zoom.current = null;
      renderer.domElement.removeEventListener('pointerup', click);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      clear();
      geometries.forEach((g) => g.dispose());
      arena.dispose();
      pmrem?.dispose();
      hdr?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [roomId, viewer]);
  useEffect(() => {
    update.current?.(view);
  }, [view]);
  return (
    <div className="tt-scene-wrap">
      <div
        className="tt-scene"
        ref={host}
        aria-label={`${view.gameId} 3D game board`}
      />
      <span className="tt-scene-label">
        {error ||
          `${ROOM_OPTIONS.find((r) => r.id === roomId)?.name || 'Royal Club'} · TAP THE BOARD`}
      </span>
      <div className="tt-view-controls">
        <button
          onClick={() => {
            setNear(!near);
            zoom.current?.(!near);
          }}
          aria-label={near ? 'View playing room' : 'View board closer'}
        >
          {near ? 'Room view' : 'Board view'}
        </button>
      </div>
    </div>
  );
}
