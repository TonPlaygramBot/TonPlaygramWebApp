import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from '../webapp/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import {canonicalHumanoidBone,inspectHumanoidRig,normalizePlayableHuman,headBoneIndices,solveHumanoidLimb,HumanoidLegPose,hideAuthoredPlayerWeapon} from '../webapp/src/games/tiranastreets/street-career/humanoidRig.mjs';

const sources=new Map();
async function source(id){
  if(!sources.has(id))sources.set(id,(async()=>{
    const bytes=readFileSync(new URL(`../webapp/public/assets/tirana-streets/players/${id}.glb`,import.meta.url));
    const loader=new GLTFLoader();
    // Decode the actual geometry, bind matrices and clips. Only image decoding is
    // skipped here; actual textured WebGL presentation is checked in the browser.
    loader.register(()=>({name:'HEADLESS_TEXTURES',loadTexture:async()=>new T.Texture()}));
    return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  })());
  return sources.get(id);
}
test('uploaded joint aliases preserve Mixamo finger numbers and exclude twist helpers',()=>{
  assert.equal(canonicalHumanoidBone('mixamorig:LeftHandIndex1_016'),'lefthandindex1');
  assert.equal(canonicalHumanoidBone('CC_Base_R_Upperarm_074'),'rightarm');
  assert.equal(canonicalHumanoidBone('CC_Base_R_UpperarmTwist01_075'),'rightupperarmtwist01');
  assert.equal(canonicalHumanoidBone('CC_Base_L_Mid2_057'),'lefthandmiddle2');
  assert.equal(canonicalHumanoidBone('Bone.036_base_soldier1'),'rightarm');
  assert.equal(canonicalHumanoidBone('Bone.023_base_soldier1'),'lefthandindex1');
  assert.equal(canonicalHumanoidBone('Bone.046_base_soldier1'),'righthandindex1');
});

for(const id of ['tactical','polish','agent-47']){
  test(`${id}: real uploaded skin has both limbs, masked facial descendants and unchanged source transforms`,async()=>{
    const gltf=await source(id),model=clone(gltf.scene),matrix=model.matrix.clone(),scale=model.scale.clone();
    const root=normalizePlayableHuman(model),rig=inspectHumanoidRig(root);
    assert.equal(rig.valid,true,rig.missing.join(','));
    assert.ok(model.matrix.equals(matrix));assert.ok(model.scale.equals(scale));
    assert.ok(Math.abs(new T.Box3().setFromObject(root).getSize(new T.Vector3()).y-1.78)<.001);
    for(const limb of ['arm','upleg']){
      const left=rig.bones.get('left'+limb).getWorldPosition(new T.Vector3()),right=rig.bones.get('right'+limb).getWorldPosition(new T.Vector3());
      assert.ok(left.x>right.x,limb+' anatomical sides were reversed');
    }
    let maskedVertices=0,remainingVertices=0;
    root.traverse(mesh=>{
      if(!mesh.isSkinnedMesh)return;
      const heads=headBoneIndices(mesh.skeleton);
      const headIndex=mesh.skeleton.bones.indexOf(rig.bones.get('head'));
      assert.ok(heads.has(headIndex));
      const indices=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
      for(let i=0;i<indices.count;i++){
        let weight=0;for(let j=0;j<4;j++)if(heads.has(indices.getComponent(i,j)))weight+=weights.getComponent(i,j);
        if(weight>.3)maskedVertices++;else remainingVertices++;
      }
      for(const [i,bone] of mesh.skeleton.bones.entries())if(/Jaw|Teeth|Tongue/.test(bone.name))assert.ok(heads.has(i),bone.name);
    });
    assert.ok(maskedVertices>100,'head must disappear from the first-person camera');
    assert.ok(remainingVertices>1000,'body and arms must remain');
  });

  test(`${id}: authored joint axes solve weapon grips and no-clip walking without accumulating drift`,async()=>{
    const root=normalizePlayableHuman(clone((await source(id)).scene)),rig=inspectHumanoidRig(root);
    root.position.set(13,7,-5);root.rotation.y=1.1;root.updateMatrixWorld(true);
    for(const side of ['left','right']){
      const target=root.localToWorld(new T.Vector3(side==='left'?.06:-.12,1.32,.33));
      assert.equal(solveHumanoidLimb(root,rig.bones,side,target),true);
      const hand=rig.bones.get(side+'hand').getWorldPosition(new T.Vector3());
      assert.ok(hand.distanceTo(target)<.045,`${side} hand missed grip by ${hand.distanceTo(target)}`);
    }
    const legs=new HumanoidLegPose(root,rig.bones),foot=rig.bones.get('leftfoot');
    legs.update(Math.PI/2,3);root.updateMatrixWorld(true);const forward=root.worldToLocal(foot.getWorldPosition(new T.Vector3()));
    legs.update(3*Math.PI/2,3);root.updateMatrixWorld(true);const back=root.worldToLocal(foot.getWorldPosition(new T.Vector3()));
    assert.ok(forward.z>back.z+.2,'walk stride must move the actual skinned foot');
    for(let i=0;i<120;i++)legs.update(i/10,3);
    legs.update(Math.PI/2,3);root.updateMatrixWorld(true);
    assert.ok(root.worldToLocal(foot.getWorldPosition(new T.Vector3())).distanceTo(forward)<1e-5,'poses must reset instead of compounding');
    root.traverse(o=>{if(o.isBone)assert.ok(o.quaternion.toArray().every(Number.isFinite),o.name);});
  });
}

test('an incomplete or empty selected model fails normalization rather than spawning invisible',()=>{
  assert.throws(()=>normalizePlayableHuman(new T.Group()),/rig is incomplete/);
});

test('equipping a gameplay gun hides only the Polish authored rifle and leaves its uniform magazines',async()=>{
  const original=(await source('polish')).scene,root=clone(original);
  hideAuthoredPlayerWeapon(root);
  assert.equal(root.getObjectByName('WZ96_Beryl_0').visible,false);
  for(const name of ['WZ96_Beryl_mag_0','WZ96_Beryl_mag_2_0','WZ96_Beryl_mag_3_0'])assert.equal(root.getObjectByName(name).visible,true);
  assert.equal(original.getObjectByName('WZ96_Beryl_0').visible,true,'preview source stays unmodified');
});
