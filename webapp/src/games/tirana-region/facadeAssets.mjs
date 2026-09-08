import {AD_BRANDS} from './facadeCore.mjs';
/** Standard glTF 2.0, metres, PBR, UVs and normals. No proprietary extensions. */
export function buildFacadeGltf(variant=0,advertImage=null){
 if(!Number.isInteger(variant)||!AD_BRANDS[variant])throw Error('Invalid facade variant');
 const parts=new Map();
 function quad(mat,pts,normal,uv=[[0,1],[1,1],[1,0],[0,0]]){if(!parts.has(mat))parts.set(mat,{p:[],n:[],u:[],i:[]});const g=parts.get(mat),s=g.p.length/3;pts.forEach((p,i)=>{g.p.push(...p);g.n.push(...normal);g.u.push(...uv[i]);});g.i.push(s,s+1,s+2,s,s+2,s+3);}
 function box(mat,x,y,z,w,h,d){const a=x-w/2,b=x+w/2,c=y-h/2,e=y+h/2,f=z-d/2,g=z+d/2;
  quad(mat,[[a,c,g],[b,c,g],[b,e,g],[a,e,g]],[0,0,1]);quad(mat,[[b,c,f],[a,c,f],[a,e,f],[b,e,f]],[0,0,-1]);quad(mat,[[b,c,g],[b,c,f],[b,e,f],[b,e,g]],[1,0,0]);quad(mat,[[a,c,f],[a,c,g],[a,e,g],[a,e,f]],[-1,0,0]);quad(mat,[[a,e,g],[b,e,g],[b,e,f],[a,e,f]],[0,1,0]);quad(mat,[[a,c,f],[b,c,f],[b,c,g],[a,c,g]],[0,-1,0]);}
 const colour=[[.14,.23,.2,1],[.35,.19,.15,1],[.16,.28,.21,1],[.15,.22,.28,1]][variant];
 const materials=[
  {name:'powder-coated-frame',pbrMetallicRoughness:{baseColorFactor:[.12,.16,.16,1],metallicFactor:.65,roughnessFactor:.44}},
  {name:'painted-awning',pbrMetallicRoughness:{baseColorFactor:colour,metallicFactor:0,roughnessFactor:.85}},
  {name:'pale-stripe',pbrMetallicRoughness:{baseColorFactor:[.84,.79,.66,1],metallicFactor:0,roughnessFactor:.84}},
  {name:'advert',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.72}},
  {name:'brushed-AC',pbrMetallicRoughness:{baseColorFactor:[.64,.68,.65,1],metallicFactor:.28,roughnessFactor:.6}},
  {name:'recess-shadow',pbrMetallicRoughness:{baseColorFactor:[.025,.048,.055,1],metallicFactor:.08,roughnessFactor:.83}}
 ];
 // Everything clears 2.6 m. No fake doorway or uncollidable street furniture.
 box(0,0,3.75,.11,5.35,1.42,.16);quad(3,[[-2.57,3.1075,.196],[2.57,3.1075,.196],[2.57,4.3925,.196],[-2.57,4.3925,.196]],[0,0,1]);
 for(let i=0;i<12;i++){const x=-2.475+i*.45;box(i%2?2:1,x,3.05,.43,.449,.10,.85);box(i%2?2:1,x,2.91,.82,.449,.22,.07);}
 // Upper balcony framing, slatted guardrail and a compact AC condenser.
 box(0,-.45,4.55,.37,2.85,.13,.69);box(0,-.45,5.26,.64,2.85,.045,.045);
 for(let i=0;i<=14;i++)box(0,-1.85+i*.2,4.94,.64,.023,.63,.023);
 box(4,1.91,4.83,.24,.94,.63,.40);box(5,1.91,4.83,.448,.77,.48,.025);
 for(let i=0;i<8;i++)box(4,1.91,4.63+i*.056,.47,.78,.022,.025);
 for(const x of [1.63,2.19])box(0,x,4.46,.21,.06,.10,.38);
 const buffers=[],bufferViews=[],accessors=[],meshes=[];let byteOffset=0;
 const add=(values,kind,type)=>{const typed=type===5123?new Uint16Array(values):new Float32Array(values);const raw=new Uint8Array(typed.buffer);const padding=(4-raw.length%4)%4;buffers.push(raw,new Uint8Array(padding));const view=bufferViews.length;bufferViews.push({buffer:0,byteOffset,byteLength:raw.length,target:kind==='SCALAR'?34963:34962});byteOffset+=raw.length+padding;const width=kind==='SCALAR'?1:Number(kind.slice(-1));const a={bufferView:view,componentType:type,count:values.length/width,type:kind};if(kind==='VEC3'){a.min=[0,1,2].map(i=>Math.min(...values.filter((_,j)=>j%3===i)));a.max=[0,1,2].map(i=>Math.max(...values.filter((_,j)=>j%3===i)));}accessors.push(a);return accessors.length-1;};
 for(const [material,g] of parts){const position=add(g.p,'VEC3',5126),normal=add(g.n,'VEC3',5126),uv=add(g.u,'VEC2',5126),indices=add(g.i,'SCALAR',5123);meshes.push({name:materials[material].name,primitives:[{attributes:{POSITION:position,NORMAL:normal,TEXCOORD_0:uv},indices,material}]});}
 const bytes=new Uint8Array(byteOffset);let at=0;for(const b of buffers){bytes.set(b,at);at+=b.length;}
 let binary='';for(const b of bytes)binary+=String.fromCharCode(b);const encoded=typeof btoa==='function'?btoa(binary):globalThis.Buffer.from(bytes).toString('base64');
 const gltf={asset:{version:'2.0',generator:'TonPlaygram original facade kit'},scene:0,scenes:[{nodes:meshes.map((_,i)=>i)}],nodes:meshes.map((_,i)=>({mesh:i})),meshes,materials,accessors,bufferViews,buffers:[{byteLength:bytes.length,uri:`data:application/octet-stream;base64,${encoded}`}],extras:{brand:AD_BRANDS[variant].id,accuracy:'Authored decorative modules, not measured shop facades',units:'metres',source:'Original geometry and advertising'}};
 if(advertImage){if(!/^data:image\/(png|jpeg);base64,/.test(advertImage))throw Error('Export requires embedded PNG/JPEG, not SVG');gltf.images=[{uri:advertImage}];gltf.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];gltf.textures=[{sampler:0,source:0}];materials[3].pbrMetallicRoughness.baseColorTexture={index:0};}
 return gltf;
}
