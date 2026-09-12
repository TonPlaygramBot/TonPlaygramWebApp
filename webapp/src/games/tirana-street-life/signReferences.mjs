/** Identity artwork comes from the brand itself; sign mounting sizes and the
 * pre-existing billboard locations are authored, not surveyed advertisements. */
export const SIGN_REFERENCES = Object.freeze([
  {id:'mulliri',match:/mulliri/i,logo:'/assets/tirana-streets/signs/mulliri-logo.png',
   source:'https://mullirivjeter.al/',background:'#faf5eb',foreground:'#d91505',
   crop:[74,37,915,279]}
]);
export const signReferenceFor = text => SIGN_REFERENCES.find(reference=>reference.match.test(text));
export function referencedAdvertising(site,storefronts){
 const shop=storefronts.filter(s=>signReferenceFor(s.name)&&Math.hypot(s.x-site.x,s.z-site.z)<150)
   .sort((a,b)=>Math.hypot(a.x-site.x,a.z-site.z)-Math.hypot(b.x-site.x,b.z-site.z))[0];
 return shop?{...site,name:shop.name,reference:signReferenceFor(shop.name).source,
   placementAccuracy:'Authored roadside brand panel near mapped tenant; not a surveyed advertisement'}:site;
}
