/** Decoration in the unchanged city metre frame. Dimensions are authored,
 * not surveyed Tirana infrastructure. No road is moved or widened. */
export const POST_RADIUS=.17, POST_HEIGHT=.78;
const PROFILES=Object.freeze({
  fps:Object.freeze({roadY:.09,postY:.23,skipPaint:Object.freeze(['center','zebra','stop'])}),
  street:Object.freeze({roadY:.09,postY:.07,skipPaint:Object.freeze(['center'])}),
  racing:Object.freeze({roadY:.03,postY:.02,skipPaint:Object.freeze([])})
});
export function streetDetailProfile(profile){const p=PROFILES[profile];if(!p)throw Error('Unknown street rendering profile');return p;}

const finite=Number.isFinite;
const point=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(finite);
export function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l)):0;return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}
function inside(x,z,p){let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const freeze=a=>Object.freeze(a.map(v=>Object.freeze(v)));
/** Explicit OSM tags take precedence. The legacy snapshot has no cycleway tags;
 * the two Lana boulevards may use a labelled river-side authored approximation.
 * A named road alone never establishes the side of a cycle lane. */
export function cyclingSide(r,river=[]){
  const yes=v=>['lane','track','opposite_lane','opposite_track'].includes(v);
  if(r.cycle||r.highway==='cycleway')return {sides:[0],evidence:'source-tag',width:Math.min(2.2,r.w||2)};
  if(r.walk)return null;
  const sides=[];
  if(yes(r.cyclewayRight||r['cycleway:right']))sides.push(1);
  if(yes(r.cyclewayLeft||r['cycleway:left']))sides.push(-1);
  if(sides.length)return {sides,evidence:'source-tag',width:1.4};
  if(r.cycleway==='no'||r.bicycle==='no')return null;
  const name=normalize(r.name);
  if(!/bajram curri|gjergj fishta/.test(name)||(r.w||0)<8)return null;
  const x=(r.a[0]+r.b[0])/2,z=(r.a[1]+r.b[1])/2,dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],length=Math.hypot(dx,dz);
  if(length<1)return null;
  let best=Infinity,side=0;
  for(const w of river)for(let i=1;i<(w.line?.length||0);i++){
    const d=segmentDistance(x,z,w.line[i-1],w.line[i]);if(d>=best||d>45||d<(r.w||0)/2+3)continue;
    const right=segmentDistance(x-dz/length,z+dx/length,w.line[i-1],w.line[i]);
    best=d;side=right<d?1:-1;
  }
  return side?{sides:[side],evidence:'authored-lana-corridor',width:1.4}:null;
}
function gridIndex(items,bounds,cell=32){
  const bins=new Map();
  for(const item of items){const b=bounds(item);if(!b.every(finite))continue;
    for(let x=Math.floor(b[0]/cell);x<=Math.floor(b[2]/cell);x++)for(let z=Math.floor(b[1]/cell);z<=Math.floor(b[3]/cell);z++){const k=`${x},${z}`;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(item);}}
  return (x,z,pad=0)=>{const hits=new Set();for(let i=Math.floor((x-pad)/cell);i<=Math.floor((x+pad)/cell);i++)for(let j=Math.floor((z-pad)/cell);j<=Math.floor((z+pad)/cell);j++)for(const v of bins.get(`${i},${j}`)||[])hits.add(v);return [...hits];};
}
export function ribbonExclusion(track){
  if(!track||!Array.isArray(track.points)||track.points.length<2||!finite(track.width)||track.width<=0)throw Error('Valid race ribbon required');
  const points=track.points.map(p=>Array.isArray(p)?[p[0],p[1]]:[p.x,p.z]);if(!points.every(point))throw Error('Invalid race point');
  const segments=points.map((a,i)=>({a,b:points[(i+1)%points.length]})),width=track.width;
  const near=gridIndex(segments,s=>[Math.min(s.a[0],s.b[0])-width/2,Math.min(s.a[1],s.b[1])-width/2,Math.max(s.a[0],s.b[0])+width/2,Math.max(s.a[1],s.b[1])+width/2]);
  return (x,z,pad=0)=>{if(![x,z,pad].every(finite)||pad<0)return true;return near(x,z,pad+1).some(s=>segmentDistance(x,z,s.a,s.b)<width/2+pad+1);};
}
export function buildRoadDetails(world,{signals=[],river=[],exclude=()=>false,includeCycling=true}={}){
  const roads=(world.roads||[]).filter(r=>point(r.a)&&point(r.b)&&finite(r.w)&&r.w>0&&r.w<=80&&Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1])<10000);
  const buildings=(world.buildings||[]).filter(b=>Array.isArray(b.p)&&b.p.length>=3&&b.p.every(point));
  const masks=signals.filter(s=>[s.x,s.z,s.yaw,s.width].every(finite)&&s.width>1);
  const signalNear=gridIndex(masks,s=>[s.x-s.width/2-10,s.z-s.width/2-10,s.x+s.width/2+10,s.z+s.width/2+10]);
  const buildingNear=gridIndex(buildings,b=>[Math.min(...b.p.map(p=>p[0]))-2,Math.min(...b.p.map(p=>p[1]))-2,Math.max(...b.p.map(p=>p[0]))+2,Math.max(...b.p.map(p=>p[1]))+2]);
  const roadNear=gridIndex(roads,r=>[Math.min(r.a[0],r.b[0])-r.w/2-2,Math.min(r.a[1],r.b[1])-r.w/2-2,Math.max(r.a[0],r.b[0])+r.w/2+2,Math.max(r.a[1],r.b[1])+r.w/2+2]);
  const blocked=(x,z,pad=0)=>signalNear(x,z,pad).some(s=>Math.hypot(s.x-x,s.z-z)<s.width/2+5+pad);
  const occupied=(x,z,pad=.3)=>buildingNear(x,z,pad).some(b=>inside(x,z,b.p)||b.p.some((a,i)=>segmentDistance(x,z,a,b.p[(i+1)%b.p.length])<pad));
  const decals=[],posts=[],keys=new Set(),cycles=[];
  const add=(kind,x,z,w,d,yaw,extra={})=>{if(![x,z,w,d,yaw].every(finite)||w<=0||d<=0||exclude(x,z,Math.hypot(w,d)/2))return;decals.push({kind,x,z,w,d,yaw,...extra});};
  // Preserve the exact existing SIGNALS crosswalk layout in the two city modes.
  for(const s of masks){
    const ux=Math.sin(s.yaw),uz=Math.cos(s.yaw),rx=uz,rz=-ux;
    add('crossing-bed',s.x-ux*2.1,s.z-uz*2.1,s.width-.4,2.7,s.yaw);
    for(let d=-s.width/2+.4;d<s.width/2-.2;d+=.95)add('zebra',s.x+rx*d-ux*2.1,s.z+rz*d-uz*2.1,.48,2.6,s.yaw);
    add('stop',s.x+rx*s.width*.25+ux*.75,s.z+rz*s.width*.25+uz*.75,s.width/2-.3,.28,s.yaw);
  }
  // Cell-bounded sampling makes no new connections across road gaps or bridges.
  for(const r of roads){
    const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],length=Math.hypot(dx,dz);
    if(length<1||r.bridge||r.tunnel||['private','no'].includes(r.access))continue;
    const ux=dx/length,uz=dz/length,rx=-uz,rz=ux,yaw=Math.atan2(dx,dz),cycle=includeCycling?cyclingSide(r,river):null;
    if(cycle)for(const side of cycle.sides)cycles.push({a:[...r.a],b:[...r.b],width:cycle.width,side,evidence:cycle.evidence,name:r.name||''});
    for(let d=1;d<length-1;d+=2){
      const take=Math.min(2,length-1-d),x=r.a[0]+ux*(d+take/2),z=r.a[1]+uz*(d+take/2);
      if(blocked(x,z,1)||occupied(x,z))continue;
      if(!r.walk&&r.w>=6){
        for(const side of [-1,1])add('edge',x+rx*side*(r.w/2-.18),z+rz*side*(r.w/2-.18),.11,take,yaw);
        if(Math.floor(d/4)%2===0)add('center',x,z,.12,take,yaw);
      }
      if(cycle)for(const side of cycle.sides){
        const off=side===0?0:side*(r.w/2-cycle.width/2-.25),cx=x+rx*off,cz=z+rz*off;
        if(occupied(cx,cz,cycle.width/2))continue;
        add('cycle-bed',cx,cz,cycle.width,take,yaw,{evidence:cycle.evidence});
        if(side!==0)add('cycle-edge',x+rx*(off-side*cycle.width/2),z+rz*(off-side*cycle.width/2),.12,take,yaw);
      }
    }
    if(cycle&&length>=12){
      const d=length/2,x=r.a[0]+ux*d,z=r.a[1]+uz*d;
      for(const side of cycle.sides){const off=side*(r.w/2-cycle.width/2-.25),cx=x+rx*off,cz=z+rz*off;
        if(!blocked(cx,cz,3)&&!occupied(cx,cz,1))add('bicycle',cx,cz,1.05,2.8,yaw+(side<0?Math.PI:0),{evidence:cycle.evidence});}
    }
    // Concrete pedestrian bollards, NOT flexible cycle-lane delineators. Kept
    // outside carriageways, footpath centrelines and every crossing approach.
    if(r.walk||r.w<8||length<18)continue;
    for(const side of [-1,1])for(let d=6;d<length-6;d+=6){
      const x=r.a[0]+ux*d+rx*side*(r.w/2+.55),z=r.a[1]+uz*d+rz*side*(r.w/2+.55);
      if(blocked(x,z,2)||occupied(x,z,.55)||exclude(x,z,1)||roadNear(x,z).some(o=>segmentDistance(x,z,o.a,o.b)<(o.walk?o.w/2+.55:o.w/2+.25)))continue;
      const key=`${Math.round(x)},${Math.round(z)}`;if(keys.has(key)||posts.some(p=>Math.hypot(p.x-x,p.z-z)<2))continue;
      keys.add(key);posts.push({id:`post:${key}`,x,z,radius:POST_RADIUS,height:POST_HEIGHT,evidence:'authored-pedestrian-edge'});
    }
  }
  return {decals:freeze(decals),posts:freeze(posts),cycles:freeze(cycles),accuracy:'Authored dimensions on stored roads; not a surveyed city inventory'};
}
/** Stable grid broad phase, bounded to existing occupied cells. */
export function createPostCollider(posts){
  const cells=new Map();for(const p of posts){const key=`${Math.floor(p.x/8)},${Math.floor(p.z/8)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push({...p});}
  return (body,radius)=>{if(!body||![body.x,body.z,radius].every(finite)||radius<=0||radius>4)return false;let hit=false;
    const x0=Math.floor((body.x-radius-POST_RADIUS)/8),x1=Math.floor((body.x+radius+POST_RADIUS)/8),z0=Math.floor((body.z-radius-POST_RADIUS)/8),z1=Math.floor((body.z+radius+POST_RADIUS)/8);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const p of cells.get(`${x},${z}`)||[]){const dx=body.x-p.x,dz=body.z-p.z,d=Math.hypot(dx,dz),limit=radius+p.radius;if(d>=limit)continue;body.x=p.x+(d>1e-8?dx/d:1)*(limit+.001);body.z=p.z+(d>1e-8?dz/d:0)*(limit+.001);hit=true;}return hit;
  };
}
