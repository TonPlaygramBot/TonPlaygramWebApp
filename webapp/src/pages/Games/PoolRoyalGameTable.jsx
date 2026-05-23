"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const TABLE_MODEL_URL = "https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb";
const DRACO_DECODER_PATH = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";
const BASIS_TRANSCODER_PATH = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/";

const PARTS = ["cloth", "cushion"];
const PART_OPTIONS = {
  cloth: {
    a: { label: "Green cloth", color: "#0a7b33", metalness: 0, roughness: 1, envMapIntensity: 0.16 },
    b: { label: "Blue cloth", color: "#0d4fb8", metalness: 0, roughness: 1, envMapIntensity: 0.16 },
  },
  cushion: {
    a: { label: "Green cushions", color: "#064f23", metalness: 0, roughness: 0.94, envMapIntensity: 0.24 },
    b: { label: "Black cushions", color: "#050505", metalness: 0, roughness: 0.88, envMapIntensity: 0.38 },
  },
};

const DEFAULT_PALETTE = { cloth: "a", cushion: "a" };

function applyMaterial(mat, option) {
  mat.color.set(option.color);
  mat.metalness = option.metalness;
  mat.roughness = option.roughness;
  mat.envMapIntensity = option.envMapIntensity;
  mat.map = null;
  mat.normalMap = null;
  mat.roughnessMap = null;
  mat.metalnessMap = null;
  mat.needsUpdate = true;
}

export default function PoolRoyalGameTable() {
  const hostRef = useRef(null);
  const bucketsRef = useRef({ cloth: [], cushion: [] });
  const [palette, setPalette] = useState(DEFAULT_PALETTE);

  useEffect(() => {
    PARTS.forEach((part) => {
      bucketsRef.current[part].forEach((mat) => applyMaterial(mat, PART_OPTIONS[part][palette[part]]));
    });
  }, [palette]);

  const rows = useMemo(() => PARTS.map((part) => ({ part, options: PART_OPTIONS[part], selected: palette[part] })), [palette]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050505");
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.position.set(6.2, 4.2, 7.0);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.05, 0);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 1.08));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(6, 10, 7);
    scene.add(key);

    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_DECODER_PATH);
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(BASIS_TRANSCODER_PATH);
    ktx2.detectSupport(renderer);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder);

    let frame = 0;
    let mounted = true;

    loader.load(TABLE_MODEL_URL, (gltf) => {
      if (!mounted) return;
      const table = gltf.scene;
      table.scale.setScalar(1.5);
      table.rotation.y = Math.PI;
      table.traverse((child) => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        child.material = mats.map((m) => {
          const mat = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.5, metalness: 0 });
          const name = `${child.name || ""} ${m?.name || ""}`.toLowerCase();
          const isCloth = /cloth|felt|bed|surface/.test(name);
          const part = isCloth ? "cloth" : /cushion|rubber|bumper/.test(name) ? "cushion" : null;
          if (part) {
            mat.userData.part = part;
            bucketsRef.current[part].push(mat);
            applyMaterial(mat, PART_OPTIONS[part][palette[part]]);
          } else {
            mat.color.set("#2b2118");
          }
          return mat;
        });
      });
      scene.add(table);
    });

    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      mounted = false;
      cancelAnimationFrame(frame);
      controls.dispose();
      pmrem.dispose();
      ktx2.dispose();
      draco.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [palette]);

  return (
    <div ref={hostRef} style={{ position: "fixed", inset: 0, background: "#050505" }}>
      <div style={{ position: "fixed", left: 8, right: 8, bottom: 8, background: "rgba(0,0,0,0.72)", padding: 10, borderRadius: 14 }}>
        {rows.map((row) => (
          <div key={row.part} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <strong style={{ color: "white", width: 80 }}>{row.part}</strong>
            {["a", "b"].map((choice) => (
              <button key={choice} onClick={() => setPalette((p) => ({ ...p, [row.part]: choice }))} style={{ color: "white", borderRadius: 999, padding: "6px 10px", border: "1px solid #666", background: row.selected === choice ? "#334155" : "#111827" }}>
                {row.options[choice].label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
