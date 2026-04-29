import { swatchThumbnail } from './storeThumbnails.js';

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
  { id: 'poly-shotgun-01', label: 'Quaternius Shotgun', thumbnail: swatchThumbnail(['#64748b','#1e293b','#f8fafc']), urls: [polyGlb('032e6589-3188-41bc-b92b-e25528344275')] },
  { id: 'poly-assault-rifle-01', label: 'Quaternius Assault Rifle', thumbnail: swatchThumbnail(['#334155','#0f172a','#94a3b8']), urls: [polyGlb('b3e6be61-0299-4866-a227-58f5f3fe610b')] },
  { id: 'poly-pistol-01', label: 'Quaternius Pistol', thumbnail: swatchThumbnail(['#6b7280','#111827','#e5e7eb']), urls: [polyGlb('3b53f0fe-f86e-451c-816d-6ab9bd265cdc')] },
  { id: 'poly-revolver-01', label: 'Quaternius Heavy Revolver', thumbnail: swatchThumbnail(['#7c2d12','#1f2937','#fbbf24']), urls: [polyGlb('9e728565-67a3-44db-9567-982320abff09')] },
  { id: 'poly-sawed-off-01', label: 'Quaternius Sawed-Off', thumbnail: swatchThumbnail(['#78350f','#0f172a','#d6d3d1']), urls: [polyGlb('9a6ee0ee-068b-4774-8b0f-679c3cef0b6e')] },
  { id: 'poly-revolver-02', label: 'Quaternius Revolver Silver', thumbnail: swatchThumbnail(['#94a3b8','#1f2937','#f8fafc']), urls: [polyGlb('7951b3b9-d3a5-4ec8-81b7-11111f1c8e88')] },
  { id: 'poly-shotgun-02', label: 'Quaternius Long Shotgun', thumbnail: swatchThumbnail(['#475569','#020617','#cbd5e1']), urls: [polyGlb('f71d6771-f512-4374-bd23-ba00b564db68')] },
  { id: 'poly-shotgun-03', label: 'Quaternius Pump Shotgun', thumbnail: swatchThumbnail(['#52525b','#111827','#e2e8f0']), urls: [polyGlb('08f27141-8e64-425a-9161-1bbd6956dfca')] },
  { id: 'poly-smg-01', label: 'Quaternius SMG', thumbnail: swatchThumbnail(['#374151','#030712','#d1d5db']), urls: [polyGlb('fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710')] },
  { id: 'slot-10-ak47-gltf', label: 'AK47 GLTF', thumbnail: swatchThumbnail(['#7f1d1d','#111827','#f59e0b']), urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/AK47/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/AK47/scene.gltf', SNAKE_KNOWN_WORKING_GLB.awp, SNAKE_KNOWN_WORKING_GLB.awpRaw] },
  { id: 'slot-11-krsv-gltf', label: 'KRSV GLTF', thumbnail: swatchThumbnail(['#1d4ed8','#0f172a','#bfdbfe']), urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/KRSV/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/KRSV/scene.gltf', SNAKE_KNOWN_WORKING_GLB.mrtk, SNAKE_KNOWN_WORKING_GLB.mrtkRaw] },
  { id: 'slot-12-smith-gltf', label: 'Smith GLTF', thumbnail: swatchThumbnail(['#6b7280','#0f172a','#f8fafc']), urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/Smith/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/Smith/scene.gltf', SNAKE_KNOWN_WORKING_GLB.pistolHolster, SNAKE_KNOWN_WORKING_GLB.pistolHolsterRaw] },
  { id: 'slot-13-mosin-gltf', label: 'Mosin GLTF', thumbnail: swatchThumbnail(['#92400e','#1f2937','#fcd34d']), urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Mosin/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models2/Mosin/scene.gltf', SNAKE_KNOWN_WORKING_GLB.awp, SNAKE_KNOWN_WORKING_GLB.awpRaw] },
  { id: 'slot-14-uzi-gltf', label: 'Uzi GLTF', thumbnail: swatchThumbnail(['#0f766e','#111827','#99f6e4']), urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Uzi/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models2/Uzi/scene.gltf', SNAKE_KNOWN_WORKING_GLB.mrtk, SNAKE_KNOWN_WORKING_GLB.mrtkMaster] },
  { id: 'slot-15-sigsauer-gltf', label: 'SigSauer GLTF', thumbnail: swatchThumbnail(['#334155','#020617','#f1f5f9']), urls: ['https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models3/SigSauer/scene.gltf', 'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models3/SigSauer/scene.gltf', SNAKE_KNOWN_WORKING_GLB.pistolHolster, SNAKE_KNOWN_WORKING_GLB.pistolHolsterRaw] },
  { id: 'slot-16-awp-glb', label: 'AWP Sniper GLB', thumbnail: swatchThumbnail(['#1e293b','#0f172a','#f8fafc']), urls: [SNAKE_KNOWN_WORKING_GLB.awp, SNAKE_KNOWN_WORKING_GLB.awpRaw] },
  { id: 'slot-17-mrtk-gun-glb', label: 'MRTK Gun GLB', thumbnail: swatchThumbnail(['#0369a1','#0f172a','#e0f2fe']), urls: [SNAKE_KNOWN_WORKING_GLB.mrtk, SNAKE_KNOWN_WORKING_GLB.mrtkRaw, SNAKE_KNOWN_WORKING_GLB.mrtkMaster] },
  { id: 'slot-18-fps-gun-gltf', label: 'FPS Shotgun', thumbnail: swatchThumbnail(['#f59e0b','#111827','#fde68a']), urls: [SNAKE_KNOWN_WORKING_GLB.fps, SNAKE_KNOWN_WORKING_GLB.fpsRaw, SNAKE_KNOWN_WORKING_GLB.awp, SNAKE_KNOWN_WORKING_GLB.awpRaw] }
]);
