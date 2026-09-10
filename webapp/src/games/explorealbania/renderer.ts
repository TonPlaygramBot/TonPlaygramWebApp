import * as THREE from 'three';
import { ALBANIA_OUTLINE, CITIES, ROADS, pathBetween } from './world';
import type { TruckState } from './simulation';

export type CameraMode='chase'|'cab'|'cinematic';
const V=()=>new THREE.Vector3();
const material=(color:string,rough=.75,metal=0)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});

export class AlbaniaRenderer {
  renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(54,1,.1,1800);
  truck=new THREE.Group();trailer=new THREE.Group();traffic:THREE.Group[]=[];sun=new THREE.DirectionalLight(0xfff0cf,3.1);
  resize:ResizeObserver;dead=false;
  constructor(private host:HTMLElement){
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.45));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.domElement.setAttribute('aria-label','3D truck driving across Albania');host.appendChild(this.renderer.domElement);
    this.scene.background=new THREE.Color('#8ec6db');this.scene.fog=new THREE.Fog('#91bdc9',90,520);
    this.scene.add(new THREE.HemisphereLight(0xcde8ff,0x40502e,2.2),this.sun);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.far=420;Object.assign(this.sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80});
    this.buildWorld();this.buildTruck();this.buildTraffic();
    this.resize=new ResizeObserver(()=>this.size());this.resize.observe(host);this.size();
  }
  private mesh(geo:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D=this.scene){const m=new THREE.Mesh(geo,mat);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  private box(size:[number,number,number],position:[number,number,number],color:string,parent:THREE.Object3D=this.scene,rough=.68,metal=0){const m=this.mesh(new THREE.BoxGeometry(...size),material(color,rough,metal),parent);m.position.set(...position);return m;}
  private buildWorld(){
    const shape=new THREE.Shape();ALBANIA_OUTLINE.forEach((p,i)=>i?shape.lineTo(p.x,p.z):shape.moveTo(p.x,p.z));
    const land=this.mesh(new THREE.ShapeGeometry(shape),material('#657c44',.96));land.rotation.x=-Math.PI/2;land.position.y=-.18;
    const sea=this.mesh(new THREE.PlaneGeometry(900,1000),new THREE.MeshStandardMaterial({color:'#26799a',roughness:.28,metalness:.08}));sea.rotation.x=-Math.PI/2;sea.position.set(-500,-.35,-80);
    for(const road of ROADS){
      const curve=new THREE.CatmullRomCurve3(road.points.map(p=>new THREE.Vector3(p.x,.04,p.z)),false,'centripetal');
      const asphalt=this.mesh(new THREE.TubeGeometry(curve,Math.max(8,road.points.length*8),4.8,6,false),material('#343a3c',.91));asphalt.scale.y=.055;asphalt.receiveShadow=true;
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(60)),new THREE.LineDashedMaterial({color:'#f2df96',dashSize:2.4,gapSize:3.1,transparent:true,opacity:.82}));line.position.y=.12;line.computeLineDistances();this.scene.add(line);
      for(let i=0;i<road.points.length-1;i++){const a=road.points[i],b=road.points[i+1],len=Math.hypot(b.x-a.x,b.z-a.z);for(let d=12;d<len;d+=20){const t=d/len,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,side=(Math.floor(d/20)%2?1:-1),nx=-(b.z-a.z)/len,nz=(b.x-a.x)/len;this.tree(x+nx*(7+side*2),z+nz*(7+side*2),.75+((d*7)%10)/20);}}
    }
    CITIES.forEach((c,ci)=>{
      const depot=this.box([12,.35,10],[c.x,.18,c.z],'#a94736');depot.castShadow=false;
      for(let i=0;i<12;i++){const angle=i*2.399+ci,height=2.5+(i*13%7),radius=8+(i%4)*3,x=c.x+Math.cos(angle)*radius,z=c.z+Math.sin(angle)*radius;const b=this.box([3+(i%3),height,3+(i%2)],[x,height/2,z],i%3===0?'#d9c4a0':i%3===1?'#b9b5a7':'#8f9b94');b.castShadow=i<5;}
      const beacon=this.mesh(new THREE.CylinderGeometry(1.6,1.6,.16,24),new THREE.MeshBasicMaterial({color:'#ffcf55',transparent:true,opacity:.78}));beacon.position.set(c.x,.2,c.z);beacon.rotation.x=Math.PI/2;
    });
    for(let i=0;i<42;i++){const x=80+(i%7)*28+Math.sin(i*2)*18,z=-380+Math.floor(i/7)*150+(i%3)*18,h=14+(i*17%20);const mountain=this.mesh(new THREE.ConeGeometry(18+(i%4)*7,h,7),material(i%2?'#6f7856':'#7e8467',1));mountain.position.set(x,h/2-.2,z);mountain.castShadow=false;}
  }
  private tree(x:number,z:number,s=1){const g=new THREE.Group(),trunk=this.mesh(new THREE.CylinderGeometry(.18,.25,1.7,5),material('#60452e'),g),crown=this.mesh(new THREE.ConeGeometry(1.25,3.8,7),material('#315b37'),g);trunk.position.y=.85;crown.position.y=2.5;g.position.set(x,0,z);g.scale.setScalar(s);this.scene.add(g);}
  private wheel(parent:THREE.Group,x:number,z:number){const w=this.mesh(new THREE.CylinderGeometry(.62,.62,.38,16),material('#111414',.9),parent);w.rotation.z=Math.PI/2;w.position.set(x,.66,z);const hub=this.mesh(new THREE.CylinderGeometry(.28,.28,.4,12),material('#9ea7a5',.35,.65),parent);hub.rotation.z=Math.PI/2;hub.position.copy(w.position);}
  private buildTruck(){
    const cab=this.box([2.55,2.8,2.5],[0,2.05,.6],'#d83b32',this.truck,.25);cab.geometry.translate(0,0,0);this.box([2.35,.85,1.15],[0,2.45,-1.15],'#d83b32',this.truck,.25);
    const glass=new THREE.MeshStandardMaterial({color:'#18374a',roughness:.18,metalness:.25});for(const x of [-.66,.66]){const w=this.mesh(new THREE.PlaneGeometry(1.05,.72),glass,this.truck);w.position.set(x,2.62,-1.265);w.rotation.y=Math.PI;}
    this.box([2.1,.18,.12],[0,1.35,-1.31],'#dbe4df',this.truck,.7,.7);for(const x of [-.85,.85]){const l=this.mesh(new THREE.CircleGeometry(.22,16),new THREE.MeshBasicMaterial({color:'#fff2bd'}),this.truck);l.position.set(x,1.55,-1.375);l.rotation.y=Math.PI;}
    for(const x of [-1.28,1.28])for(const z of [-.8,.85])this.wheel(this.truck,x,z);
    this.box([2.7,3.1,6.4],[0,2.2,3.9],'#e6e2d7',this.trailer,.04);this.box([2.72,.22,6.45],[0,.62,3.9],'#a8adb0',this.trailer,.75,.5);for(const x of [-1.36,1.36])for(const z of [2.25,4.9,5.8])this.wheel(this.trailer,x,z);this.trailer.position.z=0;
    this.scene.add(this.trailer,this.truck);
  }
  private buildTraffic(){for(let i=0;i<15;i++){const g=new THREE.Group(),color=['#e4aa31','#e7e4dc','#3977b8','#823b35'][i%4];this.box([1.65,1.05,3.5],[0,1.05,0],color,g,.12);this.box([1.45,.62,1.6],[0,1.78,.2],'#24434e',g,.1);for(const x of [-.86,.86])for(const z of [-1.15,1.15])this.wheel(g,x,z);g.scale.setScalar(.78);this.scene.add(g);this.traffic.push(g);}}
  private sampleRoad(index:number,time:number){const road=ROADS[index%ROADS.length],points=road.points;let lengths:number[]=[],total=0;for(let i=1;i<points.length;i++){total+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);lengths.push(total);}let d=(time*(5+index%4)+index*47)%total,i=lengths.findIndex(v=>v>=d);if(i<0)i=lengths.length-1;const before=i?lengths[i-1]:0,t=(d-before)/(lengths[i]-before),a=points[i],b=points[i+1];return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,heading:Math.atan2(b.x-a.x,b.z-a.z)};}
  draw(state:TruckState,mode:CameraMode){if(this.dead)return;
    this.truck.position.set(state.x,0,state.z);this.truck.rotation.y=state.heading+Math.PI;this.trailer.position.set(state.x-Math.sin(state.heading)*.25,0,state.z-Math.cos(state.heading)*.25);this.trailer.rotation.y=state.heading+Math.PI;
    this.traffic.forEach((g,i)=>{const p=this.sampleRoad(i,state.time*90);g.position.set(p.x,0,p.z);g.rotation.y=p.heading;});
    const forward=new THREE.Vector3(Math.sin(state.heading),0,Math.cos(state.heading)),right=new THREE.Vector3(forward.z,0,-forward.x),target=new THREE.Vector3(state.x,1.7,state.z);
    if(mode==='cab'){this.camera.position.copy(target).addScaledVector(forward,-1.05).addScaledVector(right,.62);target.addScaledVector(forward,24);target.y=1.5;}
    else {const orbit=mode==='cinematic'?Math.sin(state.time*2)*.7:0;this.camera.position.copy(target).addScaledVector(forward,mode==='cinematic'?-14:-11).addScaledVector(right,orbit*8);this.camera.position.y=mode==='cinematic'?7.5:6.2;target.addScaledVector(forward,7);}
    this.camera.lookAt(target);const daylight=Math.max(.08,Math.sin((state.time-6)/24*Math.PI*2)*.62+.42);this.sun.intensity=.5+daylight*3;this.sun.position.set(state.x+80,state.z%30+110,state.z+55);this.scene.background=new THREE.Color().setHSL(.56,.42,.12+daylight*.5);(this.scene.fog as THREE.Fog).color.copy(this.scene.background as THREE.Color);
    this.renderer.render(this.scene,this.camera);
  }
  private size(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  dispose(){this.dead=true;this.resize.disconnect();this.scene.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.geometry.dispose();for(const mat of Array.isArray(m.material)?m.material:[m.material])mat.dispose();}});this.renderer.dispose();this.renderer.domElement.remove();}
}

/** Playable road view for WebViews that disable WebGL. */
export class AlbaniaCanvasRenderer {
  canvas=document.createElement('canvas');context:CanvasRenderingContext2D;resize:ResizeObserver;dead=false;
  constructor(private host:HTMLElement){const c=this.canvas.getContext('2d');if(!c)throw Error('Canvas graphics unavailable');this.context=c;this.canvas.setAttribute('aria-label','Compatibility truck driving view across Albania');host.appendChild(this.canvas);this.resize=new ResizeObserver(()=>this.size());this.resize.observe(host);this.size();}
  private size(){const d=Math.min(devicePixelRatio||1,1.5),w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.canvas.width=w*d;this.canvas.height=h*d;this.canvas.style.width=`${w}px`;this.canvas.style.height=`${h}px`;this.context.setTransform(d,0,0,d,0,0);}
  draw(state:TruckState,mode:CameraMode){if(this.dead)return;const c=this.context,w=this.host.clientWidth,h=this.host.clientHeight,day=Math.max(.08,Math.sin((state.time-6)/24*Math.PI*2)*.62+.42),horizon=h*.38;
    const sky=c.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,day>.25?`rgb(${55+day*85},${90+day*100},${120+day*100})`:'#081329');sky.addColorStop(1,day>.25?'#d9bd82':'#263451');c.fillStyle=sky;c.fillRect(0,0,w,horizon);
    c.fillStyle='#3f5743';c.beginPath();c.moveTo(0,horizon);for(let x=0;x<=w;x+=w/8)c.lineTo(x,horizon-20-Math.sin(x*.047+state.z*.002)*45-(x%3)*8);c.lineTo(w,h*.72);c.lineTo(0,h*.72);c.fill();
    c.fillStyle='#526748';c.fillRect(0,horizon,w,h-horizon);const steer=Math.sin(state.heading)*w*.08,cx=w/2+steer;c.fillStyle='#34393c';c.beginPath();c.moveTo(cx-w*.055,horizon);c.lineTo(cx+w*.055,horizon);c.lineTo(w*.94,h);c.lineTo(w*.06,h);c.fill();
    c.strokeStyle='#eacb77';c.lineWidth=3;c.setLineDash([18,22]);c.lineDashOffset=(state.odometer*80)%40;c.beginPath();c.moveTo(cx,horizon);c.lineTo(w/2,h);c.stroke();c.setLineDash([]);
    if(mode!=='cab'){const y=h*.68,bw=Math.min(155,w*.4);c.fillStyle='#e7e4da';c.fillRect(w/2-bw/2,y,bw,bw*.55);c.fillStyle='#b72f2b';c.fillRect(w/2-bw*.43,y+bw*.42,bw*.86,bw*.42);c.fillStyle='#173540';c.fillRect(w/2-bw*.29,y+bw*.47,bw*.58,bw*.18);c.fillStyle='#111';c.beginPath();c.arc(w/2-bw*.33,y+bw*.87,bw*.12,0,Math.PI*2);c.arc(w/2+bw*.33,y+bw*.87,bw*.12,0,Math.PI*2);c.fill();}
    c.fillStyle='#f2d27a';for(let i=0;i<3;i++){const y=horizon+((i*140+state.odometer*60)%(h-horizon)),scale=(y-horizon)/(h-horizon);c.fillRect(w*.5-2-scale*150,y,4+scale*4,8+scale*8);}
  }
  dispose(){this.dead=true;this.resize.disconnect();this.canvas.remove();}
}
