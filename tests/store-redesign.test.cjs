const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let ts;try{ts=require('typescript');}catch{ts=require(process.env.TYPESCRIPT_PATH||path.join(__dirname,'../webapp/node_modules/typescript'));}
const modules={};
function load(name){
 if(modules[name])return modules[name].exports;
 const filename=path.join(__dirname,'../webapp/src/components/store',name+'.ts');
 const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
 const errors=(output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,JSON.stringify(errors));
 const m={exports:{}};modules[name]=m;
 new Function('require','module','exports',output.outputText)(p=>load(p.replace('./','')),m,m.exports);return m.exports;
}
const m=load('storeModel'),a=load('storeArtwork');
const item=(v={})=>({id:'cue-a',type:'cueStyle',optionId:'redwood-ember',name:'Redwood Ember Cue',displayLabel:'Redwood Ember',price:310,sourcePrice:310,description:'Rich redwood cue butt with ember accents.',slug:'poolroyale',gameName:'Pool Royale',key:'poolroyale:cue-a',entitlementKey:'poolroyale:cueStyle:redwood-ember',category:'Cues',typeLabel:'Cue style',swatches:['#7f1d1d','#b91c1c','#fde68a'],...v});
const filters={game:'all',category:'All',query:'',sort:'featured'};
const swatch='data:image/svg+xml;utf8,'+encodeURIComponent('<svg><stop stop-color="#7f1d1d"/><stop stop-color="#b91c1c"/><circle cx="92" cy="82" r="120"/><rect x="40" y="168" width="176"/></svg>');
test('Legacy price scaling matches existing bounds and intermediate values',()=>{assert.equal(m.legacyStorePrice(0,0,3000),100);assert.equal(m.legacyStorePrice(1500,0,3000),2550);assert.equal(m.legacyStorePrice(3000,0,3000),5000);assert.equal(m.legacyStorePrice(NaN,0,3000),100);assert.equal(m.legacyStorePrice(3,3,3),5000);assert.equal(m.legacyStorePrice(9000,0,3000),5000);});
test('Totals use integer cents rather than floating-point addition',()=>assert.equal(m.totalPrice([{price:.1},{price:.2}]),.3));
test('Search combines words across actual name, game and category',()=>{const result=m.filterItems([item()],{...filters,query:'POOL redwood'},()=>false);assert.equal(result.length,1);assert.equal(m.filterItems([item()],{...filters,query:'missing'},()=>false).length,0);});
test('Game and category filters are independent and exact',()=>{assert.equal(m.filterItems([item()],{...filters,game:'snake'},()=>false).length,0);assert.equal(m.filterItems([item()],{...filters,category:'Cues'},()=>false).length,1);});
test('Owned and hide-owned filters do not mutate source array',()=>{const data=[item(),item({key:'b',price:22})];const owns=x=>x.key==='b';assert.equal(m.filterItems(data,{...filters,ownedOnly:true},owns)[0].key,'b');assert.equal(m.filterItems(data,{...filters,hideOwned:true},owns).length,1);assert.equal(data.length,2);});
test('Sorting is stable, numeric and non-mutating',()=>{const data=[item({price:150}),item({key:'b',price:22})];assert.equal(m.filterItems(data,{...filters,sort:'price-low'},()=>false)[0].price,22);assert.equal(data[0].price,150);});
test('Shared game entitlements deduplicate the basket',()=>{const first=item(),alias=item({slug:'bilardoshqip'});assert.equal(m.entitlementKey(first),m.entitlementKey(alias));assert.equal(m.uniqueCart([first,alias]).length,1);assert.equal(m.entitlementKey(item({slug:'weaponkart',type:'humanCharacter',optionId:'alex'})),'murlanroyale:characters:alex');});
test('Consumable description states quantity and is not a cosmetic',()=>{const d=m.itemDescription(item({type:'poolTrainingAttempt',optionId:'12'}));assert.match(d.full,/12 Pool Royale training attempts/);assert.equal(d.note,'Consumable');assert.match(d.full,/not a visual customization/);});
test('Descriptions use source facts without synthetic sales history',()=>{const d=m.itemDescription(item());assert.match(d.full,/redwood/);assert.match(d.full,/in Pool Royale/);assert.doesNotMatch(d.full,/rare|minted|limited edition|last sold/i);});
test('Only the known legacy swatch template is replaced',()=>{assert.equal(a.isLegacySwatch(swatch),true);const genuine='data:image/svg+xml,'+encodeURIComponent('<svg><path d="M0 0H100"/></svg>');assert.equal(a.isLegacySwatch(genuine),false);assert.deepEqual(a.sourceImages(item({thumbnail:genuine})),[genuine]);});
test('Palettes are extracted from source swatches, never invented from names',()=>{assert.equal(a.itemPalette(item({swatches:undefined,thumbnail:swatch})).colors[0],'#7f1d1d');assert.equal(a.itemPalette(item({name:'Golden Emerald',swatches:undefined})).specified,false);assert.equal(a.validColor('red;" onload="alert(1)'),undefined);assert.equal(a.validColor(0xff0000),'#ff0000');});
test('Unsafe image URLs and non-image model/HDR sources are rejected',()=>{for(const s of ['javascript:alert(1)','http://example.com/a.png','//example.com/a.png','https://u:p@example.com/a.png','https://example.com/a.glb','/sky.exr','/x\\evil','data:text/html,a'])assert.equal(a.safeImageSource(s),'',s);assert.equal(a.safeImageSource('/store-thumbs/item.png'),'/store-thumbs/item.png');assert.equal(a.safeImageSource('https://example.com/item.webp'),'https://example.com/item.webp');});
test('Original images are preferred, deduplicated and swatches skipped',()=>{assert.deepEqual(a.sourceImages(item({thumbnail:swatch,image:'/item.png',imageUrl:'/item.png',zoomImage:'/large.webp'})),['/item.png','/large.webp']);});
test('All catalog type families produce escaped, nonempty SVG artwork',()=>{for(const type of Object.keys(m.TYPE_INFO)){const svg=a.thumbnailSvg(item({type,displayLabel:'<script>x</script> & "name"'}));assert.match(svg,/^<svg/);assert.match(svg,/width="640" height="448"/);assert.doesNotMatch(svg,/<script>/);assert.match(svg,/&lt;script&gt;/);assert.doesNotMatch(svg,/undefined|NaN/);}});
test('Type-specific artwork differs, including known table-base structure',()=>{assert.notEqual(a.thumbnailSvg(item()),a.thumbnailSvg(item({type:'pocketLiner'})));assert.notEqual(a.thumbnailSvg(item({type:'tableBase',optionId:'openPortal'})),a.thumbnailSvg(item({type:'tableBase',optionId:'classicCylinders'})));});
test('Generated SVG data URLs round-trip without broken quoting',()=>{const i=item();assert.equal(decodeURIComponent(a.thumbnailDataUrl(i).split(',')[1]),a.thumbnailSvg(i));});
