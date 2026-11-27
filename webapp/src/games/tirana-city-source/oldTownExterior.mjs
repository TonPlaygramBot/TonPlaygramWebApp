/** Exterior interpretation constrained to existing OSM geometry. Nothing here changes physics. */
export const MARKET_ID='623438669';
export const NINE_STOREY_IDS=Object.freeze(['682795212','682795153','682795152','470177345']);
export const MARKET_GLAZING=0x577984;

const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];

export function marketExterior(ring) {
 // This mapped pavilion, unlike the larger named market precinct, is a four-
 // corner outline. Do not stretch a speculative replica over a changed footprint.
 if(ring?.length!==4||ring.some(p=>p?.length!==2||!p.every(Number.isFinite)))return null;
 const width=distance(ring[0],ring[1]),length=distance(ring[0],ring[3]);
 if(width<24||width>28||length<37||length>40||
  Math.abs(distance(ring[1],ring[2])-length)>.25||
  Math.abs(distance(ring[3],ring[2])-width)>.25)return null;
 const basis=[(ring[1][0]-ring[0][0])/width,(ring[1][1]-ring[0][1])/width];
 const axisYaw=-Math.atan2(basis[1],basis[0]);
 const point=(u,v,y)=>{const p=lerp(lerp(ring[0],ring[1],u),lerp(ring[3],ring[2],u),v);return [p[0],y,p[1]];};
 const roof=[],beams=[],boxes=[],floor=[];
 const profile=[[0,4.7],[.265,7.9],[.49,4.85],[.72,7.55],[1,4.65]];
 for(let i=0;i<profile.length-1;i++){
  const [a,ya]=profile[i],[b,yb]=profile[i+1];
  roof.push([point(a,0,ya),point(a,1,ya),point(b,1,yb),point(b,0,yb)]);
  for(const v of [0,.2,.4,.6,.8,1])beams.push([point(a,v,ya-.06),point(b,v,yb-.06),.10]);
  for(let step=0;step<3;step++){
   const t=step/3,u=a+(b-a)*t,y=ya+(yb-ya)*t;
   beams.push([point(u,0,y-.04),point(u,1,y-.04),.067]);
  }
 }
 beams.push([point(1,0,4.63),point(1,1,4.63),.10]);
 for(const [u,y] of [profile[0],profile[2],profile[4]])for(const v of [.055,.28,.5,.72,.945]){
  const p=point(u===0?.012:u===1?.988:u,v,y/2);
  boxes.push([0x40494b,p,[.19,y,.19],axisYaw]);
 }
 // Representative produce displays, not a survey of individual stall owners.
 // Short ranks leave a broad clear aisle; all are only decorative.
 for(const [rank,u] of [.20,.36,.64,.81].entries())for(const v of [.16,.33,.66,.83]){
  boxes.push([0x765b43,point(u,v,.375),[1.38,.74,.76],axisYaw]);
  boxes.push([0x9f7854,point(u,v,.78),[1.53,.12,.93],axisYaw]);
  for(const [item,o] of [-.016,0,.016].entries())
   boxes.push([[0xc97748,0x8f9a53,0xc4a24d,0x9c5b46][(rank+item)%4],point(u+o,v,.89),[.32,.12,.53],axisYaw]);
 }
 // Shared muted terracotta and cream setts, confined to the roof footprint and
 // generated without an image. A narrow seam remains between each tile.
 for(let u=0;u<13;u++)for(let v=0;v<19;v++){
  const a=(u+.018)/13,b=(u+.982)/13,c=(v+.018)/19,d=(v+.982)/19;
  const color=([0xa0907a,0x967863,0xac8d74,0x8a6b57,0xaaa08b])[(u*3+v*7+(u+v)%3)%5];
  floor.push([color,[point(a,c,.083),point(a,d,.083),point(b,d,.083),point(b,c,.083)]]);
 }
 return {roof,beams,boxes,floor};
}

export function nineStoreyBays(edgeLength,height,ordinal) {
 if(!Number.isFinite(edgeLength)||edgeLength<3.4||!Number.isFinite(height)||height<25||height>32)return [];
 const count=Math.max(1,Math.round(edgeLength/3.25)),pitch=edgeLength/count,story=height/9,out=[];
 for(let n=0;n<9;n++)for(let bay=0;bay<count;bay++){
  const balcony=n>0&&edgeLength>=6&&(bay+ordinal)%3!==2,u=(bay+.5)*pitch;
  out.push({u,n,y:story*(n+(n===0?.55:.52)),story,
   width:Math.min(pitch-.60,n===0?2.27:balcony?1.44:1.22),balcony,
   awning:balcony&&(n*3+bay+ordinal)%7===2});
 }
 return out;
}
