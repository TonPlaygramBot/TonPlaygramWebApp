import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * AUDIENCE ARENA 3D — Tribunes on all four sides
 */

const CAM = { fov: 50, near: 0.1, far: 5000, minR: 60, maxR: 220, phiMin: 0.8, phiMax: 1.3 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const COLORS = Object.freeze({
  wall: 0x0f1013,
  stair: 0x1b1d20,
  riser: 0x17181b,
  seat: 0x2a2f3a,
  chair: 0x3b4250,
  skin: 0xffd7b3,
  hairD: 0x222222,
  hairL: 0x7d5a3c,
  shirt1: 0x2a76ff,
  shirt2: 0x22c55e,
  shirt3: 0xf59e0b,
  pants1: 0x39424e,
  pants2: 0x1f2937,
  shoe: 0x0c0c0c,
});

function mat(c, rough = 0.85, metal = 0.1) {
  return new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
}
function box(w, h, d, c) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
}
function cyl(rt, rb, h, c, seg = 16) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));
}
function sph(r, c, seg = 16) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat(c));
}

function buildChair() {
  const g = new THREE.Group();
  const seat = box(1.2, 0.18, 1.1, COLORS.seat);
  seat.position.set(0, 1, 0);
  g.add(seat);
  const back = box(1.2, 1.2, 0.12, COLORS.chair);
  back.position.set(0, 1.7, -0.55);
  g.add(back);
  [[-0.55, 0.5, -0.5], [0.55, 0.5, -0.5], [-0.55, 0.5, 0.5], [0.55, 0.5, 0.5]].forEach(([x, y, z]) => {
    const leg = cyl(0.08, 0.08, 1, COLORS.chair, 8);
    leg.position.set(x, y, z);
    g.add(leg);
  });
  return g;
}

function buildHuman() {
  const g = new THREE.Group();
  const shirts = [COLORS.shirt1, COLORS.shirt2, COLORS.shirt3];
  const pants = [COLORS.pants1, COLORS.pants2];
  const hair = [COLORS.hairD, COLORS.hairL];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const torso = cyl(0.45, 0.55, 1.2, pick(shirts));
  torso.position.set(0, 1.6, 0);
  g.add(torso);
  const head = sph(0.5, COLORS.skin, 18);
  head.position.set(0, 2.9, 0);
  g.add(head);
  const hairCap = cyl(0.52, 0.52, 0.25, pick(hair), 14);
  hairCap.position.set(0, 3.05, 0);
  g.add(hairCap);
  return g;
}

function buildRow(seats, spacing = 1.6) {
  const g = new THREE.Group();
  for (let i = 0; i < seats; i++) {
    const chair = buildChair();
    const human = buildHuman();
    const x = (i - (seats - 1) / 2) * spacing;
    chair.position.set(x, 0, 0);
    human.position.set(x, 0, 0);
    g.add(chair, human);
  }
  return g;
}

function buildTribune({ rows = 8, seatsPerRow = 14, rise = 0.7, depth = 2.0 }) {
  const g = new THREE.Group();
  for (let r = 0; r < rows; r++) {
    const y = r * rise;
    const z = -r * depth;
    const riser = box(seatsPerRow * 1.8 + 6, 0.25, 0.2, COLORS.riser);
    riser.position.set(0, y, z - depth / 2);
    g.add(riser);
    const tread = box(seatsPerRow * 1.8 + 6, 0.2, depth, COLORS.stair);
    tread.position.set(0, y + 0.1, z);
    g.add(tread);
    const row = buildRow(seatsPerRow);
    row.position.set(0, y, z - 0.2);
    g.add(row);
  }
  return g;
}

function buildWall({ width = 180, length = 220, height = 45 }) {
  const g = new THREE.Group();
  const back = box(length, height, 1, COLORS.wall);
  back.position.set(0, height / 2, -width / 2);
  g.add(back);
  return g;
}

export default function AudienceArena3D() {
  const mountRef = useRef(null);
  const rafRef = useRef(0);
  const [err, setErr] = useState(null);
  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    let renderer, scene, camera, sph;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(host.clientWidth, host.clientHeight, false);
      host.appendChild(renderer.domElement);
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0a0a);
      camera = new THREE.PerspectiveCamera(
        CAM.fov,
        host.clientWidth / host.clientHeight,
        CAM.near,
        CAM.far
      );
      sph = new THREE.Spherical(160, (CAM.phiMin + CAM.phiMax) / 2, Math.PI * 0.25);
      const fit = () => {
        camera.aspect = host.clientWidth / host.clientHeight;
        camera.updateProjectionMatrix();
        camera.position.setFromSpherical(sph);
        camera.lookAt(0, 8, 0);
      };
      fit();

      scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 0.95));
      const key = new THREE.DirectionalLight(0xffffff, 1.0);
      key.position.set(-40, 80, 40);
      scene.add(key);

      const dims = { width: 180, length: 220, height: 45 };
      const gap = 50; // distance from wall to tribune

      // Walls on four sides
      const backWall = buildWall(dims);
      scene.add(backWall);
      const frontWall = buildWall(dims);
      frontWall.rotation.y = Math.PI;
      scene.add(frontWall);
      const leftWall = buildWall({ width: dims.length, length: dims.width, height: dims.height });
      leftWall.rotation.y = Math.PI / 2;
      scene.add(leftWall);
      const rightWall = buildWall({ width: dims.length, length: dims.width, height: dims.height });
      rightWall.rotation.y = -Math.PI / 2;
      scene.add(rightWall);

      // Tribunes on four sides facing the table
      const tribParams = { rows: 8, seatsPerRow: 14 };
      const offsetZ = dims.width / 2 - gap; // 40
      const offsetX = dims.length / 2 - gap; // 60

      const tribBack = buildTribune(tribParams);
      tribBack.position.set(0, 0, -offsetZ);
      scene.add(tribBack);

      const tribFront = buildTribune(tribParams);
      tribFront.position.set(0, 0, offsetZ);
      tribFront.rotation.y = Math.PI;
      scene.add(tribFront);

      const tribLeft = buildTribune(tribParams);
      tribLeft.position.set(-offsetX, 0, 0);
      tribLeft.rotation.y = Math.PI / 2;
      scene.add(tribLeft);

      const tribRight = buildTribune(tribParams);
      tribRight.position.set(offsetX, 0, 0);
      tribRight.rotation.y = -Math.PI / 2;
      scene.add(tribRight);

      const dom = renderer.domElement;
      const drag = { on: false, x: 0, y: 0 };
      const down = (e) => {
        drag.on = true;
        drag.x = e.clientX || e.touches?.[0]?.clientX || 0;
        drag.y = e.clientY || e.touches?.[0]?.clientY || 0;
      };
      const move = (e) => {
        if (!drag.on) return;
        const x = e.clientX || e.touches?.[0]?.clientX || drag.x;
        const y = e.clientY || e.touches?.[0]?.clientY || drag.y;
        const dx = x - drag.x,
          dy = y - drag.y;
        drag.x = x;
        drag.y = y;
        sph.theta -= dx * 0.005;
        sph.phi = clamp(sph.phi + dy * 0.003, CAM.phiMin, CAM.phiMax);
        fit();
      };
      const up = () => {
        drag.on = false;
      };
      const wheel = (e) => {
        sph.radius = clamp(sph.radius + e.deltaY * 0.2, CAM.minR, CAM.maxR);
        fit();
      };
      dom.addEventListener("mousedown", down);
      dom.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      dom.addEventListener("touchstart", down, { passive: true });
      dom.addEventListener("touchmove", move, { passive: true });
      window.addEventListener("touchend", up);
      dom.addEventListener("wheel", wheel, { passive: true });

      const step = () => {
        renderer.render(scene, camera);
        rafRef.current = requestAnimationFrame(step);
      };
      step();
      const onResize = () => {
        renderer.setSize(host.clientWidth, host.clientHeight, false);
        fit();
      };
      window.addEventListener("resize", onResize);
      return () => {
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener("resize", onResize);
        try {
          host.removeChild(renderer.domElement);
        } catch {}
        dom.removeEventListener("mousedown", down);
        dom.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        dom.removeEventListener("touchstart", down);
        dom.removeEventListener("touchmove", move);
        window.removeEventListener("touchend", up);
        dom.removeEventListener("wheel", wheel);
      };
    } catch (e) {
      console.error(e);
      setErr(e.message || String(e));
    }
  }, []);

  return (
    <div className="w-full h-[100vh] bg-black text-white overflow-hidden select-none">
      <div ref={mountRef} className="absolute inset-0" />
    </div>
  );
}
