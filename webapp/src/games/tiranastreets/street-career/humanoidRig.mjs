import * as T from 'three';

// These names were audited against the uploaded skins and their bind hierarchy.
// Alias lookup does not rename bones: authored animation targets stay intact.
const POLISH = {
  1:'hips', 2:'spine', 3:'spine1', 4:'neck', 5:'head',
  6:'leftshoulder', 7:'leftupleg', 8:'leftleg', 9:'leftfoot',
  10:'rightupleg', 11:'rightleg', 12:'rightfoot',
  13:'leftarm', 14:'leftforearm', 15:'lefthand',
  35:'rightshoulder', 36:'rightarm', 37:'rightforearm', 38:'righthand'
};
for (const [side, offset] of [['left',0],['right',23]]) {
  for (let segment=1; segment<=3; segment++) POLISH[15+segment+offset]=`${side}handthumb${segment}`;
  for (const [finger,index] of [['index',0],['middle',1],['ring',2],['pinky',3]])
    for (let segment=1; segment<=3; segment++) POLISH[23+index+(segment-1)*4+offset]=`${side}hand${finger}${segment}`;
}
const SIMPLE = {
  upperarml:'leftarm',upperarmr:'rightarm',lowerarml:'leftforearm',lowerarmr:'rightforearm',
  wristl:'lefthand',wristr:'righthand',upperlegl:'leftupleg',upperlegr:'rightupleg',
  lowerlegl:'leftleg',lowerlegr:'rightleg',footl:'leftfoot',footr:'rightfoot'
};
const CC = {hip:'hips',pelvis:'pelvis',waist:'spine',spine01:'spine1',spine02:'spine2',necktwist01:'neck',necktwist02:'neck1',head:'head',clavicle:'shoulder',upperarm:'arm',forearm:'forearm',hand:'hand',thigh:'upleg',calf:'leg',foot:'foot',toebase:'toebase'};

export function canonicalHumanoidBone(name) {
  const polish=name.match(/^Bone[._]?(\d+)?_base_soldier1$/i);
  if (polish) return POLISH[Number(polish[1]||0)] || `polishbone${Number(polish[1]||0)}`;
  // Sketchfab appends _00, _01 ... to both Mixamo and Character Creator joints.
  let n=name.replace(/_0\d+$/,'').toLowerCase().replace(/mixamorig\d*|[^a-z0-9]/g,'');
  if(n.startsWith('ccbase')) {
    n=n.slice(6);
    const side=/^[lr]/.test(n)?(n[0]==='l'?'left':'right'):'';
    const part=side?n.slice(1):n;
    const finger=part.match(/^(thumb|index|mid|ring|pinky)([123])$/);
    if(finger)return side+'hand'+(finger[1]==='mid'?'middle':finger[1])+finger[2];
    return side+(CC[part]||part);
  }
  const finger=n.match(/^(thumb|index|middle|ring|pinky)(\d)([lr])$/);
  if(finger)return (finger[3]==='l'?'left':'right')+'hand'+finger[1]+finger[2];
  return SIMPLE[n]||n;
}

export function humanoidBones(root) {
  const bones=new Map();
  root.traverse(o=>{if(o.isBone)bones.set(canonicalHumanoidBone(o.name),o);});
  return bones;
}
export function inspectHumanoidRig(root) {
  const bones=humanoidBones(root), missing=[];
  for(const name of ['hips','head','leftarm','leftforearm','lefthand','rightarm','rightforearm','righthand','leftupleg','leftleg','leftfoot','rightupleg','rightleg','rightfoot'])
    if(!bones.has(name))missing.push(name);
  let skinCount=0;
  root.traverse(o=>{if(o.isSkinnedMesh&&o.geometry.getAttribute('skinIndex')&&o.geometry.getAttribute('skinWeight'))skinCount++;});
  return {valid:missing.length===0&&skinCount>0,missing,skinCount,bones};
}

export function headBoneIndices(skeleton) {
  const head=new Set();
  for(const bone of skeleton.bones)
    if(/^(head|neck|.*eye)/.test(canonicalHumanoidBone(bone.name)))bone.traverse(o=>{if(o.isBone)head.add(o);});
  return new Set(skeleton.bones.flatMap((bone,i)=>head.has(bone)?[i]:[]));
}

export function hideAuthoredPlayerWeapon(root) {
  // The uploaded Polish skin includes a posed Beryl rifle. Its separate spare
  // magazines stay on the uniform; the game owns the actual equipped weapon.
  root.traverse(o=>{if(o.isMesh&&/^WZ96[_ ]Beryl_0$/.test(o.name))o.visible=false;});
}

export function normalizePlayableHuman(root,height=1.78) {
  const rig=inspectHumanoidRig(root);
  if(!rig.valid)throw Error(`Player rig is incomplete: ${rig.missing.join(', ')||'no skinned body'}`);
  root.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3());
  if(![size.x,size.y,size.z,height].every(Number.isFinite)||size.y<.01||height<=0)throw Error('Player has invalid body bounds');
  const scale=height/size.y,center=box.getCenter(new T.Vector3());
  const normalizer=new T.Group();normalizer.name='player-authored-transform';
  normalizer.add(root);normalizer.scale.setScalar(scale);
  normalizer.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
  const wrapper=new T.Group();wrapper.add(normalizer);wrapper.updateMatrixWorld(true);
  return wrapper;
}

/** World-space two-bone IK works with the three different authored joint axes. */
export function solveHumanoidLimb(root,bones,side,target,leg=false) {
  const upper=bones.get(side+(leg?'upleg':'arm')),
    lower=bones.get(side+(leg?'leg':'forearm')),
    end=bones.get(side+(leg?'foot':'hand'));
  if(!upper||!lower||!end||!upper.parent||!lower.parent)return false;
  root.updateMatrixWorld(true);
  const start=upper.getWorldPosition(new T.Vector3()),middle=lower.getWorldPosition(new T.Vector3()),tip=end.getWorldPosition(new T.Vector3());
  const a=start.distanceTo(middle),b=middle.distanceTo(tip),axis=target.clone().sub(start);
  if(a<1e-5||b<1e-5||!Number.isFinite(axis.lengthSq()))return false;
  const length=T.MathUtils.clamp(axis.length(),Math.abs(a-b)+.0001,(a+b)*.999);
  if(axis.lengthSq()<1e-10)axis.set(0,-1,0);else axis.normalize();
  const rotation=root.getWorldQuaternion(new T.Quaternion());
  const pole=(leg?new T.Vector3(0,0,1):new T.Vector3(side==='left'?.5:-.5,-1,-.2)).applyQuaternion(rotation);
  pole.addScaledVector(axis,-pole.dot(axis));
  if(pole.lengthSq()<1e-8){pole.set(1,0,0).applyQuaternion(rotation);pole.addScaledVector(axis,-pole.dot(axis));}
  pole.normalize();
  const along=(a*a+length*length-b*b)/(2*length),
    bend=start.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,a*a-along*along))),
    reachable=start.clone().addScaledVector(axis,length);
  const rotate=(bone,from,to)=>{
    if(from.lengthSq()<1e-10||to.lengthSq()<1e-10)return;
    const world=bone.getWorldQuaternion(new T.Quaternion()),parent=bone.parent.getWorldQuaternion(new T.Quaternion());
    world.premultiply(new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()));
    bone.quaternion.copy(parent.invert().multiply(world));bone.updateWorldMatrix(false,true);
  };
  rotate(upper,middle.clone().sub(start),bend.sub(start));
  lower.getWorldPosition(middle);end.getWorldPosition(tip);
  rotate(lower,tip.sub(middle),reachable.sub(middle));
  return true;
}

/** A rig-specific rest pose supplies stride targets when no walk/run is shipped. */
export class HumanoidLegPose {
  constructor(root,bones) {
    this.root=root;this.bones=bones;this.rests=new Map();this.feet=new Map();
    root.updateMatrixWorld(true);
    for(const side of ['left','right'])for(const part of ['upleg','leg','foot']){
      const bone=bones.get(side+part);if(!bone)continue;
      this.rests.set(bone,bone.quaternion.clone());
      if(part==='foot')this.feet.set(side,root.worldToLocal(bone.getWorldPosition(new T.Vector3())));
    }
  }
  reset(){for(const [bone,rotation] of this.rests)bone.quaternion.copy(rotation);}
  update(gait,speed) {
    this.reset();
    const amount=T.MathUtils.clamp(speed/4,0,1),stride=.28*amount,lift=.11*amount;
    for(const side of ['left','right']) {
      const rest=this.feet.get(side);if(!rest)continue;
      const phase=gait+(side==='left'?0:Math.PI),foot=rest.clone();
      foot.z+=Math.sin(phase)*stride;foot.y+=Math.max(0,Math.cos(phase))*lift;
      solveHumanoidLimb(this.root,this.bones,side,this.root.localToWorld(foot),true);
    }
  }
}
