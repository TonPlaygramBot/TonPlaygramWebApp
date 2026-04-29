const polyGlb = (uuid) => `https://static.poly.pizza/${uuid}.glb`;

export const SNAKE_KNOWN_WORKING_GLB = Object.freeze({
  awp: 'https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb',
  awpRaw: 'https://raw.githubusercontent.com/GarbajYT/godot-sniper-rifle/master/AWP.glb',
  mrtk: 'https://cdn.jsdelivr.net/gh/microsoft/MixedRealityToolkit@main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  mrtkRaw: 'https://raw.githubusercontent.com/microsoft/MixedRealityToolkit/main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  mrtkMaster: 'https://cdn.jsdelivr.net/gh/Microsoft/MixedRealityToolkit@master/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  pistolHolster: 'https://cdn.jsdelivr.net/gh/SAAAM-LLC/3D_model_bundle@main/SAM_ASSET-PISTOL-IN-HOLSTER.glb',
  pistolHolsterRaw: 'https://raw.githubusercontent.com/SAAAM-LLC/3D_model_bundle/main/SAM_ASSET-PISTOL-IN-HOLSTER.glb',
  fps: 'https://cdn.jsdelivr.net/gh/lando19/Guns-for-BJS-FPS-Game@main/main/scene.gltf',
  fpsRaw: 'https://raw.githubusercontent.com/lando19/Guns-for-BJS-FPS-Game/main/main/scene.gltf'
});

export const SNAKE_CAPTURE_WEAPON_OPTIONS = Object.freeze([
  { id: 'shotgunBlastAttack', label: 'Quaternius Shotgun', handMode: 'both', gripPreset: 'rifle', urls: [polyGlb('032e6589-3188-41bc-b92b-e25528344275')] },
  { id: 'assaultRifleAttack', label: 'Quaternius Assault Rifle', handMode: 'both', gripPreset: 'rifle', urls: [polyGlb('b3e6be61-0299-4866-a227-58f5f3fe610b')] },
  { id: 'glockSidearmAttack', label: 'Quaternius Pistol', handMode: 'right', gripPreset: 'pistol', urls: [polyGlb('3b53f0fe-f86e-451c-816d-6ab9bd265cdc')] },
  { id: 'smithSidearmAttack', label: 'Quaternius Heavy Revolver', handMode: 'right', gripPreset: 'pistol', urls: [polyGlb('9e728565-67a3-44db-9567-982320abff09')] },
  { id: 'pistolSidearmAttack', label: 'Quaternius Sawed-Off Shotgun', handMode: 'right', gripPreset: 'pistol', urls: [polyGlb('9a6ee0ee-068b-4774-8b0f-679c3cef0b6e')] },
  { id: 'compactCarbineAttack', label: 'Quaternius Revolver Silver', handMode: 'right', gripPreset: 'pistol', urls: [polyGlb('7951b3b9-d3a5-4ec8-81b7-11111f1c8e88')] },
  { id: 'marksmanDmrAttack', label: 'Quaternius Long Shotgun', handMode: 'both', gripPreset: 'rifle', urls: [polyGlb('f71d6771-f512-4374-bd23-ba00b564db68')] },
  { id: 'grenadeBlastAttack', label: 'Quaternius Pump Shotgun', handMode: 'both', gripPreset: 'rifle', urls: [polyGlb('08f27141-8e64-425a-9161-1bbd6956dfca')] },
  { id: 'smgBurstAttack', label: 'Quaternius SMG', handMode: 'both', gripPreset: 'rifle', urls: [polyGlb('fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710')] },
  { id: 'ak47VolleyAttack', label: 'AK47 GLTF', handMode: 'both', gripPreset: 'rifle', urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/AK47/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/AK47/scene.gltf', SNAKE_KNOWN_WORKING_GLB.awp, SNAKE_KNOWN_WORKING_GLB.awpRaw] },
  { id: 'krsvBurstAttack', label: 'KRSV GLTF', handMode: 'both', gripPreset: 'rifle', urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/KRSV/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/KRSV/scene.gltf', SNAKE_KNOWN_WORKING_GLB.mrtk, SNAKE_KNOWN_WORKING_GLB.mrtkRaw] },
  { id: 'fighterJetAttack', label: 'Smith GLTF', handMode: 'right', gripPreset: 'pistol', urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/Smith/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/Smith/scene.gltf', SNAKE_KNOWN_WORKING_GLB.pistolHolster, SNAKE_KNOWN_WORKING_GLB.pistolHolsterRaw] },
  { id: 'mosinMarksmanAttack', label: 'Mosin GLTF', handMode: 'both', gripPreset: 'sniper', urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Mosin/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models2/Mosin/scene.gltf', SNAKE_KNOWN_WORKING_GLB.awp, SNAKE_KNOWN_WORKING_GLB.awpRaw] },
  { id: 'uziSprayAttack', label: 'Uzi GLTF', handMode: 'both', gripPreset: 'rifle', urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Uzi/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models2/Uzi/scene.gltf', SNAKE_KNOWN_WORKING_GLB.mrtk, SNAKE_KNOWN_WORKING_GLB.mrtkMaster] },
  { id: 'sigsauerTacticalAttack', label: 'SigSauer GLTF', handMode: 'right', gripPreset: 'pistol', urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models3/SigSauer/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models3/SigSauer/scene.gltf', SNAKE_KNOWN_WORKING_GLB.pistolHolster, SNAKE_KNOWN_WORKING_GLB.pistolHolsterRaw] },
  { id: 'sniperShotAttack', label: 'AWP Sniper GLB', handMode: 'both', gripPreset: 'sniper', urls: [SNAKE_KNOWN_WORKING_GLB.awp, SNAKE_KNOWN_WORKING_GLB.awpRaw] },
  { id: 'droneAttack', label: 'MRTK Gun GLB', handMode: 'both', gripPreset: 'rifle', urls: [SNAKE_KNOWN_WORKING_GLB.mrtk, SNAKE_KNOWN_WORKING_GLB.mrtkRaw, SNAKE_KNOWN_WORKING_GLB.mrtkMaster] },
  { id: 'fpsGunAttack', label: 'FPS Gun GLTF', handMode: 'both', gripPreset: 'rifle', urls: [SNAKE_KNOWN_WORKING_GLB.fps, SNAKE_KNOWN_WORKING_GLB.fpsRaw, SNAKE_KNOWN_WORKING_GLB.awp, SNAKE_KNOWN_WORKING_GLB.awpRaw] }
]);
