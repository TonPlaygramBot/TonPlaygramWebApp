import * as T from 'three';
/** Use explicit source finishes before the neutral, estimated game palette. */
export function sourceBuildingColour(b:any){
 const value=String(b.tags?.['building:colour']||'').trim().toLowerCase();
 if(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(value)||Object.hasOwn(T.Color.NAMES,value))return new T.Color(value);
 const material=b.tags?.['building:material'];
 const finishes:Record<string,number>={brick:0xa57361,stone:0xc7bca5,concrete:0xb9b8ae,glass:0x557886,metal:0x9babae,steel:0x9ba2a5};
 if(finishes[material])return new T.Color(finishes[material]);
 const seed=Array.from(String(b.id)).reduce((n,c)=>n+c.charCodeAt(0),0);
 return new T.Color([0xcbbfa8,0xcebea9,0xc3c4b9,0xd0bfa7,0xc2b7a8][seed%5]);
}
export function firstWindowHeight(b:any){
 const t=b.tags||{};
 const education=['school','kindergarten','university','college'].includes(t.building)||['school','kindergarten','university','college'].includes(t.amenity);
 return Math.max((b.minHeight||0)+1.55,education||b.h<4.5?1.55:4.7);
}
