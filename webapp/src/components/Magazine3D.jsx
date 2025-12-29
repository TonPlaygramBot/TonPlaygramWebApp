import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../utils/colorSpace.js';

const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/v1/decoders/';
const BASIS_TRANSCODER_PATH = 'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/libs/basis/';

const TARGET_COUNT = 220;
const OFFSET_SKIP = 160;
const MAX_IN_FLIGHT = 6;
const PRODUCTION_NAME = 'Poly Haven Showroom';

const TARGET_FOOTPRINT_XZ = 9.0;
const GRID_COLS = 14;
const GRID_SPACING = 13;
const TICKET_Y_OFFSET = 1.0;

const KEYWORDS = [
  'snooker',
  'billiard',
  'billiards',
  'pool',
  'poker',
  'casino',
  'roulette',
  'table',
  'dining',
  'coffee',
  'desk',
  'chair',
  'armchair',
  'stool',
  'bench',
  'seat',
  'sofa',
  'cabinet',
  'shelf',
  'dresser',
  'drawer',
  'cupboard',
  'bookcase',
  'lamp',
  'plant',
  'vase',
  'rug',
  'carpet'
];

let sharedKtx2Loader = null;
let sharedTextureLoader = null;

function stripQueryHash(u) {
  return u.split('#')[0].split('?')[0];
}

function basename(u) {
  if (!u) return '';
  const clean = stripQueryHash(u);
  const idx = clean.lastIndexOf('/');
  return idx >= 0 ? clean.slice(idx + 1) : clean;
}

function isModelUrl(u) {
  const s = stripQueryHash(u).toLowerCase();
  return s.endsWith('.glb') || s.endsWith('.gltf');
}

function extractAllHttpUrls(apiJson) {
  const out = [];
  const seen = new Set();
  const walk = (v) => {
    if (!v) return;
    if (typeof v === 'string' && v.startsWith('http')) {
      if (!seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === 'object') {
      Object.values(v).forEach(walk);
    }
  };
  walk(apiJson);
  return out;
}

function pickBestModelUrl(urls) {
  const modelUrls = urls.filter(isModelUrl);
  const glbs = modelUrls.filter((u) => stripQueryHash(u).toLowerCase().endsWith('.glb'));
  const gltfs = modelUrls.filter((u) => stripQueryHash(u).toLowerCase().endsWith('.gltf'));
  return glbs[0] || gltfs[0] || null;
}

function fallbackMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xd0d6e2,
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide
  });
}

function ensureVisible(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    materials.forEach((m, idx) => {
      if (!m) {
        materials[idx] = fallbackMaterial();
        return;
      }
      if (m.map) applySRGBColorSpace(m.map);
      if (m.emissiveMap) applySRGBColorSpace(m.emissiveMap);
      if (!m.map && m.color?.getHex?.() === 0x000000) {
        m.color.set(0xd0d6e2);
      }
      m.needsUpdate = true;
    });
  });
}

function makeTicket(text) {
  const c = document.createElement('canvas');
  c.width = 840;
  c.height = 160;
  const g = c.getContext('2d');

  g.fillStyle = 'rgba(0,0,0,0.82)';
  g.fillRect(0, 0, c.width, c.height);

  g.strokeStyle = 'rgba(255,255,255,0.28)';
  g.lineWidth = 2;
  g.strokeRect(6, 6, c.width - 12, c.height - 12);

  g.fillStyle = '#e5ecff';
  g.font = '800 26px system-ui';
  g.fillText(text, 18, 86);

  const tex = new THREE.CanvasTexture(c);
  applySRGBColorSpace(tex);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  spr.scale.set(5.8, 1.1, 1);
  return spr;
}

function scaleToFootprint(root, targetXZ) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  root.position.sub(center);

  const maxXZ = Math.max(size.x, size.z);
  root.scale.setScalar(maxXZ > 0 ? targetXZ / maxXZ : 1);

  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
}

function categoryForId(id) {
  const s = String(id).toLowerCase();
  if (s.includes('snooker') || s.includes('billiard') || s.includes('billiards') || s.includes('pool')) {
    return 'Billiards & Snooker';
  }
  if (s.includes('poker') || s.includes('casino') || s.includes('roulette') || s.includes('blackjack')) {
    return 'Poker & Casino';
  }
  if (s.includes('chair') || s.includes('armchair') || s.includes('stool') || s.includes('bench') || s.includes('seat') || s.includes('sofa')) {
    return 'Chairs & Seating';
  }
  if (s.includes('cabinet') || s.includes('cupboard') || s.includes('dresser') || s.includes('drawer') || s.includes('shelf') || s.includes('bookcase')) {
    return 'Storage & Shelving';
  }
  if (s.includes('lamp') || s.includes('plant') || s.includes('vase') || s.includes('rug') || s.includes('carpet')) {
    return 'Decor';
  }
  return 'Tables';
}

const CATEGORY_ORDER = [
  'Billiards & Snooker',
  'Poker & Casino',
  'Tables',
  'Chairs & Seating',
  'Storage & Shelving',
  'Decor'
];

function buildPolyhavenModelUrls(id) {
  const safe = encodeURIComponent(id);
  return [
    `https://dl.polyhaven.org/file/ph-assets/models/gltf/${safe}/${safe}.gltf`,
    `https://dl.polyhaven.org/file/ph-assets/models/gltf/${safe}/${safe}.glb`
  ];
}

function createConfiguredGLTFLoader(renderer, manager) {
  const loader = new GLTFLoader(manager);
  loader.setCrossOrigin?.('anonymous');

  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);

  if (!sharedKtx2Loader) {
    sharedKtx2Loader = new KTX2Loader();
    sharedKtx2Loader.setTranscoderPath(BASIS_TRANSCODER_PATH);
  }

  if (renderer) {
    try {
      sharedKtx2Loader.detectSupport(renderer);
    } catch (error) {
      console.warn('Magazine KTX2 support detection failed', error);
    }
  }

  loader.setKTX2Loader(sharedKtx2Loader);
  loader.setMeshoptDecoder?.(MeshoptDecoder);
  return loader;
}

function ensureTextureLoader() {
  if (!sharedTextureLoader) {
    sharedTextureLoader = new THREE.TextureLoader();
  }
  return sharedTextureLoader;
}

function buildModelThumbnailUrl(id) {
  const safeId = encodeURIComponent(id);
  return `https://cdn.polyhaven.com/asset_img/primary/${safeId}.png?height=320`;
}

function buildModelViewUrl(id) {
  return `https://polyhaven.com/a/${encodeURIComponent(id)}`;
}

function prepareLoadedModel(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.forEach((mat, idx) => {
      if (!mat) {
        materials[idx] = fallbackMaterial();
        return;
      }
      if (mat.map) applySRGBColorSpace(mat.map);
      if (mat.emissiveMap) applySRGBColorSpace(mat.emissiveMap);
      mat.needsUpdate = true;
    });
  });
}

function pickBestTextureUrls(apiJson) {
  if (!apiJson || typeof apiJson !== 'object') {
    return { diffuse: null, normal: null, roughness: null };
  }
  const urls = [];
  const walk = (v) => {
    if (!v) return;
    if (typeof v === 'string' && v.startsWith('http')) {
      const lower = v.toLowerCase();
      if (lower.includes('.jpg') || lower.includes('.png')) {
        urls.push(v);
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === 'object') {
      Object.values(v).forEach(walk);
    }
  };
  walk(apiJson);

  const pick = (needles) => {
    const scored = urls
      .filter((u) => needles.some((n) => u.toLowerCase().includes(n)))
      .map((u) => {
        let s = 0;
        const lower = u.toLowerCase();
        if (lower.includes('2k')) s += 3;
        if (lower.includes('1k')) s += 2;
        if (lower.includes('4k')) s += 1;
        if (lower.includes('preview')) s -= 50;
        if (lower.includes('.exr')) s -= 100;
        return { url: u, score: s };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0]?.url || null;
  };

  return {
    diffuse: pick(['diff', 'albedo', 'basecolor']),
    normal: pick(['nor', 'normal']),
    roughness: pick(['rough'])
  };
}

async function loadTexture(textureLoader, url, isColor, maxAnisotropy = 1) {
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (texture) => {
        if (isColor) applySRGBColorSpace(texture);
        texture.flipY = false;
        texture.wrapS = texture.wrapS ?? THREE.RepeatWrapping;
        texture.wrapT = texture.wrapT ?? THREE.RepeatWrapping;
        texture.anisotropy = Math.max(texture.anisotropy ?? 1, maxAnisotropy);
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      () => reject(new Error('texture load failed'))
    );
  });
}

function applyTextureSetToModel(model, textureSet, fallbackTexture, maxAnisotropy = 1) {
  const normalizeTex = (tex, isColor = false) => {
    if (!tex) return null;
    if (isColor) applySRGBColorSpace(tex);
    tex.flipY = false;
    tex.wrapS = tex.wrapS ?? THREE.RepeatWrapping;
    tex.wrapT = tex.wrapT ?? THREE.RepeatWrapping;
    tex.anisotropy = Math.max(tex.anisotropy ?? 1, maxAnisotropy);
    tex.needsUpdate = true;
    return tex;
  };

  model.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((material) => {
      if (!material) return;
      material.roughness = Math.max(material.roughness ?? 0.4, 0.4);
      material.metalness = Math.min(material.metalness ?? 0.4, 0.4);

      if (material.map) {
        normalizeTex(material.map, true);
      } else if (textureSet?.diffuse) {
        material.map = normalizeTex(textureSet.diffuse, true);
      } else if (fallbackTexture) {
        material.map = normalizeTex(fallbackTexture, true);
      }

      if (!material.normalMap && textureSet?.normal) {
        material.normalMap = normalizeTex(textureSet.normal, false);
      } else if (material.normalMap) {
        normalizeTex(material.normalMap, false);
      }

      if (!material.roughnessMap && textureSet?.roughness) {
        material.roughnessMap = normalizeTex(textureSet.roughness, false);
      } else if (material.roughnessMap) {
        normalizeTex(material.roughnessMap, false);
      }
    });
  });
}

export default function Magazine3D() {
  const mountRef = useRef(null);
  const [status, setStatus] = useState('Initializing…');
  const [catalog, setCatalog] = useState([]);

  const sortedCatalog = useMemo(
    () => [...catalog].sort((a, b) => a.slot - b.slot),
    [catalog]
  );

  const groupedCatalog = useMemo(() => {
    const groups = {};
    catalog.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    Object.values(groups).forEach((items) => items.sort((a, b) => a.slot - b.slot));

    const ordered = {};
    CATEGORY_ORDER.forEach((cat) => {
      if (groups[cat]) ordered[cat] = groups[cat];
    });
    Object.keys(groups)
      .filter((cat) => !CATEGORY_ORDER.includes(cat))
      .sort()
      .forEach((cat) => {
        ordered[cat] = groups[cat];
      });

    return ordered;
  }, [catalog]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    mount.innerHTML = '';
    mount.style.width = '100%';
    mount.style.minHeight = '520px';
    mount.style.position = 'relative';

    const hud = document.createElement('div');
    hud.style.position = 'absolute';
    hud.style.top = '10px';
    hud.style.left = '10px';
    hud.style.padding = '8px 12px';
    hud.style.background = 'rgba(0,0,0,0.6)';
    hud.style.color = 'white';
    hud.style.fontFamily = 'system-ui';
    hud.style.borderRadius = '8px';
    hud.style.zIndex = '10';
    hud.innerText = status;
    mount.appendChild(hud);

    const setHud = (t) => {
      if (hud) hud.innerText = t;
      setStatus(t);
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1116);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 20000);
    camera.position.set(0, 18, 120);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    applyRendererSRGB(renderer);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(Math.max(1, mount.clientWidth), mount.clientHeight || 560, false);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 2.2, -80);
    controls.maxDistance = 2600;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x20242c, 1.05));

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(32, 44, 24);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.9);
    fill.position.set(-28, 18, 12);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16000, 16000),
      new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const group = new THREE.Group();
    scene.add(group);

    let cancelled = false;
    let raf = 0;

    (async () => {
      try {
        setHud('Fetching model list…');
        const res = await fetch('https://api.polyhaven.com/assets?t=models');
        const data = await res.json();
        const idsAll = Array.isArray(data) ? data : Object.keys(data);

        const kw = KEYWORDS.map((k) => k.toLowerCase());
        let filtered = idsAll.filter((id) => {
          const s = String(id).toLowerCase();
          return kw.some((k) => s.includes(k));
        });

        const need = OFFSET_SKIP + TARGET_COUNT;
        if (filtered.length < need) {
          const extras = idsAll.filter((id) => !filtered.includes(id));
          filtered = [...filtered, ...extras];
        }

        const ids = filtered.slice(OFFSET_SKIP, OFFSET_SKIP + TARGET_COUNT);
        setHud(`Loading ${ids.length} NEW items…`);

        let nextSlot = 0;
        let loadedCount = 0;
        let processed = 0;
        const queue = [...ids];
        let inFlight = 0;

        const runNext = () => {
          while (inFlight < MAX_IN_FLIGHT && queue.length && !cancelled) {
            const id = queue.shift();
            inFlight += 1;

            (async () => {
              try {
                const anisotropy = renderer.capabilities.getMaxAnisotropy?.() ?? 1;
                const textureLoader = ensureTextureLoader();

                const filesJson = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(id)}`).then((r) => r.json());
                const allUrls = extractAllHttpUrls(filesJson);
                const modelUrl = pickBestModelUrl(allUrls) || buildPolyhavenModelUrls(id)[0];
                if (!modelUrl) return;

                const fileMap = new Map();
                allUrls.forEach((u) => fileMap.set(basename(u), u));

                const manager = fileMap.size ? new THREE.LoadingManager() : undefined;
                if (manager && fileMap.size) {
                  manager.setURLModifier((requestedUrl) => {
                    if (/^https?:\/\//i.test(requestedUrl)) return requestedUrl;
                    const b = basename(requestedUrl);
                    return fileMap.get(b) || requestedUrl;
                  });
                }

                const loader = createConfiguredGLTFLoader(renderer, manager);
                const resourcePath = modelUrl.substring(0, modelUrl.lastIndexOf('/') + 1);
                loader.setResourcePath?.(resourcePath);
                loader.setPath?.('');

                const gltf = await loader.loadAsync(modelUrl);
                const root = gltf?.scene || gltf?.scenes?.[0] || gltf;
                if (!root) return;

                let textures = null;
                try {
                  const urls = pickBestTextureUrls(filesJson);
                  if (urls.diffuse) {
                    const [diffuse, normal, roughness] = await Promise.all([
                      loadTexture(textureLoader, urls.diffuse, true, anisotropy),
                      urls.normal ? loadTexture(textureLoader, urls.normal, false, anisotropy) : null,
                      urls.roughness ? loadTexture(textureLoader, urls.roughness, false, anisotropy) : null
                    ]);
                    textures = { diffuse, normal, roughness };
                  }
                } catch {
                  // fall back below
                }

                const fallbackTexture = (() => {
                  const canvas = document.createElement('canvas');
                  canvas.width = 256;
                  canvas.height = 256;
                  const ctx = canvas.getContext('2d');
                  ctx.fillStyle = '#dcdcdc';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.strokeStyle = '#a8b2c4';
                  ctx.lineWidth = 6;
                  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
                  const tex = new THREE.CanvasTexture(canvas);
                  applySRGBColorSpace(tex);
                  tex.wrapS = THREE.RepeatWrapping;
                  tex.wrapT = THREE.RepeatWrapping;
                  tex.anisotropy = anisotropy;
                  tex.needsUpdate = true;
                  return tex;
                })();

                ensureVisible(root);
                prepareLoadedModel(root);
                applyTextureSetToModel(root, textures, fallbackTexture, anisotropy);
                scaleToFootprint(root, TARGET_FOOTPRINT_XZ);

                const slot = nextSlot;
                nextSlot += 1;
                const col = slot % GRID_COLS;
                const row = Math.floor(slot / GRID_COLS);

                root.position.x += (col - (GRID_COLS - 1) / 2) * GRID_SPACING;
                root.position.z += -row * GRID_SPACING;

                const cat = categoryForId(id);
                const ticket = makeTicket(`${PRODUCTION_NAME} | #${String(slot + 1).padStart(4, '0')} | ${cat} | ${id}`);
                const box = new THREE.Box3().setFromObject(root);
                ticket.position.set(root.position.x, box.max.y + TICKET_Y_OFFSET, root.position.z);

                group.add(root);
                group.add(ticket);

                loadedCount += 1;
                if (!cancelled) {
                  setCatalog((prev) => [
                    ...prev,
                    {
                      slot: slot + 1,
                      id,
                      category: cat,
                      thumbnail: buildModelThumbnailUrl(id),
                      viewUrl: buildModelViewUrl(id)
                    }
                  ]);
                }
              } catch (error) {
                console.warn('Failed to load Poly Haven asset', id, error);
              } finally {
                processed += 1;
                inFlight -= 1;
                if (!cancelled) {
                  setHud(`Loaded ${loadedCount} (processed ${processed}/${ids.length})`);
                }
                runNext();
              }
            })();
          }

          if (processed >= ids.length && !cancelled) {
            setHud(`Done. Loaded ${loadedCount}/${ids.length} NEW items.`);
          }
        };

        runNext();
      } catch (e) {
        setHud(`Error: ${e?.message || e}`);
      }
    })();

    const resize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(Math.max(1, mount.clientWidth), mount.clientHeight || 560, false);
    };
    window.addEventListener('resize', resize);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      group.clear();
    };
  }, []);

  return (
    <div className="space-y-3">
      <div
        ref={mountRef}
        className="w-full rounded-xl border border-border overflow-hidden bg-black/30"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(groupedCatalog).map(([category, items]) => (
          <div
            key={category}
            className="rounded-lg border border-border bg-surface/60 p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-base">{category}</h4>
              <span className="text-xs text-subtext">{items.length} items</span>
            </div>
            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={`${category}-${item.slot}-${item.id}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-mono text-primary text-sm font-semibold">
                    #{String(item.slot).padStart(4, '0')}
                  </span>
                  <span className="ml-2 truncate text-foreground font-medium">{item.id}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-surface/70 p-3 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-0.5">
            <h3 className="font-semibold text-base">Catalogue</h3>
            <p className="text-xs text-subtext">
              Every loaded asset with its number, quick preview, and direct Poly Haven link.
            </p>
          </div>
          <span className="text-xs text-subtext mt-1">{sortedCatalog.length} items</span>
        </div>
        {sortedCatalog.length === 0 ? (
          <p className="text-sm text-subtext">Assets will appear here as they finish loading.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
            {sortedCatalog.map((item) => (
              <div
                key={`${item.slot}-${item.id}`}
                className="flex gap-3 p-2 rounded-lg border border-border bg-black/20"
              >
                <div className="w-20 h-20 rounded-md overflow-hidden border border-border/60 bg-gradient-to-br from-surface to-surface/60 flex items-center justify-center shrink-0">
                  <img
                    src={item.thumbnail}
                    alt={`${item.id} preview`}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml;utf8,' +
                        encodeURIComponent(
                          '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" fill="none"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="%232A2F37"/><stop offset="1" stop-color="%23363C45"/></linearGradient></defs><rect width="160" height="160" rx="12" fill="url(#g)"/><path d="M32 112l26-32 20 24 18-20 32 40H32Z" stroke="%238A94A7" stroke-width="6" stroke-linejoin="round" fill="%23414A56"/><circle cx="52" cy="58" r="12" fill="%238A94A7"/></svg>'
                        );
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-primary text-sm font-semibold">
                      #{String(item.slot).padStart(4, '0')}
                    </span>
                    <a
                      href={item.viewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-2 py-1 rounded-md border border-primary text-primary hover:bg-primary/10"
                    >
                      View
                    </a>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{item.id}</p>
                  <p className="text-xs text-subtext truncate">{item.category}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
