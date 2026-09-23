import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import RELIEFS from './identityReliefs.json';
import {loadBrandArtwork} from './brandArtworkCache';
import {SIGN_REFERENCES} from './signReferences.mjs';

export const RELIEF_BRANDS=new Set(Object.keys(RELIEFS));
/** Shared original pixels on baked raised silhouettes, metal rim and cassette.
 * Used by offline baking and model review; gameplay loads the baked GLBs. */
export async function createIdentityRelief(id:string):Promise<T.Group> {
  const record=RELIEFS[id as keyof typeof RELIEFS];
  const reference=SIGN_REFERENCES.find(r=>r.id===id);
  if(!record||!reference)throw Error(`Unknown identity: ${id}`);
  const image=await loadBrandArtwork(reference.logo);
  if(!image)throw Error(`Identity artwork unavailable: ${id}`);
  return identityReliefFromImage(id,image);
}
export function identityReliefFromImage(id:string,image:HTMLImageElement):T.Group {
  const record=RELIEFS[id as keyof typeof RELIEFS];
  const reference=SIGN_REFERENCES.find(r=>r.id===id);
  if(!record||!reference)throw Error(`Unknown identity: ${id}`);
  const root=new T.Group();root.name=`Raised official identity: ${id}`;
  const frame=new T.MeshStandardMaterial({color:0x687077,metalness:.75,roughness:.32});
  const side=new T.MeshStandardMaterial({color:reference.foreground||'#282c30',metalness:.34,roughness:.42});
  const texture=new T.Texture(image);texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;
  const paint=new T.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.02,roughness:.47,metalness:.06});
  const cassette=new T.Mesh(new T.BoxGeometry(record.ratio+.06,1.06,.1),frame);root.add(cassette);
  const background=new T.Mesh(new T.PlaneGeometry(record.ratio,1),new T.MeshStandardMaterial({color:reference.background||'#ffffff',roughness:.6}));
  background.position.z=.051;root.add(background);
  const parts:T.BufferGeometry[][]=[[],[]];
  for(const contour of record.shapes){
    const shape=new T.Shape(contour.outer.map(p=>new T.Vector2(p[0],p[1])));
    for(const hole of contour.holes)shape.holes.push(new T.Path(hole.map(p=>new T.Vector2(p[0],p[1]))));
    const geometry=new T.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:false,curveSegments:1,steps:1});
    const positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
    for(let i=0;i<positions.count;i++)uv.setXY(i,positions.getX(i)/record.ratio+.5,positions.getY(i)+.5);
    for(const group of geometry.groups){
      const part=new T.BufferGeometry();
      for(const name of ['position','normal','uv']){
        const attribute=geometry.getAttribute(name);
        part.setAttribute(name,new T.Float32BufferAttribute(attribute.array.slice(group.start*attribute.itemSize,(group.start+group.count)*attribute.itemSize),attribute.itemSize));
      }
      parts[group.materialIndex||0].push(part);
    }
    geometry.dispose();
  }
  [paint,side].forEach((material,index)=>{
    if(!parts[index].length){material.dispose();return;}
    const merged=mergeGeometries(parts[index],false)!;parts[index].forEach(g=>g.dispose());
    const mesh=new T.Mesh(merged,material);mesh.position.z=.052;root.add(mesh);
  });
  root.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;});
  return root;
}
