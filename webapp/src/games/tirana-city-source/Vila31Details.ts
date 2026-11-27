import type {ReferenceProfile} from './profiles.mjs';
import type {FacadeEdge} from './sourceCore.mjs';

type Wall=(edge:FacadeEdge,color:number,u:number,y:number,w:number,h:number,d:number,offset?:number)=>void;

/** Only the visible exterior palette and architectural motifs are reconstructed.
 * No roof/terrain volume, doorway behavior or collision is created here. */
export function vila31Details(p:ReferenceProfile,edges:FacadeEdge[],height:number,wall:Wall){
 if(p.style!=='vila-31-cultural')return false;
 const lime=0xc8ccab,peach=0xe4b99d,stone=0xb6aa90,stoneBand=0xc7bba2;
 const frame=0xdcc078,glass=0x354349,rail=0xe4e2d8;
 for(const e of edges){
  const band=(color:number,y:number,h:number,d:number,offset:number)=>wall(e,color,e.length/2,y,e.length,h,d,offset);
  band(p.trim,height-.26,.38,.30,.15);
  band(stone,.43,.67,.15,.035);
  if(e.length<3.4)continue;
  // Garden-facing elevations use sweeping bands and visible balcony rails;
  // the source edges stay intact even on stepped returns.
  const garden=e.nz>.48||e.nx>.81;
  const tone=e.x>-130?peach:lime;
  const floor=height/3;
  const inset=.40,usable=e.length-inset*2;
  const cells=Math.max(1,Math.min(8,Math.round(usable/2.95)));
  const pitch=usable/cells;
  band(tone,height*.65,height*.47,.042,.09);
  for(let row=0;row<3;row++){
   const y=floor*(row+.54);
   const w=Math.min(p.window*(garden?1.15:1),pitch-.38);
   const h=Math.min(garden?2.26:1.95,floor*.54);
   const deckY=y-h*.59;
   if(garden&&row>0){
    wall(e,p.trim,e.length/2,deckY,usable,.23,.85,.43);
    wall(e,rail,e.length/2,deckY+.77,usable,.048,.046,.88);
    wall(e,rail,e.length/2,deckY+.29,usable,.042,.042,.88);
    const spindles=Math.min(76,Math.ceil(usable/.32));
    for(let i=0;i<=spindles;i++)wall(e,rail,inset+i*usable/spindles,deckY+.53,.036,.43,.042,.88);
   }else if(row)band(p.trim,deckY,.15,.16,.12);
   for(let i=0;i<cells;i++){
    const u=inset+(i+.5)*pitch;
    wall(e,frame,u,y,w+.19,h+.19,.065,.19);
    wall(e,glass,u,y,w,h,.059,.24);
    wall(e,frame,u,y,.06,h,.039,.276);
    if(row===0&&garden){
     const pier=u-pitch/2+.05,pierW=Math.min(.50,pitch*.21);
     wall(e,stone,pier,y,pierW,h+.7,.20,.18);
     for(let k=0;k<9;k++)wall(e,stoneBand,pier,y-h/2-.20+k*(h+.3)/8,pierW,.044,.04,.30);
    }
   }
  }
 }
 return true;
}
