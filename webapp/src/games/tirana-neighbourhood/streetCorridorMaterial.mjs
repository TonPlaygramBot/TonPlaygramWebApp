// These are authored visual treatments anchored to exact road names in WORLD,
// not surveyed material claims. See docs/tirana-corridor-appearance.md.
const keys=new Map([
 ['bulevardi deshmoret e kombit',1],
 ['bulevardi bajram curri',2],['bulevardi gjergj fishta',2],
 ['rruga e kavajes',3],
 ['rruga e durresit',4],
 ['rruga ali demi',5],['rruga petro nini luarasi',5],
 ['bulevardi zogu i pare',6],['bulevardi i ri',7],
]);
const memo=new Map();
export function corridorMaterialId(name){
 if(typeof name!=='string'||!name)return 0;
 if(memo.has(name))return memo.get(name);
 const id=keys.get(name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' '))||0;
 if(memo.size<1024)memo.set(name,id);
 return id;
}
