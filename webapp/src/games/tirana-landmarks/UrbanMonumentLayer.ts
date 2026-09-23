import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {URBAN_MONUMENTS} from './urbanMonuments.mjs';

type V=[number,number,number];
/** Two original sculptural approximations from publicly documented silhouettes.
 * Static material batches; no new lights, remote textures or per-frame meshes. */
export class UrbanMonumentLayer{
 readonly group=new T.Group();
 private materials=[new T.MeshStandardMaterial({color:0x4c5346,roughness:.78,metalness:.62,vertexColors:true}),new T.MeshStandardMaterial({color:0xc2b5a0,roughness:.94}),new T.MeshStandardMaterial({color:0x756d5d,roughness:1}),new T.MeshStandardMaterial({color:0x384b29,roughness:1})];
 private sites:T.Group[]=[];
 constructor(){
  this.group.name='Tirana:urban-square-monuments';
  for(const site of URBAN_MONUMENTS){
   const root=new T.Group();root.name=site.name;root.position.set(site.x,0,site.z);root.rotation.y=site.yaw;root.userData={...site,accuracy:'Original photo-informed approximation; dimensions and facing estimated'};
   const parts:T.BufferGeometry[][]=[[],[],[],[]];
   const add=(g:T.BufferGeometry,p:V,s:V=[1,1,1],material=0,rotation:V=[0,0,0])=>{const m=new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(...s));g.applyMatrix4(m);parts[material].push(g.index?g.toNonIndexed():g);if(g.index)g.dispose();};
   const ball=(p:V,s:V)=>add(new T.SphereGeometry(1,12,8),p,s);
   const box=(p:V,s:V,material=0)=>add(new T.BoxGeometry(1,1,1),p,s,material);
   const limb=(a:V,b:V,r:number)=>{const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start),g=new T.CylinderGeometry(r*.8,r,delta.length(),10);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));add(g,start.add(end).multiplyScalar(.5).toArray() as V);};
   const {w,d,h}=site.plinth;box([0,h/2,0],[w,h,d],1);
   if(site.id==='sulejman-pasha'){
    // Long folded robe, shoulder mantle, fez, moustache, scroll and curved sash.
    const robe=new T.LatheGeometry([new T.Vector2(.64,0),new T.Vector2(.57,.35),new T.Vector2(.45,1.5),new T.Vector2(.42,2.12)],28);
    const pos=robe.getAttribute('position');for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),fold=1+.048*Math.sin(Math.atan2(z,x)*14);pos.setX(i,x*fold);pos.setZ(i,z*fold);}robe.computeVertexNormals();add(robe,[0,h,0]);
    ball([0,h+2.06,0],[.62,.48,.31]);ball([0,h+2.59,0],[.24,.32,.22]);
    add(new T.CylinderGeometry(.17,.22,.36,14),[0,h+2.97,0]);
    ball([0,h+2.57,-.235],[.065,.09,.09]);ball([-.075,h+2.49,-.214],[.095,.035,.045]);ball([.075,h+2.49,-.214],[.095,.035,.045]);
    limb([-.48,h+2.16,0],[-.53,h+1.19,-.12],.17);limb([.48,h+2.16,0],[.51,h+1.27,-.12],.17);
    ball([-.53,h+1.1,-.13],[.13,.2,.13]);ball([.51,h+1.17,-.12],[.13,.2,.13]);
    limb([-.53,h+1.12,-.2],[-.26,h+.98,-.42],.105);
    add(new T.TorusGeometry(.43,.045,6,30,Math.PI),[0,h+1.53,-.04],[1,1,.65],0,[Math.PI/2,0,.1]);
    limb([.24,h+1.57,-.29],[.32,h+.86,-.23],.045);
    // Low clipped hedge around this low base, as in the 2026 reference.
    for(let i=0;i<22;i++){const a=i*Math.PI*2/22;add(new T.IcosahedronGeometry(1,0),[Math.cos(a)*1.25,.32,Math.sin(a)*1.25],[.33,.32,.3],3);}
   }else{
    // Forward stride with the right arm raised holding the sculpted pistol.
    const y=h;ball([0,y+1.45,0],[.4,.55,.29]);ball([.09,y+2.08,-.09],[.22,.29,.2]);
    add(new T.CylinderGeometry(.23,.23,.12,12),[.09,y+2.31,-.09]);
    ball([.12,y+2.09,-.28],[.07,.09,.08]);
    limb([-.2,y+1.13,0],[-.51,y+.53,.3],.21);limb([-.51,y+.53,.3],[-.67,y+.12,.52],.16);
    limb([.2,y+1.1,0],[.46,y+.75,-.5],.23);limb([.46,y+.75,-.5],[.49,y+.14,-.64],.17);
    box([-.67,y+.1,.38],[.3,.2,.55]);box([.49,y+.1,-.76],[.3,.2,.54]);
    limb([-.29,y+1.73,0],[-.47,y+1.33,-.26],.15);limb([-.47,y+1.33,-.26],[-.03,y+1.22,-.3],.13);ball([-.01,y+1.22,-.3],[.13,.11,.12]);
    limb([.32,y+1.79,0],[.55,y+2.27,-.01],.16);limb([.55,y+2.27,-.01],[.74,y+2.9,-.11],.12);ball([.74,y+2.93,-.11],[.12,.14,.11]);
    box([.75,y+3.11,-.12],[.1,.32,.12]);box([.7,y+2.96,-.12],[.18,.09,.1]);
    add(new T.ConeGeometry(.47,.75,10,1,true),[0,y+1.02,.14],[1,1,.75],0,[.1,0,.15]);
    // Stone joints and an original abstract relief panel, not a copied texture.
    for(let row=1;row<7;row++)box([0,row*h/7,-d/2-.003],[w,.014,.012],2);
    for(let row=0;row<7;row++)for(const x of row%2?[-w*.25,w*.25]:[0])box([x,(row+.5)*h/7,-d/2-.003],[.012,h/7,.012],2);
    box([0,h*.43,-d/2-.018],[w*.65,h*.35,.055]);
    for(let i=0;i<5;i++){const x=(i-2)*.24;ball([x,h*.49,-d/2-.065],[.09,.11,.06]);limb([x,h*.43,-d/2-.08],[x+.08,h*.28,-d/2-.08],.065);}
   }
   parts.forEach((geometries,index)=>{if(!geometries.length)return;const g=mergeGeometries(geometries,false)!;geometries.forEach(p=>p.dispose());if(index===0){const p=g.getAttribute('position'),colors=[];for(let i=0;i<p.count;i++){const tone=.84+.14*Math.sin(p.getX(i)*17+p.getY(i)*11+p.getZ(i)*7);colors.push(tone,tone,Math.min(1,tone+.04));}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));}g.computeBoundingSphere();const mesh=new T.Mesh(g,this.materials[index]);mesh.castShadow=index!==3;mesh.receiveShadow=true;root.add(mesh);});
   this.sites.push(root);this.group.add(root);
  }
 }
 update(viewer?:{x:number;z:number},battery=false){if(!viewer)return;const radius=battery?320:650;for(const site of this.sites)site.visible=(site.position.x-viewer.x)**2+(site.position.z-viewer.z)**2<radius*radius;}
 dispose(){this.group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});this.materials.forEach(m=>m.dispose());this.group.clear();this.group.removeFromParent();}
}
