import * as T from 'three';
import { FLAG_RATIOS } from './flagRatios.mjs';
import { WORLD } from '../tiranastreets/shared/world.mjs';
import { CITY_SOURCE } from './sourceData.mjs';
import { CITY_PLACES } from './registry.mjs';
import { frontage, type CitySite } from './sourceCore.mjs';

const flagBase = '/assets/tirana-streets/flags/';
type SignItem = {site:CitySite;edge:NonNullable<ReturnType<typeof frontage>>};

/** Shared, locally packaged flag artwork. Cloth proportions come from the SVG,
 * including square Swiss/Vatican flags. No emoji substitutes or remote hotlinks. */
export class InstitutionLayer {
  readonly group = new T.Group();
  readonly ready:Promise<void>;
  private dead=false;
  private disposed=false;
  private time={value:0};
  private last=-Infinity;
  private entries:{group:T.Group;x:number;z:number}[]=[];
  private textures=new Set<T.Texture>();
  private materials=new Set<T.Material>();
  private geometries=new Set<T.BufferGeometry>();
  constructor(sites:CitySite[]=CITY_PLACES.sites, private errors:string[]=[], flagUrl:(country:string)=>string=country=>`${flagBase}${country.toLowerCase()}.svg`) {
    this.group.name='Tirana:institution-identities-and-national-flags';
    this.group.userData={source:CITY_SOURCE.source,accuracy:'Mapped building identity; authored exterior sign and flag mounts',
      omitted:CITY_PLACES.issues};
    const items=sites.flatMap(site=>{
      const edge=frontage(site,WORLD.roads,CITY_SOURCE.entrances);
      return edge?[{site,edge}]:[];
    });
    const atlas=this.signAtlas(items);
    const signMaterial=new T.MeshStandardMaterial({map:atlas,roughness:.78,metalness:.12});
    const poleMaterial=new T.MeshStandardMaterial({color:0xbac0c3,roughness:.4,metalness:.75});
    this.materials.add(signMaterial);this.materials.add(poleMaterial);
    const poleGeometry=new T.CylinderGeometry(.025,.035,3.4,6);
    const clothGeometry=new T.PlaneGeometry(1,1,16,8).translate(.5,-.5,0);
    this.geometries.add(poleGeometry);this.geometries.add(clothGeometry);
    const flagMaterials=new Map<string,T.MeshStandardMaterial>();
    const load:Promise<void>[]=[];
    items.forEach(({site,edge},i)=>{
      const group=new T.Group();group.name=site.name||site.category;group.userData={...site};
      group.position.set(edge.x+edge.nx*.26,0,edge.z+edge.nz*.26);group.rotation.y=edge.yaw;
      if(site.name){
        const width=Math.min(edge.length-.6,4.6),height=width/4;
        const geometry=new T.PlaneGeometry(width,height),uv=geometry.getAttribute('uv');
        const col=i%8,row=Math.floor(i/8),rows=Math.ceil(items.length/8);
        for(let v=0;v<uv.count;v++)uv.setXY(v,(col+uv.getX(v))/8,1-(row+1-uv.getY(v))/rows);
        this.geometries.add(geometry);
        const sign=new T.Mesh(geometry,signMaterial);sign.name='Institution name';
        sign.position.set(0,Math.min(site.height-.6,3.35),.04);group.add(sign);
      }
      if(site.country){
        const country=site.country;
        if(!flagMaterials.has(country)){
          const material=new T.MeshStandardMaterial({color:0xffffff,side:T.DoubleSide,roughness:.93});
          material.onBeforeCompile=shader=>{
            shader.uniforms.flagTime=this.time;
            shader.vertexShader='uniform float flagTime;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
              float freeEdge = uv.x * uv.x;
              transformed.z += sin(uv.x * 8.0 - flagTime * 2.7 + uv.y * 2.0) * .085 * freeEdge;
              transformed.y -= .07 * freeEdge;
            `);
          };
          material.customProgramCacheKey=()=> 'tirana-national-cloth-v1';
          flagMaterials.set(country,material);this.materials.add(material);
          load.push(new Promise<void>(resolve=>new T.TextureLoader().load(flagUrl(country),texture=>{
            if(this.dead){texture.dispose();resolve();return;}
            texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=2;
            material.map=texture;material.needsUpdate=true;this.textures.add(texture);resolve();
          },undefined,()=>{if(!this.dead){this.errors.push(`${country}: national flag texture unavailable`);material.visible=false;}resolve();})));
        }
        const pole=new T.Mesh(poleGeometry,poleMaterial);
        pole.position.set(-Math.min(2.7,edge.length*.34),4.35,.4);group.add(pole);
        const cloth=new T.Mesh(clothGeometry,flagMaterials.get(country)!);
        const width=2.15,height=width/FLAG_RATIOS[country];
        cloth.position.set(pole.position.x,5.94,.43);cloth.scale.set(width,height,1);
        cloth.name=`${country} flag`;cloth.visible=false;
        group.add(cloth);
        // Never show an untextured white rectangle as a country's flag.
        void Promise.all(load).then(()=>{if(!this.dead)cloth.visible=Boolean((cloth.material as T.MeshStandardMaterial).map);});
      }
      this.group.add(group);this.entries.push({group,x:edge.x,z:edge.z});group.visible=false;
    });
    this.ready=Promise.all(load).then(()=>{});
  }
  private signAtlas(items:SignItem[]) {
    const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=Math.max(64,Math.ceil(items.length/8)*64);
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Institution sign canvas unavailable');
    for(let i=0;i<items.length;i++){
      const site=items[i].site,x=(i%8)*256,y=Math.floor(i/8)*64;
      ctx.fillStyle=['hotel','casino'].includes(site.category)?'#242528':'#173c59';ctx.fillRect(x,y,256,64);
      ctx.strokeStyle='#c7b982';ctx.lineWidth=1;ctx.strokeRect(x+3,y+3,250,58);
      ctx.fillStyle='#fff9e9';ctx.font='600 14px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
      const words=(site.name||'').split(/\s+/),lines:string[]=[];let line='';
      for(const word of words){const candidate=line?`${line} ${word}`:word;if(ctx.measureText(candidate).width>232&&line){lines.push(line);line=word;}else line=candidate;}
      if(line)lines.push(line);
      lines.slice(0,3).forEach((text,j)=>ctx.fillText(text,x+128,y+32+(j-(Math.min(lines.length,3)-1)/2)*17,232));
    }
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;
    this.textures.add(texture);return texture;
  }
  update(seconds:number,viewer?:{x:number;z:number},battery=false) {
    if(this.dead)return;
    this.time.value=seconds;
    if(!viewer||seconds>=this.last&&seconds-this.last<.25)return;this.last=seconds;
    const radius=battery?120:250;
    for(const entry of this.entries)entry.group.visible=Math.hypot(entry.x-viewer.x,entry.z-viewer.z)<radius;
  }
  retire(){this.dead=true;}
  dispose(){if(this.disposed)return;this.disposed=true;this.retire();this.group.removeFromParent();
    this.textures.forEach(t=>t.dispose());this.materials.forEach(m=>m.dispose());this.geometries.forEach(g=>g.dispose());this.group.clear();}
}
