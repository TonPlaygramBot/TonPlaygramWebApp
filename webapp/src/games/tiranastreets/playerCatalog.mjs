// These are the five requested originals. A preview is never a playable model.
export const PLAYER_CATALOG=Object.freeze([
  {id:'human',label:'Human Soldier',author:'Adobe Mixamo',licence:'Mixamo game-use terms',source:'https://github.com/mrdoob/three.js/tree/r164/examples/models/gltf',url:'/assets/tirana-streets/living/human.glb'},
  {id:'operator',label:'City Operator',author:'Quaternius · TonPlaygram costume',licence:'CC0-1.0',source:'https://quaternius.com/',url:'/assets/tirana-streets/living/operator.glb'},
  {
    "id": "tactical",
    "label": "Soldier Full Tactical Gear",
    "author": "DanlyVostok",
    "uid": "850593a8c7114c188395ba1849a66eb9",
    "source": "https://sketchfab.com/3d-models/850593a8c7114c188395ba1849a66eb9",
    "preview": "/assets/tirana-streets/players/tactical.jpg",
    "licence": "CC BY 4.0"
  },
  {
    "id": "polish",
    "label": "Polish soldier",
    "author": "buh",
    "uid": "fb96a663fc4a4246a57ca85de3228c00",
    "source": "https://sketchfab.com/3d-models/fb96a663fc4a4246a57ca85de3228c00",
    "preview": "/assets/tirana-streets/players/polish.jpg",
    "licence": "CC BY 4.0"
  },
  {
    "id": "city",
    "label": "City Soldier (outdated)",
    "author": "buh",
    "uid": "636b5a7c7e0c400abda269ba382f3252",
    "source": "https://sketchfab.com/3d-models/636b5a7c7e0c400abda269ba382f3252",
    "preview": "/assets/tirana-streets/players/city.jpg",
    "licence": "CC BY 4.0"
  },
  {
    "id": "forest",
    "label": "Forest soldier (outdated)",
    "author": "buh",
    "uid": "b265975196394070837366de9a0ddb7c",
    "source": "https://sketchfab.com/3d-models/b265975196394070837366de9a0ddb7c",
    "preview": "/assets/tirana-streets/players/forest.jpg",
    "licence": "CC BY 4.0"
  },
  {
    "id": "sand",
    "label": "Sand soldier (outdated)",
    "author": "buh",
    "uid": "98e1431914c1408f958d9c694352cc92",
    "source": "https://sketchfab.com/3d-models/98e1431914c1408f958d9c694352cc92",
    "preview": "/assets/tirana-streets/players/sand.jpg",
    "licence": "CC BY 4.0"
  }
]);
let selected=null;
export function selectPlayerAsset(asset){
  if(!asset){selected=null;return;}
  const entry=PLAYER_CATALOG.find(p=>p.id===asset.id);
  if(!entry||asset.url!==(entry.url||`/assets/tirana-streets/players/${entry.id}.glb`))throw Error('Choose an installed character.');
  selected=Object.freeze({...asset});
}
export function selectedPlayerAsset(){return selected;}
export function selectedPlayerUrl(){return selected?.url||null;}
export function playerAssetFor(id,manifest){
  const builtin=PLAYER_CATALOG.find(p=>p.id===id&&p.url);
  if(builtin)return {id,url:builtin.url};
  const entry=manifest?.players?.[id];
  if(!PLAYER_CATALOG.some(p=>p.id===id)||!entry?.rigValidated||!/^\/assets\/tirana-streets\/players\/[a-z-]+\.glb$/.test(entry.url))return null;
  return {id,url:entry.url};
}
