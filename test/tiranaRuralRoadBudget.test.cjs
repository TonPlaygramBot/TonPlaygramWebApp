const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const web=require('node:module').createRequire(path.resolve(__dirname,'../webapp/package.json')),ts=web('typescript'),T=web('three');
const root=path.resolve(__dirname,'../webapp/src/games');
function load(file,deps){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>{if(!(id in deps))throw Error('Missing fixture '+id);return deps[id];},performance,console});return module.exports;
}
class Finish{apply(){}dispose(){}}
test('one long hillside road yields within tessellation and bounded meshes retain exact terrain vertices',async()=>{
 const terrain=await import('../webapp/src/games/tirana-east/terrainCore.mjs');
 const roadCore=await import('../webapp/src/games/tirana-environment/roadSurfaceCore.mjs');
 const {CellWorkQueue}=await import('../webapp/src/games/tirana-neighbourhood/cellWorkQueue.mjs');
 const drape=load('tirana-east/drapeGeometry.ts',{three:T,'./terrainCore.mjs':terrain});
 const rows=[{a:[8000,0],b:[8400,20],w:8},{a:[8000,40],b:[8350,60],w:3,walk:true}];
 let emitted=0;
 const {UrbanRoadCells}=load('tirana-neighbourhood/UrbanRoadCells.ts',{
  three:T,'../tiranastreets/renderSettings':{},'../tirana-east/terrainCore.mjs':terrain,
  '../tirana-east/drapeGeometry':{...drape,appendGroundTriangle(out,...args){const count=out.length;drape.appendGroundTriangle(out,...args);emitted+=(out.length-count)/3;}},
  './cellWorkQueue.mjs':{CellWorkQueue},'../tirana-environment/EnvironmentMaterials':{EnvironmentMaterials:Finish},
  '../tiranastreets/shared/world.mjs':{WORLD:{roads:rows}},'../tirana-environment/riverGeometry':{},
  '../tirana-environment/roadSurfaceCore.mjs':roadCore,'../tirana-environment/roadSurfaceRegistry':{},
  'three/examples/jsm/utils/BufferGeometryUtils.js':{}
 });
 const layer=new UrbanRoadCells(false),job=layer.buildDistrict({key:'long-hillside',roads:rows,bounds:[7990,-10,8410,70],used:0});
 try{
  let steps=0,done=false;
  while(!done){const before=emitted;done=job.next().done;steps++;assert.ok(emitted-before<=192,'each step emits at most64 terrain triangles');}
  assert.ok(steps>20,'a single source road must yield repeatedly');
  for(const walk of [false,true]){
   const expected=[],actual=[];
   for(const road of rows.filter(r=>!!r.walk===walk)){
    const ring=roadCore.roadRing(road),y=road.walk?.071:.09;
    for(let i=1;i<ring.length-1;i++){
     const [a,b,c]=[ring[0],ring[i],ring[i+1]],face=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0?[a,c,b]:[a,b,c];
     drape.appendGroundTriangle(expected,face[0],face[1],face[2],y);
    }
   }
   layer.group.traverse(o=>{
    if(o instanceof T.Mesh&&o.material===(walk?layer.pavement:layer.asphalt)){
     assert.ok(o.geometry.attributes.position.count<=3072,'geometry allocation stays bounded');
     actual.push(...o.geometry.attributes.position.array);
    }
   });
   assert.deepEqual(new Float32Array(actual),new Float32Array(expected),'streaming preserves vertex order, terrain heights and entire road');
  }
 }finally{job.return();layer.dispose();}
});
