import {MATERIAL_TILES} from './textureSources.mjs';
/** Original glTF 2.0 assets. Meshes are shared by nodes; geometry and PBR images
 * are embedded so both games and the Blender exporter use identical assets. */
export const ASSET_IDS=Object.freeze(['culture-bay','bank-bay','civic-bay','gondola','station','belvedere']);
const PALETTE={limestone:[0xeee2ca,.84,0],brick:[0xe2c6b5,.89,0],ochre:[0xffe2bb,.82,0],metal:[0x637878,.43,.65],dark:[0x172831,.52,.2],glass:[0x507f91,.19,.55],blue:[0x39759b,.38,.38]};
const box=(m,x,y,z,w,h,d,rz=0)=>({m,p:[x,y,z],s:[w,h,d],rz});
const cyl=(m,x,y,z,r,h,rz=0)=>({m,p:[x,y,z],s:[r,h,r],rz,cylinder:true});
export function assetParts(id){
 const out=[],add=(...p)=>out.push(...p);
 if(id==='culture-bay'){
  add(box('limestone',0,4.9,.1,4,.6,1.8),box('dark',0,2.3,-.32,3.3,4.7,.12));
  for(const x of [-1.55,1.55])add(box('limestone',x,2.35,.25,.45,4.7,.68),box('limestone',x,.18,.25,.68,.36,.88));
  add(box('glass',0,2.2,-.22,2.5,4.2,.06),box('metal',0,2.2,-.13,.075,4.2,.07));
 }else if(id==='bank-bay'||id==='civic-bay'){
  const m=id==='bank-bay'?'brick':'ochre';
  add(box(m,0,2,0,3.4,4,.16),box('limestone',0,2,.13,1.7,2.9,.14),box('dark',0,2,.23,1.42,2.6,.07),box('glass',0,2,.28,1.25,2.4,.04));
  add(box('limestone',0,.52,.28,2.1,.18,.44),box('metal',0,2,.34,.07,2.45,.04),box('metal',0,2,.34,1.25,.07,.04));
 }else if(id==='gondola'){
  add(box('blue',0,.28,0,2.45,.54,1.85),box('limestone',0,2.04,0,2.45,.25,1.85),box('dark',0,.53,0,2.31,.1,1.71));
  for(const x of [-1.15,1.15])for(const z of [-.86,.86])add(box('dark',x,1.23,z,.1,1.52,.1));
  for(const z of [-.88,.88]){add(box('glass',0,1.22,z,2.15,1.35,.055));for(const x of [-1.1,0,1.1])add(box('metal',x,1.23,z,.06,1.52,.07));}
  for(const x of [-1.19,1.19])add(box('glass',x,1.21,0,.05,1.35,1.52));
  add(cyl('metal',0,2.7,0,.09,1.16),box('metal',0,3.23,0,.28,.22,.65),box('limestone',0,.59,0,1.65,.13,.58));
 }else if(id==='station'){
  add(box('limestone',0,.3,0,18,.6,13),box('limestone',0,3.9,-3.5,18,7.2,6),box('blue',0,7.7,-3.5,19,.45,7));
  for(let x=-7;x<=7;x+=2.8)add(box('glass',x,4.8,-.43,2.3,3.4,.09),box('metal',x,4.8,-.33,.055,3.5,.07));
  for(const x of [-5,5])add(cyl('limestone',x,3.4,3,.65,6.8));
  add(box('blue',0,6.85,3,12,.45,12),box('metal',0,6.25,3,9,.8,10),cyl('metal',0,5.8,5,2.2,.35));
 }else if(id==='belvedere'){
  add(box('limestone',0,10,0,15,20,12),cyl('glass',0,24,0,9,8),cyl('metal',0,28.25,0,9.5,.5),cyl('limestone',0,19.8,0,9.4,.5));
  for(let y=3;y<20;y+=3.1)for(const x of [-5,0,5])for(const z of [-6.06,6.06])add(box('glass',x,y,z,2.6,1.8,.07));
  for(let i=0;i<20;i++){const a=i*Math.PI/10;add(cyl('metal',8.97*Math.cos(a),24,8.97*Math.sin(a),.085,8));}
 }else throw Error('Unknown original glTF asset');
 return out;
}
function geometry(cylinder){
 const p=[],n=[],uv=[],index=[];
 const face=(vertices,normal)=>{const start=p.length/3;vertices.forEach((v,i)=>{p.push(...v);n.push(...normal);uv.push(i===0||i===3?0:1,i<2?0:1);});index.push(start,start+1,start+2,start,start+2,start+3);};
 if(!cylinder){
  face([[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]],[1,0,0]);
  face([[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]],[-1,0,0]);
  face([[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]],[0,1,0]);
  face([[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]],[0,-1,0]);
  face([[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[-.5,-.5,.5]],[0,0,1]);
  face([[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,-.5,-.5]],[0,0,-1]);
 }else{
  const count=16;
  for(let i=0;i<count;i++){
   const a=i*2*Math.PI/count,b=(i+1)*2*Math.PI/count,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
   face([[ca,-.5,sa],[ca,.5,sa],[cb,.5,sb],[cb,-.5,sb]],[Math.cos((a+b)/2),0,Math.sin((a+b)/2)]);
   for(const y of [-.5,.5]){
    const s=p.length/3,v=[[0,y,0],[ca,y,sa],[cb,y,sb]];if(y>0)v.reverse();
    for(const q of v){p.push(...q);n.push(0,Math.sign(y),0);uv.push(q[0]/2+.5,q[2]/2+.5);}index.push(s,s+1,s+2);
   }
  }
 }
 return {p,n,uv,index};
}
const base64=bytes=>{
 if(typeof Buffer!=='undefined')return Buffer.from(bytes).toString('base64');
 let text='';for(let i=0;i<bytes.length;i++)text+=String.fromCharCode(bytes[i]);return btoa(text);
};
export function buildGltfAsset(id){
 const parts=assetParts(id),names=[...new Set(parts.map(p=>p.m))],chunks=[],views=[],accessors=[];let length=0;
 const attribute=(array,type,componentType=5126)=>{
  const typed=componentType===5126?new Float32Array(array):new Uint16Array(array),bytes=new Uint8Array(typed.buffer);
  const view=views.length;views.push({buffer:0,byteOffset:length,byteLength:bytes.length});chunks.push(bytes);length+=bytes.length;
  if(length%4){const padding=new Uint8Array(4-length%4);chunks.push(padding);length+=padding.length;}
  const size={SCALAR:1,VEC2:2,VEC3:3}[type],a={bufferView:view,componentType,count:array.length/size,type};
  if(type==='VEC3'){a.min=[0,1,2].map(k=>Math.min(...array.filter((_,i)=>i%3===k)));a.max=[0,1,2].map(k=>Math.max(...array.filter((_,i)=>i%3===k)));}
  accessors.push(a);return accessors.length-1;
 };
 const shapes=[false,true].map(c=>{const g=geometry(c);return {attributes:{POSITION:attribute(g.p,'VEC3'),NORMAL:attribute(g.n,'VEC3'),TEXCOORD_0:attribute(g.uv,'VEC2')},indices:attribute(g.index,'SCALAR',5123)};});
 const images=[],textures=[],samplers=[{wrapS:10497,wrapT:10497,magFilter:9729,minFilter:9987}];
 const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
 const materials=names.map(name=>{const [hex,r,m]=PALETTE[name],pbr={baseColorFactor:[linear((hex>>16&255)/255),linear((hex>>8&255)/255),linear((hex&255)/255),name==='glass'?.36:1],roughnessFactor:r,metallicFactor:m};
  if(MATERIAL_TILES[name]){const i=images.length;images.push({uri:MATERIAL_TILES[name]});textures.push({source:i,sampler:0});pbr.baseColorTexture={index:i};}return {name,pbrMetallicRoughness:pbr,...(name==='glass'?{alphaMode:'BLEND',doubleSided:true}:{})};});
 const meshes=names.flatMap((name,mi)=>shapes.map(shape=>({name,primitives:[{...shape,material:mi,mode:4}]})));
 const nodes=parts.map((p,i)=>({name:`${id}:${p.m}:${i}`,mesh:names.indexOf(p.m)*2+(p.cylinder?1:0),translation:p.p,scale:p.s,rotation:[0,0,Math.sin(p.rz/2),Math.cos(p.rz/2)]}));
 const buffer=new Uint8Array(length);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
 return {asset:{version:'2.0',generator:'TonPlaygram original civic/Dajti glTF authoring'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials,images,textures,samplers,buffers:[{byteLength:length,uri:`data:application/octet-stream;base64,${base64(buffer)}`}],bufferViews:views,accessors,extras:{units:'metres',provenance:'Original approximate architecture; not a scan. Textures authored locally.'}};
}
