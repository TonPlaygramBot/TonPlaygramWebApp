import { LANDMARK_DATA } from './landmarkData.mjs';

/** Exterior interpretations. Footprints are mapped; untagged dimensions, exact
 * bay counts, finishes and terrain elevations still require a measured survey. */
export const LANDMARK_CATALOG = {
 'delijorgji': {name:'Kompleksi Delijorgji',style:'delijorgji',category:'residential',color:0xd3c7ad,trim:0xf1eee2,source:'https://duashpi.al/en/property/675dd193aad07cd14402ace9/11-apartment-for-sale-at-delijorgji-complex.html',date:'2024-12-14 listing; capture undated',features:'Mapped courtyard blocks; repeated balconies and pale facade bands. Selected core buildings, not the entire neighbourhood.'},
 'grand': {name:'Pallati Grand · ish-Tregu Elektrik',style:'grand',category:'residential',color:0xcbd0c6,trim:0xdce3ac,source:'https://wikimapia.org/14185230/sq/Kompleksi-Grand',date:'Undated exterior',features:'Nine mapped levels; pale green bands, pink window frames, curved balcony edges and timber rooftop pergolas.'},
 'studenti': {name:'Qyteti Studenti',style:'studenti',category:'university',color:0xdcd9c7,trim:0xf1eee3,source:'https://www.openstreetmap.org/way/234270352',date:'2026-09-10 OSM snapshot',features:'Separate mapped dormitories retain open courts. Building-specific renovation colours and elevations remain unverified.'},
 'air-albania': {name:'Air Albania · Arena Kombëtare',style:'stadium',category:'stadium',color:0x344653,trim:0xe0393e,source:'https://www.archea.it/en/progetto/new-national-stadium-of-albania/',date:'2024-09-05 photograph',photo:'air-albania-2024.jpg',credit:'BBB2021 · CC BY-SA 4.0',photoSource:'https://commons.wikimedia.org/wiki/File:Air_Albania_Stadium_2024.jpg',features:'Open mapped stadium ring and separate 112 m Marriott tower; red fins over blue glazing. Seating detail is simplified.'},
 'mangalem': {name:'Kompleksi Mangalem 21',style:'mangalem',category:'residential',color:0xeee9d9,trim:0x179d9c,source:'https://www.oma.com/projects/mangalem-21',date:'Completed 2023; photograph undated',features:'Six mapped building outlines with coloured window grids. OMA records a 27 m site rise; local terrain and stepped floor heights are not surveyed.'},
 'teg': {name:'TEG · Tirana East Gate',style:'teg',category:'mall',color:0xd4d1c6,trim:0xecece3,source:'https://www.teg.al/',date:'2016-10-28 entrance photograph',photo:'teg-2016.jpg',credit:'Kj1595 · CC BY-SA 4.0',photoSource:'https://commons.wikimedia.org/wiki/File:TEG_Tirana_2016.jpg',features:'Mapped retail footprint; pale cladding, dark bands and glazed entrance canopy on V struts. Entrance detail uses dated imagery.'},
 'qtu': {name:'QTU · Qendra Tregtare Univers',style:'qtu',category:'mall',color:0xdddcd1,trim:0xc13b41,source:'https://balfin.al/industries/asset-management/',date:'Wikimapia exterior; capture undated',features:'Two mapped levels, red diamond-pattern upper facade and ground-floor glazing. Seasonal star decorations are omitted.'},
 'ring': {name:'Tirana Ring Center',style:'ring',category:'mall',color:0x395c69,trim:0x36464b,source:'https://ring.al/',date:'Wikimapia exterior; capture undated',features:'Blue-green curtain wall, dark grid and projecting upper band. Exact stepped elevations remain estimated.'},
 'toptani': {name:'Toptani Shopping Center',style:'toptani',category:'mall',color:0xd9ded8,trim:0x95aeb5,source:'https://toptani.com.al/en/',date:'Operator exterior; capture undated',features:'Angular mapped corners, pale outer panels and tall glazed facade openings.'},
 'sky': {name:'Sky Tower',style:'sky',category:'hotel',color:0xd9d7c8,trim:0xece9de,source:'https://skyhotel.al/',date:'Operator page retrieved 2026-09-10',features:'Mapped 76 m, 21-level tower; horizontal glazing and rooftop panoramic crown. Crown dimensions estimated.'},
 'sheraton': {name:'Ish-Sheraton · Mak Albania',style:'sheraton',category:'hotel',color:0xe0ded2,trim:0xeeece1,source:'https://commons.wikimedia.org/wiki/File:MAK_Hotel_Tirana.jpg',date:'2019-08-19',photo:'mak-hotel-2019.jpg',credit:'Andrew Milligan sumo · CC BY 2.0',features:'Former Sheraton: dark curved glazing over a white podium. Historical 2019 exterior; subsequent redevelopment is not represented.'},
 'rogner': {name:'Rogner Hotel Tirana',style:'rogner',category:'hotel',color:0xe3d3af,trim:0xf0e8cf,source:'https://www.hotel-europapark.com/',date:'2019-08-19',photo:'rogner-2019.jpg',credit:'Andrew Milligan sumo · CC BY 2.0',photoSource:'https://commons.wikimedia.org/wiki/File:Rogner_Hotel,_Tirana_(49600188791).jpg',features:'Retained curved footprint and balcony rhythm facing the garden.'},
 'taivani': {name:'Taivani / Taiwan · Shatërvani',style:'taivani',category:'casino',color:0xd8cfb5,trim:0xe8e1ce,source:'https://commons.wikimedia.org/wiki/File:Taiwan_center_in_Tirana.JPG',date:'2014-07-12',photo:'taivani-2014.jpg',credit:'Avi1111 / Dr. Avishai Teicher · CC BY-SA 4.0',features:'Casino complex plus the actual adjacent pond outline and three mapped fountain positions.'},
 'plaza': {name:'The Plaza · TID Tower',style:'plaza',category:'hotel',color:0xd7d4c8,trim:0xe8e6db,source:'https://www.plazatirana.com/',date:'Mapped 85 m; facade interpretation',features:'Pale deep window grid on the mapped tower footprint. Full circle-to-square transformation remains simplified.'},
 'congress': {name:'Pallati i Kongreseve',style:'congress',category:'government',color:0xc1ab92,trim:0xe2d9c4,height:21,source:'https://tirana.al/pika-interesi/pallati-i-kongreseve-6931',date:'City exterior; uploaded July 2019',features:'Upper glass band and branching pale supports. City gives a height range of 18–23 m; 21 m model is an estimate.'}
};

export const LANDMARK_PROFILES = Object.fromEntries(LANDMARK_DATA.buildings.map((b,index)=>{
 const site=LANDMARK_CATALOG[b.site];
 return [b.id,{...site,name:b.tags.name||site.name,site:b.site,floor:site.style==='toptani'?6:3.2,window:1.7,
   height:site.height??b.h,photo:site.photo??null,credit:site.credit??'Visual reference only; no source image redistributed',
   ...(['467502142','467502143'].includes(b.id)?{style:'studenti-renovated',source:'https://shqiptarja.com/lajm/perfundon-rikonstruktimi-i-godines-27-ne-qytet-studenti-veliaj-ne-vere-do-nderhyjme-ne-dhoma',date:'2019-04-24 article',features:'White balconies with red recesses; photographed shared 26/27 entrance. Other dormitories remain neutral.'}:{}),
   // Colours are palette interpretations, not claimed per-wing measurements.
   ...(site.style==='mangalem'?{color:[0xefe9d7,0x1ba9b5,0x9fb66c,0xe8e3db,0xdf8878,0xe3cba8][index%6],trim:[0xc94a88,0xf2b94f,0x728895][index%3]}:{})}];
}));
export const LANDMARK_REPLACED_IDS = new Set(LANDMARK_DATA.buildings.flatMap(b=>[b.id,...(b.replaces??[])]));

export function landmarkBuildings(world) {
 const extra=new Map(LANDMARK_DATA.buildings.map(b=>[b.id,b]));
 // Retain in-map footprints exactly so visual walls and existing colliders agree.
 const result=world.buildings.map(b=>({...extra.get(b.id),...b}));
 const existing=new Set(result.map(b=>b.id));
 return [...result,...LANDMARK_DATA.buildings.filter(b=>!existing.has(b.id))];
}
