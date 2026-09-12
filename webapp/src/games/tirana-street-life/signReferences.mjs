/** Identity artwork comes from the brand itself; sign mounting sizes and the
 * pre-existing billboard locations are authored, not surveyed advertisements. */
import {BUSINESS_SIGN_REFERENCES} from './businessSignReferences.mjs';
export const SIGN_REFERENCES = Object.freeze([
  ...BUSINESS_SIGN_REFERENCES,
  {id:'spar',match:/^spar(?: express)?$/i,logo:'/assets/tirana-streets/signs/spar-logo.png',source:'https://spar.al/',background:'#ffffff',foreground:'#008844',crop:[74,96,1074,178]},
  {id:'toptani',match:/^toptani(?: shopping center)?$/i,logo:'/assets/tirana-streets/signs/toptani-logo.svg',source:'https://toptani.com.al/en/',background:'#ffffff',foreground:'#111111',crop:null},
  {id:'mon-cheri',match:/^mon ch[eé]ri$/i,logo:'/assets/tirana-streets/signs/mon-cheri-logo.jpg',source:'https://toptani.com.al/en/content/132-mon-cheri',background:'#ffffff',foreground:'#222222',crop:null},
  {id:'mulliri',match:/mulliri/i,logo:'/assets/tirana-streets/signs/mulliri-logo.png',
   source:'https://mullirivjeter.al/',background:'#faf5eb',foreground:'#d91505',
   crop:[74,37,915,279]}
]);
export const signReferenceFor = text => SIGN_REFERENCES.find(reference=>reference.match.test(String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ')));
export function referencedAdvertising(site,storefronts){
 const shop=storefronts.filter(s=>signReferenceFor(s.name)&&Math.hypot(s.x-site.x,s.z-site.z)<150)
   .sort((a,b)=>Math.hypot(a.x-site.x,a.z-site.z)-Math.hypot(b.x-site.x,b.z-site.z))[0];
 return shop?{...site,name:shop.name,reference:signReferenceFor(shop.name).source,
   placementAccuracy:'Authored roadside brand panel near mapped tenant; not a surveyed advertisement'}:site;
}
