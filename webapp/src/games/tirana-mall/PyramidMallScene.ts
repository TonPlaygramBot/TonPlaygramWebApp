import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {KTX2Loader} from 'three/examples/jsm/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {createWebGLRenderer} from '../tiranastreets/createWebGLRenderer';
import {NativeLandmarkLayer} from '../tirana-landmarks/NativeLandmarkLayer';
import {createMallBrand} from './MallBrand';
import {mallHallPosition} from './mallCatalog.mjs';
export type MallDestination={id:string;name:string;route:string;image?:string;description:string;count?:number};
const MODELS:Record<string,string>={kartroyale:'/assets/kart-royale/karts/apex.glb',airhockey:'/assets/airhockey/air-hockey-table.glb'};
function disposeTree(root:T.Object3D){
  const materials=new Set<T.Material>(),geometries=new Set<T.BufferGeometry>(),textures=new Set<T.Texture>();
  root.traverse(obj=>{if(obj instanceof T.Mesh){geometries.add(obj.geometry);for(const material of Array.isArray(obj.material)?obj.material:[obj.material])materials.add(material);}});
  materials.forEach(material=>{for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value);material.dispose();});
  textures.forEach(texture=>texture.dispose());geometries.forEach(geometry=>geometry.dispose());root.clear();
}
/** Authored gallery fit-out inside the existing mapped Pyramid, with the live
 * game artwork and existing GLBs. The city building is never substituted. */
export class PyramidMallScene {
  readonly renderer:T.WebGLRenderer;readonly camera=new T.PerspectiveCamera(65,1,.08,160);
  readonly scene=new T.Scene();private halls=new T.Group();private native:NativeLandmarkLayer;
  private boards:T.Object3D[]=[];private frame=0;private dead=false;private observer:ResizeObserver;
  private eye=new T.Vector3(0,1.68,24);private look=new T.Vector3(0,1.68,-14);private targetEye=this.eye.clone();private targetLook=this.look.clone();
  private floor=0;private last=0;private generation=0;private selected='';private items:MallDestination[]=[];
  private models=new Map<string,T.Group>();private requested=new Set<string>();
  private draco=new DRACOLoader().setDecoderPath('/vendor/three/examples/jsm/libs/draco/gltf/');
  private ktx=new KTX2Loader().setTranscoderPath('/vendor/three/examples/jsm/libs/basis/');private loader:GLTFLoader;
  private wall!:T.MeshStandardMaterial;
  private white!:T.MeshStandardMaterial;
  constructor(private root:HTMLElement,private select:(id:string)=>void,private fail:(message:string)=>void){
    this.renderer=createWebGLRenderer();this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;root.appendChild(this.renderer.domElement);
    this.ktx.detectSupport(this.renderer);this.loader=new GLTFLoader().setDRACOLoader(this.draco).setKTX2Loader(this.ktx).setMeshoptDecoder(MeshoptDecoder);
    this.scene.background=new T.Color('#102125');this.scene.fog=new T.Fog('#102125',45,100);this.scene.add(new T.HemisphereLight('#eafff7','#52616c',3));const sun=new T.DirectionalLight('#fff3d5',3.5);sun.position.set(0,16,8);this.scene.add(sun);
    this.native=new NativeLandmarkLayer([{id:'pyramid',name:'Pyramid of Tirana',x:0,z:0,groundY:0,yaw:0} as any]);
    this.native.group.traverse(object=>{if(object instanceof T.Mesh){for(const m of Array.isArray(object.material)?object.material:[object.material])m.side=T.DoubleSide;}});
    this.scene.add(this.native.group,this.halls);const logo=createMallBrand(8);logo.position.set(0,6,-22);this.scene.add(logo);
    this.observer=new ResizeObserver(this.resize);this.observer.observe(root);this.resize();
    this.renderer.domElement.addEventListener('pointerdown',this.pointerDown);this.renderer.domElement.addEventListener('pointerup',this.pointerUp);this.renderer.domElement.addEventListener('webglcontextlost',this.contextLost);
    this.frame=requestAnimationFrame(this.draw);
  }
  private resize=()=>{const w=Math.max(1,this.root.clientWidth),h=Math.max(1,this.root.clientHeight);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();};
  private down:{x:number;y:number}|null=null;
  private pointerDown=(event:PointerEvent)=>{this.down={x:event.clientX,y:event.clientY};};
  private pointerUp=(event:PointerEvent)=>{if(!this.down||Math.hypot(event.clientX-this.down.x,event.clientY-this.down.y)>12)return;this.down=null;const rect=this.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);const hit=ray.intersectObjects(this.boards,false)[0];if(hit)this.select(String(hit.object.userData.destination));};
  private contextLost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(this.frame);this.fail('The 3D view paused. You can still use the hall directory, or leave and re-enter the mall.');};
  private box(w:number,h:number,d:number,x:number,y:number,z:number,material:T.Material){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);this.halls.add(mesh);return mesh;}
  private label(text:string,width=4,height=.7){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const c=canvas.getContext('2d')!;c.fillStyle='#102125';c.fillRect(0,0,768,160);c.fillStyle='#a8fbe0';c.font='bold 39px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(text,384,80,735);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));}
  setDestinations(items:MallDestination[],shops:boolean){
    this.generation++;disposeTree(this.halls);this.models.clear();this.requested.clear();this.boards=[];this.items=items;this.floor=shops?4.5:0;this.selected='';
    // Distinct game halls below and equipment boutiques on the mezzanine.
    this.wall=new T.MeshStandardMaterial({color:shops?'#30333d':'#182b31',roughness:.72});this.white=new T.MeshStandardMaterial({color:'#dedfd6',roughness:.8});
    this.box(45,.2,48,0,this.floor-.12,0,this.white);
    this.box(1,.025,46,0,this.floor+.006,0,new T.MeshStandardMaterial({color:'#227e74',emissive:'#133c35',roughness:.5}));
    items.forEach((item,index)=>{
      const p=mallHallPosition(index,items.length),side=p.x<0?-1:1,y=this.floor;
      this.box(p.width,3.3,.16,p.x,y+1.65,p.z-p.depth/2,this.wall);this.box(p.width,3.3,.16,p.x,y+1.65,p.z+p.depth/2,this.wall);
      this.box(.2,3.3,p.depth,p.x+side*p.width/2,y+1.65,p.z,this.wall);
      this.box(p.width,.05,p.depth,p.x,y+.02,p.z,new T.MeshStandardMaterial({color:index%2?'#26474b':'#29434f',roughness:.5,metalness:.15}));
      const title=this.label(`${String(index+1).padStart(2,'0')}  ${item.name}`,p.depth-.25,.65);title.rotation.y=-side*Math.PI/2;title.position.set(side*5,y+2.9,p.z);title.userData.destination=item.id;this.halls.add(title);this.boards.push(title);
      const sign=this.label(shops?`${item.count??0} items · SHOP`:'ENTER GAME HALL',p.depth-1,.55);sign.rotation.y=-side*Math.PI/2;sign.position.set(side*16.8,y+2.5,p.z);this.halls.add(sign);
      if(item.image){const generation=this.generation;new T.TextureLoader().load(item.image,texture=>{if(this.dead||generation!==this.generation){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=this.renderer.capabilities.getMaxAnisotropy();const board=new T.Mesh(new T.PlaneGeometry(3,1.9),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));board.position.set(side*16.6,y+1.3,p.z);board.rotation.y=-side*Math.PI/2;board.userData.destination=item.id;this.halls.add(board);this.boards.push(board);},undefined,()=>{});}
    });this.lobby();
  }
  lobby(){this.targetEye.set(0,this.floor+1.68,this.floor?20:24);this.targetLook.set(0,this.floor+1.68,-14);this.selected='';}
  visit(id:string){const index=this.items.findIndex(item=>item.id===id);if(index<0)return;this.selected=id;const p=mallHallPosition(index,this.items.length),side=p.x<0?-1:1;this.targetEye.set(side*7,this.floor+1.68,p.z);this.targetLook.set(side*16.5,this.floor+1.55,p.z);
    if(this.floor===0&&MODELS[id]&&!this.requested.has(id)){
      this.requested.add(id);const generation=this.generation;void this.loader.loadAsync(MODELS[id]).then(gltf=>{if(this.dead||generation!==this.generation){disposeTree(gltf.scene);return;}const bounds=new T.Box3().setFromObject(gltf.scene),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),scale=3.5/Math.max(size.x,size.z,.1);gltf.scene.scale.setScalar(scale);gltf.scene.position.set(p.x-center.x*scale,this.floor-bounds.min.y*scale+.08,p.z-center.z*scale);this.halls.add(gltf.scene);this.models.set(id,gltf.scene);}).catch(()=>{if(!this.dead&&generation===this.generation)this.fail('This hall’s display model could not load. Its game lobby is still available.');});
    }
  }
  walk(direction:number){this.selected='';this.targetEye.set(0,this.floor+1.68,T.MathUtils.clamp(this.targetEye.z-direction*3.5,this.floor?-20:-22,this.floor?20:24));this.targetLook.set(0,this.floor+1.68,this.targetEye.z-12);}
  private draw=(now:number)=>{if(this.dead)return;const dt=this.last?Math.min(.05,(now-this.last)/1000):.016;this.last=now;const t=1-Math.exp(-dt*6);this.eye.lerp(this.targetEye,t);this.look.lerp(this.targetLook,t);this.camera.position.copy(this.eye);this.camera.lookAt(this.look);this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(this.draw);};
  dispose(){if(this.dead)return;this.dead=true;this.generation++;cancelAnimationFrame(this.frame);this.observer.disconnect();this.renderer.domElement.removeEventListener('pointerdown',this.pointerDown);this.renderer.domElement.removeEventListener('pointerup',this.pointerUp);this.renderer.domElement.removeEventListener('webglcontextlost',this.contextLost);this.native.dispose();disposeTree(this.scene);this.draco.dispose();this.ktx.dispose();this.models.clear();this.renderer.dispose();this.renderer.domElement.remove();}
}
