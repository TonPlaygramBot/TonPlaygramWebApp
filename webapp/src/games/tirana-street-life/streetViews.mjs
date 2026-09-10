import {STREET_LIFE} from './registry.mjs';
const front=(id,name)=>{const f=STREET_LIFE.storefronts.find(f=>f.id===id);return {id,name,x:f.x,z:f.z,y:2,yaw:f.yaw,distance:20,context:70,source:`https://www.openstreetmap.org/${id}`};};
const fuel=STREET_LIFE.fuel.find(f=>/Bolv/.test(f.name));
const bus=STREET_LIFE.stops.find(f=>f.name==='Piramida'&&f.shelter);
export const STREET_VIEWS=[
 {id:'statue',name:'Skënderbeu · monument',x:-20.897,z:-30.056,y:5.4,yaw:.6,distance:22,context:90,photo:'skanderbeg-side.jpg',credit:'Fingalo · 2007 · CC BY-SA 2.0 DE',source:'https://commons.wikimedia.org/wiki/File:07Tirana_Skenderbeg-Denkmal02.jpg'},
 {id:'boulevard',name:'Bulevardi Dëshmorët e Kombit',x:111,z:600,y:10,yaw:.17,distance:65,context:155,photo:'boulevard-mature-trees.jpg',credit:'Ridiculopathy · 2022 · CC BY-SA 4.0',source:'https://commons.wikimedia.org/wiki/File:D%C3%ABshmor%C3%ABt_e_Kombit_Boulevard_aka_Bulevardi_D%C3%ABshmor%C3%ABt_e_Kombit,_Tirana,_Albania.jpg'},
 {id:'bashkia',name:'Bashkia · square gardens',x:41,z:36,y:6,yaw:-.7,distance:63,context:135,source:'https://51n4e.com/projects/skanderbeg-square/'},
 {id:'opera',name:'Opera – Sahati – Ushtari i Panjohur',x:171,z:-117,y:7,yaw:-.8,distance:82,context:160,source:'https://51n4e.com/projects/skanderbeg-square/'},
 front('node/4437922190','Mulliri · Rruga e Kavajës'),
 front('node/3878110461','Sophie · Rruga Papa Gjon Pali II'),
 front('node/6882349785','Shops · Rruga Myslym Shyri'),
 {id:'fuel',name:'Bolv-Oil · Hoxha Tahsin',x:fuel.x,z:fuel.z,y:2,yaw:fuel.yaw,distance:21,context:65,source:`https://www.openstreetmap.org/${fuel.id}`},
 {id:'bus',name:'Piramida · bus stop',x:bus.x,z:bus.z,y:1.5,yaw:bus.yaw,distance:17,context:80,source:`https://www.openstreetmap.org/${bus.id}`}
];
