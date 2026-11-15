/** Fraction of a closed event that doubles back into a nearby parallel
 * carriageway. Such ribbons merge and cannot hold independent race barriers. */
export function parallelRoadOverlap(points,widths){
  const segments=points.map((p,i)=>{const q=points[(i+1)%points.length],dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz);return {p,q,dx,dz,length,width:widths[i]};});
  let length=0;for(const edge of segments){edge.distance=length;length+=edge.length;}
  let overlap=0;
  for(const a of segments){
    const count=Math.max(1,Math.ceil(a.length/12));
    for(let j=0;j<count;j++){
      const t=(j+.5)/count,x=a.p[0]+a.dx*t,z=a.p[1]+a.dz*t,at=a.distance+a.length*t;
      if(segments.some(b=>{
        const gap=Math.abs(at-(b.distance+b.length*.5));if(Math.min(gap,length-gap)<100)return false;
        if(Math.abs(a.dx*b.dx+a.dz*b.dz)<a.length*b.length*.85)return false;
        const u=Math.max(0,Math.min(1,((x-b.p[0])*b.dx+(z-b.p[1])*b.dz)/(b.length*b.length)));
        return Math.hypot(x-b.p[0]-b.dx*u,z-b.p[1]-b.dz*u)<(a.width+b.width)*.5+1.25;
      }))overlap+=a.length/count;
    }
  }
  return overlap/length;
}
