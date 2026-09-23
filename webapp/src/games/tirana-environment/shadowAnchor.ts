/** Quantize in the light's two image axes, not world X/Z. This keeps building
 * edges on stable shadow texels when the camera travels diagonally. Preserve
 * camera elevation so the same near-field map works from accessible rooftops. */
export function shadowAnchor(
  point:{x:number;y:number;z:number},direction:{x:number;y:number;z:number},span:number,resolution:number
) {
  const length=Math.hypot(direction.x,direction.y,direction.z)||1;
  const dx=direction.x/length,dy=direction.y/length,dz=direction.z/length;
  const horizontal=Math.hypot(dx,dz);
  const rx=horizontal>1e-6?dz/horizontal:1,rz=horizontal>1e-6?-dx/horizontal:0;
  const ux=dy*rz,uy=dz*rx-dx*rz,uz=-dy*rx;
  const texel=Math.max(.001,span/Math.max(1,resolution));
  const right=point.x*rx+point.z*rz,up=point.x*ux+point.y*uy+point.z*uz;
  const dr=Math.round(right/texel)*texel-right,du=Math.round(up/texel)*texel-up;
  return {x:point.x+rx*dr+ux*du,y:point.y+uy*du,z:point.z+rz*dr+uz*du};
}
