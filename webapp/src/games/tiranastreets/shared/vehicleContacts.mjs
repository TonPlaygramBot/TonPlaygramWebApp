import {vehicleSize} from './trafficSimulation.mjs';
const EPS=1e-6;
const dot=(a,b)=>a.x*b.x+a.z*b.z;
const inside=(p,ring)=>{
  let result=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>p.z)!==(b[1]>p.z)&&p.x<(b[0]-a[0])*(p.z-a[1])/(b[1]-a[1])+a[0])result=!result;
  }
  return result;
};
export function vehicleFootprint(car){
  const {length,width}=vehicleSize(car),right={x:Math.cos(car.heading),z:-Math.sin(car.heading)},forward={x:Math.sin(car.heading),z:Math.cos(car.heading)};
  return {right,forward,halfWidth:width/2,halfLength:length/2,corners:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:car.x+right.x*x*width/2+forward.x*z*length/2,z:car.z+right.z*x*width/2+forward.z*z*length/2}))};
}
const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
const intersects=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<-EPS&&cross(c,d,a)*cross(c,d,b)<-EPS;
/** Exact narrow phase for an oriented body and a concave footprint with courtyards.
 * Bounding circles may only reject distant objects; they never create a contact. */
export function vehicleOverlapsPolygon(car,building){
  const shape=vehicleFootprint(car),rings=[building.p,...(building.holes||[])];
  const solid=p=>inside(p,building.p)&&!(building.holes||[]).some(r=>inside(p,r));
  if(shape.corners.some(solid))return true;
  for(const ring of rings)for(let i=0;i<ring.length;i++){
    const a={x:ring[i][0],z:ring[i][1]},b={x:ring[(i+1)%ring.length][0],z:ring[(i+1)%ring.length][1]},relative={x:a.x-car.x,z:a.z-car.z};
    if(Math.abs(dot(relative,shape.right))<shape.halfWidth-EPS&&Math.abs(dot(relative,shape.forward))<shape.halfLength-EPS)return true;
    for(let j=0;j<4;j++)if(intersects(a,b,shape.corners[j],shape.corners[(j+1)%4]))return true;
  }
  return false;
}
export function vehiclePolygonContact(car,building){
  const shape=vehicleFootprint(car),radius=Math.hypot(shape.halfWidth,shape.halfLength);
  const xs=building.p.map(p=>p[0]),zs=building.p.map(p=>p[1]);
  if(car.x+radius<Math.min(...xs)||car.x-radius>Math.max(...xs)||car.z+radius<Math.min(...zs)||car.z-radius>Math.max(...zs))return null;
  if(!vehicleOverlapsPolygon(car,building))return null;
  const candidates=[];
  for(const ring of [building.p,...(building.holes||[])])for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<EPS)continue;
    const n={x:-dz/length,z:dx/length},signed=(car.x-a[0])*n.x+(car.z-a[1])*n.z;
    const extent=Math.abs(dot(n,shape.right))*shape.halfWidth+Math.abs(dot(n,shape.forward))*shape.halfLength;
    for(const side of [-1,1]){
      const distance=side*(extent+.001)-signed;
      candidates.push({x:n.x*distance,z:n.z*distance,depth:Math.abs(distance)});
    }
  }
  // Include car axes for vertex/corner contacts against diagonal building edges.
  for(const n of [shape.right,shape.forward]){
    const values=building.p.map(p=>(p[0]-car.x)*n.x+(p[1]-car.z)*n.z);
    const extent=Math.abs(dot(n,shape.right))*shape.halfWidth+Math.abs(dot(n,shape.forward))*shape.halfLength;
    for(const distance of [Math.min(...values)-extent-.001,Math.max(...values)+extent+.001])
      candidates.push({x:n.x*distance,z:n.z*distance,depth:Math.abs(distance)});
  }
  candidates.sort((a,b)=>a.depth-b.depth);
  const contact=candidates.find(v=>!vehicleOverlapsPolygon({...car,x:car.x+v.x,z:car.z+v.z},building));
  if(!contact)return null;
  const normal={x:contact.x/contact.depth,z:contact.z/contact.depth};
  const extent=Math.abs(dot(normal,shape.right))*shape.halfWidth+Math.abs(dot(normal,shape.forward))*shape.halfLength;
  return {...contact,kind:building.kind||'building',id:building.id,point:{x:car.x-normal.x*extent,z:car.z-normal.z*extent}};
}
/** Preserve tangent velocity on scrapes, including when no damage system is installed. */
export function slideVehicle(car,contact){
  const length=Math.hypot(contact.x,contact.z);if(length<EPS)return;
  const nx=contact.x/length,nz=contact.z/length,closing=(car.vx||0)*nx+(car.vz||0)*nz;
  if(closing<0){car.vx-=closing*nx;car.vz-=closing*nz;}
  car.speed=-Math.sin(car.heading)*car.vx-Math.cos(car.heading)*car.vz;
}
