const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const web=require('node:module').createRequire(path.resolve(__dirname,'../webapp/package.json')),ts=web('typescript'),T=web('three');
function load(file,deps={}) {
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../webapp/src/games/',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>{if(!(id in deps))throw Error('Missing fixture '+id);return deps[id];},console});return module.exports;
}
const {DynamicResolution,GRAPHICS_PROFILES}=load('tiranastreets/graphicsQuality.ts');
const {shadowAnchor}=load('tirana-environment/shadowAnchor.ts');
const {EnvironmentMaterialRegistry}=load('tirana-environment/EnvironmentMaterialRegistry.ts',{three:T});

test('dynamic resolution ignores isolated stutters and healthy high refresh display caps',()=>{
 const d=new DynamicResolution();
 for(let i=0;i<30;i++){d.sample(i%2?60:40,120);assert.equal(d.scale,1);}
 for(let i=0;i<30;i++)d.sample(60,120);
 assert.equal(d.scale,1);assert.equal(d.sample(NaN,60),false);assert.equal(d.sample(0,60),false);
});
test('sustained load reduces framebuffer area before detail and recovers without oscillation',()=>{
 const d=new DynamicResolution();
 assert.equal(d.sample(40,60),false);assert.equal(d.sample(40,60),true);assert.equal(d.scale,.9);
 for(let i=0;i<30;i++)d.sample(40,60);
 assert.equal(d.scale,.72);assert.equal(d.atMinimum,true);assert.ok(d.scale*d.scale<.52,'about half the shaded pixels at floor');
 const minimum=d.scale;d.sample(60,60);assert.equal(d.scale,minimum,'one healthy window does not resize');
 for(let i=0;i<60;i++)d.sample(60,60);
 assert.equal(d.scale,1);d.reset();assert.equal(d.scale,1);
 assert.equal(GRAPHICS_PROFILES.high.shadowSize,1024,'full profile keeps its shadow definition');
});
test('shadow target quantizes both light-space axes and preserves rooftop depth',()=>{
 const direction=new T.Vector3(1,2,1).normalize(),right=new T.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right);
 const span=104,size=1024,texel=span/size,p=new T.Vector3(782,74,302);
 const anchor=new T.Vector3(...Object.values(shadowAnchor(p,direction,span,size)));
 for(const axis of [right,up])assert.ok(Math.abs(anchor.dot(axis)/texel-Math.round(anchor.dot(axis)/texel))<1e-8);
 assert.ok(Math.abs(anchor.dot(direction)-p.dot(direction))<1e-8,'depth follows current rooftop');
 assert.ok(anchor.distanceTo(p)<texel,'snap cannot visibly move the shadow box');
 const shifted=p.clone().addScaledVector(direction,120),roof=shadowAnchor(shifted,direction,span,size);
 assert.ok(Math.abs(new T.Vector3(roof.x,roof.y,roof.z).dot(direction)-shifted.dot(direction))<1e-8);
 for(const direction of [{x:0,y:1,z:0},{x:0,y:0,z:0}])for(const value of Object.values(shadowAnchor(p,direction,100,512)))assert.ok(Number.isFinite(value));
});
test('weather discovery is bounded, deduplicates shared materials, and retains lighting during scans',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial();material.userData.environmentSurface=true;
 for(let i=0;i<100;i++)scene.add(new T.Mesh(new T.BoxGeometry(),material));
 const added=[],registry=new EnvironmentMaterialRegistry(scene,m=>added.push(m));
 registry.update(0,2);assert.equal(added.length,1);assert.equal(registry.materials.size,1);
 const late=new T.MeshStandardMaterial();late.userData.environmentWindow=true;const last=new T.Mesh(new T.BoxGeometry(),late);scene.add(last);
 registry.update(0,2);assert.equal(added.length,1,'only two more nodes visited');
 for(let i=0;i<60;i++)registry.update(0,2);
 assert.equal(added.length,2);assert.equal(registry.materials.size,2);
 last.removeFromParent();registry.update(3,2);assert.equal(registry.materials.has(late),true,'old registry retained while pass runs');
 for(let i=0;i<60;i++)registry.update(3,2);
 assert.equal(registry.materials.has(late),false);assert.equal(added.filter(m=>m===material).length,1,'one shared material prepared once');
 registry.dispose();assert.equal(registry.materials.size,0);scene.traverse(o=>o.geometry?.dispose());last.geometry.dispose();material.dispose();late.dispose();
});
