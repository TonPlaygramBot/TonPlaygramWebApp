/** Original category palettes for source-named façades. Deliberately not copied
 * identities or promotional offers. This operates on existing placement only. */
const PALETTES={
 cafe:['#2d3d37','#f9e6c3','KAFE'],
 food:['#603628','#ffedc8','RESTORANT'],
 bar:['#303541','#f0e7d3','BAR'],
 bakery:['#e9d5b4','#53372d','FURRË BUKE'],
 pastry:['#633b51','#fff1de','PASTIÇERI'],
 market:['#215348','#fbf5da','MARKET'],
 pharmacy:['#f0f4e9','#216456','FARMACI'],
 hair:['#33383f','#f1f2ec','BERBER'],
 hotel:['#333943','#ebd7a1','HOTEL'],
 bank:['#244056','#edf4f3','BANKË'],
 mall:['#313638','#ede9de','QENDËR TREGTARE']
};
const CATEGORIES=new Map(Object.entries({
 cafe:'cafe',coffee:'cafe',restaurant:'food',fast_food:'food',bar:'bar',pub:'bar',
 bakery:'bakery',pastry:'pastry',confectionery:'pastry',chocolate:'pastry',
 supermarket:'market',convenience:'market',marketplace:'market',greengrocer:'market',
 pharmacy:'pharmacy',chemist:'pharmacy',hairdresser:'hair',barber:'hair',
 hotel:'hotel',bank:'bank',mall:'mall'
}));
export function mappedBusinessFascia(site,face){
 if(site.visualStyle||site.kind==='fuel-sign'||!face.text||face.caption) return null;
 const role=CATEGORIES.get(site.shop||site.category||site.kind);
 const style=PALETTES[role];
 if(!style)return null;
 const [bg,fg,caption]=style;
 return {bg,fg,caption,frontage:true};
}
/** Keep large per-district textures inside older guaranteed-size GPUs. */
export function fasciaAtlasLayout(count){
 const columns=Math.min(16,Math.max(8,Math.ceil(count/85)));
 const rows=Math.max(1,Math.ceil(count/columns));
 if(rows>4096)throw RangeError('Tirana signage atlas exceeds the city registry budget');
 const cellHeight=Math.min(48,Math.floor(4096/rows));
 return {columns,rows,cellHeight};
}
