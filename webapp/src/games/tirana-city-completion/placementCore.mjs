/** Shared geometry guards for the offline importer and regression checks. */
export function inside(x,z,p,holes=[]){
 const ring=r=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
 return ring(p)&&!holes.some(ring);
}
export function nearestPoint(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return [a[0]+t*dx,a[1]+t*dz];}
export function distance(p,a,b){const q=nearestPoint(p,a,b);return Math.hypot(p[0]-q[0],p[1]-q[1]);}
export function spatialIndex(items,bounds,size=64){
 const cells=new Map();for(const item of items){const b=bounds(item);for(let x=Math.floor(b[0]/size);x<=Math.floor(b[2]/size);x++)for(let z=Math.floor(b[1]/size);z<=Math.floor(b[3]/size);z++){const k=x+':'+z;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(item);}}
 return (x,z,pad=0)=>{const out=new Set();for(let i=Math.floor((x-pad)/size);i<=Math.floor((x+pad)/size);i++)for(let j=Math.floor((z-pad)/size);j<=Math.floor((z+pad)/size);j++)for(const item of cells.get(i+':'+j)||[])out.add(item);return [...out];};
}
export const bounds=p=>[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1]))];
export const hash=id=>Array.from(String(id)).reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,17);
/** Paint belongs inside a surface parking polygon. Leave a central access aisle,
 * use actual lane polygons for curbside bays, never paint underground parking. */
export function parkingBays(feature,blocked=()=>false){
 const {p,holes=[],tags={}}=feature;
 if(!p?.length||!['surface','lane','street_side'].includes(tags.parking)||tags.location==='underground'||Number(tags.level)<0)return [];
 let longest=0,yaw=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len>longest){longest=len;yaw=Math.atan2(b[0]-a[0],b[1]-a[1]);}}
 const c=Math.cos(yaw),s=Math.sin(yaw),local=p.map(q=>[q[0]*c-q[1]*s,q[0]*s+q[1]*c]),[minX,minZ,maxX,maxZ]=bounds(local);
 const world=(x,z)=>[x*c+z*s,-x*s+z*c],parallel=tags.parking==='lane'||tags.orientation==='parallel';
 const width=parallel?2.1:5,depth=parallel?5.8:2.6,rows=[minX+.2+width/2];
 if(!parallel&&maxX-minX>=16)rows.push(maxX-.2-width/2);
 const result=[];for(const x of rows)for(let z=minZ+.25+depth/2;z<maxZ-.15-depth/2;z+=depth){
  const corners=[[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]].map(([dx,dz])=>world(x+dx,z+dz));
  const safe=q=>inside(...q,p,holes)&&!blocked(...q)&&[p,...holes].every(r=>r.every((a,i)=>distance(q,a,r[(i+1)%r.length])>=.07));
  if(corners.some(q=>!safe(q)))continue;
  // Also sample each edge: corner-only containment misses concave cuts/holes.
  if(corners.some((a,i)=>{const b=corners[(i+1)%4];return [0.25,.5,.75].some(t=>{const q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];return !safe(q);});}))continue;
  if(holes.some(r=>r.some(q=>inside(...q,corners))))continue;
  const q=world(x,z);if(!inside(...q,p,holes)||blocked(...q))continue;
  result.push({x:q[0],z:q[1],yaw,w:width,d:depth});
 }
 return result;
}
