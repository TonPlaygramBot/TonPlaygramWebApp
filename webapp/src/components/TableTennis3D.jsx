import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

/**
 * Simple 3D table tennis game with basic AI.
 * Mobile portrait friendly – always shows full table.
 */

const CAM = { fov: 60, near: 0.1, far: 5000 };
const TABLE = { L: 2.74, W: 1.525, H: 0.76 };
const SCALE = 48;
const R = { ball: 0.02 * SCALE, paddleR: 0.095 * SCALE };
const COLORS = Object.freeze({
  bg: 0x0b0d11,
  table: 0x0a5d9e,
  edge: 0x0e3f69,
  line: 0xf8fafc,
  p1: 0x22c55e,
  p2: 0xf59e0b,
  ball: 0xffffff
});

const mat = (c) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0.05 });

export default function TableTennis3D({ turn, onPoint }) {
  const hostRef = useRef(null);
  const rafRef = useRef(0);
  const stateRef = useRef({});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.bg);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1));

    const L = TABLE.L * SCALE,
      W = TABLE.W * SCALE,
      H = TABLE.H * SCALE;

    const cam = new THREE.PerspectiveCamera(
      CAM.fov,
      host.clientWidth / host.clientHeight,
      CAM.near,
      CAM.far
    );
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 200;
    controls.maxDistance = 600;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minPolarAngle = Math.PI / 4;

    const fitCamera = () => {
      cam.aspect = host.clientWidth / host.clientHeight;
      cam.updateProjectionMatrix();
      cam.position.set(0, 400, L * 0.7);
      controls.target.set(0, H, 0);
      controls.update();
    };
    fitCamera();

    // Table
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mat(COLORS.table));
    top.rotation.x = -Math.PI / 2;
    top.position.y = H;
    scene.add(top);
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.02, L * 1.02), mat(COLORS.edge));
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = H - 0.01;
    scene.add(edge);

    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 1.02, 0.02 * SCALE),
      mat(COLORS.line)
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, H + 0.01, 0);
    scene.add(line);

    // Ball
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(R.ball, 16, 16),
      mat(COLORS.ball)
    );
    ball.position.set(0, H + R.ball, 0);
    scene.add(ball);

    // Paddles
    const paddleGeom = new THREE.CylinderGeometry(
      R.paddleR,
      R.paddleR,
      0.02 * SCALE,
      16
    );
    paddleGeom.rotateX(Math.PI / 2);
    const player = new THREE.Mesh(paddleGeom, mat(COLORS.p1));
    player.position.set(0, H + 0.01 * SCALE, L / 2 - R.paddleR * 1.5);
    scene.add(player);
    const ai = new THREE.Mesh(paddleGeom, mat(COLORS.p2));
    ai.position.set(0, H + 0.01 * SCALE, -L / 2 + R.paddleR * 1.5);
    scene.add(ai);

    const ballVel = new THREE.Vector3();

    const serve = (side) => {
      ball.position.set(0, H + R.ball, side === 'player' ? L / 2 - 20 : -L / 2 + 20);
      ballVel.set((Math.random() - 0.5) * 4, 0, side === 'player' ? -6 : 6);
    };

    stateRef.current = { ball, ballVel, player, ai, serve, L, W };

    // Player control
    const handleMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * W * 0.9;
      player.position.x = THREE.MathUtils.clamp(
        x,
        -W / 2 + R.paddleR,
        W / 2 - R.paddleR
      );
    };
    renderer.domElement.addEventListener('pointermove', handleMove);

    serve(turn);

    const step = () => {
      controls.update();
      const { ball, ballVel, player, ai, L, W } = stateRef.current;
      ball.position.add(ballVel);

      // Wall bounce
      if (ball.position.x < -W / 2 + R.ball || ball.position.x > W / 2 - R.ball) {
        ballVel.x *= -1;
        ball.position.x = THREE.MathUtils.clamp(
          ball.position.x,
          -W / 2 + R.ball,
          W / 2 - R.ball
        );
      }

      // Paddle collisions
      if (
        ball.position.z > player.position.z - R.ball &&
        Math.abs(ball.position.x - player.position.x) < R.paddleR
      ) {
        ballVel.z = -Math.abs(ballVel.z);
        ballVel.x += (ball.position.x - player.position.x) * 0.1;
        ball.position.z = player.position.z - R.ball;
      } else if (
        ball.position.z < ai.position.z + R.ball &&
        Math.abs(ball.position.x - ai.position.x) < R.paddleR
      ) {
        ballVel.z = Math.abs(ballVel.z);
        ballVel.x += (ball.position.x - ai.position.x) * 0.1;
        ball.position.z = ai.position.z + R.ball;
      }

      // Scoring
      if (ball.position.z > L / 2) {
        onPoint?.('ai');
        serve('player');
      } else if (ball.position.z < -L / 2) {
        onPoint?.('player');
        serve('ai');
      }

      // AI movement
      const targetX = THREE.MathUtils.clamp(
        ball.position.x,
        -W / 2 + R.paddleR,
        W / 2 - R.paddleR
      );
      ai.position.x += (targetX - ai.position.x) * 0.1; // smooth follow

      renderer.render(scene, cam);
      rafRef.current = requestAnimationFrame(step);
    };
    step();

    const onResize = () => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      fitCamera();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', handleMove);
      host.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    // serve when turn changes
    stateRef.current.serve?.(turn);
  }, [turn]);

  return <div ref={hostRef} className="w-full h-[100vh]" />;
}

