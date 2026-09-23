import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import { GLTFExporter } from '../webapp/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url),out=new URL('webapp/public/assets/kart-royale/karts/',root);
// GLTFExporter uses the browser FileReader interface for its binary buffer.
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result='data:'+blob.type+';base64,'+Buffer.from(result).toString('base64');this.onloadend?.();});}
};
const code=await build({entryPoints:[fileURLToPath(new URL('tools/assets/modernKartModel.ts',root))],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'shared-three',setup(b){b.onResolve({filter:/three\/build\/three\.module\.js$/},()=>({path:new URL('webapp/node_modules/three/build/three.module.js',root).href,external:true}));b.onResolve({filter:/^three$/},()=>({path:new URL('webapp/node_modules/three/build/three.module.js',root).href,external:true}));}}]});
const {buildModernKart,KART_DESIGNS}=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'));
const assets=[];await mkdir(out,{recursive:true});
for(const design of KART_DESIGNS)for(const low of [false,true]) {
  const scene=buildModernKart(design.id,low),filename=design.id+(low?'-lod':'')+'.glb';
  const bytes=Buffer.from(await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true}));
  await writeFile(new URL(filename,out),bytes);
  let triangles=0,drawCalls=0;scene.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;drawCalls++;}});
  assets.push({...design,lod:low,file:filename,bytes:bytes.length,triangles,drawCalls,wheelRadius:scene.userData.wheelRadius,...(low?{}:{features:scene.userData.features})});
  console.log(filename,bytes.length,triangles+' triangles',drawCalls+' draws');
  scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
}
await writeFile(new URL('modern-manifest.json',out),JSON.stringify({generator:'Three.js parameterised original mesh authoring',revision:'city-driver-v2',source:'tools/assets/modernKartModel.ts',up:'+Y',forward:'+Z',assets},null,2)+'\n');
for(const file of ['manifest.json','future-manifest.json']) {
  const previous=JSON.parse(await readFile(new URL(file,out),'utf8'));
  previous.generator='Three.js original kart meshes; existing Blender driver assets';
  previous.source='tools/assets/modernKartModel.ts';
  previous.assets=previous.assets.map(a=>{const current=assets.find(n=>n.id===a.id&&n.lod===a.lod);if(!current)return a;const {features,...summary}=current;return summary;});
  await writeFile(new URL(file,out),JSON.stringify(previous,null,2)+'\n');
}
