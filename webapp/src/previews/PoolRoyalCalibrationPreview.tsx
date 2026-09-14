import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fitPoolRoyalTable } from '../pages/Games/shared/poolRoyalTableGeometry';
import {
  PoolRoyalPhysics,
  PoolRoyalPhysicsClock,
  resolveMappedPoolCushion
} from '../pages/Games/shared/poolRoyalPhysics';
import { separatePoolBalls } from '../pages/Games/poolRoyaleBallSeparation.js';

declare const POOL_TABLE_GZIP: string;
declare const POOL_REVIEW_METRICS: {
  playW: number;
  playL: number;
  clothY: number;
  ballY: number;
  ballR: number;
};
declare const POOL_EYE_TRACE: number[][];
const m = POOL_REVIEW_METRICS;

function CalibrationPreview() {
  const stage = useRef<HTMLDivElement>(null);
  const live = useRef({
    view: 'table',
    mapping: true,
    spin: 0,
    shot: 0,
    reset: 0
  });
  const [ready, setReady] = useState(false),
    [status, setStatus] = useState('Loading table…');
  const [view, setView] = useState('table'),
    [mapping, setMapping] = useState(true),
    [spin, setSpin] = useState(0);
  useEffect(() => {
    const host = stage.current!;
    let cancelled = false,
      animation = 0,
      renderer: THREE.WebGLRenderer | undefined;
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1000);
    const physics = new PoolRoyalPhysics(m.ballR),
      clock = new PoolRoyalPhysicsClock();
    const loader = new GLTFLoader();
    const packed = Uint8Array.from(atob(POOL_TABLE_GZIP), (c) =>
      c.charCodeAt(0)
    );
    const stream = new Blob([packed])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    let observer: ResizeObserver | undefined;
    new Response(stream)
      .arrayBuffer()
      .then((buffer) => loader.parseAsync(buffer, ''))
      .then((gltf) => {
        if (cancelled) return;
        const model = gltf.scene,
          calibration = fitPoolRoyalTable(model, m.playW, m.playL, m.clothY);
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        } catch {
          setStatus('WebGL unavailable in this browser.');
          return;
        }
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.domElement.setAttribute(
          'aria-label',
          'Measured Showood table with source-engine ball physics'
        );
        renderer.domElement.setAttribute('role', 'img');
        host.appendChild(renderer.domElement);
        scene.add(model, new THREE.HemisphereLight(0xffffff, 0x879199, 2.4));
        const light = new THREE.DirectionalLight(0xffffff, 3);
        light.position.set(20, 90, 50);
        scene.add(light);
        const points = calibration.segments.flatMap((s) => [
          new THREE.Vector3(s.start.x, m.ballY, s.start.y),
          new THREE.Vector3(s.end.x, m.ballY, s.end.y)
        ]);
        const overlay = new THREE.Group();
        overlay.add(
          new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: 0x50e8ed, depthTest: false })
          )
        );
        for (const pocket of calibration.pockets) {
          const circle = Array.from(
            { length: 65 },
            (_, i) =>
              new THREE.Vector3(
                pocket.center.x + Math.cos((i * Math.PI) / 32) * pocket.radius,
                m.clothY + 0.08,
                pocket.center.y + Math.sin((i * Math.PI) / 32) * pocket.radius
              )
          );
          overlay.add(
            new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(circle),
              new THREE.LineBasicMaterial({ color: 0xfac766, depthTest: false })
            )
          );
        }
        scene.add(overlay);
        const targetPocket = calibration.pockets[0].center;
        const direction = targetPocket.clone().normalize();
        const target = targetPocket.clone().addScaledVector(direction, -12);
        const cue = target.clone().addScaledVector(direction, -16);
        const makeBall = (pos: THREE.Vector2, color: number) => {
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(m.ballR, 32, 24),
            new THREE.MeshStandardMaterial({ color, roughness: 0.22 })
          );
          scene.add(mesh);
          const seam = new THREE.Mesh(
            new THREE.TorusGeometry(m.ballR * 1.002, 0.025, 4, 48),
            new THREE.MeshBasicMaterial({ color: 0x25282a })
          );
          mesh.add(seam);
          return {
            pos: pos.clone(),
            vel: new THREE.Vector2(),
            omega: new THREE.Vector3(),
            active: true,
            mesh
          };
        };
        const balls = [makeBall(cue, 0xf6f1e3), makeBall(target, 0xb92832)];
        const cueMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(m.ballR * 0.08, m.ballR * 0.18, 50, 12),
          new THREE.MeshStandardMaterial({ color: 0xb48451 })
        );
        scene.add(cueMesh);
        let last = performance.now(),
          shot = 0,
          reset = 0,
          elapsed = -1;
        const resetBalls = () => {
          balls.forEach((b, i) => {
            b.pos.copy(i ? target : cue);
            b.vel.set(0, 0);
            b.omega.set(0, 0, 0);
            b.active = true;
            b.mesh.visible = true;
          });
          elapsed = -1;
          clock.reset();
        };
        resetBalls();
        const resize = () => {
          const width = host.clientWidth,
            height = host.clientHeight;
          renderer!.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();
        setReady(true);
        setStatus('WebGL · calibrated table · 240 Hz physics');
        const frame = (now: number) => {
          if (cancelled) return;
          const delta = Math.min(100, now - last);
          last = now;
          if (reset !== live.current.reset) {
            reset = live.current.reset;
            resetBalls();
          }
          if (shot !== live.current.shot) {
            shot = live.current.shot;
            resetBalls();
            physics.strike(balls[0], direction, (90 * m.ballR) / 60, {
              x: live.current.spin,
              y: 0
            });
            elapsed = 0;
          }
          if (elapsed >= 0) elapsed += delta;
          const steps = clock.advance(delta).physicsSubsteps;
          for (let i = 0; i < steps; i++) {
            for (const b of balls)
              if (b.active) {
                physics.step(b, 1 / 240);
                if (
                  calibration.pockets.some(
                    (p) =>
                      b.pos.distanceToSquared(p.center) < p.radius * p.radius
                  )
                ) {
                  b.active = false;
                  b.mesh.visible = false;
                  continue;
                }
                const contact = resolveMappedPoolCushion(
                  b,
                  calibration.segments,
                  m.ballR
                );
                if (contact) physics.cushion(b, contact.normal);
                const angular = b.omega.length();
                if (angular > 0)
                  b.mesh.rotateOnWorldAxis(
                    b.omega.clone().divideScalar(angular),
                    angular * 0.25
                  );
              }
            if (
              balls.every((b) => b.active) &&
              balls[0].pos.distanceTo(balls[1].pos) <= m.ballR * 2
            )
              physics.collide(balls[0], balls[1]);
            separatePoolBalls(balls, m.ballR * 2, 5);
          }
          balls.forEach((b) => b.mesh.position.set(b.pos.x, m.ballY, b.pos.y));
          overlay.visible = live.current.mapping;
          if (live.current.view === 'eyes') {
            // Recorded from the actual production eye bones for this exact shot.
            const index =
              elapsed < 0
                ? 0
                : Math.min(
                    POOL_EYE_TRACE.length - 1,
                    Math.floor(elapsed / (1000 / 60))
                  );
            camera.position.fromArray(POOL_EYE_TRACE[index]);
            camera.lookAt(
              cue.x + direction.x * m.ballR * 5,
              m.ballY,
              cue.y + direction.y * m.ballR * 5
            );
          } else {
            camera.position.set(m.playW * 0.7, m.playL * 1.45, m.playL * 0.64);
            camera.lookAt(0, m.clothY - 8, 0);
          }
          cueMesh.visible = elapsed < 0;
          cueMesh.position.set(
            cue.x - direction.x * (25 + m.ballR),
            m.ballY + 0.2,
            cue.y - direction.y * (25 + m.ballR)
          );
          cueMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(direction.x, 0, direction.y)
          );
          renderer!.render(scene, camera);
          animation = requestAnimationFrame(frame);
        };
        animation = requestAnimationFrame(frame);
      })
      .catch((error) => setStatus(`Preview unavailable: ${error.message}`));
    return () => {
      cancelled = true;
      cancelAnimationFrame(animation);
      observer?.disconnect();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        materials.forEach((mat) => mat?.dispose());
      });
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, []);
  return (
    <>
      <div className="pool-review-controls">
        <button
          type="button"
          aria-pressed={view === 'table'}
          onClick={() => {
            live.current.view = 'table';
            setView('table');
          }}
        >
          Table
        </button>
        <button
          type="button"
          aria-pressed={view === 'eyes'}
          onClick={() => {
            live.current.view = 'eyes';
            setView('eyes');
          }}
        >
          Player eyes
        </button>
        <button
          type="button"
          aria-pressed={mapping}
          onClick={() => {
            live.current.mapping = !mapping;
            setMapping(!mapping);
          }}
        >
          Mapping
        </button>
      </div>
      <div className="pool-review-stage" ref={stage} />
      <div className="pool-review-controls">
        <button
          type="button"
          disabled={!ready}
          onClick={() => live.current.shot++}
        >
          Play shot
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => live.current.reset++}
        >
          Reset
        </button>
        <label>
          Side spin{' '}
          <input
            aria-label="Side spin"
            type="range"
            min="-100"
            max="100"
            value={spin}
            onChange={(e) => {
              setSpin(+e.target.value);
              live.current.spin = +e.target.value / 100;
            }}
          />
        </label>
      </div>
      <div className="pool-review-status" role="status">
        {status}
      </div>
    </>
  );
}
createRoot(document.getElementById('pool-royal-calibration')!).render(
  <CalibrationPreview />
);
