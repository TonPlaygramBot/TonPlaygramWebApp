import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { SnookerRoyalPowerSlider } from '../../../snooker-royale-power-slider.js';
import { resolvePoolRoyalReleasePower } from '../pages/Games/poolRoyaleShotState.js';
import { advancePoolRoyalCueStroke } from '../pages/Games/poolRoyaleCueStrokeTimeline.js';
import { consumeSnookerPhysicsTime } from '../games/snooker/physicsClock';
import { calendar, createCareer } from '../games/snooker/career';
import '../../../power-slider.css';
import './snooker-shot-preview.css';
import '../../../snooker-royale-power-slider.css';

function SnookerShotPreview() {
  const host = useRef<HTMLDivElement>(null),
    powerMount = useRef<HTMLDivElement>(null);
  const aim = useRef(0),
    reset = useRef(() => {});
  const [tab, setTab] = useState('table'),
    [angle, setAngle] = useState(0),
    [status, setStatus] = useState('Pull down and release to strike'),
    [shots, setShots] = useState(0);
  useEffect(() => {
    if (tab !== 'table' || !host.current || !powerMount.current) return;
    const el = host.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071d18');
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setStatus('WebGL is unavailable in this preview.');
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    el.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    camera.position.set(0, 7.4, 6.2);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xf0f5df, 0x163c2d, 2));
    const light = new THREE.DirectionalLight(0xfff5d2, 3);
    light.position.set(-3, 7, 2);
    scene.add(light);
    const box = (
      w: number,
      h: number,
      d: number,
      color: string,
      x = 0,
      y = 0,
      z = 0
    ) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.65 })
      );
      m.position.set(x, y, z);
      scene.add(m);
      return m;
    };
    box(3.25, 0.3, 5.85, '#452c20', 0, -0.17);
    box(2.9, 0.08, 5.5, '#08764f', 0, 0.01);
    box(0.13, 0.16, 5.5, '#17573c', -1.48, 0.12);
    box(0.13, 0.16, 5.5, '#17573c', 1.48, 0.12);
    box(3.05, 0.16, 0.14, '#17573c', 0, 0.12, -2.8);
    box(3.05, 0.16, 0.14, '#17573c', 0, 0.12, 2.8);
    const pockets = [
      [-1.42, -2.69],
      [1.42, -2.69],
      [-1.44, 0],
      [1.44, 0],
      [-1.42, 2.69],
      [1.42, 2.69]
    ];
    pockets.forEach(([x, z]) => {
      const p = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.14, 0.04, 24),
        new THREE.MeshBasicMaterial({ color: '#061410' })
      );
      p.position.set(x, 0.1, z);
      scene.add(p);
    });
    const radius = 0.085,
      geo = new THREE.SphereGeometry(radius, 20, 14);
    const makeBall = (color: string, x: number, z: number) => {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.18,
          metalness: 0.06
        })
      );
      mesh.position.set(x, 0.145, z);
      scene.add(mesh);
      return {
        mesh,
        pos: new THREE.Vector2(x, z),
        vel: new THREE.Vector2(),
        active: true
      };
    };
    const cue = makeBall('#ffffe7', 0, 1.9),
      red = makeBall('#c51d35', 0, -0.2),
      balls = [cue, red];
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.025, 1.65, 12),
      new THREE.MeshStandardMaterial({ color: '#d4b477', roughness: 0.42 })
    );
    stick.rotation.x = Math.PI / 2;
    scene.add(stick);
    const guide = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({
        color: '#e7dcb2',
        dashSize: 0.09,
        gapSize: 0.07,
        transparent: true,
        opacity: 0.65
      })
    );
    scene.add(guide);
    const clock = { remainderMs: 0 };
    let stroke: any = null,
      busy = false,
      disposed = false,
      last = performance.now(),
      raf = 0;
    const layout = () => {
      const w = el.clientWidth;
      renderer.setSize(w, 440);
      camera.aspect = w / 440;
      camera.updateProjectionMatrix();
    };
    layout();
    const observer = new ResizeObserver(layout);
    observer.observe(el);
    const ready = () => {
      for (const [i, b] of balls.entries()) {
        b.active = true;
        b.mesh.visible = true;
        b.pos.set(0, i === 0 ? 1.9 : -0.2);
        b.vel.set(0, 0);
      }
      busy = false;
      stroke = null;
      slider.unlock();
      slider.set(0);
      setStatus('Pull down and release to strike');
    };
    const slider = new SnookerRoyalPowerSlider({
      mount: powerMount.current,
      value: 0,
      labels: false,
      onCommit: (value: number) => {
        const power = resolvePoolRoyalReleasePower({
          busy,
          committedPower: value / 100,
          currentPower: 0,
          minPower: 0
        });
        if (power === null || power <= 0 || !cue.active) return false;
        busy = true;
        slider.lock();
        setStatus('Cue in motion');
        const direction = new THREE.Vector3(
          Math.sin(aim.current),
          0,
          -Math.cos(aim.current)
        );
        const contact = cue.mesh.position
          .clone()
          .addScaledVector(direction, -0.9);
        stroke = {
          startTime: performance.now(),
          pullbackDuration: 80,
          strikeDuration: 120,
          holdDuration: 50,
          recoverDuration: 100,
          idlePos: contact.clone(),
          pullPos: contact.clone().addScaledVector(direction, -0.4 * power),
          contactPos: contact.clone(),
          shotApplied: false,
          onImpact: () => {
            cue.vel
              .set(direction.x, direction.z)
              .multiplyScalar(0.035 + 0.15 * power);
            setShots((n) => n + 1);
            setStatus('Shot released');
          }
        };
        return true;
      }
    });
    reset.current = ready;
    const render = (now: number) => {
      if (disposed) return;
      const tick = consumeSnookerPhysicsTime(clock, now - last);
      last = now;
      if (stroke) {
        const sample = advancePoolRoyalCueStroke(stick, stroke, now);
        if (sample.done) stroke = null;
      }
      for (let k = 0; k < tick.steps; k++) {
        balls.forEach((b) => {
          if (!b.active) return;
          b.pos.addScaledVector(b.vel, tick.stepScale);
          b.vel.multiplyScalar(Math.pow(0.985, tick.stepScale));
          if (
            pockets.some(
              ([x, z]) => b.pos.distanceTo(new THREE.Vector2(x, z)) < 0.16
            )
          ) {
            b.active = false;
            b.mesh.visible = false;
            b.vel.set(0, 0);
            setStatus(
              b === red ? 'Red potted · 1 point' : 'In-off · cue ball potted'
            );
            return;
          }
          if (Math.abs(b.pos.x) > 1.35) {
            b.pos.x = Math.sign(b.pos.x) * 1.35;
            b.vel.x *= -0.82;
          }
          if (Math.abs(b.pos.y) > 2.6) {
            b.pos.y = Math.sign(b.pos.y) * 2.6;
            b.vel.y *= -0.82;
          }
          if (b.vel.length() < 0.001) b.vel.set(0, 0);
        });
        if (cue.active && red.active) {
          const d = red.pos.clone().sub(cue.pos),
            dist = d.length();
          if (dist > 0 && dist < radius * 2) {
            const n = d.divideScalar(dist),
              closing = cue.vel.clone().sub(red.vel).dot(n);
            if (closing > 0) {
              cue.vel.addScaledVector(n, -closing * 0.97);
              red.vel.addScaledVector(n, closing * 0.97);
            }
            const overlap = (radius * 2 - dist) / 2;
            cue.pos.addScaledVector(n, -overlap);
            red.pos.addScaledVector(n, overlap);
          }
        }
      }
      balls.forEach((b) => b.mesh.position.set(b.pos.x, 0.145, b.pos.y));
      if (busy && !stroke && balls.every((b) => b.vel.lengthSq() === 0)) {
        busy = false;
        slider.unlock();
        slider.set(0);
        if (!cue.active) setStatus('Reset table to play again');
        else setStatus('Ready for your next shot');
      }
      const direction = new THREE.Vector3(
        Math.sin(aim.current),
        0,
        -Math.cos(aim.current)
      );
      if (!busy && cue.active) {
        stick.visible = true;
        stick.position
          .copy(cue.mesh.position)
          .addScaledVector(direction, -0.95 - (slider.get() / 100) * 0.25);
        stick.rotation.set(Math.PI / 2, 0, -aim.current);
        guide.geometry.setFromPoints([
          cue.mesh.position.clone(),
          cue.mesh.position.clone().addScaledVector(direction, 2)
        ]);
        guide.computeLineDistances();
        guide.visible = true;
      } else guide.visible = false;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      slider.destroy();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material)
          (Array.isArray(m.material) ? m.material : [m.material]).forEach((a) =>
            a.dispose()
          );
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [tab]);
  return (
    <div className="sp-app">
      <header>
        <span className="sp-mark">♛</span>
        <div>
          <small>TONPLAYGRAM</small>
          <strong>Snooker Royal</strong>
        </div>
        <span className="sp-build">REVIEW</span>
      </header>
      <nav>
        <button aria-pressed={tab === 'table'} onClick={() => setTab('table')}>
          Cue test
        </button>
        <button
          aria-pressed={tab === 'career'}
          onClick={() => setTab('career')}
        >
          Career path
        </button>
      </nav>
      {tab === 'table' ? (
        <>
          <div className="sp-status">
            <span>{status}</span>
            <b>{shots} shots</b>
          </div>
          <div className="sp-arena">
            <div ref={host} className="sp-canvas" />
            <div className="sp-power" ref={powerMount} />
            <span className="sp-practice">SHOT-CONTROL PREVIEW</span>
          </div>
          <div className="sp-controls">
            <label htmlFor="sp-aim">
              Aim <span>{angle}°</span>
            </label>
            <input
              id="sp-aim"
              type="range"
              min="-70"
              max="70"
              value={angle}
              onChange={(e) => {
                const n = +e.target.value;
                aim.current = (n * Math.PI) / 180;
                setAngle(n);
              }}
            />
            <button onClick={() => reset.current()}>Reset table</button>
          </div>
        </>
      ) : (
        <div className="sp-career">
          <small>CLUB → QUALIFYING → PROFESSIONAL</small>
          <h2>
            Your road to the
            <br />
            <em>world title.</em>
          </h2>
          {calendar(createCareer().tier).map((e, i) => (
            <div className="sp-event" key={e.name}>
              <b>0{i + 1}</b>
              <div>
                <strong>{e.name}</strong>
                <span>
                  {e.venue} · Best of {e.rounds.join(' / ')}
                </span>
              </div>
            </div>
          ))}
          <div className="sp-feature">
            15-red frames · Multi-frame matches
            <br />
            Two-season rankings · Saved shot progress
          </div>
        </div>
      )}
    </div>
  );
}
const mount = document.getElementById('snooker-shot-preview');
if (mount) createRoot(mount).render(<SnookerShotPreview />);
