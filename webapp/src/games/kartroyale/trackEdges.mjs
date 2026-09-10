const finite=(v,name)=>{if(!Number.isFinite(v))throw Error(`Invalid ${name}`);return v};
export function segmentFrame(a,b,halfWidth){
  finite(halfWidth,'track width');
  const dx=finite(b.x-a.x,'segment x'),dz=finite(b.z-a.z,'segment z'),length=Math.hypot(dx,dz);
  if(length<1e-6)throw Error('Track segment is too short');
  const tx=dx/length,tz=dz/length,nx=-tz,nz=tx;
  return {x:(a.x+b.x)/2,z:(a.z+b.z)/2,length,yaw:Math.atan2(tx,tz),tx,tz,nx,nz,
    side(sign,offset=0){const d=(halfWidth+offset)*sign;return{x:this.x+nx*d,z:this.z+nz*d};}};
}
