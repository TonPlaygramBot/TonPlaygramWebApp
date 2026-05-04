import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type PinState = { mesh: THREE.Group; knocked: boolean };

type ReturnBall = { mesh: THREE.Mesh; t: number; active: boolean };

const LANE_LENGTH = 18.29; // 60ft foul line -> head pin
const LANE_WIDTH = 1.05; // 41.5in
const PIN_ROWS = [1, 2, 3, 4];

const createPin = () => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.095, 0.36, 24),
    new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.35, metalness: 0.08 }),
  );
  body.position.y = 0.18;
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.076, 0.03, 24),
    new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.5 }),
  );
  stripe.position.y = 0.28;
  g.add(body, stripe);
  return g;
};

export default function BowlingGame() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const pinsRef = useRef<PinState[]>([]);
  const ballRef = useRef<THREE.Mesh | null>(null);
  const returnBallRef = useRef<ReturnBall | null>(null);
  const [status, setStatus] = useState('Ready: swipe your mouse/touch horizontally then press Space to throw.');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020617');

    const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, 2.3, 7.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(3, 8, 4);
    scene.add(keyLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 36),
      new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.88, metalness: 0.1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const lane = new THREE.Mesh(
      new THREE.BoxGeometry(LANE_WIDTH + 0.25, 0.08, LANE_LENGTH + 4.7),
      new THREE.MeshStandardMaterial({ color: '#9a6b3f', roughness: 0.42, metalness: 0.15 }),
    );
    lane.position.set(0, 0.04, -6.2);
    scene.add(lane);

    const oil = new THREE.Mesh(
      new THREE.PlaneGeometry(LANE_WIDTH, LANE_LENGTH),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', transparent: true, opacity: 0.09, roughness: 0.05, metalness: 0.6 }),
    );
    oil.rotation.x = -Math.PI / 2;
    oil.position.set(0, 0.085, -6.9);
    scene.add(oil);

    const gutters = [-1, 1].map((dir) => {
      const gutter = new THREE.Mesh(
        new THREE.BoxGeometry(0.17, 0.06, LANE_LENGTH + 4.2),
        new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.9 }),
      );
      gutter.position.set(dir * (LANE_WIDTH * 0.5 + 0.13), 0.015, -6.2);
      scene.add(gutter);
      return gutter;
    });

    const pit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.8), new THREE.MeshStandardMaterial({ color: '#0f172a' }));
    pit.position.set(0, -0.2, -15.8);
    scene.add(pit);

    const sweepBar = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 0.1), new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.7, roughness: 0.2 }));
    sweepBar.position.set(0, 0.45, -14.95);
    scene.add(sweepBar);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 24), new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.2, metalness: 0.2 }));
    ball.position.set(0, 0.12, 1.1);
    scene.add(ball);
    ballRef.current = ball;

    const returnTrack = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.55, 0.12, -15.4),
      new THREE.Vector3(0.92, 0.28, -10),
      new THREE.Vector3(0.98, 0.18, -2),
      new THREE.Vector3(0.68, 0.12, 0.7),
    ]), 50, 0.04, 12, false), new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.85, roughness: 0.25 }));
    scene.add(returnTrack);

    const returnedBall = ball.clone();
    returnedBall.material = new THREE.MeshStandardMaterial({ color: '#60a5fa', emissive: '#1d4ed8', emissiveIntensity: 0.25 });
    returnedBall.visible = false;
    scene.add(returnedBall);
    returnBallRef.current = { mesh: returnedBall, t: 0, active: false };

    const pinBaseZ = -14.2;
    const pinSpacing = 0.18;
    pinsRef.current = [];
    PIN_ROWS.forEach((count, rowIdx) => {
      for (let i = 0; i < count; i += 1) {
        const pin = createPin();
        pin.position.set((i - (count - 1) / 2) * pinSpacing, 0, pinBaseZ + rowIdx * pinSpacing);
        scene.add(pin);
        pinsRef.current.push({ mesh: pin, knocked: false });
      }
    });

    let shotActive = false;
    let shotVelocity = new THREE.Vector3(0, 0, -7.8);
    let sweepPhase = 0;
    let inputX = 0;

    const handleMove = (x: number) => {
      const nx = ((x / mount.clientWidth) * 2 - 1) * 0.34;
      inputX = THREE.MathUtils.clamp(nx, -0.34, 0.34);
      if (!shotActive && ballRef.current) ballRef.current.position.x = inputX;
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.offsetX);
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const rect = mount.getBoundingClientRect();
      handleMove(touch.clientX - rect.left);
    };

    const resetPins = () => {
      pinsRef.current.forEach((p) => {
        p.knocked = false;
        p.mesh.rotation.set(0, 0, 0);
        p.mesh.position.y = 0;
      });
    };

    const triggerReturn = () => {
      const r = returnBallRef.current;
      if (!r) return;
      r.active = true;
      r.t = 0;
      r.mesh.visible = true;
      setStatus('Ball return active: topi po kthehet te lojtari.');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || shotActive || !ballRef.current) return;
      shotActive = true;
      shotVelocity = new THREE.Vector3(inputX * 1.8, 0, -8.5);
      setStatus('Shot launched. Pinsetter do pastroje pinat e rrezuar dhe topi kthehet automatikisht.');
    };

    mount.addEventListener('mousemove', onMouseMove);
    mount.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    let raf = 0;
    const clock = new THREE.Clock();
    const returnPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.55, 0.12, -15.4),
      new THREE.Vector3(0.92, 0.28, -10),
      new THREE.Vector3(0.98, 0.18, -2),
      new THREE.Vector3(0.68, 0.12, 0.7),
    ]);

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const d = Math.min(clock.getDelta(), 0.033);

      if (shotActive && ballRef.current) {
        ballRef.current.position.addScaledVector(shotVelocity, d);
        if (ballRef.current.position.z < -13.8) {
          pinsRef.current.forEach((p) => {
            if (p.knocked) return;
            const dist = p.mesh.position.distanceTo(ballRef.current!.position);
            if (dist < 0.22) {
              p.knocked = true;
              p.mesh.rotation.z = THREE.MathUtils.randFloat(-1.45, -0.65);
              p.mesh.rotation.x = THREE.MathUtils.randFloat(-0.3, 0.3);
              p.mesh.position.y = 0.02;
            }
          });
        }

        if (ballRef.current.position.z < -15.6) {
          ballRef.current.visible = false;
          shotActive = false;
          sweepPhase = 1;
        }
      }

      if (sweepPhase > 0) {
        sweepPhase += d;
        if (sweepPhase < 1) {
          sweepBar.position.z = THREE.MathUtils.lerp(-14.95, -13.8, sweepPhase);
          sweepBar.position.y = 0.38;
        } else if (sweepPhase < 1.8) {
          pinsRef.current.forEach((p) => {
            if (p.knocked) p.mesh.visible = false;
          });
          sweepBar.position.z = THREE.MathUtils.lerp(-13.8, -14.95, (sweepPhase - 1) / 0.8);
        } else {
          sweepPhase = 0;
          pinsRef.current.forEach((p) => (p.mesh.visible = true));
          resetPins();
          if (ballRef.current) {
            ballRef.current.visible = true;
            ballRef.current.position.set(inputX, 0.12, 1.1);
          }
          triggerReturn();
        }
      }

      const rb = returnBallRef.current;
      if (rb?.active) {
        rb.t += d * 0.5;
        const t = Math.min(rb.t, 1);
        rb.mesh.position.copy(returnPath.getPointAt(t));
        if (t >= 1) {
          rb.active = false;
          rb.mesh.visible = false;
          setStatus('Ready for next shot.');
        }
      }

      camera.position.lerp(new THREE.Vector3(inputX * 0.35, 2.3, 7.2), 0.06);
      camera.lookAt(new THREE.Vector3(0, 0.3, -10));
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      mount.removeEventListener('mousemove', onMouseMove);
      mount.removeEventListener('touchmove', onTouchMove);
      renderer.dispose();
    };
  }, []);

  return (
    <div className='relative h-screen w-screen overflow-hidden bg-slate-950'>
      <div ref={mountRef} className='h-full w-full' />
      <div className='pointer-events-none absolute left-3 right-3 top-3 rounded-xl border border-cyan-400/20 bg-slate-900/75 p-3 text-xs text-slate-100'>
        <div className='font-semibold text-cyan-300'>Bowling Mechanic Demo</div>
        <div>{status}</div>
      </div>
    </div>
  );
}
