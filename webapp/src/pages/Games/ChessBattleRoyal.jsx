import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

const MODEL_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://fastly.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf'
];

const HDRI_URLS = [
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/royal_esplanade_1k.hdr',
  'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/equirectangular/royal_esplanade_1k.hdr'
];

async function tryUrls(urls, importer) {
  let lastErr;
  for (const url of urls) {
    try {
      const value = await importer(url);
      return value;
    } catch (error) {
      lastErr = error;
    }
  }
  throw lastErr || new Error('All attempts failed');
}

function ChessBattleRoyal() {
  const containerRef = useRef(null);
  const badgeRef = useRef(null);
  const failRef = useRef(null);
  const hdrRef = useRef(null);
  const focusRef = useRef(null);
  const turnRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return () => {};

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.85;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f16);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    camera.position.set(10, 12, 18);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 6;
    controls.maxDistance = 60;
    controls.target.set(0, 2, 0);
    controls.update();

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(12, 16, 10);
    key.castShadow = true;
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-10, 8, 4);
    const rim = new THREE.DirectionalLight(0xffffff, 0.9);
    rim.position.set(0, 10, -12);
    scene.add(ambient, key, fill, rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.9, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    let hdrTex = null;
    const setHDR = async (on) => {
      if (!on) {
        scene.environment = null;
        renderer.toneMappingExposure = 1.85;
        return;
      }
      try {
        const url = await tryUrls(HDRI_URLS, (u) =>
          fetch(u, { mode: 'cors' }).then((r) => (r.ok ? u : Promise.reject(new Error('hdr fetch fail'))))
        );
        const loader = new RGBELoader();
        hdrTex = await new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
        hdrTex.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = hdrTex;
        renderer.toneMappingExposure = 1.35;
      } catch (error) {
        console.warn('HDRI failed', error);
      }
    };

    setHDR(true);

    const loader = new GLTFLoader();
    let modelRoot = null;
    let modelLoaded = false;
    const badgeEl = badgeRef.current;
    const failEl = failRef.current;

    const showStatus = (text, fail = false) => {
      if (badgeEl) {
        badgeEl.textContent = text;
        badgeEl.classList.toggle('fail', fail);
      }
      if (failEl) {
        failEl.classList.toggle('show', fail);
      }
    };

    const resolveModelUrl = async () => {
      return tryUrls(MODEL_URLS, (url) =>
        new Promise((resolve, reject) => loader.load(url, () => resolve(url), undefined, reject))
      );
    };

    const loadModel = async () => {
      try {
        showStatus('Downloading ABeautifulGame (glTF)…');
        const modelUrl = await resolveModelUrl();
        showStatus('Model URL OK: ' + modelUrl);
        await new Promise((resolve, reject) =>
          loader.load(
            modelUrl,
            (gltf) => {
              modelRoot = gltf.scene;
              modelRoot.traverse((obj) => {
                if (obj.isMesh) {
                  obj.castShadow = true;
                  obj.receiveShadow = true;
                }
              });
              const box = new THREE.Box3().setFromObject(modelRoot);
              const size = new THREE.Vector3();
              box.getSize(size);
              const center = new THREE.Vector3();
              box.getCenter(center);
              const scale = 0.85 * (12 / Math.max(size.x, size.z));
              modelRoot.scale.setScalar(scale);
              modelRoot.position.sub(center.multiplyScalar(scale));
              modelRoot.position.y = 0.02;
              scene.add(modelRoot);
              modelLoaded = true;
              showStatus('Loaded: ABeautifulGame (CC‑BY 4.0)');
              resolve();
            },
            undefined,
            (error) => reject(error)
          )
        );
      } catch (error) {
        console.error('Chess Battle Royal: failed to resolve ABeautifulGame assets', error);
        showStatus('Model failed', true);
        throw error;
      }
    };

    loadModel();

    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let lastPick = null;
    let lastMat = null;

    const onPointerMove = (event) => {
      if (!focusRef.current?.checked) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      mouse.set(x * 2 - 1, -(y * 2 - 1));
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(scene.children, true);
      if (hits.length) {
        const mesh = hits[0].object;
        if (lastPick !== mesh) {
          if (lastPick) {
            lastPick.material = lastMat;
            lastPick = null;
          }
          lastPick = mesh;
          lastMat = mesh.material;
          mesh.material = lastMat.clone();
          mesh.material.emissive = new THREE.Color(0x88ffcc);
          mesh.material.emissiveIntensity = 0.4;
        }
      }
    };

    const clearHighlight = () => {
      if (lastPick) {
        lastPick.material = lastMat;
        lastPick = null;
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const onResize = () => {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };

    const onReset = () => {
      camera.position.set(10, 12, 18);
      controls.target.set(0, 2, 0);
      controls.update();
    };

    const resetButton = document.getElementById('resetView');
    resetButton?.addEventListener('click', onReset);

    window.addEventListener('resize', onResize);

    let lastTime = performance.now();
    let spin = false;

    const renderLoop = () => {
      requestAnimationFrame(renderLoop);
      const now = performance.now();
      const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      if (spin) {
        camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.5);
        controls.update();
      }
      controls.update();
      renderer.render(scene, camera);
    };

    const runTests = () => {
      try {
        if (!window.THREE && !THREE) throw new Error('THREE not found');
        if (!OrbitControls) throw new Error('OrbitControls not found');
        if (!GLTFLoader) throw new Error('GLTFLoader not found');
        if (renderer.getContext() == null) throw new Error('WebGL context missing');
        const lights = scene.children.filter((o) => o.isLight).length;
        if (lights < 3) throw new Error('Lights missing');
        setTimeout(() => {
          if (!modelLoaded) {
            showStatus('Tests failed: model not loaded (network/CDN blocked)', true);
          }
        }, 9000);
        showStatus('Ready');
      } catch (error) {
        showStatus('Tests failed: ' + error.message, true);
      }
    };

    runTests();
    renderLoop();

    const onHdrChange = (event) => {
      const next = event.target.checked;
      setHDR(next);
    };

    const onFocusChange = (event) => {
      if (!event.target.checked) clearHighlight();
    };

    const onTurnChange = (event) => {
      spin = event.target.checked;
    };

    hdrRef.current?.addEventListener('change', onHdrChange);
    focusRef.current?.addEventListener('change', onFocusChange);
    turnRef.current?.addEventListener('change', onTurnChange);

    return () => {
      resetButton?.removeEventListener('click', onReset);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      hdrRef.current?.removeEventListener('change', onHdrChange);
      focusRef.current?.removeEventListener('change', onFocusChange);
      turnRef.current?.removeEventListener('change', onTurnChange);
      clearHighlight();
      controls.dispose();
      renderer.dispose();
      hdrTex?.dispose();
      if (modelRoot) {
        modelRoot.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose?.());
          } else if (child.material) child.material.dispose?.();
        });
      }
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <style>{`
        html, body, #root { height: 100%; margin: 0; }
        .chess-app { position: fixed; inset: 0; }
        canvas { display: block; width: 100%; height: 100%; }
        .hud { position: fixed; left: 10px; top: 10px; display: flex; gap: 8px; align-items: center; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); backdrop-filter: blur(8px); padding: 8px 10px; border-radius: 10px; font-size: 12px; z-index: 2; color: #e8eef7; }
        .btn { cursor: pointer; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.25); color: #e8eef7; padding: 6px 10px; border-radius: 8px; }
        .btn:active { transform: translateY(1px); }
        .badge { position: fixed; right: 12px; bottom: 12px; font-size: 12px; padding: 6px 10px; border-radius: 8px; background: rgba(12,180,75,.15); border: 1px solid rgba(12,180,75,.35); color: #c7f7da; z-index: 2; }
        .badge.fail { background: rgba(200,20,20,.15); border-color: rgba(200,20,20,.45); color: #ffd8d8; }
        .failbox { position: fixed; inset: 0; display: none; place-items: center; text-align: center; padding: 24px; z-index: 3; color: #e8eef7; }
        .failbox.show { display: grid; }
        .failbox > div { max-width: 760px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.18); padding: 18px 20px; border-radius: 12px; }
        a { color: #9cd1ff; }
        .toolbar { position: fixed; left: 10px; bottom: 10px; display: flex; gap: 8px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); backdrop-filter: blur(8px); padding: 8px 10px; border-radius: 10px; font-size: 12px; z-index: 2; color: #e8eef7; }
        .toggle { display: inline-flex; align-items: center; gap: 6px; }
        input[type='checkbox'] { accent-color: #3fbf7f; }
      `}</style>
      <div className="hud">
        <button id="resetView" className="btn">
          Reset view
        </button>
        <span>Drag = orbit · Pinch/Wheel = zoom</span>
      </div>
      <div ref={containerRef} id="app" className="chess-app" />
      <div ref={badgeRef} id="badge" className="badge">
        Loading open‑source chess…
      </div>
      <div ref={failRef} id="fail" className="failbox">
        <div>
          <h3>Preview nuk u ngarkua</h3>
          <p>
            Skriptet ose modeli nuk u shkarkuan nga CDN‑të. Ky projekt është plotësisht open‑source (Three.js MIT, model
            “A Beautiful Game” CC‑BY 4.0). Provoje përsëri, ose hap{' '}
            <a
              href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ABeautifulGame"
              target="_blank"
              rel="noopener noreferrer"
            >
              burimin e modelit
            </a>
            .
          </p>
        </div>
      </div>
      <div className="toolbar">
        <label className="toggle">
          <input ref={hdrRef} id="hdr" type="checkbox" defaultChecked /> HDR env
        </label>
        <label className="toggle">
          <input ref={focusRef} id="focus" type="checkbox" /> Focus highlight
        </label>
        <label className="toggle">
          <input ref={turnRef} id="turn" type="checkbox" /> Turntable
        </label>
      </div>
    </div>
  );
}

export default ChessBattleRoyal;
