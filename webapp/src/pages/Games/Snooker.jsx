import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function Snooker() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(2.8, 1.8, 3.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 1.1;
    controls.maxDistance = 6;

    // Lights
    scene.add(new THREE.HemisphereLight(0xdde7ff, 0x0b1020, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(-2.5, 4, 2);
    scene.add(dir);

    const spot = new THREE.SpotLight(0xffffff, 1.5, 0, Math.PI * 0.2, 0.3, 1);
    spot.position.set(1.3, 2.6, 0.5);
    spot.target.position.set(0, 0.75, 0);
    scene.add(spot, spot.target);

    const point = new THREE.PointLight(0xffffff, 1.2, 10);
    point.position.set(-1.5, 2.2, -0.8);
    scene.add(point);

    const tiny = new THREE.PointLight(0xffffff, 0.6, 3);
    tiny.position.set(0.5, 1.8, 1.2);
    scene.add(tiny);

    // Field (cloth)
    const PLAY_L = 3.57;
    const PLAY_W = 1.78;
    const TABLE_H = 0.75;

    const baseCloth = new THREE.Mesh(
      new THREE.PlaneGeometry(PLAY_L, PLAY_W),
      new THREE.MeshPhysicalMaterial({
        color: 0x1a6d1a, // slightly darker green
        roughness: 0.95,
        sheen: 1.0,
        sheenRoughness: 0.8,
      })
    );
    baseCloth.rotation.x = -Math.PI / 2;
    baseCloth.position.set(0, TABLE_H, 0);
    scene.add(baseCloth);

    // Snooker balls
    const BALL_R = 0.0525;
    const SNOOKER_COLORS = {
      cue: 0xffffff,
      red: 0xff0000,
      yellow: 0xffff00,
      green: 0x006400,
      brown: 0x8b4513,
      blue: 0x0000ff,
      pink: 0xff69b4,
      black: 0x000000,
    };

    function makeBall(color) {
      const mat = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
      });
      const b = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 64, 48), mat);
      b.position.y = TABLE_H + BALL_R;
      return b;
    }

    // 15 red balls
    let redIndex = 0;
    for (let row = 0; row < 5; row++) {
      for (let i = 0; i <= row; i++) {
        if (redIndex >= 15) break;
        const ball = makeBall(SNOOKER_COLORS.red);
        ball.position.x = (i - row / 2) * (BALL_R * 2 + 0.002);
        ball.position.z = -PLAY_W * 0.15 + row * (BALL_R * 1.9);
        scene.add(ball);
        redIndex++;
      }
    }

    // Colored balls
    const yellow = makeBall(SNOOKER_COLORS.yellow);
    yellow.position.set(-PLAY_L * 0.35, TABLE_H + BALL_R, PLAY_W * 0.35);
    scene.add(yellow);

    const green = makeBall(SNOOKER_COLORS.green);
    green.position.set(PLAY_L * 0.35, TABLE_H + BALL_R, PLAY_W * 0.35);
    scene.add(green);

    const brown = makeBall(SNOOKER_COLORS.brown);
    brown.position.set(-0.2, TABLE_H + BALL_R, PLAY_W * 0.35);
    scene.add(brown);

    const blue = makeBall(SNOOKER_COLORS.blue);
    blue.position.set(-0.4, TABLE_H + BALL_R, 0);
    scene.add(blue);

    const pink = makeBall(SNOOKER_COLORS.pink);
    pink.position.set(0, TABLE_H + BALL_R, -PLAY_W * 0.2);
    scene.add(pink);

    const black = makeBall(SNOOKER_COLORS.black);
    black.position.set(0, TABLE_H + BALL_R, -PLAY_W * 0.45);
    scene.add(black);

    // Cue ball
    const cueBall = makeBall(SNOOKER_COLORS.cue);
    cueBall.position.set(0, TABLE_H + BALL_R, PLAY_W * 0.25);

    // Add 4 red dots on cue ball
    const dotSize = 0.008;
    const dotGeom = new THREE.SphereGeometry(dotSize, 16, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const offsets = [
      [BALL_R * 0.7, 0, 0],
      [-BALL_R * 0.7, 0, 0],
      [0, 0, BALL_R * 0.7],
      [0, 0, -BALL_R * 0.7],
    ];
    offsets.forEach((o) => {
      const d = new THREE.Mesh(dotGeom, dotMat);
      d.position.set(o[0], o[1], o[2]);
      cueBall.add(d);
    });
    scene.add(cueBall);

    // Cue stick behind cueball
    const cueStick = new THREE.Group();

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.025, 1.5, 32),
      new THREE.MeshPhysicalMaterial({ color: 0xdeb887, roughness: 0.6 })
    );
    shaft.rotation.x = -Math.PI / 2;
    cueStick.add(shaft);

    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.05, 32),
      new THREE.MeshPhysicalMaterial({ color: 0x0000ff, roughness: 0.4 })
    );
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -0.75;
    cueStick.add(tip);

    const connector = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.015, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0xcd7f32,
        metalness: 0.8,
        roughness: 0.5,
      })
    );
    connector.rotation.x = -Math.PI / 2;
    connector.position.z = -0.748;
    cueStick.add(connector);

    const buttCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 32, 16),
      new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.5 })
    );
    buttCap.position.z = 0.75;
    cueStick.add(buttCap);

    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for (let i = 0; i < 12; i++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.01, 0.001, 0.35),
        stripeMat
      );
      const angle = (i / 12) * Math.PI * 2;
      stripe.position.x = Math.cos(angle) * 0.02;
      stripe.position.y = Math.sin(angle) * 0.02;
      stripe.position.z = 0.55;
      stripe.rotation.z = angle;
      cueStick.add(stripe);
    }

    cueStick.position.set(
      cueBall.position.x,
      TABLE_H + BALL_R,
      cueBall.position.z + 0.9
    );
    scene.add(cueStick);

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    function animate() {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.removeEventListener('resize', onResize);
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', inset: 0, background: '#0b0f1a', overflow: 'hidden' }}
    />
  );
}
