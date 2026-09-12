import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {facadeEdges} from './sourceCore.mjs';
import {AGED_HOUSING} from './housingRegistry.mjs';
import {housingSeed} from './housingCore.mjs';

/** Shared source-frame details. At most 24 nearby buildings / 36 cached models.
 * Geometry is merged by material; there is no draw call per AC or window. */
export class AgedHousingLayer {
  readonly group=new T.Group();
  private cache=new Map<string,T.Group>();
  private last=-Infinity;
  private dead=false;
  private materials:T.MeshStandardMaterial[];
  private textures=new Set<T.Texture>();
  constructor(private buildings=AGED_HOUSING,loadTextures=true){
    this.group.name='Tirana:aged-apartment-details';
    this.group.userData={buildings:buildings.length,classification:'Date-tagged or explicitly estimated typology',assetErrors:[]};
    const plaster=new T.MeshStandardMaterial({color:0xcfc3a9,roughness:.96});
    // Analytic chipped-plaster / exposed-brick finish layered over the existing
    // CC0 plaster map. This is an authored material, never a site photograph.
    plaster.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec2 housingUV;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nhousingUV=uv;');
      shader.fragmentShader='varying vec2 housingUV;\nfloat housingHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat housingNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(housingHash(i),housingHash(i+vec2(1,0)),f.x),mix(housingHash(i+vec2(0,1)),housingHash(i+vec2(1,1)),f.x),f.y);}\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        vec2 brickUV=housingUV*vec2(12.0,26.0);brickUV.x+=mod(floor(brickUV.y),2.0)*.5;
        vec2 bf=fract(brickUV);float mortar=1.0-smoothstep(.025,.075,min(bf.x,bf.y));
        vec3 brick=mix(vec3(.39,.19,.11)*(0.8+0.3*housingHash(floor(brickUV))),vec3(.53,.49,.40),mortar);
        float wear=housingNoise(housingUV*2.3)+.25*housingNoise(housingUV*13.0);
        float exposed=smoothstep(.62,.70,wear);
        diffuseColor.rgb=mix(diffuseColor.rgb*(.76+.24*housingNoise(housingUV*8.0)),brick,exposed);
      `);
    };
    plaster.customProgramCacheKey=()=> 'tirana-aged-plaster-v1';
    this.materials=[plaster,new T.MeshStandardMaterial({color:0xe0dacc,roughness:.88}),new T.MeshStandardMaterial({color:0x314851,roughness:.35,metalness:.15}),new T.MeshStandardMaterial({color:0x9ba2a0,roughness:.55,metalness:.55}),new T.MeshStandardMaterial({color:0x292d2c,roughness:.83})];
    this.materials[2].userData.environmentWindow=true;
    if(loadTextures)for(const [file,key] of [['plastered_wall_02-diff.jpg','map'],['plastered_wall_02-nor_gl.jpg','normalMap']] as const){
      new T.TextureLoader().load('/assets/tirana-streets/materials/'+file,t=>{
        if(this.dead){t.dispose();return;}t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=2;
        if(key==='map')t.colorSpace=T.SRGBColorSpace;
        this.textures.add(t);plaster[key]=t;plaster.normalScale.set(.2,.2);plaster.needsUpdate=true;
      },undefined,()=>this.group.userData.assetErrors.push(file));
    }
  }
  private build(b:any){
    const group=new T.Group(),parts:T.BufferGeometry[][]=this.materials.map(()=>[]);
    group.name='Housing:'+b.id;group.userData={era:b.era,tanks:b.tanks.length,windows:0,airConditioners:0};
    const add=(m:number,g:T.BufferGeometry)=>{if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}parts[m].push(g);};
    const box=(m:number,x:number,y:number,z:number,w:number,h:number,d:number,yaw=0)=>add(m,new T.BoxGeometry(w,h,d).rotateY(yaw).translate(x,y,z));
    const seed=housingSeed(b.id);
    for(const [edgeIndex,e] of facadeEdges(b.p).entries()){
      const yaw=Math.atan2(e.nx,e.nz);
      const wall=(m:number,u:number,y:number,w:number,h:number,d:number,offset:number)=>box(m,e.a[0]+e.ux*u+e.nx*offset,y,e.a[1]+e.uz*u+e.nz*offset,w,h,d,yaw);
      const g=new T.PlaneGeometry(e.length,b.h).rotateY(yaw).translate(e.a[0]+e.ux*e.length/2+e.nx*.045,b.h/2,e.a[1]+e.uz*e.length/2+e.nz*.045);
      const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*e.length/4,uv.getY(i)*b.h/4);add(0,g);
      wall(1,e.length/2,b.h+.12,e.length,.24,.3,.06);
      if(e.length<3)continue;
      const columns=Math.floor(e.length/3.4),pitch=e.length/columns;
      for(let row=1,y=3.2;y<b.h-1;row++,y+=3.2)for(let j=0;j<columns;j++){
        const u=(j+.5)*pitch,w=Math.min(1.3,pitch-.7);
        wall(1,u,y,w+.22,1.8,.09,.10);wall(2,u,y,w,1.56,.05,.18);
        wall(1,u,y,.065,1.56,.05,.23);wall(1,u,y-.91,w+.42,.12,.42,.22);
        group.userData.windows++;
        // 95% coverage, deterministic across reloads and renderers.
        if((seed+edgeIndex*7+row*11+j)%20!==0){
          const acU=Math.min(e.length-.5,u+w/2+.47),acY=y-.6;
          wall(1,acU,acY,.72,.48,.38,.29);
          const x=e.a[0]+e.ux*acU+e.nx*.5,z=e.a[1]+e.uz*acU+e.nz*.5;
          add(4,new T.CircleGeometry(.16,10).rotateY(yaw).translate(x,acY,z));
          for(const dy of [-.1,0,.1])wall(3,acU,acY+dy,.62,.022,.02,.51);
          wall(3,acU,acY-.3,.62,.045,.45,.28);group.userData.airConditioners++;
        }
        if(j%3===1&&row%2===1){
          wall(1,u,y-1.1,w+.65,.13,1,.53);wall(4,u,y-.56,w+.65,.05,.06,1);
          for(let rail=-2;rail<=2;rail++)wall(4,u+rail*.3,y-.8,.035,.5,.04,1);
        }
      }
    }
    for(const [i,t] of b.tanks.entries()){
      const m=t.black?4:3,y=b.h+.22+t.height/2;
      box(3,t.x,b.h+.11,t.z,1.45,.22,1.45);
      add(m,new T.CylinderGeometry(t.radius,t.radius,t.height,12).translate(t.x,y,t.z));
      for(const h of [-.35,.35])add(m,new T.TorusGeometry(t.radius+.015,.035,4,12).rotateX(Math.PI/2).translate(t.x,y+h,t.z));
      add(4,new T.CylinderGeometry(.23,.23,.12,10).translate(t.x,y+t.height/2+.06,t.z));
      box(3,t.x+.69,b.h+.36,t.z,.09,.65,.09);
    }
    parts.forEach((gs,i)=>{if(!gs.length)return;const g=mergeGeometries(gs,false);gs.forEach(x=>x.dispose());if(!g)throw Error('Housing geometry merge failed');const mesh=new T.Mesh(g,this.materials[i]);mesh.castShadow=i!==0;mesh.receiveShadow=true;group.add(mesh);});
    return group;
  }
  update(seconds:number,viewer?:{x:number;z:number},battery=false){
    if(this.dead||!viewer||seconds-this.last<.25)return;this.last=seconds;
    const radius=battery?150:260,limit=battery?12:24;
    const near=this.buildings.map(b=>({b,d:Math.hypot(b.x-viewer.x,b.z-viewer.z)})).filter(v=>v.d<radius).sort((a,b)=>a.d-b.d).slice(0,limit);
    const active=new Set(near.map(v=>String(v.b.id)));this.cache.forEach(g=>g.visible=false);
    for(const {b} of near){let g=this.cache.get(String(b.id));if(!g){g=this.build(b);this.cache.set(String(b.id),g);this.group.add(g);}g.visible=true;}
    for(const [id,g] of this.cache){if(this.cache.size<=36)break;if(active.has(id))continue;this.disposeGeometry(g);this.cache.delete(id);}
  }
  private disposeGeometry(g:T.Group){g.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});g.removeFromParent();}
  dispose(){if(this.dead)return;this.dead=true;this.cache.forEach(g=>this.disposeGeometry(g));this.cache.clear();this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.group.removeFromParent();}
}
