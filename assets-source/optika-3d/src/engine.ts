import * as T from 'three';
import {Actor,disposeScene,getModel,setMeshes} from './assets';
import {SoftwareRenderer} from './software';
import {Atmosphere} from './atmosphere';
import {Layout,Mission} from './data';
import {FLIGHT_CUT_SECONDS,flightPresentation} from './flightPresentation';
export type CameraMode='third'|'first';
export type SoundEvent='hit'|'miss'|'load'|'zoom'|'finish';
export interface Stats{ammo:number;hp:number;hits:number;shots:number;score:number;phase:'hunt'|'extract'|'won'|'lost';scope:boolean;mode:CameraMode;reloading:boolean;total:number}
export interface GameUi{stats:(s:Stats)=>void;loading:(line:string,pct:number)=>void;ready:()=>void;error:(e:string)=>void;notice:(text:string)=>void;sound:(type:SoundEvent)=>void}
type V=T.Vector3;
type Foe={actor:Actor;start:V;end:V;t:number;direction:number;down:number;cool:number;alert:number;visible:boolean;tag:HTMLDivElement};
type Streak={mesh:T.Mesh;start:V;end:V;age:number;life:number;cinematic:boolean};
const UP=new T.Vector3(0,1,0),v3=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=T.MathUtils.clamp;
export class Game{
  public status:Stats={ammo:7,hp:100,hits:0,shots:0,score:0,phase:'hunt',scope:false,mode:'third',reloading:false,total:3};
  public paused=false;private stopped=false;private ready=false;private raf=0;private oldTime=0;private accumulator=0;private time=0;
  private renderer:T.WebGLRenderer|SoftwareRenderer;private scene=new T.Scene();private camera=new T.PerspectiveCamera(60,1,.035,420);private atmo:Atmosphere;
  private observer:ResizeObserver;private width=1;private height=1;private ratio=1;private frames=0;private slowFrames=0;
  private player:Actor|null=null;private fp:T.Object3D|null=null;private foes:Foe[]=[];private layouts:Layout|null=null;
  private position=v3(0,0,10);private yaw=0;private pitch=-.018;private ySpeed=0;private speed=0;private step=0;private direction=v3(0,0,-1);private right=v3(1,0,0);
  private input=new T.Vector2();private keys=new Set<string>();private lastShot=-10;private recoil=0;private reloadEnd=0;
  private ray=new T.Raycaster();private bodyRay=new T.Ray();private floorHits:T.Object3D[]=[];
  private exitFlag:T.Group;private exitPos=v3();private exitLabel:HTMLDivElement;
  private streaks:Streak[]=[];private shotMat=new T.MeshBasicMaterial({color:0xffc06b,toneMapped:false});private enemyMat=new T.MeshBasicMaterial({color:0xdc8c5f,toneMapped:false});private streakShape=new T.SphereGeometry(.045,8,5);
  private film:{start:V;end:V;dir:V;age:number}|null=null;private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;private alerts=false;
  constructor(private holder:HTMLDivElement,private labels:HTMLDivElement,private compass:HTMLDivElement,private range:HTMLSpanElement,private mission:Mission,private cb:GameUi){
    this.yaw=({harbor:-.26,airfield:-.11,alpine:-.17,valley:-.065} as Record<string,number>)[mission.id]||0;
    if(mission.id==='harbor')this.position.x=-1.25;
    let gpu:T.WebGLRenderer|null=null;try{const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});if(gl)gpu=new T.WebGLRenderer({canvas,context:gl,antialias:true,alpha:false,powerPreference:'high-performance'})}catch{}this.renderer=gpu??new SoftwareRenderer(mission);this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.domElement.setAttribute('aria-label','Bota 3D');holder.prepend(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost',this.lost);
    this.scene.add(this.camera);this.atmo=new Atmosphere(this.scene,mission,gpu);this.exitFlag=this.buildExit();
    this.exitLabel=document.createElement('div');this.exitLabel.className='exit-tag';this.exitLabel.textContent='DALJA';labels.appendChild(this.exitLabel);this.exitLabel.hidden=true;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(holder);this.resize();this.updateCamera(1);
    this.load();this.raf=requestAnimationFrame(this.frame);
  }
  private lost=(e:Event)=>{e.preventDefault();this.paused=true;this.cb.error('Pamja 3D u ndërpre. Rihap skenën për të vazhduar.')};
  private async load(){
    let temporary:T.Object3D[]=[];try{
      const progress=[0,0,0,0];const weights=[.43,.25,.23,.09];let last=0;
      const update=(i:number,n:number)=>{if(this.stopped)return;progress[i]=Math.max(progress[i],clamp(n,0,1));const pc=Math.floor(progress.reduce((s,p,j)=>s+p*weights[j],0)*96);if(pc>=last+3){last=pc;this.cb.loading(pc<45?'Po ngarkohet ambienti 3D…':'Po përgatiten personazhet…',pc)}};
      const part=async(name:string,i:number)=>{const g=await getModel(name,n=>update(i,n));if(this.stopped){disposeScene(g.scene);return g}temporary.push(g.scene);update(i,1);return g};
      const [map,hero,guard,fp,layout]=await Promise.all([part(this.mission.id,0),part('hero',1),part('guard',2),part('rig-fpv',3),fetch('worlds/'+this.mission.id+'.json').then(r=>{if(!r.ok)throw Error('layout');return r.json() as Promise<Layout>})]);
      if(this.stopped)return;
      this.layouts=layout;setMeshes(map.scene);map.scene.traverse(o=>{if(o instanceof T.Mesh){o.userData.softwareStatic=true;const names=(o.name+' '+(Array.isArray(o.material)?o.material.map(m=>m.name).join(' '):o.material.name)).toLowerCase();if(/water|ocean|cloud|mountain|terrainfar|horizon|distant/.test(names))o.castShadow=false;this.floorHits.push(o)}});this.scene.add(map.scene);
      this.player=new Actor(hero,'hero');this.scene.add(this.player.root);this.player.root.position.copy(this.position);this.player.root.rotation.y=Math.PI-this.yaw;
      this.fp=fp.scene;this.fp.visible=false;setMeshes(this.fp,false);this.camera.add(this.fp);
      this.foes=layout.patrols.slice(0,3).map((p,i)=>{const actor=new Actor(guard,'guard');const start=v3(p[0],0,p[1]),end=v3(p[2],0,p[3]);const t=[.28,.54,.81][i];actor.root.position.lerpVectors(start,end,t);this.scene.add(actor.root);actor.motion('walk');
        const tag=document.createElement('div');tag.className='foe-tag';tag.setAttribute('aria-hidden','true');tag.innerHTML='<i></i>';this.labels.appendChild(tag);return{actor,start,end,t,direction:i%2?-1:1,down:-1,cool:3+i*1.5,alert:0,visible:true,tag}});
      this.status.total=this.foes.length;
      const route=layout.patrols[layout.patrols.length-1];this.exitPos.set(route[2],0,route[3]);for(const zz of [layout.bounds[2]+4,layout.bounds[2]+7,-14]){if(this.canStand(.4,zz)){this.exitPos.set(.4,0,zz);break}}
      this.exitFlag.position.copy(this.exitPos);this.exitFlag.visible=false;this.scene.add(this.exitFlag);
      this.ready=true;this.updateCamera(1);this.cb.loading('Gati',100);this.cb.stats({...this.status});this.cb.ready();temporary=[];
    }catch(e){if(!this.stopped){temporary.forEach(s=>{if(!s.parent)disposeScene(s)});this.cb.error('Një nga modelet 3D nuk u hap. Provo ta ngarkosh sërish.');console.error(e)}}
  }
  private buildExit(){
    const group=new T.Group(),mat=new T.MeshStandardMaterial({color:0xd4b676,metalness:.3,roughness:.53,emissive:0x3b3a1f});const ring=new T.Mesh(new T.TorusGeometry(1.25,.034,7,64),mat);ring.rotation.x=-Math.PI/2;ring.position.y=.08;group.add(ring);
    for(let i=0;i<3;i++){const spark=new T.Mesh(new T.OctahedronGeometry(.10),mat);spark.position.set(Math.cos(i*2.094)*1.25,.24,Math.sin(i*2.094)*1.25);group.add(spark)}return group;
  }
  private resize(){this.width=this.holder.clientWidth||1;this.height=this.holder.clientHeight||1;this.ratio=Math.min(devicePixelRatio,this.width<700?1.55:1.28);this.renderer.setPixelRatio(this.ratio);this.renderer.setSize(this.width,this.height,false);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix()}
  private emit(){this.cb.stats({...this.status})}
  key(key:string,pressed:boolean){if(pressed)this.keys.add(key);else this.keys.delete(key)}
  stick(x:number,y:number){this.input.set(x,y);if(this.input.length()>1)this.input.normalize()}
  drag(dx:number,dy:number){if(this.paused||!this.ready||this.film)return;const k=(this.status.scope?.00165:.00365)*(this.width<560?1.12:1);this.yaw+=dx*k;this.pitch=clamp(this.pitch-dy*k,-.79,.76)}
  clear(){this.input.set(0,0);this.keys.clear()}
  toggleCamera(){if(!this.ready||this.paused)return;this.status.mode=this.status.mode==='third'?'first':'third';this.status.scope=false;this.film=null;for(const s of this.streaks)if(s.cinematic)s.age=s.life;this.updateCamera(1);this.emit();this.cb.notice(this.status.mode==='first'?'Pamja nga sytë':'Pamja pas lojtarit')}
  scope(){if(!this.ready||this.paused||this.film)return;this.status.scope=!this.status.scope;this.cb.sound('zoom');this.updateCamera(.05);this.emit()}
  jump(){if(!this.ready||this.paused||this.position.y>.025)return;this.ySpeed=4.1}
  reload(){if(!this.ready||this.paused||this.reloadEnd||this.status.ammo===7||this.status.phase!=='hunt')return;this.status.reloading=true;this.reloadEnd=this.time+1.05;this.cb.sound('load');this.cb.notice('Duke rimbushur…');this.emit()}
  private inside(x:number,z:number,b:[number,number,number,number],margin:number){return Math.abs(x-b[0])<b[2]/2+margin&&Math.abs(z-b[1])<b[3]/2+margin}
  private canStand(x:number,z:number){if(!this.layouts)return true;const [xmin,xmax,zmin,zmax]=this.layouts.bounds;if(x<xmin+.3||x>xmax-.3||z<zmin+.3||z>zmax-.3)return false;return !this.layouts.blocks.some(b=>this.inside(x,z,b,.29))}
  private advance(dt:number){
    const key=(v:string)=>Number(this.keys.has(v));
    const vx=this.input.x+key('d')-key('a'),vz=-this.input.y+key('w')-key('s')+key('ArrowUp')-key('ArrowDown');
    const l=Math.hypot(vx,vz),v=this.status.scope?1.45:(this.keys.has('Shift')||l>.87?4.1:2.35);
    this.yaw+=dt*(key('ArrowRight')-key('ArrowLeft'))*1.6;const sin=Math.sin(this.yaw),cos=Math.cos(this.yaw),div=Math.max(1,l);
    const dx=(cos*vx+sin*vz)/div*v*dt,dz=(sin*vx-cos*vz)/div*v*dt;
    const ox=this.position.x,oz=this.position.z;
    if(this.canStand(ox+dx,oz))this.position.x+=dx;if(this.canStand(this.position.x,oz+dz))this.position.z+=dz;
    this.speed=Math.hypot(this.position.x-ox,this.position.z-oz)/dt;
    this.ySpeed-=12*dt;this.position.y+=this.ySpeed*dt;if(this.position.y<=0){this.position.y=0;this.ySpeed=0}
    this.step+=this.speed*dt*2.4;const player=this.player!;
    player.root.position.copy(this.position);player.root.rotation.y=Math.PI-this.yaw;player.motion(this.speed>2.8?'run':this.speed>.15?'walk':'idle');player.tick(dt);
    if(this.status.phase==='extract'&&Math.hypot(this.position.x-this.exitPos.x,this.position.z-this.exitPos.z)<1.7){this.status.phase='won';this.status.score+=250;this.emit();this.cb.sound('finish')}
  }
  private wall(a:V,b:V){
    if(!this.layouts)return false;for(const block of this.layouts.blocks){
      const [x,z,w,d]=block,dx=b.x-a.x,dz=b.z-a.z;let lo=.003,hi=.994;
      const axis=(o:number,delta:number,min:number,max:number)=>{if(Math.abs(delta)<.00001)return o>=min&&o<=max;const q=(min-o)/delta,r=(max-o)/delta;lo=Math.max(lo,Math.min(q,r));hi=Math.min(hi,Math.max(q,r));return lo<=hi};
      if(axis(a.x,dx,x-w*.5,x+w*.5)&&axis(a.z,dz,z-d*.5,z+d*.5))return true;
    }return false;
  }
  private updateFoes(dt:number){
    for(const e of this.foes){
      if(e.down>=0){e.down+=dt;e.actor.root.rotation.z=-1.30*clamp(e.down/.51,0,1);e.actor.root.position.y=-.15*clamp(e.down/.51,0,1);if(e.down>1.4)e.actor.root.visible=false;continue}
      const pos=e.actor.root.position;const length=e.start.distanceTo(e.end);const distance=pos.distanceTo(this.position);
      const alert=this.alerts&&distance<21&&!this.wall(pos,this.position)&&this.status.phase==='hunt';
      e.alert=alert?Math.min(1,e.alert+dt):Math.max(0,e.alert-dt*.6);
      if(e.alert>.79){e.actor.motion('idle');e.actor.root.rotation.y=Math.atan2(this.position.x-pos.x,this.position.z-pos.z);
        e.cool-=dt;if(e.cool<=0&&!this.film){e.cool=3.9+Math.random()*2.4;const from=pos.clone().add(v3(0,1.33,0)),to=this.position.clone().add(v3(.02,1.15,0));this.streak(from,to,true);this.status.hp=Math.max(0,this.status.hp-(this.speed>2?3:7));if(this.status.hp===0)this.status.phase='lost';this.holder.classList.remove('damaged');void this.holder.offsetWidth;this.holder.classList.add('damaged');this.emit()}
      }else{
        e.t+=e.direction*dt*.8/Math.max(1,length);if(e.t>1||e.t<0){e.t=clamp(e.t,0,1);e.direction*=-1}pos.lerpVectors(e.start,e.end,e.t);e.actor.root.rotation.y=Math.atan2((e.end.x-e.start.x)*e.direction,(e.end.z-e.start.z)*e.direction);e.actor.motion('walk')
      }
      e.actor.tick(dt);
    }
  }
  private updateCamera(dt:number){
    const sin=Math.sin(this.yaw),cos=Math.cos(this.yaw),cp=Math.cos(this.pitch);this.direction.set(sin*cp,Math.sin(this.pitch),-cos*cp);this.right.set(cos,0,sin);
    const first=this.status.mode==='first'||this.status.scope;const bob=this.reduced?0:Math.min(1,this.speed/3)*Math.sin(this.step)*.027;
    const eye=this.position.clone().add(v3(0,1.61+bob,0));const look=eye.clone().addScaledVector(this.direction,14);
    if(first)this.camera.position.copy(eye);
    else{
      const back=v3(-sin*3.95+cos*.53,.78,cos*3.95+sin*.53);
      let factor=1;for(let t=.17;t<=1;t+=.10){const p=eye.clone().addScaledVector(back,t);if(this.layouts?.blocks.some(b=>this.inside(p.x,p.z,b,.10))){factor=Math.max(.13,t-.13);break}}
      this.camera.position.copy(eye).addScaledVector(back,factor);
    }
    this.camera.lookAt(look);if(this.recoil>0)this.camera.rotateX(this.recoil*.012);
    const fov=this.status.scope?24:(this.width/this.height<.85?66:56);this.camera.fov=T.MathUtils.lerp(this.camera.fov,fov,dt===1?1:1-Math.exp(-16*dt));this.camera.updateProjectionMatrix();
    if(this.film){
      const c=this.film,p=flightPresentation(c.age);
      const tracer=v3().lerpVectors(c.start,c.end,p.travel);
      const side=v3().crossVectors(UP,c.dir).normalize();
      const follow=tracer.clone().addScaledVector(c.dir,-.82).addScaledVector(side,.19);
      follow.y+=.11;
      this.camera.position.lerp(follow,p.blend);
      this.camera.lookAt(look.clone().lerp(tracer,p.blend));
    }
    if(this.player)this.player.root.visible=!first&&!this.film;
    if(this.fp){this.fp.visible=first&&!this.status.scope&&!this.film;this.fp.position.set(Math.sin(this.step/2)*Math.min(1,this.speed)*.006,-this.recoil*.012+bob*.27,this.recoil*.07);this.fp.rotation.x=this.recoil*.065}
    this.camera.updateMatrixWorld();
  }
  private streak(from:V,to:V,enemy=false,cinematic=false){
    const mesh=new T.Mesh(this.streakShape,enemy?this.enemyMat:this.shotMat);
    mesh.scale.set(1,1,cinematic?4.8:3);mesh.position.copy(from);mesh.lookAt(to);
    this.scene.add(mesh);
    this.streaks.push({mesh,start:from,end:to,age:0,life:cinematic?FLIGHT_CUT_SECONDS:enemy?.24:.13,cinematic});
  }
  private obstacle(ray:T.Ray,limit:number){this.ray.ray.copy(ray);this.ray.near=.12;this.ray.far=limit;const closest=this.ray.intersectObjects(this.floorHits,false)[0];return closest?closest.distance:limit}
  shoot(ndc?:T.Vector2){
    if(!this.ready||this.paused||this.film||this.status.phase!=='hunt'||this.status.reloading||this.time-this.lastShot<.28)return;
    if(this.status.ammo===0){this.reload();return}
    this.lastShot=this.time;this.status.ammo--;this.status.shots++;this.alerts=true;this.recoil=1;
    this.ray.setFromCamera(ndc||new T.Vector2(),this.camera);this.bodyRay.copy(this.ray.ray);
    let winner:Foe|undefined,best=100;const impact=v3(),point=v3();
    for(const e of this.foes){if(e.down>=0)continue;const pos=e.actor.root.position;const a=pos.clone().add(v3(0,.35,0)),b=pos.clone().add(v3(0,1.55,0));const nearest=v3();
      const d=this.bodyRay.distanceSqToSegment(a,b,nearest,point),dist=nearest.distanceTo(this.bodyRay.origin);const ease=this.width<650?Math.min(.18,dist*.009):.035;
      if(d<(.36+ease)**2&&dist<best){winner=e;best=dist;impact.copy(nearest)}
    }
    const blocking=this.obstacle(this.bodyRay,winner?best-.22:70);
    if(winner&&blocking<best-.24)winner=undefined;
    const end=winner?impact:this.bodyRay.at(blocking,v3());
    if(ndc){const eye=this.position.clone().add(v3(0,1.6,0));const aim=end.clone().sub(eye).normalize();this.yaw=Math.atan2(aim.x,-aim.z);this.pitch=clamp(Math.asin(aim.y),-.79,.76)}
    const from=this.position.clone().addScaledVector(this.direction,.62).addScaledVector(this.right,.18).add(v3(0,1.34,0));const cinematic=Boolean(winner)&&!this.reduced&&from.distanceToSquared(end)>4;
    this.streak(from,end,false,cinematic);
    if(winner){
      winner.down=0;winner.tag.hidden=true;this.status.hits++;this.status.score+=150;this.cb.sound('hit');this.cb.notice('Goditje  +150');
      if(cinematic){this.film={start:from,end,dir:end.clone().sub(from).normalize(),age:0}}
      if(this.status.hits===this.status.total){this.status.phase='extract';this.status.scope=false;this.exitFlag.visible=true;this.cb.notice('Zona u pastrua · Shko te dalja')}
    }else{this.cb.sound('miss');if(!this.status.ammo)this.cb.notice('Prek për të rimbushur')}
    this.emit();
  }
  private tags(){
    const update=(el:HTMLDivElement,p:V,okay:boolean)=>{if(!okay){el.hidden=true;return}const n=p.project(this.camera);el.hidden=n.z>1||n.z<0||Math.abs(n.x)>1.04||Math.abs(n.y)>1;if(!el.hidden)el.style.transform='translate3d('+((n.x*.5+.5)*this.width)+'px,'+((.5-n.y*.5)*this.height)+'px,0)'};
    let near=Infinity;
    for(const e of this.foes){if(e.down>=0){e.tag.hidden=true;continue}const p=e.actor.root.position;near=Math.min(near,this.position.distanceTo(p));update(e.tag,p.clone().add(v3(0,2.13,0)),!this.film&&!this.wall(this.position,p))}
    if(this.status.phase==='extract'){
      near=this.position.distanceTo(this.exitPos);this.exitLabel.textContent='DALJA · '+Math.round(near)+' m';update(this.exitLabel,this.exitPos.clone().add(v3(0,1.5,0)),true)
    }else this.exitLabel.hidden=true;
    this.range.textContent=isFinite(near)?Math.round(near)+' m':'';
    const deg=((this.yaw*180/Math.PI)%360+360)%360;this.compass.style.setProperty('--shift',(-deg*1.45)+'px');
  }
  private frame=(stamp:number)=>{
    if(this.stopped)return;const raw=(stamp-(this.oldTime||stamp))/1000;this.oldTime=stamp;const dt=Math.min(.07,raw);
    if(!this.paused&&!document.hidden){
      if(this.ready&&(this.status.phase==='hunt'||this.status.phase==='extract')){
        this.accumulator+=dt;while(this.accumulator>=1/60){this.time+=1/60;if(!this.film)this.advance(1/60);this.updateFoes(1/60);this.accumulator-=1/60}
        if(this.reloadEnd&&this.time>=this.reloadEnd){this.status.ammo=7;this.status.reloading=false;this.reloadEnd=0;this.emit()}
        if(this.film){this.film.age+=dt;if(this.film.age>=FLIGHT_CUT_SECONDS)this.film=null}
        this.recoil=Math.max(0,this.recoil-dt*5.8);this.updateCamera(dt);this.atmo.update(dt,this.position);
        if(this.exitFlag.visible)this.exitFlag.rotation.y+=dt*.28;
        for(const s of this.streaks){s.age+=dt;s.mesh.position.lerpVectors(s.start,s.end,(s.cinematic?flightPresentation(s.age).travel:clamp(s.age/s.life,0,1)));if(s.age>=s.life)this.scene.remove(s.mesh)}this.streaks=this.streaks.filter(s=>s.age<s.life);
        this.tags();this.frames++;if(raw>.058)this.slowFrames++;if(this.frames===120){if(this.slowFrames>42&&this.ratio>.86){this.ratio=Math.max(.85,this.ratio*.83);this.renderer.setPixelRatio(this.ratio)}this.frames=this.slowFrames=0}
      }
      if(this.ready)this.renderer.render(this.scene,this.camera)
    }
    this.raf=requestAnimationFrame(this.frame);
  };
  destroy(){this.stopped=true;cancelAnimationFrame(this.raf);this.observer.disconnect();this.clear();this.renderer.domElement.removeEventListener('webglcontextlost',this.lost);this.foes.forEach(e=>e.actor.dispose());this.player?.dispose();this.labels.replaceChildren();this.atmo.dispose();disposeScene(this.scene);this.streakShape.dispose();this.shotMat.dispose();this.enemyMat.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove()}
}
