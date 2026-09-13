/** The user's three supplied originals; no alternate/default character entry. */
export const PLAYER_CATALOG = Object.freeze([
  { id:'tactical', label:'Tactical Soldier', author:'DanlyVostok',
    uid:'850593a8c7114c188395ba1849a66eb9',
    source:'https://sketchfab.com/3d-models/850593a8c7114c188395ba1849a66eb9',
    licence:'CC BY 4.0', licenceUrl:'https://creativecommons.org/licenses/by/4.0/' },
  { id:'polish', label:'Polish Soldier', author:'buh',
    uid:'fb96a663fc4a4246a57ca85de3228c00',
    source:'https://sketchfab.com/3d-models/fb96a663fc4a4246a57ca85de3228c00',
    licence:'CC BY 4.0', licenceUrl:'https://creativecommons.org/licenses/by/4.0/' },
  { id:'agent-47', label:'Agent 47', author:'Veterock (@windofglass)',
    uid:'1680cad927304bb687d6a9ad5b9dd98a',
    source:'https://sketchfab.com/3d-models/1680cad927304bb687d6a9ad5b9dd98a',
    licence:'CC BY-NC 4.0', licenceUrl:'https://creativecommons.org/licenses/by-nc/4.0/' }
].map(entry=>Object.freeze(entry)));
let selected = null;
export function playerAssetFor(id, manifest) {
  const entry = manifest?.players?.[id];
  if(!PLAYER_CATALOG.some(p=>p.id===id) || !entry?.rigValidated ||
    entry.url!==`/assets/tirana-streets/players/${id}.glb`) return null;
  return {id, url:entry.url};
}
export function selectPlayerAsset(asset) {
  if(!asset || !PLAYER_CATALOG.some(p=>p.id===asset.id) || asset.url!==`/assets/tirana-streets/players/${asset.id}.glb`)
    throw new Error('Choose one of the three available players.');
  selected = Object.freeze({id:asset.id,url:asset.url});
}
export function selectedPlayerAsset(){return selected;}
export function selectedPlayerUrl(){return selected?.url || null;}
