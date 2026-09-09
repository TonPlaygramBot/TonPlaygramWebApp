// Control-flow fixtures only. This is deliberately NOT a WebGL/Three.js emulator.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let ts;
try { ts = require('typescript'); } catch {
  try { ts = require(path.join(require('node:child_process').execFileSync('npm', ['root', '-g'], {encoding:'utf8'}).trim(), 'typescript')); }
  catch { throw new Error('Install TypeScript or run from the webapp dependency environment.'); }
}
class Disposable { constructor(){this.disposals=0;} dispose(){this.disposals++;} }
class Vector3 {
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  set(x,y,z){Object.assign(this,{x,y,z});return this;}
  setScalar(n){return this.set(n,n,n);}
  copy(v){return this.set(v.x,v.y,v.z);}
  multiplyScalar(n){this.x*=n;this.y*=n;this.z*=n;return this;}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  clone(){return new Vector3(this.x,this.y,this.z);}
}
class Object3D {
  constructor(){this.children=[];this.parent=null;this.visible=true;this.name='';this.userData={};this.position=new Vector3();this.rotation=new Vector3();this.scale=new Vector3(1,1,1);this.matrixWorld={determinant:()=>1};}
  add(...nodes){for(const n of nodes){n.removeFromParent();this.children.push(n);n.parent=this;}return this;}
  removeFromParent(){if(this.parent){this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}return this;}
  clear(){for(const n of this.children)n.parent=null;this.children=[];return this;}
  traverse(fn){fn(this);for(const n of this.children)n.traverse(fn);}
  updateMatrixWorld(){}
  getObjectByName(name){let result;this.traverse(n=>{if(n.name===name)result=n;});return result;}
  clone(recursive=true){const n=this instanceof Mesh?new this.constructor(this.geometry,this.material):new this.constructor();n.name=this.name;n.visible=this.visible;if(recursive)for(const c of this.children)n.add(c.clone(true));return n;}
}
class Group extends Object3D{}
class BufferAttribute {constructor(array,itemSize,normalized=false){Object.assign(this,{array,itemSize,normalized,count:array.length/itemSize});}setXYZ(i,x,y,z){this.array.set([x,y,z],i*this.itemSize);} }
class BufferGeometry extends Disposable {
  constructor(attributes={position:new BufferAttribute(new Float32Array([0,0,0,1,0,0,0,1,0]),3)}){super();this.attributes=attributes;this.groups=[];this.morphAttributes={};this.drawRange={start:0,count:Infinity};this.index=null;}
  getAttribute(k){return this.attributes[k];}setAttribute(k,v){this.attributes[k]=v;return this;}deleteAttribute(k){delete this.attributes[k];return this;}
  clone(){const g=new BufferGeometry(Object.fromEntries(Object.entries(this.attributes).map(([k,a])=>[k,new BufferAttribute(a.array.slice(),a.itemSize,a.normalized)])));g.groups=this.groups.map(x=>({...x}));g.drawRange={...this.drawRange};g.morphAttributes={...this.morphAttributes};g.index=this.index;return g;}
  applyMatrix4(){return this;}toNonIndexed(){return this.index?this.clone():this;}computeVertexNormals(){this.attributes.normal=new BufferAttribute(new Float32Array(9),3);return this;}computeBoundingBox(){}computeBoundingSphere(){}
}
class Material extends Disposable {constructor(props={}){super();Object.assign(this,props);} }
class Texture extends Disposable{}
class Mesh extends Object3D{constructor(geometry=new BufferGeometry(),material=new Material()){super();this.geometry=geometry;this.material=material;this.isMesh=true;}}
class Skeleton extends Disposable {update(){}}
class SkinnedMesh extends Mesh {constructor(...args){super(...args);this.skeleton=new Skeleton();this.isSkinnedMesh=true;}getVertexPosition(i,v){return v;}}
class Sprite extends Object3D{constructor(material=new Material()){super();this.material=material;this.isSprite=true;}}
class LineSegments extends Object3D{constructor(geometry=new BufferGeometry(),material=new Material()){super();this.geometry=geometry;this.material=material;}}
class Quaternion {clone(){return new Quaternion();}copy(){return this;}multiply(){return this;}setFromEuler(){return this;}}
class Euler{set(){return this;}}
class Box3 {
  setFromObject(root){this.empty=true;root.traverse(o=>{if(o instanceof Mesh)this.empty=false;});this.min={x:0,y:0,z:0};this.max={x:1,y:2,z:3};return this;}
  getSize(v){return v.set(this.empty?0:1,this.empty?0:2,this.empty?0:3);}
  getCenter(v){return v.set(.5,1,1.5);}
}
const T={Object3D,Group,Vector3,BufferAttribute,BufferGeometry,Material,Texture,Mesh,SkinnedMesh,Skeleton,Sprite,LineSegments,Quaternion,Euler,Box3,Bone:class extends Object3D{},SRGBColorSpace:'srgb'};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function loadTS(filename,overrides={},cache=new Map()){
  filename=path.resolve(filename);if(cache.has(filename))return cache.get(filename);
  const source=fs.readFileSync(filename,'utf8');
  const compiled=ts.transpileModule(source,{fileName:filename,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
  const errors=(compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  if(errors.length)throw Error(ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:x=>x,getNewLine:()=> '\n'}));
  const module={exports:{}};cache.set(filename,module.exports);
  const requireMock=id=>{
    if(Object.hasOwn(overrides,id))return overrides[id];
    if(id==='three')return T;
    if(id==='three/examples/jsm/utils/SkeletonUtils.js')return {clone:o=>o.clone(true)};
    if(id==='three/examples/jsm/utils/BufferGeometryUtils.js')return {mergeGeometries:geos=>geos[0]?.clone()||null};
    if(id.startsWith('.')){const f=path.resolve(path.dirname(filename),id);for(const p of [f,f+'.ts'])if(fs.existsSync(p)&&p.endsWith('.ts'))return loadTS(p,overrides,cache);}
    throw Error('Unconfigured fixture dependency: '+id);
  };
  vm.runInNewContext(compiled.outputText,{module,exports:module.exports,require:requireMock,console,URL,AbortController,setTimeout,clearTimeout,DataView,Uint8Array,ArrayBuffer,Map,Set,performance},{filename});
  return module.exports;
}
const sourceRoot=process.env.UPGRADE_ROOT||path.resolve(__dirname,'..');
const source=p=>path.join(sourceRoot,'webapp/src/games',p);
function sharedHarness(){
  const cast=['rpm-current','athlete-male','athlete-female'].map((id,i)=>({id,url:'/human-'+i+'.glb',label:id,roles:['civilian']}));
  const {SharedHumans}=loadTS(source('tiranastreets/street-career/SharedHumans.ts'),{
    '../livingVisuals':{LivingVisuals:class{}},'./humanRoster.mjs':{},'./sharedCastCore.mjs':{},'./SharedGameCast':{SHARED_GAME_CAST:cast},
    'three/examples/jsm/loaders/GLTFLoader.js':{GLTFLoader:class{}}
  });
  const h=Object.create(SharedHumans.prototype);
  Object.assign(h,{cast,group:new Group(),errors:[],sources:new Map(),requested:new Set(),failed:new Set(),queue:[],loading:0,aborts:new Set(),actors:new Map(),bikes:new Map(),signs:new Map(),dead:false,held:{dispose(){}}});
  const requests=[];
  h.loadCatalogAsset=asset=>{const d=deferred();requests.push({asset,...d});return d.promise;};
  const model=()=>{const scene=new Group();scene.add(new SkinnedMesh());return {scene,animations:[]};};
  return {h,requests,model};
}
function livingHarness({asset,merge}={}){
  const entries=[['old',{model:'old',category:'rifle'}],['next',{model:'next',category:'rifle'}]];
  const requests=[];
  const overrides={
    './shared/weapons.mjs':{WEAPON_BY_ID:new Map(entries)},
    'three/examples/jsm/loaders/GLTFLoader.js':{GLTFLoader:class {loadAsync(url){requests.push(url);return asset?Promise.resolve({scene:asset}):new Promise(()=>{});}}}
  };
  if(merge)overrides['three/examples/jsm/utils/BufferGeometryUtils.js']={mergeGeometries:merge};
  const {LivingVisuals}=loadTS(source('tiranastreets/livingVisuals.ts'),overrides);
  const h=Object.create(LivingVisuals.prototype),tracers=new LineSegments();
  Object.assign(h,{group:new Group(),models:new Map(),loading:new Set(),failed:new Set(),holders:new Map(),tracers,dealerLabel:null,disposed:false});
  h.group.add(tracers);
  return {h,requests,actor:new Group(),entity:{weapon:'old',health:100}};
}
module.exports={T,source,loadTS,sharedHarness,livingHarness,deferred,flush};
