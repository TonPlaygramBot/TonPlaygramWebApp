const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
/** Positive cross in the horizontal (x,z) plane is screen-right from a driver's
 * forward-facing camera. Boards face back toward the approaching driver. */
export function turnGuides(track,{lookAhead=24,minTurn=.24,spacing=28}={}){
  const points=track?.points;if(!points||points.length<4||!Number.isFinite(track.width)||track.width<=0)return [];
  const lengths=points.map((p,i)=>Math.hypot(points[(i+1)%points.length].x-p.x,points[(i+1)%points.length].z-p.z));if(lengths.some(n=>!Number.isFinite(n)||n<1e-6))return [];
  let distance=0,last=-Infinity;const out=[];
  for(let i=0;i<points.length;i++){
    const p=points[i];let j=i,walk=0;while(walk<lookAhead&&walk<track.length){walk+=lengths[j];j=(j+1)%points.length;if(j===i)break;}
    const inYaw=Math.atan2(points[(i+1)%points.length].x-p.x,points[(i+1)%points.length].z-p.z),q=points[j],r=points[(j+1)%points.length],outYaw=Math.atan2(r.x-q.x,r.z-q.z),delta=wrap(outYaw-inYaw);
    if(Math.abs(delta)>=minTurn&&Math.abs(delta)<2.6&&distance-last>=spacing){
      const direction=delta<0?'right':'left',sign=direction==='right'?1:-1,rx=-Math.cos(inYaw),rz=Math.sin(inYaw),offset=track.width/2+2;
      const x=p.x-rx*sign*offset,z=p.z-rz*sign*offset;
      // Reject a board that lands on another part of the same closed track.
      let clearance=Infinity;for(let k=0;k<points.length;k++){const a=points[k],b=points[(k+1)%points.length],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));clearance=Math.min(clearance,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));}
      if(clearance>track.width/2+.6){out.push({x,z,y:1.9,yaw:wrap(inYaw+Math.PI),direction,approach:{x:-Math.sin(inYaw),z:-Math.cos(inYaw)},at:distance});last=distance;}
    }distance+=lengths[i];
  }
  // The start/finish seam has the same metric spacing rule as every other turn.
  if(out.length>1&&track.length-out.at(-1).at+out[0].at<spacing)out.pop();return out;
}
