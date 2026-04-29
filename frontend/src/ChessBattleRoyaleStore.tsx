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
type RuntimeWeapon = { entry: WeaponEntry; slot: THREE.Group; root: THREE.Object3D; basePosition: THREE.Vector3; index: number };

const polyGlb = (uuid: string) => `https://static.poly.pizza/${uuid}.glb`;
const KNOWN_WORKING_GLB = { awp: 'https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb', awpRaw: 'https://raw.githubusercontent.com/GarbajYT/godot-sniper-rifle/master/AWP.glb', mrtk: 'https://cdn.jsdelivr.net/gh/microsoft/MixedRealityToolkit@main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb', mrtkRaw: 'https://raw.githubusercontent.com/microsoft/MixedRealityToolkit/main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb', mrtkMaster: 'https://cdn.jsdelivr.net/gh/Microsoft/MixedRealityToolkit@master/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb', pistolHolster: 'https://cdn.jsdelivr.net/gh/SAAAM-LLC/3D_model_bundle@main/SAM_ASSET-PISTOL-IN-HOLSTER.glb', pistolHolsterRaw: 'https://raw.githubusercontent.com/SAAAM-LLC/3D_model_bundle/main/SAM_ASSET-PISTOL-IN-HOLSTER.glb', fps: 'https://cdn.jsdelivr.net/gh/lando19/Guns-for-BJS-FPS-Game@main/main/scene.gltf', fpsRaw: 'https://raw.githubusercontent.com/lando19/Guns-for-BJS-FPS-Game/main/main/scene.gltf' };
const QUATERNIUS_WEAPONS: WeaponEntry[] = [
  { id: 'poly-shotgun-01', name: 'Quaternius Shotgun', shortName: 'Shotgun', source: 'Quaternius', handMode: 'both', gripPreset: 'rifle', urls: [polyGlb('032e6589-3188-41bc-b92b-e25528344275')], price: 120 },
  { id: 'poly-assault-rifle-01', name: 'Quaternius Assault Rifle', shortName: 'Assault Rifle', source: 'Quaternius', handMode: 'both', gripPreset: 'rifle', urls: [polyGlb('b3e6be61-0299-4866-a227-58f5f3fe610b')], price: 150 },
  { id: 'poly-pistol-01', name: 'Quaternius Pistol', shortName: 'Pistol', source: 'Quaternius', handMode: 'right', gripPreset: 'pistol', urls: [polyGlb('3b53f0fe-f86e-451c-816d-6ab9bd265cdc')], price: 80 },
  { id: 'poly-revolver-01', name: 'Quaternius Heavy Revolver', shortName: 'Heavy Revolver', source: 'Quaternius', handMode: 'right', gripPreset: 'pistol', urls: [polyGlb('9e728565-67a3-44db-9567-982320abff09')], price: 95 },
  { id: 'poly-sawed-off-01', name: 'Quaternius Sawed-Off Shotgun', shortName: 'Sawed-Off', source: 'Quaternius', handMode: 'right', gripPreset: 'pistol', urls: [polyGlb('9a6ee0ee-068b-4774-8b0f-679c3cef0b6e')], price: 90 },
  { id: 'poly-revolver-02', name: 'Quaternius Revolver Silver', shortName: 'Silver Revolver', source: 'Quaternius', handMode: 'right', gripPreset: 'pistol', urls: [polyGlb('7951b3b9-d3a5-4ec8-81b7-11111f1c8e88')], price: 100 },
  { id: 'poly-shotgun-02', name: 'Quaternius Long Shotgun', shortName: 'Long Shotgun', source: 'Quaternius', handMode: 'both', gripPreset: 'rifle', urls: [polyGlb('f71d6771-f512-4374-bd23-ba00b564db68')], price: 155 },
  { id: 'poly-shotgun-03', name: 'Quaternius Pump Shotgun', shortName: 'Pump Shotgun', source: 'Quaternius', handMode: 'both', gripPreset: 'rifle', urls: [polyGlb('08f27141-8e64-425a-9161-1bbd6956dfca')], price: 145 },
  { id: 'poly-smg-01', name: 'Quaternius Submachine Gun', shortName: 'SMG', source: 'Quaternius', handMode: 'both', gripPreset: 'rifle', urls: [polyGlb('fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710')], price: 130 }
];
const EXTRA_WEAPONS: WeaponEntry[] = [
  { id: 'slot-10-ak47-gltf', name: 'AK47 GLTF', shortName: 'AK47', source: 'Extra', handMode: 'both', gripPreset: 'rifle', urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/AK47/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/AK47/scene.gltf', KNOWN_WORKING_GLB.awp, KNOWN_WORKING_GLB.awpRaw], price: 180 },
  { id: 'slot-11-krsv-gltf', name: 'KRSV GLTF', shortName: 'KRSV', source: 'Extra', handMode: 'both', gripPreset: 'rifle', urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/KRSV/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/KRSV/scene.gltf', KNOWN_WORKING_GLB.mrtk, KNOWN_WORKING_GLB.mrtkRaw], price: 165 },
  { id: 'slot-12-smith-gltf', name: 'Smith GLTF', shortName: 'Smith', source: 'Extra', handMode: 'right', gripPreset: 'pistol', urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/Smith/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/Smith/scene.gltf', KNOWN_WORKING_GLB.pistolHolster, KNOWN_WORKING_GLB.pistolHolsterRaw], price: 110 },
  { id: 'slot-13-mosin-gltf', name: 'Mosin GLTF', shortName: 'Mosin', source: 'Extra', handMode: 'both', gripPreset: 'sniper', urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Mosin/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models2/Mosin/scene.gltf', KNOWN_WORKING_GLB.awp, KNOWN_WORKING_GLB.awpRaw], price: 190 },
  { id: 'slot-14-uzi-gltf', name: 'Uzi GLTF', shortName: 'Uzi', source: 'Extra', handMode: 'both', gripPreset: 'rifle', urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Uzi/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models2/Uzi/scene.gltf', KNOWN_WORKING_GLB.mrtk, KNOWN_WORKING_GLB.mrtkMaster], price: 170 },
  { id: 'slot-15-sigsauer-gltf', name: 'SigSauer GLTF', shortName: 'SigSauer', source: 'Extra', handMode: 'right', gripPreset: 'pistol', urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models3/SigSauer/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models3/SigSauer/scene.gltf', KNOWN_WORKING_GLB.pistolHolster, KNOWN_WORKING_GLB.pistolHolsterRaw], price: 115 },
  { id: 'slot-16-awp-glb', name: 'AWP Sniper GLB', shortName: 'AWP Sniper', source: 'Extra', handMode: 'both', gripPreset: 'sniper', urls: [KNOWN_WORKING_GLB.awp, KNOWN_WORKING_GLB.awpRaw], price: 210 },
  { id: 'slot-17-mrtk-gun-glb', name: 'MRTK Gun GLB', shortName: 'MRTK Gun', source: 'Extra', handMode: 'both', gripPreset: 'rifle', urls: [KNOWN_WORKING_GLB.mrtk, KNOWN_WORKING_GLB.mrtkRaw, KNOWN_WORKING_GLB.mrtkMaster], price: 160 },
  { id: 'slot-18-fps-gun-gltf', name: 'FPS Gun GLTF', shortName: 'FPS Shotgun', source: 'Extra', handMode: 'both', gripPreset: 'rifle', urls: [KNOWN_WORKING_GLB.fps, KNOWN_WORKING_GLB.fpsRaw, KNOWN_WORKING_GLB.awp, KNOWN_WORKING_GLB.awpRaw], price: 200 }
];
const WEAPON_MANIFEST = [...QUATERNIUS_WEAPONS, ...EXTRA_WEAPONS];
const isModelUrl = (u: string) => /\.(glb|gltf)(\?|#|$)/i.test(u);
const slotPosition = (i: number) => { const c = i % GRID_COLS, r = Math.floor(i / GRID_COLS), m = (GRID_ROWS - 1) / 2; return new THREE.Vector3((c - 1) * GAP_X, 0, (r - m) * GAP_Z); };

export default function ChessBattleRoyaleStore() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimesRef = useRef<RuntimeWeapon[]>([]);
  const selectedRef = useRef(0);
  const recoilSel = useRef(0);
  const recoilAll = useRef(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [status, setStatus] = useState('Loading 18 weapons...');
  const [currency, setCurrency] = useState(1200);
  const [inventory, setInventory] = useState<string[]>([WEAPON_MANIFEST[0].id]);
  const [showSwapMenu, setShowSwapMenu] = useState(false);
  const selectedWeapon = useMemo(() => WEAPON_MANIFEST[selectedIndex], [selectedIndex]);

  useEffect(() => { selectedRef.current = selectedIndex; }, [selectedIndex]);

  useEffect(() => {
    if (WEAPON_MANIFEST.length !== WEAPON_COUNT || !WEAPON_MANIFEST.every((w) => w.urls.every(isModelUrl))) {
      throw new Error('Weapon manifest self-test failed');
    }
  }, []);

  const weaponIcon = (weapon: WeaponEntry) => (weapon.gripPreset === 'pistol' ? '🔫' : weapon.gripPreset === 'sniper' ? '🎯' : '🪖');
  const ownsSelected = inventory.includes(selectedWeapon.id);

  function purchaseSelectedWeapon() {
    if (ownsSelected) return;
    if (currency < selectedWeapon.price) return setStatus(`Not enough coins for ${selectedWeapon.shortName}.`);
    setCurrency((v) => v - selectedWeapon.price);
    setInventory((prev) => [...prev, selectedWeapon.id]);
    setStatus(`Purchased ${selectedWeapon.shortName}. You can now swap to it in animation.`);
  }

  function quickSwapWeapon(weaponId: string) {
    const nextIndex = WEAPON_MANIFEST.findIndex((w) => w.id === weaponId);
    if (nextIndex < 0) return;
    setSelectedIndex(nextIndex);
    selectedRef.current = nextIndex;
    setShowSwapMenu(false);
    setStatus(`Quick swapped to ${WEAPON_MANIFEST[nextIndex].shortName}.`);
  }
  return <div className='relative h-screen w-full overflow-hidden bg-slate-950 text-white'><div ref={mountRef} className='absolute inset-0'/><div className='pointer-events-none absolute left-3 right-3 top-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-xs'><div className='font-black text-yellow-300'>18 Weapons · FPS Shotgun Size Match</div><div>{loadedCount}/{WEAPON_COUNT} loaded · {failedCount} failed · Coins: {currency}</div><div>{status}</div></div>
    <div className='absolute right-3 top-20 z-20 flex flex-col items-center gap-3'>
      <button onClick={() => setShowSwapMenu((v) => !v)} className='h-11 w-11 rounded-full border border-cyan-300/30 bg-cyan-500/90 text-lg font-black text-slate-950 shadow-lg'>⇅</button>
      <button className='h-11 w-11 rounded-full border border-violet-300/30 bg-violet-500/90 text-xs font-black text-slate-950 shadow-lg'>GIF</button>
      {showSwapMenu && <div className='max-h-72 w-56 overflow-y-auto rounded-xl border border-cyan-300/30 bg-slate-900/95 p-2 shadow-2xl backdrop-blur'>
        <div className='mb-2 text-[11px] font-black text-cyan-300'>Swap Animation Weapon</div>
        {inventory.map((id) => {
          const weapon = WEAPON_MANIFEST.find((w) => w.id === id);
          if (!weapon) return null;
          return <button key={id} onClick={() => quickSwapWeapon(id)} className='mb-1 flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-left text-xs hover:bg-white/10'>
            <span>{weaponIcon(weapon)} {weapon.shortName}</span><span className='text-cyan-300'>Swap</span></button>;
        })}
      </div>}
    </div>
    <div className='absolute bottom-3 left-3 right-3 rounded-2xl border border-white/10 bg-slate-950/75 p-3'><div className='mb-2 text-xs font-black text-yellow-300'>Selected: {selectedIndex + 1}. {selectedWeapon.shortName}</div><div className='grid max-h-40 grid-cols-3 gap-2 overflow-y-auto pr-1'>{WEAPON_MANIFEST.map((weapon, index) => <button key={weapon.id} onClick={() => { setSelectedIndex(index); selectedRef.current = index; setStatus(`Selected ${index + 1}/${WEAPON_COUNT}: ${WEAPON_MANIFEST[index].name}`); }} className={`rounded-xl border px-2 py-2 text-left text-[11px] font-bold ${selectedIndex === index ? 'border-yellow-300 bg-yellow-400 text-slate-950' : 'border-white/10 bg-white/10 text-slate-100'}`}><span className='block text-[10px] opacity-70'>#{index + 1} · {weapon.handMode === 'both' ? '2H' : 'RH'} · {weaponIcon(weapon)}</span><span className='block truncate'>{weapon.shortName}</span><span className='block text-[10px] opacity-70'>{inventory.includes(weapon.id) ? 'Owned' : `${weapon.price} coins`}</span></button>)}</div><div className='mt-2 flex gap-2'><button onClick={purchaseSelectedWeapon} className='rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white'>{ownsSelected ? 'Owned' : `Buy ${selectedWeapon.price}`}</button><button onClick={() => { recoilSel.current = 1; setStatus(`Recoil preview: ${selectedWeapon.name}`); }} className='rounded-xl bg-yellow-500 px-3 py-2 text-xs font-black text-slate-950'>Fire Selected</button><button onClick={() => { recoilAll.current = 1; setStatus('Recoil preview: all visible weapons together.'); }} className='rounded-xl bg-red-700 px-3 py-2 text-xs font-black'>Fire All</button></div></div></div>;
}
