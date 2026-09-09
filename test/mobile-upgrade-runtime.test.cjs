const test=require('node:test');
const assert=require('node:assert/strict');
const {T,sharedHarness,livingHarness,flush}=require('./runtime-harness.cjs');
test('human retry does not duplicate queued or in-flight GLBs',()=>{
  const {h,requests}=sharedHarness();h.primeLocalHumans();h.retryFailed();h.retryFailed();
  assert.equal(requests.length,2);assert.equal(h.queue.length,1);
  assert.equal(new Set([...requests.map(r=>r.asset.url),...h.queue.map(a=>a.url)]).size,3);
});
test('human retry keeps a successful source and retries a failed source exactly once',async()=>{
  const {h,requests,model}=sharedHarness();h.primeLocalHumans();
  const good=model();requests[0].resolve(good);requests[1].reject(Error('offline'));await flush();
  h.retryFailed();h.retryFailed();await flush();
  assert.equal(h.sources.get(h.cast[0].url),good);
  assert.equal(requests.filter(r=>r.asset.id===h.cast[1].id).length,2);
  assert.equal(h.queue.length,0);
});
test('late human load after disposal frees its result without installing it',async()=>{
  const {h,requests,model}=sharedHarness();h.primeLocalHumans();h.dispose();
  const g=model();requests[0].resolve(g);await flush();assert.equal(h.sources.size,0);assert.equal(g.scene.children[0].geometry.disposals,1);
});
test('weapon switch hides the old model while the selected model loads',()=>{
  const {h,actor,entity}=livingHarness();h.models.set('old',new T.Group());h.pose('p',actor,entity,0);
  entity.weapon='next';h.pose('p',actor,entity,0);const holder=h.holders.get('p');
  assert.equal(holder.group.visible,false);assert.equal(holder.group.children.length,0);
});
test('weapon switch later installs only the selected loaded model',()=>{
  const {h,actor,entity}=livingHarness();const old=new T.Group();old.name='old';const next=new T.Group();next.name='next';h.models.set('old',old);h.pose('p',actor,entity,0);
  entity.weapon='next';h.pose('p',actor,entity,0);h.models.set('next',next);h.pose('p',actor,entity,0);
  assert.equal(h.holders.get('p').weapon,'next');assert.equal(h.holders.get('p').group.children[0].name,'next');
});
test('holstering and dead actors never show a held model',()=>{
  const {h,actor,entity}=livingHarness();h.models.set('old',new T.Group());h.pose('p',actor,entity,0);entity.weapon='';h.pose('p',actor,entity,0);assert.equal(h.holders.get('p').group.visible,false);
  entity.weapon='old';entity.health=0;h.pose('p',actor,entity,0);assert.equal(h.holders.get('p').group.visible,false);
});
test('multi-material GLTF mesh remains part of the loaded weapon',async()=>{
  const asset=new T.Group();asset.add(new T.Mesh(new T.BufferGeometry(),[new T.Material(),new T.Material()]));
  const {h}=livingHarness({asset});await h.load('multi');let meshes=0;h.models.get('multi')?.traverse(o=>{if(o instanceof T.Mesh)meshes++;});assert.equal(meshes,1);
});
test('GLTF extra UV, color and tangent attributes survive loading',async()=>{
  const geo=new T.BufferGeometry();for(const key of ['uv','uv1','color','tangent'])geo.setAttribute(key,new T.BufferAttribute(new Float32Array(12),key==='tangent'?4:3));
  const asset=new T.Group();asset.add(new T.Mesh(geo));const {h}=livingHarness({asset});await h.load('textured');let attrs;h.models.get('textured')?.traverse(o=>{if(o instanceof T.Mesh)attrs=o.geometry.attributes;});
  for(const key of ['uv','uv1','color','tangent'])assert.ok(attrs?.[key],key+' missing');
});
test('failed geometry merge retains the original model instead of caching nothing',async()=>{
  const asset=new T.Group(),m=new T.Material();asset.add(new T.Mesh(new T.BufferGeometry(),m),new T.Mesh(new T.BufferGeometry(),m));const {h}=livingHarness({asset,merge:()=>null});await h.load('unmergeable');let meshes=0;h.models.get('unmergeable')?.traverse(o=>{if(o instanceof T.Mesh)meshes++;});assert.ok(meshes>0);
});
test('disposing weapons detaches holders and releases each shared resource once',()=>{
  const {h,actor,entity}=livingHarness();const geo=new T.BufferGeometry(),tex=new T.Texture(),mat=new T.Material({map:tex,emissiveMap:tex});const model=new T.Group();model.add(new T.Mesh(geo,mat),new T.Mesh(geo,mat));h.models.set('old',model);h.pose('p',actor,entity,0);h.dispose();h.dispose();
  assert.equal(actor.children.length,0);assert.equal(geo.disposals,1);assert.equal(mat.disposals,1);assert.equal(tex.disposals,1);assert.equal(h.models.size,0);
});
test('source material identity is preserved when compatible rigid meshes batch',async()=>{
  const mat=new T.Material({roughness:.37}),asset=new T.Group();asset.add(new T.Mesh(new T.BufferGeometry(),mat),new T.Mesh(new T.BufferGeometry(),mat));
  const {h}=livingHarness({asset});await h.load('rigid');const rendered=[];h.models.get('rigid').traverse(o=>{if(o instanceof T.Mesh)rendered.push(o);});assert.equal(rendered.length,1);assert.equal(rendered[0].material,mat);assert.equal(mat.disposals,0);
});
test('extra PBR attributes survive the actual batching branch',async()=>{
  const mat=new T.Material(),asset=new T.Group();
  for(let i=0;i<2;i++){const geo=new T.BufferGeometry();for(const name of ['uv1','tangent','color'])geo.setAttribute(name,new T.BufferAttribute(new Float32Array(12),4));asset.add(new T.Mesh(geo,mat));}
  const {h}=livingHarness({asset});await h.load('batch-pbr');h.models.get('batch-pbr').traverse(o=>{if(o instanceof T.Mesh)for(const name of ['uv1','tangent','color'])assert.ok(o.geometry.getAttribute(name));});
});
test('incompatible vertex layouts form separate batches',async()=>{
  const mat=new T.Material(),asset=new T.Group(),colored=new T.BufferGeometry();colored.setAttribute('color',new T.BufferAttribute(new Float32Array(9),3));asset.add(new T.Mesh(new T.BufferGeometry(),mat),new T.Mesh(colored,mat));
  const batches=[];const {h}=livingHarness({asset,merge:geos=>{batches.push(geos.length);return geos[0].clone();}});await h.load('mixed-layout');assert.deepEqual(batches,[1,1]);
});
for(const variant of ['groups','skin','morph','reflection','partial-range','hidden'])test(`${variant}: complex glTF keeps its original scene`,async()=>{
  const asset=new T.Group(),geo=new T.BufferGeometry(),mesh=variant==='skin'?new T.SkinnedMesh(geo):new T.Mesh(geo);asset.add(mesh,new T.Mesh());
  if(variant==='groups')geo.groups.push({start:0,count:3,materialIndex:0});
  if(variant==='morph')geo.morphAttributes.position=[new T.BufferAttribute(new Float32Array(9),3)];
  if(variant==='reflection')mesh.matrixWorld.determinant=()=>-1;
  if(variant==='partial-range')geo.drawRange.count=3;
  if(variant==='hidden')mesh.visible=false;
  const {h}=livingHarness({asset});await h.load(variant);let found=false;h.models.get(variant).traverse(o=>{if(o===asset)found=true;});assert.equal(found,true);assert.equal(geo.disposals,0);
});
test('late weapon response after disposal is released, never cached',async()=>{
  const asset=new T.Group(),geo=new T.BufferGeometry(),mat=new T.Material();asset.add(new T.Mesh(geo,mat));const {h}=livingHarness({asset});const pending=h.load('late');h.dispose();await pending;assert.equal(h.models.size,0);assert.equal(geo.disposals,1);assert.equal(mat.disposals,1);
});
test('a disposed weapon layer cannot create a new holder or request',()=>{
  const {h,actor,entity,requests}=livingHarness();h.dispose();h.pose('p',actor,entity,0);assert.equal(actor.children.length,0);assert.equal(h.holders.size,0);assert.equal(requests.length,0);
});
test('repeated failed-model retry does not duplicate an in-flight request',()=>{
  const {h,actor,entity,requests}=livingHarness();h.failed.add('old');h.pose('p',actor,entity,0);assert.equal(requests.length,0);h.retryFailedAssets();h.pose('p',actor,entity,0);h.retryFailedAssets();h.pose('p',actor,entity,0);assert.equal(requests.length,1);
});
test('empty model fails explicitly and is not cached with infinite scale',async()=>{
  const {h}=livingHarness({asset:new T.Group()});await h.load('empty');assert.equal(h.models.has('empty'),false);assert.equal(h.failed.has('empty'),true);
});
