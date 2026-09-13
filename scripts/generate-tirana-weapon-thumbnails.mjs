/** Offline orthographic thumbnails from the exact shipped glTF geometry.
 * No browser/WebGL renderer is allocated by the in-game weapon picker. */
import {readFile, writeFile, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(join(root, 'webapp/package.json'));
const {build} = require('esbuild'), sharp = require('sharp'), T = require('three');
const temp = await mkdtemp(join(tmpdir(), 'tirana-thumbs-'));
try {
  await build({stdin: {contents: `export {weaponModelUrl} from './src/games/tiranastreets/livingVisuals'; export {WEAPONS} from './src/games/tiranastreets/shared/weapons.mjs';`, resolveDir: join(root,'webapp')}, bundle:true, platform:'node', format:'esm', outfile:join(temp,'models.mjs')});
  const {weaponModelUrl, WEAPONS} = await import(pathToFileURL(join(temp,'models.mjs')));
  const out = join(root,'webapp/public/assets/tirana-streets/weapon-thumbnails'); await mkdir(out,{recursive:true});
  const chosen=new Set(process.argv.slice(2));
  const provenance=chosen.size?JSON.parse(await readFile(join(out,'sources.json'),'utf8')):[];
  for (const w of WEAPONS.filter(w=>w.id!=='fpsGunAttack'&&(!chosen.size||chosen.has(w.id)))) {
    const url = weaponModelUrl(w.model), bytes = await readFile(join(root,'webapp/public',url));
    let doc, bin;
    if (bytes.toString('utf8',0,4)==='glTF') {
      const len=bytes.readUInt32LE(12); doc=JSON.parse(bytes.toString('utf8',20,20+len)); bin=bytes.subarray(28+len);
    } else {doc=JSON.parse(bytes); bin=Buffer.from(doc.buffers[0].uri.split(',')[1],'base64');}
    const buffers=await Promise.all(doc.buffers.map(async(b,i)=>i===0?bin:b.uri?.startsWith('data:')?Buffer.from(b.uri.split(',')[1],'base64'):readFile(join(root,'webapp/public',url,'..',b.uri))));
    function accessor(i) {
      const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],b=buffers[v.buffer];
      const size={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a.componentType],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
      const method={5120:'readInt8',5121:'readUInt8',5122:'readInt16LE',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType];
      return Array.from({length:a.count},(_,j)=>Array.from({length:n},(_,k)=>b[method]((v.byteOffset||0)+(a.byteOffset||0)+j*(v.byteStride||size*n)+k*size)));
    }
    const faces=[], points=[];
    function visit(i,parent) {
      const node=doc.nodes[i],matrix=new T.Matrix4();
      if(node.matrix)matrix.fromArray(node.matrix);else matrix.compose(new T.Vector3(...(node.translation||[0,0,0])),new T.Quaternion(...(node.rotation||[0,0,0,1])),new T.Vector3(...(node.scale||[1,1,1])));
      matrix.premultiply(parent);
      for(const primitive of node.mesh===undefined?[]:doc.meshes[node.mesh].primitives) {
        if(primitive.mode!==undefined&&primitive.mode!==4)continue;
        const pos=accessor(primitive.attributes.POSITION).map(p=>new T.Vector3(...p).applyMatrix4(matrix));points.push(...pos);
        const indices=primitive.indices===undefined?pos.map((_,i)=>i):accessor(primitive.indices).flat();
        const color=doc.materials?.[primitive.material]?.pbrMetallicRoughness?.baseColorFactor||[.36,.43,.43,1];
        for(let j=0;j<indices.length;j+=3)faces.push({vertices:indices.slice(j,j+3).map(i=>pos[i]),color});
      }
      for(const child of node.children||[])visit(child,matrix);
    }
    for(const i of doc.scenes[doc.scene||0].nodes)visit(i,new T.Matrix4());
    const box=new T.Box3().setFromPoints(points),span=box.getSize(new T.Vector3()).toArray(),axes=[0,1,2].sort((a,b)=>span[b]-span[a]);
    // Longest axis spans the card; the next widest exposes the actual profile.
    const x=axes[0],y=axes[1],z=axes[2],project=p=>{const a=p.toArray();return [a[x]+a[z]*.16,-a[y]+a[z]*.12,a[z]];};
    const projected=points.map(project),minX=Math.min(...projected.map(p=>p[0])),maxX=Math.max(...projected.map(p=>p[0])),minY=Math.min(...projected.map(p=>p[1])),maxY=Math.max(...projected.map(p=>p[1]));
    const scale=Math.min(230/(maxX-minX),118/(maxY-minY)),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    faces.sort((a,b)=>a.vertices.reduce((s,p)=>s+p.toArray()[z],0)-b.vertices.reduce((s,p)=>s+p.toArray()[z],0));
    const polygons=faces.map(f=>{
      const normal=new T.Vector3().subVectors(f.vertices[1],f.vertices[0]).cross(new T.Vector3().subVectors(f.vertices[2],f.vertices[0])).normalize();
      const shade=.7+.3*Math.abs(normal.dot(new T.Vector3(.3,.8,.5).normalize()));
      const rgb=f.color.slice(0,3).map(v=>Math.round(Math.min(255,Math.max(70,Math.pow(v,1/2.2)*255))*shade));
      return `<polygon points="${f.vertices.map(p=>{const v=project(p);return `${((v[0]-cx)*scale+128).toFixed(1)},${((v[1]-cy)*scale+72).toFixed(1)}`;}).join(' ')}" fill="rgb(${rgb.join(',')})"/>`;
    }).join('');
    await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="144">${polygons}</svg>`)).webp({quality:85}).toFile(join(out,`${w.id}.webp`));
    const previous=provenance.findIndex(p=>p.id===w.id);if(previous>=0)provenance.splice(previous,1);
    provenance.push({id:w.id,source:url,thumbnail:`${w.id}.webp`});
  }
  await writeFile(join(out,'sources.json'),JSON.stringify(provenance,null,2)+'\n');
  console.log(`Rendered ${provenance.length} thumbnails from shipped weapon geometry.`);
} finally {await rm(temp,{recursive:true,force:true});}
