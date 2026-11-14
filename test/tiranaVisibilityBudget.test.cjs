const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const web=require('node:module').createRequire(path.resolve(__dirname,'../webapp/package.json')),ts=web('typescript'),T=web('three');
const base=path.resolve(__dirname,'../webapp/src/games');
function load(file,deps={},globals={}){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(base,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>deps[id]||{},console,performance,...globals});return module.exports;
}
let visibility,economy;
test.before(async()=>{[visibility,economy]=await Promise.all([import('../webapp/src/games/tiranastreets/shared/visibilityIndex.mjs'),import('../webapp/src/games/tiranastreets/street-career/cityEconomyDefinitions.mjs')]);});
test('visibility query visits local indexed cells and retains distant bands within the existing count budget',()=>{
 let reads=0;
 const items=Array.from({length:10000},(_,i)=>({id:i,get x(){reads++;return i*20;},z:0}));
 const index=new visibility.VisibilityIndex(items);reads=0;
 const near=index.query({x:0,z:0},1100);
 assert.ok(reads<100,'query must not revisit every regional placement');
 const selected=visibility.selectVisibilityBands(near,[{radius:180,count:5},{radius:500,count:3},{radius:1100,count:2}]);
 assert.equal(selected.length,10);assert.ok(selected.some(p=>p.distanceSq>500**2));
 assert.equal(index.query({x:NaN,z:0},100).length,0);
});

const building=(id,x,z)=>({id:String(id),p:[[x-10,z-10],[x+10,z-10],[x+10,z+10],[x-10,z+10]],h:12});

function fpsFixture(){
 const settings=load('tiranastreets/renderSettings.ts');
 const {FpsCity}=load('tiranastreets/FpsCity.ts',{three:T,'./renderSettings':settings,'./shared/visibilityIndex.mjs':visibility});
 const layer=Object.create(FpsCity.prototype),group=new T.Group(),cells=[];
 for(let i=0;i<160;i++){
  const z=-30-i*5,mesh=new T.InstancedMesh(new T.BoxGeometry(3,3,3),new T.MeshBasicMaterial(),1);
  mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(0,10,z));mesh.computeBoundingSphere();group.add(mesh);cells.push({x:0,z,detail:true,object:mesh});
 }
 const shell=new T.Mesh(new T.BoxGeometry(40,80,40),new T.MeshBasicMaterial());shell.position.set(0,40,-2000);group.add(shell);cells.push({x:0,z:-2000,detail:false,object:shell});
 const noop={update(){},setBatteryMode(){}};
 Object.assign(layer,{group,cells,cellViewer:{x:Infinity,z:Infinity},detailIndex:new visibility.VisibilityIndex(cells.filter(c=>c.detail)),cellDirection:new T.Vector3(),lastCellDirection:new T.Vector3(),cellCameraPosition:new T.Vector3(Infinity,Infinity,Infinity),cellProjectionWidth:0,cellProjectionHeight:0,cellFrustum:new T.Frustum(),cellProjection:new T.Matrix4(),cellBounds:new T.Sphere(),landmarks:noop,skanderbegBuilding:noop,referenceFacades:noop,agedHousing:noop,urbanRoads:noop});
 return {layer,shell,cells};
}
test('shared FPS city keeps a 2 km skyline with bounded distant detail and correct translated-origin frustum',()=>{
 const {layer,shell,cells}=fpsFixture(),camera=new T.PerspectiveCamera(60,.56,.1,3600);
 layer.group.position.set(-800,0,-400);camera.position.set(-800,10,-400);camera.lookAt(-800,10,-1000);
 layer.update(new T.Vector3(0,10,0),1,false,camera);
 assert.ok(shell.visible);assert.ok(layer.group.userData.visibleDetailCells<=72);
 assert.ok(cells.some(c=>c.detail&&c.object.visible&&c.z<-600));
 layer.update(new T.Vector3(0,10,0),2,true,camera);
 assert.ok(shell.visible,'battery mode preserves the distant skyline');assert.equal(shell.castShadow,false);
 assert.ok(layer.group.userData.visibleDetailCells<=24);assert.equal(layer.group.userData.detailRadius,480);
 camera.lookAt(-800,10,100);layer.update(new T.Vector3(0,10,0),3,true,camera);
 assert.equal(layer.group.userData.visibleDetailCells,0);
});

test('city generation still shares a target-frame CPU allowance across both streams',()=>{
 let clock=0;const settings=load('tiranastreets/renderSettings.ts',{}, {performance:{now:()=>clock}});
 for(const fps of [50,60,90,120]){
  clock=0;const budgets=[];settings.beginCityFrame(fps);
  const queue=()=>({run(budget){budgets.push(budget);clock+=budget;}});
  settings.runCityWork(queue(),false);settings.runCityWork(queue(),false);settings.runCityWork(queue(),false);
  assert.ok(budgets.reduce((a,b)=>a+b,0)<=Math.min(4,1000/fps*.24)+1e-9);
  assert.ok(budgets.every(b=>b<=2));
 }
});
