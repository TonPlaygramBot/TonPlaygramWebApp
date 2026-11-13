/** Original CC0 asset authoring. Run from repository root: node assets-source/tirana-detail-kit/build.mjs */
import * as T from '../../webapp/node_modules/three/build/three.module.js';
import {GLTFExporter} from '../../webapp/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import {mergeGeometries} from '../../webapp/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import {RECIPES,PALETTE} from '../../webapp/src/games/tirana-detail-kit/recipes.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// GLTFExporter uses the browser FileReader abstraction only for Blob conversion.
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const root=new T.Group();root.name='Tirana original detailed fixtures';
const material=Object.fromEntries(Object.entries(PALETTE).map(([k,v])=>[k,new T.MeshStandardMaterial({...v,name:k})]));
for(const [id,recipe] of Object.entries(RECIPES)){
 const group=new T.Group();group.name=id;root.add(group);const buckets=new Map();
 const add=(key,g)=>{if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(g.index?g.toNonIndexed():g);if(g.index)g.dispose();};
 const box=(key,w,h,d,x,y,z,rx=0)=>add(key,new T.BoxGeometry(w,h,d).rotateX(rx).translate(x,y,z));
 const ring=(key,r,t,x,y,z,rx=0)=>add(key,new T.TorusGeometry(r,t,4,20).rotateX(rx).translate(x,y,z));
 const unit=new T.Object3D();
 for(const p of recipe.parts){const g=p.kind==='box'?new T.BoxGeometry(...p.s):new T.CylinderGeometry(p.top,p.radius,p.height,p.segments);unit.position.fromArray(p.p);unit.rotation.fromArray(p.r);unit.updateMatrix();add(p.m,g.applyMatrix4(unit.matrix));}
 if(id==='rooftop-ac'){
  // Concentric safety grille, visible fan vanes, service panel and copper pipes.
  for(const r of [.09,.15,.21])ring('metal',r,.008,.21,.41,.278);
  for(let i=0;i<5;i++){const g=new T.BoxGeometry(.17,.045,.012);g.translate(.09,0,0).rotateZ(i*Math.PI*2/5).translate(.21,.41,.27);add('metal',g);}
  box('metal',.018,.42,.32,.537,.39,0);box('dark',.012,.025,.08,.55,.4,.09);
  for(const z of [-.12,.12])add('terracotta',new T.CylinderGeometry(.018,.018,.36,8).translate(.57,.23,z));
 }else if(id==='water-tank'){
  for(const y of [.28,.53,.78,1.03,1.28,1.53])ring('blue',.624,.018,0,y,0,Math.PI/2);
  ring('metal',.64,.022,0,.17,0,Math.PI/2);ring('metal',.64,.022,0,1.65,0,Math.PI/2);
 }else if(id==='solar-heater'){
  for(let i=-3;i<=3;i++)box('metal',.015,.012,1.5,i*.27,.576,.075,.42);
  // Frame bars follow the collector tilt instead of floating horizontally.
  for(const x of [-1.03,1.03])box('metal',.04,.1,1.6,x,.52,.05,.42);
 }else if(id==='vent-bank'){
  for(let i=0;i<9;i++)box('dark',1.26,.022,.012,0,.08+i*.055,.432);
 }else if(id==='roof-hatch'){
  for(const y of [1.5,1.58,1.66])box('metal',.58,.025,.02,0,y,.92);
 }else if(id==='window-frame'){
  box('metal',1.5,.035,.08,0,.84,.08);
 }else if(id==='balcony'){
  for(const x of [-1.2,1.2])box('metal',.12,.12,.15,x,.08,.12);
 }
 for(const [key,geos] of buckets){const g=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());g.computeBoundingSphere();const mesh=new T.Mesh(g,material[key]);mesh.name=`${id}:${key}`;group.add(mesh);}
}
const buffer=Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true}));
const folder=new URL('../../webapp/public/assets/tirana-streets/detail-kit/',import.meta.url);await mkdir(folder,{recursive:true});await writeFile(new URL('urban-fixtures.glb',folder),buffer);
await writeFile(new URL('manifest.json',folder),JSON.stringify({version:1,license:'CC0-1.0',source:'assets-source/tirana-detail-kit/build.mjs',sha256:createHash('sha256').update(buffer).digest('hex'),bytes:buffer.length,assets:Object.keys(RECIPES)},null,2)+'\n');
console.log('Exported',buffer.length,'bytes');
