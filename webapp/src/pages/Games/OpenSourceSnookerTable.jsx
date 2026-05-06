"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const GITHUB_API_BASE = 'https://api.github.com/repos/ekiefl/pooltool/contents';
const TABLE_DIRS = ['pooltool/models/table', 'pooltool/models/tables', 'pooltool/models'];

function isTableGLB(path) {
  const p = String(path || '').toLowerCase();
  if (!p.endsWith('.glb') && !p.endsWith('.gltf')) return false;
  if (!p.includes('table')) return false;
  if (p.includes('ball') || p.includes('cue') || p.includes('menu') || p.includes('hud')) return false;
  return true;
}

async function fetchJson(url) {
  const response = await fetch(url, { mode: 'cors', headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function walkGithubDirectory(path, depth = 0, seen = new Set()) {
  if (depth > 7 || seen.has(path)) return [];
  seen.add(path);
  let entries = [];
  try {
    const json = await fetchJson(`${GITHUB_API_BASE}/${path}?ref=main`);
    entries = Array.isArray(json) ? json : [json];
  } catch {
    return [];
  }
  const results = [];
  for (const entry of entries) {
    if (entry.type === 'dir') {
      const lower = entry.path.toLowerCase();
      const useful = lower.includes('table') || lower.includes('models') || lower.includes('billiard') || lower.includes('snooker') || lower.includes('pool');
      if (useful) results.push(...(await walkGithubDirectory(entry.path, depth + 1, seen)));
    } else if (entry.type === 'file' && entry.download_url && isTableGLB(entry.path)) {
      results.push({ path: entry.path, url: entry.download_url });
    }
  }
  return results;
}

async function discoverSnookerTable() {
  const assets = [];
  for (const dir of TABLE_DIRS) assets.push(...(await walkGithubDirectory(dir)));
  const ranked = [...assets].sort((a, b) => {
    const score = (path) => {
      const p = path.toLowerCase();
      let s = 0;
      if (p.includes('snooker')) s += 10;
      if (p.includes('table')) s += 5;
      if (p.endsWith('.glb')) s += 2;
      return s;
    };
    return score(b.path) - score(a.path);
  });
  const snooker = ranked[0];
  return snooker || assets[0] || null;
}

export default function OpenSourceSnookerTable() {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('Loading snooker table model…');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x0f172a, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 260);
    camera.position.set(0, 8.8, 24);
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(-7, 11, 8);
    scene.add(key);

    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(draco);
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/');
    ktx2.detectSupport(renderer);
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);
    resize();

    let frame = 0;
    let model = null;
    let cancelled = false;
    let yaw = 0;

    const animate = () => {
      frame = requestAnimationFrame(animate);
      yaw += 0.002;
      camera.position.set(Math.sin(yaw) * 24, 9, Math.cos(yaw) * 24);
      camera.lookAt(0, 1.8, 0);
      renderer.render(scene, camera);
    };

    (async () => {
      const asset = await discoverSnookerTable();
      if (!asset || cancelled) {
        setStatus('No snooker table asset found.');
        return;
      }
      loader.load(asset.url, (gltf) => {
        if (cancelled) return;
        model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const scale = 6.5 / Math.max(size.x, size.y, size.z, 0.0001);
        model.scale.setScalar(scale);
        const box2 = new THREE.Box3().setFromObject(model);
        const center = box2.getCenter(new THREE.Vector3());
        model.position.set(-center.x, -box2.min.y + 0.75, -center.z);
        scene.add(model);
        setStatus(`Loaded: ${asset.path}`);
      }, undefined, () => setStatus('Failed to load table model.'));
    })();

    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      if (model) scene.remove(model);
      renderer.dispose();
      draco.dispose();
      ktx2.dispose();
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0f172a' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div style={{ position: 'absolute', top: 8, left: 8, right: 8, color: '#fff', fontWeight: 700, fontSize: 12 }}>{status}</div>
    </div>
  );
}
