// A mapped tenant/sign design for this game, not a reproduction of branded artwork
// or a claim that a projecting board is installed at the site today.
const style={
 coffee:['#2e3535','#fcf2db','KAFE'],
 market:['#244b3d','#fff7df','MARKET'],
 grill:['#52362c','#fff4c1','ZGARË'],
 pizza:['#343a49','#fff4d9','PICERI']
};
export const VERIFIED_STOREFRONT_BOARDS=Object.freeze([
 ['node/2609894078','318665798','Mon Cheri','Mon Chéri','coffee','https://www.visit-tirana.com/sq/locations/mon-cheri-kafeja-popullore-ne-tirane/'],
 ['node/3878110461','551324577','Sophie','Sophie','coffee','https://www.sophiecaffe.com/kontakt/'],
 ['node/6841226808','405763963','Sophie','Sophie','coffee','https://www.sophiecaffe.com/kontakt/'],
 ['node/4371665091','462428112','Sophie','Sophie','coffee','https://www.sophiecaffe.com/kontakt/'],
 ['node/3883786635','1170406860','Mulliri i Vjeter','Mulliri i Vjetër','coffee','https://mullirivjeter.al/contact-us/'],
 ['node/5100486621','673022712','Zgara Te Pazari','Zgara te Pazari','grill','https://shtepiaebirreskingpils.al/'],
 ['node/6812929864','1193858387','Pizza Destijl','Pizza Destijl','pizza','https://www.openstreetmap.org/node/6812929864'],
 ['node/4603902513','256324962','Spar','SPAR','market','https://acp.al/product-listing/product/7394/Dhoma-gjumi-femijesh/'],
 ['node/6858442596','804598282','Spar','SPAR','market','https://aapsk.gov.al/wp-content/uploads/2025/02/AAPSK-Pronat-e-Konfiskuara.pdf'],
 ['node/6824084783','736721581','Spar','SPAR','market','https://www.paysera.al/v2/sq-AL/harta']
].map(([id,buildingId,mappedName,name,kind,source])=>Object.freeze({id,buildingId,mappedName,name,kind,source})));
const byId=new Map(VERIFIED_STOREFRONT_BOARDS.map(b=>[b.id,b]));
export const STOREFRONT_BOARD_REACH=.84;
export function storefrontBoard(site){
 const b=byId.get(site.id);
 // Identity mismatch means the mapped tenant moved or changed; don't retain stale signage.
 if(!b||b.buildingId!==site.buildingId||b.mappedName!==site.name||!(site.width>=2.5))return null;
 const [bg,fg,caption]=style[b.kind];
 const y=3.88,h=.48,w=.66,z=.48, x=Math.min(1.24,site.width*.3);
 const color=parseInt(bg.slice(1),16);
 const part=(c,p,s)=>({shape:'box',color:c,p,s});
 return {parts:[
  part(0x323735,[x,y+h*.46,z-.1],[.046,.044,.5]),
  part(0x404342,[x,y,.11],[.088,.24,.055]),
  part(color,[x,y,z],[.064,h+.04,w+.04])
 ],signs:[-1,1].map(dir=>({text:b.name,caption,p:[x+dir*.034,y,z],s:[w,h,1],bg,fg,yaw:dir*Math.PI/2,plain:true}))};
}
