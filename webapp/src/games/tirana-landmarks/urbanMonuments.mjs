/** Original, photo-informed sculptures, never scans of the works. Map anchors
 * are rounded OSM coordinates; all dimensions/yaw below are visual estimates. */
export const URBAN_MONUMENTS=Object.freeze([
 {id:'sulejman-pasha',name:'Sulejman Pasha',lat:41.32832,lon:19.82165,x:238.247,z:-91.2824,yaw:-.45,plinth:{w:1.8,d:1.8,h:.3},
  source:'https://tirana.al/pika-interesi/shtatorja-e-sulejman-pashes',mapSource:'https://www.openstreetmap.org/node/6442256741',artist:'Maksim Shurdhi',year:2000},
 {id:'unknown-partisan',name:'Partizani i Panjohur',lat:41.3282,lon:19.82191,x:259.9818,z:-77.924,yaw:1.15,plinth:{w:2.15,d:1.65,h:3.15},
  source:'https://tirana.al/pika-interesi/monumenti-i-partizanit-te-panjohur',mapSource:'https://www.openstreetmap.org/node/3006044550',artist:'Andrea Mano',year:1949},
 {id:'ismail-qemali',name:'Ismail Qemali',lat:41.320574,lon:19.820227,x:119.2907,z:771.00232,yaw:-Math.PI/2,plinth:{w:1.25,d:1.25,h:.85},
  source:'https://commons.wikimedia.org/wiki/File:Ismail_Qemal_Vlora_statue.jpg',mapSource:'https://www.openstreetmap.org/node/4647394950',artist:'Odhise Paskali',year:1982}
].map(Object.freeze));
export function urbanMonumentSolids(){return URBAN_MONUMENTS.flatMap(s=>{
 const c=Math.cos(s.yaw),n=Math.sin(s.yaw),w=s.plinth.w/2,d=s.plinth.d/2;
 const base={id:'monument:'+s.id,h:s.plinth.h,minY:0,p:[[-w,-d],[w,-d],[w,d],[-w,d]].map(([x,z])=>[s.x+x*c+z*n,s.z-x*n+z*c]),collisionSource:s.mapSource};
 if(s.id!=='ismail-qemali')return [base];
 return [base,{id:base.id+':backdrop',h:3.6,minY:0,p:[[-1.1,.48],[1.1,.48],[1.1,.78],[-1.1,.78]].map(([x,z])=>[s.x+x*c+z*n,s.z-x*n+z*c]),collisionSource:s.mapSource}];
});}
