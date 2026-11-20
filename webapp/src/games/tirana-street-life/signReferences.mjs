import {LOCAL_SIGN_REFERENCES} from './localSignReferences.mjs';
/** Storefront identities are mapped separately. Authored roadside panels must
 * never inherit a nearby tenant brand: proximity is not advertising permission. */
import {BUSINESS_SIGN_REFERENCES} from './businessSignReferences.mjs';
import {CITY_BUSINESS_SIGN_REFERENCES} from './cityBusinessSignReferences.mjs';
export const SIGN_REFERENCES = Object.freeze([
  ...LOCAL_SIGN_REFERENCES,
  ...CITY_BUSINESS_SIGN_REFERENCES,
  ...BUSINESS_SIGN_REFERENCES,
  {id:'spar',match:/^spar(?: express)?$/i,logo:'/assets/tirana-streets/signs/spar-logo.png',source:'https://spar.al/',background:'#ffffff',foreground:'#008844',crop:[74,96,1074,178]},
  {id:'mon-cheri',match:/^mon ch[eé]ri(?: caffee? ?shop| coffee(?: shop)?)?$/i,logo:'/assets/tirana-streets/signs/mon-cheri-logo.jpg',source:'https://toptani.com.al/en/content/132-mon-cheri',background:'#ffffff',foreground:'#222222',crop:null},
  {id:'mulliri',match:/mulliri/i,logo:'/assets/tirana-streets/signs/mulliri-logo.png',
   source:'https://mullirivjeter.al/',background:'#faf5eb',foreground:'#d91505',
   crop:[74,37,915,279]}
]);
export const signReferenceFor = text => {const name=String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ');return SIGN_REFERENCES.find(reference=>reference.match.test(name));};
export function referencedAdvertising(site,_storefronts){
 // No commercial identity or directional claim is inferred at authored sites.
 return {...site,name:'TIRANË',reference:'https://tirana.al/',
   placementAccuracy:'Authored neutral city-information panel; not a surveyed advertisement or official municipal sign'};
}
