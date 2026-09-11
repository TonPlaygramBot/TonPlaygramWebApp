import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { weaponModelUrl } from "./livingVisuals";

const cache = new Map<string, string>();
let queue = Promise.resolve();

async function renderThumbnail(model: string) {
  if (cache.has(model)) return cache.get(model)!;
  const gltf = await new GLTFLoader().loadAsync(
    weaponModelUrl(model),
  );
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 112;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setSize(192, 112, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x607064, 3.2));
  const key = new THREE.DirectionalLight(0xffe0b0, 4);
  key.position.set(-2, 4, 3);
  scene.add(key, gltf.scene);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const center = box.getCenter(new THREE.Vector3());
  gltf.scene.position.sub(center);
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  gltf.scene.rotation.set(-0.16, Math.PI * 0.7, 0.08);
  const camera = new THREE.PerspectiveCamera(30, 192 / 112, 0.01, 10000);
  camera.position.set(0, longest * 0.28, longest * 2.25);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  const result = canvas.toDataURL("image/webp", 0.84);
  cache.set(model, result);
  renderer.dispose();
  return result;
}

export function WeaponThumbnail({ model, label }: { model: string; label: string }) {
  const [source, setSource] = useState(() => cache.get(model) || "");
  useEffect(() => {
    let active = true;
    queue = queue
      .then(() => renderThumbnail(model))
      .then((url) => {
        if (active) setSource(url);
      })
      .catch((error) => console.warn("Weapon thumbnail unavailable", model, error));
    return () => {
      active = false;
    };
  }, [model]);
  return (
    <div className="ts-weapon-thumb" aria-hidden="true">
      {source ? <img src={source} alt="" /> : <span>{label.slice(0, 2)}</span>}
    </div>
  );
}
