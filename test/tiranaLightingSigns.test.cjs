const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {createRequire}=require('node:module');
const web=createRequire(path.resolve(__dirname,'../webapp/package.json'));
const ts=web('typescript'),T=web('three');
function load(file,deps,extra={}){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:k=>deps[k]||{},console,...extra});return module.exports;
}
test('lamp range fades continuously and daylight disables street illumination',async()=>{
 const {localLampStrength,urbanLightLevel}=await import('../webapp/src/games/tirana-environment/urbanLightingCore.mjs');
 assert.equal(localLampStrength(0),1);assert.equal(localLampStrength(24),1);assert.equal(localLampStrength(36),.5);assert.equal(localLampStrength(48),0);assert.equal(localLampStrength(Infinity),0);
 assert.equal(urbanLightLevel({daylight:1,night:0}),0);assert.equal(urbanLightLevel({daylight:0,night:1}),1);
});
test('lamp poles and emitters remain above elevated streets and stale emitters switch off',async()=>{
 const core=await import('../webapp/src/games/tirana-environment/urbanLightingCore.mjs');
 const {nearbyIndex}=await import('../webapp/src/games/tirana-street-life/streetModels.mjs');
 const {UrbanLighting}=load('webapp/src/games/tirana-environment/UrbanLighting.ts',{three:T,'../tirana-neighbourhood/data.mjs':{NEIGHBOURHOOD:{storefronts:[]}},'../tirana-city-source/businessSignRegistry.mjs':{BUSINESS_SIGNS:[]},'../tirana-street-life/streetModels.mjs':{nearbyIndex},'../tirana-street-life/registry.mjs':{STREET_LIFE:{storefronts:[]}},'./urbanLampRegistry.mjs':{LAMPS:[{x:0,z:0,yaw:0}]},'../tirana-east/terrainCore.mjs':{groundHeight:()=>90},'./urbanLightingCore.mjs':core});
 const lamps=new UrbanLighting();lamps.update({x:0,z:0},0);const matrix=new T.Matrix4();lamps.poles.getMatrixAt(0,matrix);assert.ok(Math.abs(matrix.elements[13]-93.23)<.001);assert.equal(lamps.lights[0].position.y,96.05);assert.equal(lamps.lights[0].userData.lightAvailable,true);
 lamps.lights[0].intensity=120;lamps.update({x:1000,z:1000},1);assert.equal(lamps.lights[0].intensity,0);assert.equal(lamps.lights[0].userData.lightAvailable,false);lamps.dispose();
});
test('road names share a bounded atlas, read from both sides, and cull far boards',async()=>{
 const {nearbyIndex}=await import('../webapp/src/games/tirana-street-life/streetModels.mjs');
 const labels=[];const ctx={clearRect(){},fillRect(){},strokeRect(){},beginPath(){},ellipse(){},fill(){},stroke(){},fillText(text){labels.push(text);}};
 const {StreetSignFaces}=load('webapp/src/games/tiranastreets/StreetSignFaces.ts',{three:T,'../tirana-street-life/streetModels.mjs':{nearbyIndex}},{document:{createElement:()=>({getContext:()=>ctx})}});
 const signs=new StreetSignFaces(Array.from({length:100},(_,i)=>({x:i,z:0,y:2.5,yaw:0,text:'Rr. Dëshmorët '+i,w:2.35,h:.46,bg:'#123',fg:'#fff'})));
 signs.update({x:0,z:0},0);assert.equal(signs.mesh.count,128);assert.equal(labels.length,64);assert.equal(signs.texture.image.width,2048);assert.equal(signs.texture.image.height,512);
 const front=new T.Matrix4(),back=new T.Matrix4();signs.mesh.getMatrixAt(0,front);signs.mesh.getMatrixAt(1,back);assert.ok(front.elements[0]>0&&back.elements[0]<0);assert.ok(front.elements[14]>0&&back.elements[14]<0);
 signs.update({x:0,z:0},1);assert.equal(labels.length,64,'stable boards do not repaint the canvas');signs.update({x:0,z:0},2,true);assert.equal(signs.mesh.count,64);signs.update({x:10000,z:0},3);assert.equal(signs.mesh.count,0);signs.dispose();
});
