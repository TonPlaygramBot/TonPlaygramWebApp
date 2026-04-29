import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const WEAPON_COUNT = 18;
const GRID_COLS = 3;
const GRID_ROWS = 6;
const GAP_X = 2.35;
const GAP_Z = 1.48;
const FPS_SHOTGUN_DISPLAY_LENGTH = 1.18;
type HandMode = 'right' | 'both';
type GripPreset = 'pistol' | 'rifle' | 'sniper';
type WeaponEntry = { id: string; name: string; shortName: string; source: 'Quaternius' | 'Extra'; handMode: HandMode; gripPreset: GripPreset; urls: string[]; price: number };
type RuntimeWeapon = { entry: WeaponEntry; slot: THREE.Group; root: THREE.Object3D; basePosition: THREE.Vector3; baseRotation: THREE.Euler; baseScale: THREE.Vector3; index: number };

const polyGlb = (uuid: string) => `https://static.poly.pizza/${uuid}.glb`;
const KNOWN_WORKING_GLB = { awp: 'https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb', awpRaw: 'https://raw.githubusercontent.com/GarbajYT/godot-sniper-rifle/master/AWP.glb', mrtk: 'https://cdn.jsdelivr.net/gh/microsoft/MixedRealityToolkit@main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb', mrtkRaw: 'https://raw.githubusercontent.com/microsoft/MixedRealityToolkit/main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb', mrtkMaster: 'https://cdn.jsdelivr.net/gh/Microsoft/MixedRealityToolkit@master/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb', pistolHolster: 'https://cdn.jsdelivr.net/gh/SAAAM-LLC/3D_model_bundle@main/SAM_ASSET-PISTOL-IN-HOLSTER.glb', pistolHolsterRaw: 'https://raw.githubusercontent.com/SAAAM-LLC/3D_model_bundle/main/SAM_ASSET-PISTOL-IN-HOLSTER.glb', fps: 'https://cdn.jsdelivr.net/gh/lando19/Guns-for-BJS-FPS-Game@main/main/scene.gltf', fpsRaw: 'https://raw.githubusercontent.com/lando19/Guns-for-BJS-FPS-Game/main/main/scene.gltf' };
const QUATERNIUS_WEAPONS: WeaponEntry[] = [
  { id: 'poly-shotgun-01', name: 'Quaternius Shotgun', shortName: 'Shotgun', source: 'Quaternius', handMode: 'both', gripPreset: 'rifle', price: 250, urls: [polyGlb('032e6589-3188-41bc-b92b-e25528344275')] },
  { id: 'poly-assault-rifle-01', name: 'Quaternius Assault Rifle', shortName: 'Assault Rifle', source: 'Quaternius', handMode: 'both', gripPreset: 'rifle', price: 240, urls: [polyGlb('b3e6be61-0299-4866-a227-58f5f3fe610b')] },
  { id: 'poly-pistol-01', name: 'Quaternius Pistol', shortName: 'Pistol', source: 'Quaternius', handMode: 'right', gripPreset: 'pistol', price: 120, urls: [polyGlb('3b53f0fe-f86e-451c-816d-6ab9bd265cdc')] },
  { id: 'poly-revolver-01', name: 'Quaternius Heavy Revolver', shortName: 'Heavy Revolver', source: 'Quaternius', handMode: 'right', gripPreset: 'pistol', price: 140, urls: [polyGlb('9e728565-67a3-44db-9567-982320abff09')] },
  { id: 'poly-sawed-off-01', name: 'Quaternius Sawed-Off Shotgun', shortName: 'Sawed-Off', source: 'Quaternius', handMode: 'right', gripPreset: 'pistol', price: 160, urls: [polyGlb('9a6ee0ee-068b-4774-8b0f-679c3cef0b6e')] },
  { id: 'poly-revolver-02', name: 'Quaternius Revolver Silver', shortName: 'Silver Revolver', source: 'Quaternius', handMode: 'right', gripPreset: 'pistol', price: 145, urls: [polyGlb('7951b3b9-d3a5-4ec8-81b7-11111f1c8e88')] },
  { id: 'poly-shotgun-02', name: 'Quaternius Long Shotgun', shortName: 'Long Shotgun', source: 'Quaternius', handMode: 'both', gripPreset: 'rifle', price: 235, urls: [polyGlb('f71d6771-f512-4374-bd23-ba00b564db68')] },
  { id: 'poly-shotgun-03', name: 'Quaternius Pump Shotgun', shortName: 'Pump Shotgun', source: 'Quaternius', handMode: 'both', gripPreset: 'rifle', price: 230, urls: [polyGlb('08f27141-8e64-425a-9161-1bbd6956dfca')] },
  { id: 'poly-smg-01', name: 'Quaternius Submachine Gun', shortName: 'SMG', source: 'Quaternius', handMode: 'both', gripPreset: 'rifle', price: 210, urls: [polyGlb('fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710')] }
];
const EXTRA_WEAPONS: WeaponEntry[] = [
  { id: 'slot-10-ak47-gltf', name: 'AK47 GLTF', shortName: 'AK47', source: 'Extra', handMode: 'both', gripPreset: 'rifle', price: 280, urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/AK47/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/AK47/scene.gltf', KNOWN_WORKING_GLB.awp, KNOWN_WORKING_GLB.awpRaw] },
  { id: 'slot-11-krsv-gltf', name: 'KRSV GLTF', shortName: 'KRSV', source: 'Extra', handMode: 'both', gripPreset: 'rifle', price: 290, urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/KRSV/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/KRSV/scene.gltf', KNOWN_WORKING_GLB.mrtk, KNOWN_WORKING_GLB.mrtkRaw] },
  { id: 'slot-12-smith-gltf', name: 'Smith GLTF', shortName: 'Smith', source: 'Extra', handMode: 'right', gripPreset: 'pistol', price: 170, urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/Smith/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/Smith/scene.gltf', KNOWN_WORKING_GLB.pistolHolster, KNOWN_WORKING_GLB.pistolHolsterRaw] },
  { id: 'slot-13-mosin-gltf', name: 'Mosin GLTF', shortName: 'Mosin', source: 'Extra', handMode: 'both', gripPreset: 'sniper', price: 300, urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Mosin/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models2/Mosin/scene.gltf', KNOWN_WORKING_GLB.awp, KNOWN_WORKING_GLB.awpRaw] },
  { id: 'slot-14-uzi-gltf', name: 'Uzi GLTF', shortName: 'Uzi', source: 'Extra', handMode: 'both', gripPreset: 'rifle', price: 220, urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Uzi/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models2/Uzi/scene.gltf', KNOWN_WORKING_GLB.mrtk, KNOWN_WORKING_GLB.mrtkMaster] },
  { id: 'slot-15-sigsauer-gltf', name: 'SigSauer GLTF', shortName: 'SigSauer', source: 'Extra', handMode: 'right', gripPreset: 'pistol', price: 180, urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models3/SigSauer/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models3/SigSauer/scene.gltf', KNOWN_WORKING_GLB.pistolHolster, KNOWN_WORKING_GLB.pistolHolsterRaw] },
  { id: 'slot-16-awp-glb', name: 'AWP Sniper GLB', shortName: 'AWP Sniper', source: 'Extra', handMode: 'both', gripPreset: 'sniper', price: 320, urls: [KNOWN_WORKING_GLB.awp, KNOWN_WORKING_GLB.awpRaw] },
  { id: 'slot-17-mrtk-gun-glb', name: 'MRTK Gun GLB', shortName: 'MRTK Gun', source: 'Extra', handMode: 'both', gripPreset: 'rifle', price: 260, urls: [KNOWN_WORKING_GLB.mrtk, KNOWN_WORKING_GLB.mrtkRaw, KNOWN_WORKING_GLB.mrtkMaster] },
  { id: 'slot-18-fps-gun-gltf', name: 'FPS Gun GLTF', shortName: 'FPS Shotgun', source: 'Extra', handMode: 'both', gripPreset: 'rifle', price: 340, urls: [KNOWN_WORKING_GLB.fps, KNOWN_WORKING_GLB.fpsRaw, KNOWN_WORKING_GLB.awp, KNOWN_WORKING_GLB.awpRaw] }
];
const WEAPON_MANIFEST = [...QUATERNIUS_WEAPONS, ...EXTRA_WEAPONS];
const slotPosition = (i: number) => { const c = i % GRID_COLS, r = Math.floor(i / GRID_COLS), m = (GRID_ROWS - 1) / 2; return new THREE.Vector3((c - 1) * GAP_X, 0, (r - m) * GAP_Z); };
const isModelUrl = (u: string) => /\.(glb|gltf)(\?|#|$)/i.test(u);
function runSelfTests() { if (WEAPON_MANIFEST.length !== WEAPON_COUNT) throw new Error('18 only'); if (!WEAPON_MANIFEST.every(w => w.urls.every(isModelUrl))) throw new Error('urls'); }
runSelfTests();
const makeLoader = (url: string) => { const base = url.slice(0, url.lastIndexOf('/') + 1); const m = new THREE.LoadingManager(); m.setURLModifier((r: string) => /^(https?:)?\/\//i.test(r) ? r : new URL(r, base).toString()); return new GLTFLoader(m); };
const loadModelByUrls = async (name: string, urls: string[]) => { let last: unknown = null; for (const url of urls) { try { const gltf = await new Promise<GLTF>((res, rej) => makeLoader(url).load(url, res, undefined, rej)); return { gltf, url }; } catch (e) { last = e; } } throw last ?? new Error(`all failed ${name}`); };

export default function ChessBattleRoyaleStore() {
  const mountRef = useRef<HTMLDivElement | null>(null); const runtimesRef = useRef<RuntimeWeapon[]>([]); const selectedRef = useRef(0); const recoilSel = useRef(0); const recoilAll = useRef(0);
  const [selectedIndex, setSelectedIndex] = useState(0); const [loadedCount, setLoadedCount] = useState(0); const [failedCount, setFailedCount] = useState(0); const [status, setStatus] = useState('Loading 18 weapons...');
  const [coins, setCoins] = useState(500); const [owned, setOwned] = useState<Set<string>>(new Set([WEAPON_MANIFEST[0].id]));
  const [swapOpen, setSwapOpen] = useState(false); const [storeOpen, setStoreOpen] = useState(false);
  const selectedWeapon = useMemo(() => WEAPON_MANIFEST[selectedIndex], [selectedIndex]);
  const ownedWeapons = WEAPON_MANIFEST.filter((w) => owned.has(w.id));

  useEffect(() => { selectedRef.current = selectedIndex; }, [selectedIndex]);
  useEffect(() => {
    const mount = mountRef.current; if (!mount) return; let disposed = false; let frame = 0; const scene = new THREE.Scene(); scene.background = new THREE.Color('#0f172a');
    const camera = new THREE.PerspectiveCamera(43, mount.clientWidth / mount.clientHeight, 0.1, 140); camera.position.set(0, 8.3, 10.8);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(mount.clientWidth, mount.clientHeight); mount.innerHTML = ''; mount.appendChild(renderer.domElement);
    const world = new THREE.Group(); scene.add(world); scene.add(new THREE.AmbientLight(0xffffff, 1.75)); const slots: THREE.Group[] = [];
    WEAPON_MANIFEST.forEach((_, i) => { const slot = new THREE.Group(); slot.position.copy(slotPosition(i)); world.add(slot); slots.push(slot); });
    (async () => { let loaded = 0, failed = 0; await Promise.allSettled(WEAPON_MANIFEST.map(async (entry, index) => { try { const { gltf } = await loadModelByUrls(entry.name, entry.urls); const model = gltf.scene; const box = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()); const max = Math.max(box.x, box.y, box.z); if (max > 0) model.scale.setScalar(FPS_SHOTGUN_DISPLAY_LENGTH / max); slots[index].add(model); runtimesRef.current.push({ entry, slot: slots[index], root: model, basePosition: model.position.clone(), baseRotation: model.rotation.clone(), baseScale: model.scale.clone(), index }); loaded++; setLoadedCount(loaded); } catch { failed++; setFailedCount(failed); } })); setStatus(`Ready: ${loaded}/${WEAPON_COUNT} loaded, ${failed} failed.`); })();
    const clock = new THREE.Clock(); const anim = () => { if (disposed) return; frame = requestAnimationFrame(anim); const d = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime; runtimesRef.current.forEach((r) => { const sel = r.index === selectedRef.current; const rec = Math.pow(recoilAll.current, 1.4) * 0.62 + (sel ? Math.pow(recoilSel.current, 1.35) : 0); r.root.rotation.y += Math.sin(t + r.index) * 0.0008; r.root.position.y = THREE.MathUtils.lerp(r.root.position.y, r.basePosition.y + (sel ? 0.36 : 0) + rec * 0.05, 0.16); }); recoilSel.current = Math.max(0, recoilSel.current - d * 4.8); recoilAll.current = Math.max(0, recoilAll.current - d * 3.6); renderer.render(scene, camera); }; anim();
    return () => { disposed = true; cancelAnimationFrame(frame); renderer.dispose(); mount.removeChild(renderer.domElement); };
  }, []);

  const buyWeapon = (weapon: WeaponEntry) => {
    if (owned.has(weapon.id)) return;
    if (coins < weapon.price) return setStatus(`Not enough coins for ${weapon.shortName}`);
    setCoins((c) => c - weapon.price);
    setOwned((prev) => new Set([...prev, weapon.id]));
    setStatus(`Purchased ${weapon.name}.`);
  };

  const selectWeapon = (index: number) => {
    if (!owned.has(WEAPON_MANIFEST[index].id)) return setStatus('Buy this weapon first in Store.');
    setSelectedIndex(index); selectedRef.current = index; setStatus(`Selected ${index + 1}/${WEAPON_COUNT}: ${WEAPON_MANIFEST[index].name}`);
  };

  const weaponGlyph = (w: WeaponEntry) => w.gripPreset === 'pistol' ? '🔫' : w.gripPreset === 'sniper' ? '🎯' : '🪖';

  return <div className='relative h-screen w-full overflow-hidden bg-slate-950 text-white'>
    <div ref={mountRef} className='absolute inset-0' />
    <div className='absolute left-3 right-3 top-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-xs'><div className='font-black text-yellow-300'>18 Weapons · FPS Shotgun Size Match</div><div>{loadedCount}/{WEAPON_COUNT} loaded · {failedCount} failed · 🪙 {coins}</div><div>{status}</div></div>

    <div className='absolute right-3 top-24 z-20 flex flex-col items-center gap-3'>
      <button onClick={() => setSwapOpen((v) => !v)} className='h-11 w-11 rounded-xl border border-cyan-300/30 bg-cyan-500/80 text-lg font-black text-slate-950'>⇄</button>
      <button className='h-11 w-11 rounded-xl border border-white/20 bg-white/10 text-lg'>GIF</button>
    </div>

    {swapOpen && <div className='absolute right-3 top-40 z-20 w-56 rounded-xl border border-cyan-300/30 bg-slate-900/95 p-2'><div className='mb-2 text-xs font-black text-cyan-300'>Swap Weapon (Inventory)</div><div className='max-h-52 space-y-1 overflow-auto'>{ownedWeapons.map((weapon) => <button key={weapon.id} onClick={() => { selectWeapon(WEAPON_MANIFEST.findIndex((w) => w.id === weapon.id)); setSwapOpen(false); }} className='flex w-full items-center justify-between rounded-lg bg-white/10 px-2 py-2 text-left text-xs'><span>{weaponGlyph(weapon)} {weapon.shortName}</span><span className='text-[10px] text-slate-300'>{weapon.handMode === 'both' ? '2H' : 'RH'}</span></button>)}</div></div>}

    <div className='absolute bottom-3 left-3 right-3 rounded-2xl border border-white/10 bg-slate-950/75 p-3'>
      <div className='mb-2 flex items-center justify-between'><div className='text-xs font-black text-yellow-300'>Selected: {selectedIndex + 1}. {selectedWeapon.shortName}</div><button onClick={() => setStoreOpen((v) => !v)} className='rounded-lg bg-emerald-600 px-3 py-1 text-xs font-black'>{storeOpen ? 'Hide Store' : 'Open Store'}</button></div>
      {storeOpen && <div className='mb-3 max-h-36 space-y-1 overflow-auto rounded-lg bg-black/20 p-2'>{WEAPON_MANIFEST.map((weapon, index) => <div key={weapon.id} className='flex items-center justify-between rounded-lg bg-white/5 px-2 py-1 text-xs'><div>{weaponGlyph(weapon)} {weapon.shortName} · 🪙{weapon.price}</div>{owned.has(weapon.id) ? <button onClick={() => selectWeapon(index)} className='rounded bg-cyan-600 px-2 py-1 text-[10px] font-black'>Equip</button> : <button onClick={() => buyWeapon(weapon)} className='rounded bg-emerald-600 px-2 py-1 text-[10px] font-black'>Buy</button>}</div>)}</div>}
      <div className='grid max-h-40 grid-cols-3 gap-2 overflow-y-auto pr-1'>{WEAPON_MANIFEST.map((weapon, index) => <button key={weapon.id} onClick={() => selectWeapon(index)} className={`rounded-xl border px-2 py-2 text-left text-[11px] font-bold ${selectedIndex === index ? 'border-yellow-300 bg-yellow-400 text-slate-950' : owned.has(weapon.id) ? 'border-white/10 bg-white/10 text-slate-100' : 'border-red-300/20 bg-red-900/40 text-red-100'}`}><span className='block text-[10px] opacity-70'>#{index + 1} · {weapon.handMode === 'both' ? '2H' : 'RH'}</span><span className='block truncate'>{weapon.shortName}</span></button>)}</div>
      <div className='mt-2 flex gap-2'><button onClick={() => { recoilSel.current = 1; setStatus(`Recoil preview: ${selectedWeapon.name}`); }} className='rounded-xl bg-yellow-500 px-3 py-2 text-xs font-black text-slate-950'>Fire Selected</button><button onClick={() => { recoilAll.current = 1; setStatus('Recoil preview: all visible weapons together.'); }} className='rounded-xl bg-red-700 px-3 py-2 text-xs font-black'>Fire All</button></div>
    </div>
  </div>;
}
