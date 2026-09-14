/** Centreline segments shared by visible bridge ironwork and kart collision. */
export function bridgeRailSections(road, clear=()=>true) {
  const dx=road.b[0]-road.a[0],dz=road.b[1]-road.a[1],length=Math.hypot(dx,dz);
  if(!road.bridge||road.tunnel||length<=.2)return [];
  const nx=dz/length,nz=-dx/length,half=road.w/2+(road.walk?.12:1.25);
  const count=Math.max(1,Math.ceil(length/1.6)),sections=[];
  for(const side of [-1,1])for(let i=0;i<count;i++){
    const a=[road.a[0]+dx*i/count+nx*side*half,road.a[1]+dz*i/count+nz*side*half];
    const b=[road.a[0]+dx*(i+1)/count+nx*side*half,road.a[1]+dz*(i+1)/count+nz*side*half];
    if(clear(a,b,.12))sections.push({a,b,yaw:Math.atan2(dx,dz),length:length/count,index:i});
  }
  return sections;
}
