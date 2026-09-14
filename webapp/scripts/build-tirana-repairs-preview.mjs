/** Embed actual game GLBs in the in-chat preview, with no API/asset requests.
 * UVs are omitted because preview surfaces are untextured; vertex positions are
 * rounded to 1 mm and normals to four decimals only for transport compression.
 * The game GLBs and editable Blender source remain untouched.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const root=fileURLToPath(new URL('../',import.meta.url));
const asset=resolve(root,'public/assets/tirana-streets/skanderbeg-building');
function compact(data){
  const jsize=data.readUInt32LE(12),doc=JSON.parse(data.subarray(20,20+jsize)),bin=data.subarray(28+jsize);
  const oldAccessors=doc.accessors,oldViews=doc.bufferViews,views=[],accessors=[],chunks=[];
  let offset=0;
  for(const mesh of doc.meshes)for(const primitive of mesh.primitives){
    for(const key of Object.keys(primitive.attributes))if(!['POSITION','NORMAL'].includes(key))delete primitive.attributes[key];
    for(const [owner,key] of [[primitive,'indices'],...Object.keys(primitive.attributes).map(key=>[primitive.attributes,key])]){
      const original=oldAccessors[owner[key]],view=oldViews[original.bufferView];
      const size={SCALAR:1,VEC3:3}[original.type],bytes=original.componentType===5125||original.componentType===5126?4:2;
      const packed=Buffer.alloc(original.count*size*bytes);
      for(let i=0;i<original.count;i++)for(let j=0;j<size;j++){
        const source=(view.byteOffset||0)+(original.byteOffset||0)+i*(view.byteStride||size*bytes)+j*bytes,dest=(i*size+j)*bytes;
        if(original.componentType===5126){const round=key==='POSITION'?1000:10000;packed.writeFloatLE(Math.round(bin.readFloatLE(source)*round)/round,dest);}
        else if(bytes===4)packed.writeUInt32LE(bin.readUInt32LE(source),dest);else packed.writeUInt16LE(bin.readUInt16LE(source),dest);
      }
      const padding=Buffer.alloc((4-offset%4)%4);chunks.push(padding);offset+=padding.length;
      owner[key]=accessors.length;accessors.push({...original,bufferView:views.length,byteOffset:0});
      views.push({buffer:0,byteOffset:offset,byteLength:packed.length});chunks.push(packed);offset+=packed.length;
    }
  }
  doc.accessors=accessors;doc.bufferViews=views;doc.buffers=[{byteLength:offset}];
  let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const binary=Buffer.concat([...chunks,Buffer.alloc((4-offset%4)%4)]),header=Buffer.alloc(20),chunk=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  chunk.writeUInt32LE(binary.length);chunk.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,json,chunk,binary]);
}
const models={};
for(const detail of ['near','far'])models[detail]=gzipSync(compact(await readFile(resolve(asset,`skanderbeg-building-${detail}.glb`))),{level:9}).toString('base64');
// Override the project's automatic JSX runtime: the self-contained fragment
// deliberately maps React itself, not an additional react/jsx-runtime module.
const result=await build({entryPoints:[resolve(root,'src/previews/tirana-repairs/SkanderbegInlinePreview.tsx')],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',minify:true,jsx:'transform',jsxFactory:'React.createElement',jsxFragment:'React.Fragment',tsconfigRaw:{compilerOptions:{jsx:'react'}},external:['react','react-dom/client','three','three/examples/jsm/*'],define:{__TIRANA_EMBEDDED_MODELS__:JSON.stringify(models)}});
if(result.outputFiles[0].text.includes('react/jsx-runtime'))throw new Error('Unmapped JSX runtime in inline preview');
const template=await readFile(new URL('tirana-repairs-preview.fragment.html',import.meta.url),'utf8');
const fragment=template.replace('__TIRANA_PREVIEW_CODE__',result.outputFiles[0].text);
if(Buffer.byteLength(fragment)>1_000_000)throw new Error(`Inline budget exceeded: ${Buffer.byteLength(fragment)} bytes`);
const output=process.argv[2]||'/workspace/tirana-realism-repairs.html';
await writeFile(output,fragment);console.log(`${output}: ${Buffer.byteLength(fragment)} bytes`);
