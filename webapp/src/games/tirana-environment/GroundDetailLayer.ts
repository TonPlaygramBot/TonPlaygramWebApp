import * as T from 'three';
import polygonClipping from 'polygon-clipping';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {insideRing,seededParkPoints,roadCorridor,PAVING_REFERENCES} from './surfaceCore.mjs';
import {ribbonExclusion} from '../tirana-street-detail/roadDetailCore.mjs';
import type {StreetDetailOptions} from '../tirana-street-detail/StreetDetailLayer';
type Polygon=number[][][];
/** Add detail only inside recorded green/paved polygons. Trees are authored
 * infill within those boundaries, NOT claimed satellite-detected tree centres. */
export class GroundDetailLayer {
  readonly group=new T.Group();private dead=false;private disposed=false;private textures=new Set<T.Texture>();private source?:T.Group;
  private cells:{mesh:T.Object3D;x:number;z:number}[]=[];
  constructor(world:any,options:StreetDetailOptions={},errors:string[]=[]){
    this.group.name='Tirana:mapped-park-ground-and-stone-paving';this.group.userData={references:PAVING_REFERENCES,accuracy:'Existing OSM area boundaries; authored textures and vegetation infill'};
    const closed=(ring:number[][])=>[...ring,...(ring.length&&ring[0].join(',')!==ring.at(-1)!.join(',')?[ring[0]]:[])];
    const waterCuts=(world.water||[]).flatMap((w:any)=>Array.isArray(w)?[w]:(w.line||[]).slice(1).map((b:number[],i:number)=>roadCorridor({a:w.line[i],b,w:w.width},.5)).filter(Boolean));
    const cuts=[...waterCuts,...(world.areas||[]),...(world.buildings||[]).map((b:any)=>b.p),...(world.roads||[]).map((r:any)=>roadCorridor(r,r.walk?.2:2.5)).filter(Boolean)].map((p:number[][])=>[closed(p)]);
    let parks:Polygon[]=[];
    try{for(const p of world.parks||[]){if(p.length<3)continue;const box=[Math.min(...p.map((v:number[])=>v[0])),Math.min(...p.map((v:number[])=>v[1])),Math.max(...p.map((v:number[])=>v[0])),Math.max(...p.map((v:number[])=>v[1]))];const nearby=cuts.filter((poly:number[][][])=>Math.max(...poly[0].map(v=>v[0]))>=box[0]&&Math.min(...poly[0].map(v=>v[0]))<=box[2]&&Math.max(...poly[0].map(v=>v[1]))>=box[1]&&Math.min(...poly[0].map(v=>v[1]))<=box[3]);const result=nearby.length?polygonClipping.difference([closed(p)] as any,...nearby as any):[[closed(p)]];parks.push(...result as Polygon[]);}}
    catch(e){errors.push(`Park clipping failed: ${String(e)}`);parks=[];}
    const make=(polygon:Polygon,y:number)=>{const shape=new T.Shape(polygon[0].map(p=>new T.Vector2(p[0],-p[1])));for(const h of polygon.slice(1))shape.holes.push(new T.Path(h.map(p=>new T.Vector2(p[0],-p[1]))));const geo=new T.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,y,0),pos=geo.getAttribute('position'),uv=geo.getAttribute('uv');for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/6,pos.getZ(i)/6);return geo;};
    const add=(polygons:Polygon[],y:number,material:T.Material)=>{for(const p of polygons){const geo=make(p,y),mesh=new T.Mesh(geo,material);mesh.receiveShadow=true;this.group.add(mesh);}};
    const grass=new T.MeshStandardMaterial({color:'#83916c',roughness:1,polygonOffset:true,polygonOffsetFactor:-1});
    const trackBlocked=options.track?ribbonExclusion(options.track):()=>false;
    // The racing ribbon must remain visually unobstructed as well as collision-free.
    if(options.track){const ribbon=options.track.points.map((p:any,i:number)=>roadCorridor({a:[p.x,p.z],b:[options.track!.points[(i+1)%options.track!.points.length].x,options.track!.points[(i+1)%options.track!.points.length].z],w:options.track!.width},1)).filter(Boolean).map(p=>[p!]);try{parks=parks.flatMap(p=>polygonClipping.difference(p as any,...ribbon as any) as Polygon[]);}catch{parks=[];}}
    add(parks,options.profile==='racing'?.02:.061,grass);
    const loader=new T.TextureLoader();for(const [file,key] of [['grass_path_2-diff.jpg','map'],['grass_path_2-nor_gl.jpg','normalMap'],['grass_path_2-rough.jpg','roughnessMap']] as const){const t=loader.load('/assets/tirana-streets/materials/'+file,tex=>{if(this.dead){tex.dispose();return;}tex.wrapS=tex.wrapT=T.RepeatWrapping;if(key==='map')tex.colorSpace=T.SRGBColorSpace;grass[key]=tex;grass.normalScale.set(.22,.22);grass.needsUpdate=true;},undefined,()=>{if(!this.dead)errors.push(`Ground texture: ${file}`);});this.textures.add(t);}
    const square=world.landmarks?.find((p:any)=>p.id==='square');
    // Change only mapped pedestrian areas containing the documented square anchor.
    if(square&&!options.track){const area=(world.areas||[]).filter((p:number[][])=>insideRing([square.x,square.z],p));const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;const c=canvas.getContext('2d')!;c.fillStyle='#817b70';c.fillRect(0,0,2048,2048);const palette=['#b5aa98','#a69a88','#c5baaa','#d6c9b8','#94877b','#b6a093'];let seed=34;for(let y=0;y<16;y++)for(let x=0;x<16;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;c.fillStyle=palette[seed%palette.length];c.fillRect(x*128+2,y*128+2,124,124);}const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;this.textures.add(tex);const material=new T.MeshStandardMaterial({map:tex,roughness:.82,polygonOffset:true,polygonOffsetFactor:-2});add(area.map((p:number[][])=>[p]),.072,material);}
    // Racing scenery previously used one primitive tree per park. Use the already
    // shipped glTF tree for bounded infill, never within roads, paving or buildings.
    if(options.profile==='racing'){const points=seededParkPoints(parks,{spacing:15,limit:100,excluded:(x:number,z:number)=>trackBlocked(x,z,3)});
      new GLTFLoader().load('/assets/tirana-streets/street-furniture.glb',g=>{if(this.dead){this.release(g.scene);return;}this.source=g.scene;g.scene.visible=false;this.group.add(g.scene);const tree=g.scene.getObjectByName('tree');if(!tree){errors.push('Existing tree model unavailable');return;}tree.updateWorldMatrix(true,true);const d=new T.Object3D();tree.traverse(o=>{if(!(o instanceof T.Mesh))return;const instance=new T.InstancedMesh(o.geometry,o.material,points.length);points.forEach((p,i)=>{d.position.set(p.x,.03,p.z);d.scale.setScalar(p.scale);d.rotation.y=i*2.399;d.updateMatrix();instance.setMatrixAt(i,new T.Matrix4().multiplyMatrices(d.matrix,o.matrixWorld));});instance.computeBoundingSphere();this.group.add(instance);});},undefined,()=>{if(!this.dead)errors.push('Existing park-tree glTF failed to load');});
    }
  }
  update(viewer?:{x:number;z:number},battery=false){if(this.dead)return;/* Static ground is batched; map/track bounds already limit generation. */}
  retire(){this.dead=true;}
  private release(root:T.Object3D){const g=new Set<T.BufferGeometry>(),m=new Set<T.Material>(),t=new Set<T.Texture>();root.traverse(o=>{if(o instanceof T.Mesh){g.add(o.geometry);for(const mat of Array.isArray(o.material)?o.material:[o.material]){m.add(mat);for(const v of Object.values(mat))if(v instanceof T.Texture)t.add(v);}}});g.forEach(x=>x.dispose());m.forEach(x=>x.dispose());t.forEach(x=>x.dispose());}
  dispose(){if(this.disposed)return;this.disposed=true;this.retire();this.release(this.group);for(const t of this.textures)t.dispose();this.group.removeFromParent();}
}
