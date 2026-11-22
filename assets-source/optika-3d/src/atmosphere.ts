import * as T from 'three';
import {Mission} from './data';
const skyVert=`varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const skyFrag=`varying vec3 ray;
uniform vec3 zenith,horizon,warm,sundir;uniform float phase,overcast;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float cloud(vec2 p){return .52*noise(p)+.26*noise(2.02*p+14.)+.14*noise(4.15*p-8.)+.08*noise(8.3*p+27.);}
void main(){vec3 n=normalize(ray);float h=max(n.y,0.);float s=max(dot(n,sundir),0.);vec3 col=mix(horizon,zenith,pow(h,.55));col=mix(col,warm,.45*pow(s,6.));vec2 uv=n.xz/(h+.17)*1.6+vec2(phase*.004,0.);float c=cloud(uv);float density=smoothstep(.43-overcast*.08,.76,c)*smoothstep(-.04,.18,n.y);vec3 cloudColor=mix(horizon*.73,vec3(1.0,.96,.85),.2+.5*pow(s,3.)+.25*c);col=mix(col,cloudColor,density*.88);col+=vec3(1.,.80,.53)*(.16*pow(s,30.)+.62*pow(s,650.))*(1.-.65*density);gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
export class Atmosphere{
  private sky:T.Mesh;private weather:T.Points|null=null;private weatherBuf:Float32Array|null=null;private time=0;
  private flock:T.Group[]=[];private cube:T.WebGLRenderTarget|null=null;private shadow:T.DirectionalLight;
  constructor(private world:T.Scene,private level:Mission,renderer:T.WebGLRenderer|null){
    const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{zenith:{value:new T.Color(level.sky[0])},horizon:{value:new T.Color(level.sky[1])},warm:{value:new T.Color(level.sky[2])},sundir:{value:new T.Vector3(...level.sunDirection).normalize()},phase:{value:0},overcast:{value:level.weather==='rain'?1:0}},vertexShader:skyVert,fragmentShader:skyFrag});
    this.sky=new T.Mesh(new T.SphereGeometry(260,32,18),skyMat);this.sky.renderOrder=-20;world.add(this.sky);
    const envWorld=new T.Scene();envWorld.background=new T.Color(level.haze);
    const envSky=this.sky.clone();envWorld.add(envSky);if(renderer){const gen=new T.PMREMGenerator(renderer);this.cube=gen.fromScene(envWorld,.06,.1,400);world.environment=this.cube.texture;gen.dispose();}
    world.fog=new T.FogExp2(level.haze,level.id==='harbor'?.0105:.007);
    world.add(new T.HemisphereLight(0xfff8eb,level.ground,1.38));
    this.shadow=new T.DirectionalLight(level.sun,level.weather==='rain'?2.25:2.7);this.shadow.position.set(...level.sunDirection);this.shadow.target.position.set(0,0,-5);this.shadow.castShadow=true;
    const sh=this.shadow.shadow;sh.mapSize.set(1024,1024);Object.assign(sh.camera,{left:-29,right:29,top:32,bottom:-32,near:2,far:145});sh.normalBias=.025;sh.bias=-.0006;world.add(this.shadow,this.shadow.target);
    if(level.weather!=='clear'){
      const n=level.weather==='snow'?195:115,pos=new Float32Array(n*3);for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*29;pos[i*3+1]=Math.random()*13;pos[i*3+2]=(Math.random()-.5)*29}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));this.weatherBuf=pos;
      const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{isSnow:{value:level.weather==='snow'?1:0}},vertexShader:`uniform float isSnow;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((isSnow>.5?22.:55.)/max(2.,-mv.z),1.,7.);}`,fragmentShader:`uniform float isSnow;void main(){vec2 p=gl_PointCoord-.5;float a=isSnow>.5?(1.-smoothstep(.18,.5,length(p)))*.49:(1.-smoothstep(.02,.1,abs(p.x+p.y*.13)))*.35;gl_FragColor=vec4(.87,.91,.93,a);}`});this.weather=new T.Points(geo,mat);this.weather.frustumCulled=false;world.add(this.weather);
    }
    if(level.id==='harbor'||level.id==='airfield'){
      const birdMat=new T.MeshStandardMaterial({color:0xe0dfce,roughness:1,side:T.DoubleSide});
      for(let i=0;i<5;i++){const group=new T.Group();for(const sign of [-1,1]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,sign*.40,.15,-.04,sign*.81,.10,.15, 0,0,0,sign*.81,.10,.15,sign*.32,.05,.18],3));g.computeVertexNormals();group.add(new T.Mesh(g,birdMat))}world.add(group);this.flock.push(group)}
    }
  }
  update(dt:number,p:T.Vector3){this.time+=dt;(this.sky.material as T.ShaderMaterial).uniforms.phase.value=this.time;this.sky.position.set(p.x,0,p.z);
    this.flock.forEach((b,i)=>{let t=this.time*.075+i*.61;b.position.set(Math.sin(t)*24-6,9+Math.sin(t+i)*2+i*.64,-28+Math.cos(t)*12);b.rotation.y=-t+.5;for(let j=0;j<2;j++)b.children[j].rotation.z=(j?1:-1)*Math.sin(this.time*3+i)*.2});
    if(this.weather&&this.weatherBuf){this.weather.position.set(p.x,0,p.z);const snow=this.level.weather==='snow';const a=this.weatherBuf;for(let i=0;i<a.length;i+=3){a[i+1]-=dt*(snow?.72:8.3);a[i]+=dt*(snow?.08:-.45);if(a[i+1]<0){a[i+1]=13;a[i]=(Math.random()-.5)*28;a[i+2]=(Math.random()-.5)*28}}this.weather.geometry.attributes.position.needsUpdate=true}
  }
  dispose(){this.cube?.dispose();this.shadow.shadow.map?.dispose()}
}
