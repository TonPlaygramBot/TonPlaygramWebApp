const finite=(v,name)=>{if(!Number.isFinite(v))throw Error(`Invalid ${name}`);return v};
export function segmentFrame(a,b,halfWidth){
  finite(halfWidth,'track width');
  const dx=finite(b.x-a.x,'segment x'),dz=finite(b.z-a.z,'segment z'),length=Math.hypot(dx,dz);
  if(length<1e-6)throw Error('Track segment is too short');
  const tx=dx/length,tz=dz/length,nx=-tz,nz=tx;
  return {x:(a.x+b.x)/2,z:(a.z+b.z)/2,length,yaw:Math.atan2(tx,tz),tx,tz,nx,nz,
    side(sign,offset=0){const d=(halfWidth+offset)*sign;return{x:this.x+nx*d,z:this.z+nz*d};}};
}

/** Exact joined boundaries for a closed road ribbon. Averaging raw vertex
 * offsets pulls barriers inward at corners; the miter correction keeps both
 * sides on the requested road edge while limiting pathological sharp joins. */
export function circuitSides(points,halfWidth){
  finite(halfWidth,'track width');
  if(!Array.isArray(points)||points.length<3)throw Error('Circuit needs at least three points');
  const normals=points.map((p,i)=>{
    const q=points[(i+1)%points.length],dx=finite(q.x-p.x,'segment x'),dz=finite(q.z-p.z,'segment z'),length=Math.hypot(dx,dz);
    if(length<1e-6)throw Error('Track segment is too short');
    return{x:-dz/length,z:dx/length};
  });
  const sides={left:[],right:[]};
  points.forEach((p,i)=>{
    const before=normals[(i+normals.length-1)%normals.length],after=normals[i],
      sx=before.x+after.x,sz=before.z+after.z,joinLength=Math.hypot(sx,sz),
      jx=joinLength>1e-6?sx/joinLength:after.x,jz=joinLength>1e-6?sz/joinLength:after.z,
      projection=Math.max(.2,jx*after.x+jz*after.z),miter=Math.min(halfWidth*2,halfWidth/projection);
    sides.left.push({x:p.x-jx*miter,z:p.z-jz*miter});
    sides.right.push({x:p.x+jx*miter,z:p.z+jz*miter});
  });
  return sides;
}
