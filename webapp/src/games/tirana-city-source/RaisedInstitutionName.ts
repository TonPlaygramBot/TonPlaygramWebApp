import * as T from 'three';
import {FontLoader} from 'three/examples/jsm/loaders/FontLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import TYPEFACE from './institutionTypeface.json';
const font=new FontLoader().parse(TYPEFACE);
/** An authored bronze nameplate, preserving the mapped Albanian name. No
 * invented school crest. The font includes ë/ç instead of substituting '?'. */
export function raisedInstitutionName(name:string,width:number,height:number){
  const group=new T.Group();group.name='Raised institution name';
  const letters=new T.MeshStandardMaterial({color:0xdec894,metalness:.64,roughness:.4});
  const bronze=new T.MeshStandardMaterial({color:0x19354b,roughness:.55,metalness:.3});
  const back=new T.Mesh(new T.BoxGeometry(width,height,.08),bronze);group.add(back);
  const words=name.trim().split(/\s+/),lines:string[]=[];let line='';
  for(const word of words){if((line+' '+word).length>27&&line){lines.push(line);line=word;}else line+=(line?' ':'')+word;}
  if(line)lines.push(line);
  // Never truncate the institution's identity; shrink the complete name to fit.
  const count=lines.length,parts:T.BufferGeometry[]=[];
  lines.forEach((line,i)=>{
    const geometry=new T.ExtrudeGeometry(font.generateShapes(line,1),{depth:.035,bevelEnabled:false,curveSegments:2,steps:1});
    geometry.computeBoundingBox();const box=geometry.boundingBox!;
    const scale=Math.min((width-.2)/Math.max(.1,box.max.x-box.min.x),(height-.14)/count/Math.max(.9,box.max.y-box.min.y));
    geometry.translate(-(box.max.x+box.min.x)/2,-(box.max.y+box.min.y)/2,0);
    geometry.scale(scale,scale,1);geometry.translate(0,(count/2-i-.5)*(height-.1)/count,.043);parts.push(geometry);
  });
  if(parts.length){const geometry=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());group.add(new T.Mesh(geometry,letters));}
  else letters.dispose();
  group.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;});return group;
}
