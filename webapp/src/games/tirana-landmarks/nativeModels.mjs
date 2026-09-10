import {skanderbeg} from './skanderbegModel.mjs';
/** Original game meshes, not Google/Sketchfab extracts. All lengths are metres.
 * Tessellation is dependency-free so the exact runtime vertices can be tested
 * and exported as GLB without a browser or a model service. */
export const MATERIALS = Object.freeze({
  stone: { color: 0xcabda5, roughness: .86, metalness: 0 },
  pale: { color: 0xeee5d2, roughness: .76, metalness: 0 },
  shadow: { color: 0x343c3b, roughness: .69, metalness: .05 },
  roof: { color: 0x667e7d, roughness: .51, metalness: .38 },
  glass: { color: 0x365e6a, roughness: .21, metalness: .62 },
  bronze: { color: 0x514b3e, roughness: .63, metalness: .72 },
  gold: { color: 0xb09560, roughness: .54, metalness: .55 },
  purple: { color: 0x655569, roughness: .36, metalness: .48 },
  tile: { color: 0xa06b50, roughness: .89, metalness: 0 },
  slate: { color: 0x384b54, roughness: .42, metalness: .4 },
  coral: { color: 0xce7357, roughness: .78, metalness: 0 },
  blue: { color: 0x79a9b1, roughness: .72, metalness: .04 }
});
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const unit=a=>{const d=Math.hypot(...a);return d>1e-12?a.map(v=>v/d):[0,1,0];};
const add=(a,b,s=1)=>a.map((v,i)=>v+b[i]*s);
const turn=(p,yaw)=>[p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),p[1],-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw)];
class Builder {
  parts=new Map();
  tri(material,a,b,c,normals) {
    const n=cross(sub(b,a),sub(c,a));
    if(Math.hypot(...n)<1e-9)return;
    if(!MATERIALS[material])throw new Error(`Unknown material ${material}`);
    if(!this.parts.has(material))this.parts.set(material,{material,positions:[],normals:[]});
    const out=this.parts.get(material), normal=unit(n);
    [a,b,c].forEach((p,i)=>{out.positions.push(...p);out.normals.push(...(normals?.[i]||normal));});
  }
  quad(m,a,b,c,d){this.tri(m,a,b,c);this.tri(m,a,c,d);}
  box(m,w,h,d,x=0,y=0,z=0,yaw=0){
    const p=(a,b,c)=>add(turn([a*w/2,b*h/2,c*d/2],yaw),[x,y,z]);
    for(const f of [
      [[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]],
      [[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]],
      [[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]],
      [[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]],
      [[1,-1,1],[1,1,1],[-1,1,1],[-1,-1,1]],
      [[-1,-1,-1],[-1,1,-1],[1,1,-1],[1,-1,-1]]
    ])this.quad(m,...f.map(v=>p(...v)));
  }
  tube(m,a,b,ra,rb=ra,segments=12){
    const axis=unit(sub(b,a)), len=Math.hypot(...sub(b,a));
    if(len<1e-8)return;
    const u=unit(cross(axis,Math.abs(axis[1])>.9?[0,0,1]:[0,1,0])),v=cross(axis,u);
    const ring=(p,r,i)=>add(p,add(u.map(k=>k*Math.cos(i*2*Math.PI/segments)),v,Math.sin(i*2*Math.PI/segments)),r);
    for(let i=0;i<segments;i++){
      const p=ring(a,ra,i),q=ring(a,ra,i+1),r=ring(b,rb,i+1),s=ring(b,rb,i);
      const smooth=j=>unit(add(add(u.map(k=>k*Math.cos(j*2*Math.PI/segments)),v,Math.sin(j*2*Math.PI/segments)),axis,(ra-rb)/len));
      const ni=smooth(i),nj=smooth(i+1);
      this.tri(m,p,q,r,[ni,nj,nj]);this.tri(m,p,r,s,[ni,nj,ni]);
      this.tri(m,a,q,p);this.tri(m,b,s,r);
    }
  }
  sphere(m,center,radii,segments=20,rings=12,hemisphere=false){
    const point=(i,j)=>{const theta=i*(hemisphere?Math.PI/2:Math.PI)/rings, phi=j*2*Math.PI/segments;
      const p=[radii[0]*Math.sin(theta)*Math.cos(phi),radii[1]*Math.cos(theta),radii[2]*Math.sin(theta)*Math.sin(phi)];
      return {p:add(center,p),n:unit(p.map((v,k)=>v/(radii[k]*radii[k])))};};
    const triangle=(a,b,c)=>{
      if(dot(cross(sub(b.p,a.p),sub(c.p,a.p)),sub(a.p,center))<0)[b,c]=[c,b];
      this.tri(m,a.p,b.p,c.p,[a.n,b.n,c.n]);
    };
    for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){
      const a=point(i,j),b=point(i+1,j),c=point(i+1,j+1),d=point(i,j+1);
      triangle(a,b,c);triangle(a,c,d);
    }
  }
  frustum(m,w,d,y,h,topW,topD,x=0,z=0,yaw=0){
    const lo=[[-w/2,0,-d/2],[-w/2,0,d/2],[w/2,0,d/2],[w/2,0,-d/2]].map(p=>add(turn(p,yaw),[x,y,z]));
    const hi=[[-topW/2,h,-topD/2],[-topW/2,h,topD/2],[topW/2,h,topD/2],[topW/2,h,-topD/2]].map(p=>add(turn(p,yaw),[x,y,z]));
    for(let i=0;i<4;i++){const j=(i+1)%4;this.quad(m,lo[i],lo[j],hi[j],hi[i]);}
    this.quad(m,...hi);this.quad(m,...lo.slice().reverse());
  }
  finish(id,lod){
    const meshes=[...this.parts.values()];
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    let triangles=0;
    for(const mesh of meshes){triangles+=mesh.positions.length/9;for(let i=0;i<mesh.positions.length;i++){const k=i%3;min[k]=Math.min(min[k],mesh.positions[i]);max[k]=Math.max(max[k],mesh.positions[i]);}}
    return {id,lod,meshes,bounds:{min,max},triangles};
  }
}
function clock(b,detail){
  for(let i=0;i<3;i++)b.box('stone',7.4-i*.45,.3,7.4-i*.45,0,.15+i*.3,0);
  b.box('stone',6,23.8,6,0,12.8,0);
  if(detail)for(let y=1.5;y<24.5;y+=1.15)b.box('pale',6.04,.055,6.04,0,y,0);
  b.box('pale',7.7,.65,7.7,0,25.05,0);
  b.box('pale',6.45,5.2,6.45,0,27.9,0);
  b.box('stone',7.5,.5,7.5,0,30.75,0);
  b.frustum('roof',7.5,7.5,31,3.7,.2,.2);
  b.tube('gold',[0,34.65,0],[0,35.2,0],.08,.035,8);
  for(let side=0;side<4;side++){
    const yaw=side*Math.PI/2, p=(x,y,z)=>turn([x,y,z],yaw);
    b.tube('gold',p(0,28.55,3.24),p(0,28.55,3.30),1.24,1.24,detail?32:16);
    b.tube('pale',p(0,28.55,3.30),p(0,28.55,3.34),1.12,1.12,detail?32:16);
    const hand=(x,y,w,h)=>{const c=p(x,y,3.4);b.box('shadow',w,h,.06,...c,yaw);};
    hand(0,28.9,.10,.74);hand(.3,28.55,.68,.11);
    if(detail){
      for(let i=0;i<12;i++){const a=i*Math.PI/6,c=p(Math.sin(a)*.97,28.55+Math.cos(a)*.97,3.39);b.box('shadow',.08,.15,.05,...c,yaw);}
      for(let x=-3.5;x<=3.5;x+=.7){const c=p(x,25.85,3.6);b.box('roof',.10,.95,.10,...c,yaw);}
      const c=p(0,26.3,3.6);b.box('roof',7.2,.1,.12,...c,yaw);
      for(const y of [7,13,19]){const c=p(0,y,3.03);b.box('shadow',.65,1.6,.07,...c,yaw);}
    }
  }
}
function mosque(b,detail){
  b.box('stone',16,.35,17,0,.175,1);
  b.box('pale',14,7.1,14,0,3.9,0);
  b.box('stone',14.6,.35,14.6,0,7.55,0);
  b.tube('pale',[0,7.6,0],[0,8.7,0],6.75,6.75,detail?32:16);
  b.sphere('roof',[0,8.7,0],[6.75,5.1,6.75],detail?32:16,detail?14:7,true);
  b.tube('pale',[0,13.6,0],[0,15,0],.08,.025,8);
  for(let i=0;i<6;i++)b.tube('pale',[-7+i*2.8,.4,9],[-7+i*2.8,5.5,9],.26,.22,detail?12:6);
  b.box('stone',16.1,.5,5.1,0,5.65,8.7);
  b.frustum('tile',16.8,5.8,5.9,1.8,13.8,1.8,0,8.7);
  b.box('stone',2.5,3.4,2.5,-8.1,1.7,-3);
  b.tube('pale',[-8.1,3.4,-3],[-8.1,23.7,-3],1,.65,detail?20:10);
  b.tube('stone',[-8.1,21.3,-3],[-8.1,21.8,-3],1.5,1.5,detail?24:12);
  b.tube('roof',[-8.1,25.5,-3],[-8.1,30.5,-3],1.15,.015,detail?20:10);
  b.tube('pale',[-8.1,23.7,-3],[-8.1,25.5,-3],.65,.65,12);
  if(detail){
    for(let i=0;i<16;i++){const a=i*Math.PI/8,x=-8.1+Math.cos(a)*1.3,z=-3+Math.sin(a)*1.3;b.tube('roof',[x,21.8,z],[x,22.7,z],.045,.045,5);}
    for(let side=0;side<4;side++)for(const x of [-4,0,4]){
      const yaw=side*Math.PI/2,p=turn([x,3.6,7.055],yaw);
      b.box('shadow',1.2,2.05,.09,...p,yaw);
      b.box('stone',1.65,.15,.17,...turn([x,2.5,7.1],yaw),yaw);
      for(const dx of [-.7,.7])b.box('stone',.13,2.2,.15,...turn([x+dx,3.65,7.12],yaw),yaw);
    }
  }
}
function pyramid(b,detail){
  b.frustum('pale',58,58,.18,18,14,14);
  for(let side=0;side<4;side++)for(const sign of [-1,1]){
    const yaw=side*Math.PI/2;
    b.quad('glass',...[[sign*14-4,.22,29.04],[sign*14+4,.22,29.04],[sign*3.38+.97,18.22,7.04],[sign*3.38-.97,18.22,7.04]].map(p=>turn(p,yaw)));
  }
  b.box('pale',15,.6,15,0,18.5,0);
  // Eight stair/rib runs; no arbitrary pavilions outside the landmark envelope.
  for(let side=0;side<8;side++){
    const yaw=side*Math.PI/4,steps=detail?46:12;
    for(let n=0;n<steps;n++){
      const t=n/steps, diagonal=Math.max(Math.abs(Math.sin(yaw)),Math.abs(Math.cos(yaw)));
      const p=turn([0,.3+18*t+(18/steps)/2,(29-22*t)/diagonal+.17],yaw);
      b.box('pale',side%2?3.1:5.7,18/steps+.03,22/(steps*diagonal)+.1,...p,yaw);
    }
  }
  for(const [x,z,m] of [[-22,30,'coral'],[22,30,'blue'],[-30,-18,'gold']]){
    b.box(m,6.8,4.8,6.2,x,2.5,z);b.box('glass',4.8,3.5,.08,x,2.35,z+3.15);
  }
}
function museum(b,detail){
  // Symmetrical courtyard, projecting portico and original abstract relief panel.
  b.box('pale',92,18,17,0,9,21.5);b.box('pale',92,18,15,0,9,-22.5);
  b.box('pale',18,18,30,-37,9,0);b.box('pale',18,18,30,37,9,0);
  b.box('stone',94,.75,18.2,0,18.25,21.5);
  b.box('stone',94,.75,16,0,18.25,-22.5);
  b.box('stone',18.8,.75,30,-37,18.25,0);b.box('stone',18.8,.75,30,37,18.25,0);
  b.box('shadow',49,5,.10,0,3.1,30.06);
  b.box('stone',53,2,5,0,7.2,31);
  b.box('gold',42,7.7,.35,0,12.7,30.23);
  for(let i=0;i<6;i++){const x=-22.5+i*9;b.box('stone',.65,5.1,1,x,3.15,31.8);}
  if(detail){
    for(let x=-42;x<=42;x+=3.5){
      b.box('stone',.24,16.5,.18,x,9,30.18);
      b.box('shadow',1.65,2.6,.09,x,7,-30.05);b.box('shadow',1.65,2.6,.09,x,12,-30.05);
    }
    // A non-replica abstract civic relief, deliberately not a copy of "The Albanians" mosaic.
    for(let i=0;i<15;i++){
      const x=-18+i*2.57,h=2.4+(i%4)*.4;
      b.box(i%2?'gold':'pale',.9,h,.12,x,11.2+h/2,30.47);
      b.sphere('gold',[x,11.5+h,30.53],[.42,.46,.1],8,5);
    }
    for(let n=0;n<4;n++)b.box('stone',53+n*1.2,.18,1.3,0,.1+n*.18,34.6-n*1.1);
  }
}
function eyes(b,detail){
  b.box('slate',46,24,32,0,12,0);
  b.frustum('glass',27,24,24,107,33,28);
  b.box('slate',33.4,1.3,28.4,0,131.5,0);
  b.frustum('slate',33.4,28.4,132.15,2.85,28,21);
  const floors=detail?31:12;
  for(let i=0;i<floors;i++){
    const y=24+(107*i)/floors,t=(y-24)/107,w=27+6*t,d=24+4*t;
    b.box('slate',w+.4,.28,d+.4,0,y,0);
  }
  if(detail)for(let side=0;side<4;side++){
    const yaw=side*Math.PI/2,half=side%2?12:13.5;
    for(let i=-7;i<=7;i++){
      const x=i*(half*2/15),a=turn([x,24,side%2?13.65:12.15],yaw),c=turn([x*1.22,132+(i%3)*.55,side%2?16.65:14.15],yaw);
      b.tube(i%4?'slate':'gold',a,c,.15,.18,4);
    }
    for(let floor=1;floor<6;floor++)for(let x=-(side%2?12:20);x<=(side%2?12:20);x+=4){
      const p=turn([x,floor*3.8,side%2?23.06:16.06],yaw);
      b.box('glass',3.3,2.7,.08,...p,yaw);
    }
  }
}
const BUILDERS={clock,mosque,pyramid,museum,eyes,skanderbeg};
export const NATIVE_MODEL_IDS=Object.freeze(Object.keys(BUILDERS));
export function buildNativeModel(id,lod='near'){
  if(!Object.hasOwn(BUILDERS,id))throw new Error(`Unknown native landmark ${id}`);
  if(!['near','far'].includes(lod))throw new Error('LOD must be near or far');
  const b=new Builder();BUILDERS[id](b,lod==='near');return b.finish(id,lod);
}
