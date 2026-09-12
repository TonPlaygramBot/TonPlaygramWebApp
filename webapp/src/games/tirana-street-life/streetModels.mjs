/** Original, metre-sized street furniture. Category styling is approximate;
 * source names/positions do not imply a surveyed shopfront or brand logo. */
const C={metal:0x333c3d,light:0xd7d8ce,wood:0x805634,glass:0x688186,stone:0xb8b5a8,red:0x852f33};
export function buildStreetModel(site,type){
 const parts=[],signs=[];
 const box=(color,x,y,z,w,h,d)=>parts.push({shape:color===C.glass?'glass':'box',color,p:[x,y,z],s:[w,h,d]});
 const pole=(x,y,z,h,r=.035,color=C.metal)=>parts.push({shape:'cylinder',color,p:[x,y+h/2,z],s:[r,h,r]});
 const sign=(text,x,y,z,w,h,bg='#263b39',fg='#fff6dd',yaw=0)=>signs.push({text,p:[x,y,z],s:[w,h,1],bg,fg,yaw});
 const bench=(x,z,width=1.7)=>{
  for(let i=0;i<4;i++)box(C.wood,x,.49,z+i*.105,width,.065,.075);
  for(let i=0;i<3;i++)box(C.wood,x,.74+i*.13,z-.065,width,.085,.055);
  for(const side of [-1,1]){pole(x+side*width*.36,.05,z+.18,.4,.045);pole(x+side*width*.36,.1,z-.06,.99,.035);}
 };
 if(type==='storefront'&&['building-sign','fuel-sign'].includes(site.kind)){
  if(site.kind==='fuel-sign'){
   for(const x of [-site.width*.36,site.width*.36])pole(x,.03,.75,site.mountHeight,.055);
   box(C.metal,0,site.mountHeight,.76,site.width+.12,site.signHeight+.10,.06);
  }
  sign(site.name,0,site.mountHeight,.8,site.width,site.signHeight,'#ffffff','#202526');
 }else if(type==='storefront'||type==='store-detail'){
  const w=site.width,food=['cafe','restaurant','bar','pub','fast_food'].includes(site.kind),mulliri=/mulliri/i.test(site.name),sophie=/sophie/i.test(site.name);
  const accent=mulliri?C.red:food?0x4d4d3b:0x566365;
  // Shallow external bays keep the mapped footprint and entrances intact.
  box(C.metal,0,1.5,.015,w,2.9,.075);
  box(C.glass,-w*.17,1.45,.075,w*.56,2.65,.045);
  box(0x233434,w*.3,1.4,.07,w*.27,2.6,.045);
  for(const x of [-w/2+.06,w*.14,w/2-.06])box(C.light,x,1.5,.105,.07,2.9,.08);
  box(C.light,0,.1,.14,w,.13,.23);box(C.metal,0,2.92,.13,w,.14,.17);
  pole(w*.19,1.02,.16,.56,.016,C.light);
  box(accent,0,3.21,.11,w+.05,.48,.2);
  sign(site.name,0,3.21,.218,w-.15,.36,mulliri?'#45372f':sophie?'#ded7c7':food?'#303d36':'#536061',mulliri?'#f26558':sophie?'#333735':'#fff6dd');
  const tradeStart=parts.length;
  // Universal barber pole: a trade symbol, independent of business artwork.
  if(site.kind==='hairdresser'||site.shop==='hairdresser'||/barber|berber|hair/i.test(site.name)){
   const x=Math.max(.25,w/2-.25);pole(x,1.8,.35,.88,.105,C.light);
   for(let j=0;j<8;j++)box(j%2?0xb3212b:0x285b98,x,1.86+j*.105,.46,.18,.045,.02);
   for(const y of [1.77,2.73])box(C.metal,x,y,.35,.25,.10,.26);
  }
  if(site.kind==='bakery'||site.shop==='bakery'){
   box(C.wood,0,.70,.15,w*.7,.08,.20);
   for(let j=0;j<5;j++)box(0xb88b4c,-w*.29+j*w*.14,.85,.19,.19,.14,.08);
  }
  if(site.kind==='fast_food'){
   box(0x272e2d,w*.29,1.8,.27,Math.min(.75,w*.23),.90,.09);
   for(let j=0;j<5;j++)box(j%2?0xe2af53:0xd7d8ce,w*.29,2.11-j*.14,.325,Math.min(.58,w*.18),.025,.01);
  }
  if(site.kind==='cafe'){
   for(let j=0;j<3;j++){pole(-.3+j*.3,.78,.23,.12,.05,C.light);box(C.wood,-.3+j*.3,.77,.23,.17,.025,.15);}
  }
  const tradeEnd=parts.length;
  // Openable awnings on café/bakery models: not a claim about branch fabric.
  if(food||site.shop==='bakery'||site.kind==='bakery'){
   parts.push({shape:'box',color:accent,p:[0,2.78,.65],s:[w-.06,.075,1.05],pitch:.12});
   box(accent,0,2.69,1.15,w-.06,.18,.045);
   for(const x of [-w*.43,w*.43])box(C.metal,x,2.76,.61,.035,.035,1.05);
  }else{
   // Stock silhouettes behind the display glass, never invented shop copy.
   for(let i=0;i<4;i++)box(i%2?C.wood:C.light,-w*.39+i*w*.11,.6+(i%2)*.13,.105,w*.07,.38+(i%2)*.25,.06);
  }
  if(site.terrace){
   for(const side of [-1,1]){
    const x=side*Math.min(1,w*.25),z=2.03;
    parts.push({shape:'cylinder',color:C.wood,p:[x,.76,z],s:[.43,.07,.43]});pole(x,.08,z,.66,.045);
    for(const dz of [-.7,.7]){box(C.wood,x,.47,z+dz,.48,.06,.44);box(C.wood,x,.75,z+dz+Math.sign(dz)*.17,.48,.28,.045);for(const sx of [-.19,.19])pole(x+sx,.05,z+dz,.4,.025);}
   }
  }
  if(type==='store-detail'){parts.splice(tradeEnd);parts.splice(0,tradeStart);signs.length=0;}
 }else if(type==='stop'){
  pole(0,.05,.12,2.7,.045,C.light);box(0x21578a,0,2.35,.13,.58,.76,.08);
  sign('BUS',0,2.46,.18,.48,.25,'#21578a');
  sign(site.name,0,2.16,.18,.53,.21,'#21578a');
  if(site.shelter){
   for(const x of [-1.75,1.75]){pole(x,.05,-1.23,2.42,.045);pole(x,.05,-.15,2.39,.045);}
   box(C.metal,0,2.43,-.71,3.72,.13,1.7);
   box(C.light,0,2.51,-.71,3.52,.055,1.6);
   box(C.glass,0,1.32,-1.24,3.4,2.05,.035);
   for(const x of [-1.75,1.75])box(C.glass,x,1.33,-.75,.035,2,1);
   for(const y of [.45,1.7])box(C.light,0,y,-1.215,3.42,.03,.015);
   sign(site.name,0,2.43,.16,3.25,.14,'#333c3d');
  }
  if(site.bench)bench(0,-1.02);
 }else if(type==='fuel'){
  const bolv=/bolv/i.test(site.name),accent=bolv?0x2e6650:C.red;
  if(site.canopy){
   box(C.light,0,4.15,0,site.width,.28,site.depth);
   box(accent,0,4.24,site.depth/2+.008,site.width,.18,.04);
   for(const side of [-1,1]){
    const x=side*site.width*.29;
    box(C.light,x,2,0,.23,4,.23);box(accent,x,.5,0,.25,.8,.25);
    box(C.stone,x,.12,0,1.45,.24,Math.min(1.15,site.depth*.35));
    box(C.light,x,.89,0,.7,1.35,.5);box(accent,x,1.22,.26,.66,.52,.035);
    box(0x202b2b,x,1.35,.282,.4,.21,.035);
    // Hoses have no invented live prices or fuel specifications.
    for(const dx of [-.45,.45]){pole(x+dx,.25,0,1.2,.025,0x182222);box(C.metal,x+dx,1.45,0,.08,.19,.08);}
   }
   sign(site.name,0,4.22,site.depth/2+.035,Math.min(4.5,site.width-.35),.21,bolv?'#f0f1e9':'#832c32',bolv?'#24694c':'#ffffff');
  }else{
   // Source point only: a small station identity pylon, not an invented forecourt.
   box(C.metal,0,1.4,0,.12,2.8,.12);box(C.light,0,2.55,0,1.8,.55,.12);
   sign(site.name,0,2.55,.071,1.65,.42,'#f0f1e9','#333c3d');
  }
 }else if(type==='advertising'){
  for(const x of [-1.12,1.12])pole(x,.05,0,3.5,.065);
  box(C.metal,0,3,0,3.55,1.9,.16);
  for(const yaw of [0,Math.PI])sign(site.name||'TIRANË',0,3,yaw?-.091:.091,3.4,1.76,/mulliri/i.test(site.name||'')?'#faf5eb':'#97363c','#faf2da',yaw);
  for(const x of [-1.3,1.3]){box(C.metal,x,4.02,.12,.05,.28,.4);box(C.light,x,3.99,.31,.38,.07,.17);}
 }
 return {id:site.id,x:site.x,z:site.z,yaw:site.yaw||0,type,parts,signs};
}

/** Spatial bucket queries cap geometry by proximity, not source ordering. */
export function nearbyIndex(items,cellSize=64){
 const bins=new Map();items.forEach((item,order)=>{const k=`${Math.floor(item.x/cellSize)},${Math.floor(item.z/cellSize)}`;if(!bins.has(k))bins.set(k,[]);bins.get(k).push({item,order});});
 return (viewer,radius,limit)=>{
  const hits=[];
  for(let x=Math.floor((viewer.x-radius)/cellSize);x<=Math.floor((viewer.x+radius)/cellSize);x++)for(let z=Math.floor((viewer.z-radius)/cellSize);z<=Math.floor((viewer.z+radius)/cellSize);z++)for(const v of bins.get(`${x},${z}`)||[]){const d=Math.hypot(v.item.x-viewer.x,v.item.z-viewer.z);if(d<radius)hits.push({...v,d});}
  return hits.sort((a,b)=>a.d-b.d||a.order-b.order).slice(0,limit).map(h=>h.item);
 };
}
