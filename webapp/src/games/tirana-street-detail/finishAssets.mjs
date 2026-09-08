/** Original material study, not a photographic survey. Same SVG source is
 * rasterised into core-glTF PNG textures in the game and by the export tool. */
export function finishSVG(channel='color',size=2048){
  if(!['color','normal','orm'].includes(channel)||![128,512,1024,2048].includes(size))throw Error('Invalid finish map');
  let seed=8317;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const base=channel==='color'?'#c4c1b8':channel==='normal'?'#8080ff':'#ffdb00';
  let art='';
  for(let i=0;i<260;i++){
    const x=(rand()*1024).toFixed(2),y=(rand()*1024).toFixed(2),r=(.7+rand()*2.8).toFixed(2);
    const color=channel==='color'?'#565850':channel==='normal'?'#8290f7':'#eed000';
    art+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${channel==='color'?'.15':'.55'}"/>`;
  }
  for(let y=0;y<1024;y+=256){
    const x=(y/256%2)*512;
    if(channel==='color')art+=`<path d="M0 ${y}h1024M${x} ${y}v256" stroke="#807d73" stroke-width="2" opacity=".3"/><path d="M0 ${y+3}h1024" stroke="#e1ded6" stroke-width="2" opacity=".6"/>`;
    else if(channel==='normal')art+=`<path d="M0 ${y}h1024" stroke="#8074fa" stroke-width="3"/><path d="M0 ${y+3}h1024" stroke="#808cfa" stroke-width="3"/>`;
    else art+=`<path d="M0 ${y}h1024M${x} ${y}v256" stroke="#bded00" stroke-width="3"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${base}"/>${art}</svg>`;
}
export function bicycleSVG(){return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="512" viewBox="0 0 256 512"><g fill="none" stroke="#f6f3e8" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="324" r="43"/><circle cx="196" cy="324" r="43"/><path d="m60 324 55-84 33 84H60l119-67 17 67m-92-100h40m28 30 11-28h33"/></g></svg>`;}
export function buildFinishGltf(images={}){
  const list=['color','normal','orm'];
  for(const key of Object.keys(images))if(!list.includes(key)||!/^data:image\/png;base64,/.test(images[key]))throw Error('Core glTF requires PNG maps');
  const materials=[
    {name:'Tirana plaster PBR',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:1}},
    {name:'Tirana precast concrete PBR',pbrMetallicRoughness:{baseColorFactor:[.85,.85,.83,1],metallicFactor:0,roughnessFactor:1}},
    {name:'Reflective collar',pbrMetallicRoughness:{baseColorFactor:[.89,.87,.76,1],metallicFactor:0,roughnessFactor:.45}}
  ];
  const pos=[],normal=[],uv=[],index=[];
  const quad=(p,n,t)=>{const start=pos.length/3;p.forEach((a,i)=>{pos.push(...a);normal.push(...n[i]);uv.push(...t[i]);});index.push(start,start+1,start+2,start,start+2,start+3);};
  // Chamfered round concrete post with dimensions shared by the collision plan.
  const levels=[[0,.17],[.69,.17],[.78,.135]],segments=16;
  for(let j=0;j<2;j++)for(let k=0;k<segments;k++){
    const a=k/segments*Math.PI*2,b=(k+1)/segments*Math.PI*2,[y0,r0]=levels[j],[y1,r1]=levels[j+1],slope=(r0-r1)/(y1-y0),len=Math.hypot(1,slope);
    const n=t=>[Math.sin(t)/len,slope/len,Math.cos(t)/len],p=(t,y,r)=>[Math.sin(t)*r,y,Math.cos(t)*r];
    quad([p(a,y0,r0),p(b,y0,r0),p(b,y1,r1),p(a,y1,r1)],[n(a),n(b),n(b),n(a)],[[k/segments,y0],[ (k+1)/segments,y0],[(k+1)/segments,y1],[k/segments,y1]]);
  }
  for(const [y,r,up] of [[0,.17,-1],[.78,.135,1]])for(let k=0;k<segments;k++){
    const a=k/segments*Math.PI*2,b=(k+1)/segments*Math.PI*2,start=pos.length/3;
    const points=[[0,y,0],[Math.sin(a)*r,y,Math.cos(a)*r],[Math.sin(b)*r,y,Math.cos(b)*r]];
    if(up<0)points.reverse();
    points.forEach(p=>{pos.push(...p);normal.push(0,up,0);uv.push(p[0]+.5,p[2]+.5);});index.push(start,start+1,start+2);
  }
  const chunks=[],bufferViews=[],accessors=[];let offset=0;
  const add=(data,type,components,shape)=>{const bytes=new Uint8Array(data.buffer),padding=(4-bytes.length%4)%4;bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});chunks.push(bytes,new Uint8Array(padding));offset+=bytes.length+padding;
    const a={bufferView:bufferViews.length-1,componentType:type,count:data.length/components,type:shape};
    if(shape==='VEC3'){a.min=[0,1,2].map(i=>Math.min(...data.filter((_,k)=>k%3===i)));a.max=[0,1,2].map(i=>Math.max(...data.filter((_,k)=>k%3===i)));}accessors.push(a);return accessors.length-1;};
  const p=add(new Float32Array(pos),5126,3,'VEC3'),n=add(new Float32Array(normal),5126,3,'VEC3'),t=add(new Float32Array(uv),5126,2,'VEC2'),i=add(new Uint16Array(index),5123,1,'SCALAR');
  const data=new Uint8Array(offset);let at=0;for(const b of chunks){data.set(b,at);at+=b.length;}
  let binary='';for(const byte of data)binary+=String.fromCharCode(byte);
  const g={asset:{version:'2.0',generator:'TonPlaygram original street-detail kit'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'concrete-post',mesh:0}],meshes:[{primitives:[{attributes:{POSITION:p,NORMAL:n,TEXCOORD_0:t},indices:i,material:1}]}],buffers:[{byteLength:data.length,uri:'data:application/octet-stream;base64,'+btoa(binary)}],bufferViews,accessors,materials,extras:{authored:true,units:'metres',notSurveyed:true}};
  if(list.every(key=>images[key])){
    g.images=list.map(key=>({uri:images[key]}));g.samplers=[{wrapS:10497,wrapT:10497,minFilter:9987,magFilter:9729}];g.textures=list.map((_,source)=>({sampler:0,source}));
    for(const m of materials.slice(0,2)){m.pbrMetallicRoughness.baseColorTexture={index:0};m.pbrMetallicRoughness.metallicRoughnessTexture={index:2};m.normalTexture={index:1,scale:.3};m.occlusionTexture={index:2,texCoord:0,strength:.35};}
  }
  return g;
}
/** Per-face planar projection. Vertical walls use height, not ground X/Z UVs. */
export function surfaceUV(x,y,z,nx,ny,nz,metres=4){
  if(![x,y,z,nx,ny,nz,metres].every(Number.isFinite)||metres<=0)throw Error('Invalid surface coordinates');
  if(Math.abs(ny)>=Math.max(Math.abs(nx),Math.abs(nz)))return [x/metres,-z/metres];
  return Math.abs(nx)>Math.abs(nz)?[-z*Math.sign(nx||1)/metres,y/metres]:[x*Math.sign(nz||1)/metres,y/metres];
}
