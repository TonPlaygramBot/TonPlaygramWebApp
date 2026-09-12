import * as T from 'three';
import {urbanLightLevel} from './urbanLightingCore.mjs';
import {applyWindowLighting} from './windowLighting';
import {environmentAt, environmentRandom, environmentSeed} from './weatherCore.mjs';

/** Shared, entirely cosmetic day/weather system. No frame-loop ownership and no
 * gameplay randomness. All clocks, clouds, precipitation and lighting agree. */
export class CinematicAtmosphere {
  readonly group=new T.Group();
  readonly seed:number;
  current:ReturnType<typeof environmentAt>;
  private sun:T.DirectionalLight;
  private hemisphere:T.HemisphereLight;
  private ownSun=false;private ownHemisphere=false;
  private sky:T.Mesh<T.SphereGeometry,T.ShaderMaterial>;
  private rain:T.LineSegments<T.BufferGeometry,T.ShaderMaterial>;
  private surfaces=new Map<T.MeshStandardMaterial,{roughness:number;color:T.Color;emissive:T.Color;intensity:number;window:boolean}>();
  private emitters=new Set<T.MeshStandardMaterial>();
  private localLights=new Set<T.PointLight>();
  private scanAt=-Infinity;private shadowAt=-Infinity;private dead=false;
  private top=new T.Color();private horizon=new T.Color();private temp=new T.Color();
  private direction=new T.Vector3();
  constructor(private scene:T.Scene,private renderer:T.WebGLRenderer,seed=environmentSeed()){
    this.seed=seed;this.current=environmentAt(seed);
    this.sun=scene.children.find(o=>o instanceof T.DirectionalLight) as T.DirectionalLight;
    if(!this.sun){this.sun=new T.DirectionalLight();this.ownSun=true;scene.add(this.sun,this.sun.target);}
    this.hemisphere=scene.children.find(o=>o instanceof T.HemisphereLight) as T.HemisphereLight;
    if(!this.hemisphere){this.hemisphere=new T.HemisphereLight();this.ownHemisphere=true;scene.add(this.hemisphere);}
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);
    Object.assign(this.sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:500});
    this.sun.shadow.camera.updateProjectionMatrix();this.sun.shadow.normalBias=.045;this.sun.shadow.bias=-.00015;
    this.sun.shadow.autoUpdate=false;
    this.sky=new T.Mesh(new T.SphereGeometry(1,24,12),new T.ShaderMaterial({
      side:T.BackSide,depthWrite:false,depthTest:false,
      uniforms:{top:{value:this.top},horizon:{value:this.horizon},cloud:{value:0},night:{value:0},time:{value:0},sunDirection:{value:this.direction}},
      vertexShader:'varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec3 ray;uniform vec3 top,horizon,sunDirection;uniform float cloud,night,time;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){vec3 d=normalize(ray);float h=max(d.y,0.);vec3 color=mix(horizon,top,smoothstep(-.06,.8,d.y));
          vec2 p=d.xz/(.22+h)*2.8+vec2(time*.003,time*.001);
          float n=noise(p)*.6+noise(p*2.1)*.27+noise(p*4.3)*.13;
          float cover=smoothstep(.88-cloud*.68,1.04-cloud*.62,n)*smoothstep(0.,.16,d.y);
          vec3 cloudColor=mix(vec3(.88,.9,.88),vec3(.045,.065,.10),night);
          color=mix(color,cloudColor,cover*(.7+cloud*.2));
          float disk=smoothstep(.99945,.9998,dot(d,normalize(sunDirection)));
          color+=vec3(1.,.72,.38)*disk*(1.-cloud*.93)*(1.-night);
          gl_FragColor=vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    }));
    this.sky.name='Moving cloud sky';this.sky.frustumCulled=false;this.sky.renderOrder=-1000;
    const points:number[]=[],tips:number[]=[];
    for(let i=0;i<720;i++){
      const x=(environmentRandom(seed,i+100)-.5)*56,y=environmentRandom(seed,i+900)*24,z=(environmentRandom(seed,i+1800)-.5)*56;
      points.push(x,y,z,x+.08,y+.75,z+.035);tips.push(0,.75);
    }
    const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(points,3)).setAttribute('dropTip',new T.Float32BufferAttribute(tips,1));
    this.rain=new T.LineSegments(geometry,new T.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{time:{value:0},opacity:{value:0},wind:{value:new T.Vector2()}},
      vertexShader:'uniform float time;uniform vec2 wind;attribute float dropTip;void main(){vec3 p=position;p.y=mod(p.y-dropTip-time*15.,24.)+dropTip;p.xz+=wind*(24.-p.y)*.13;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
      fragmentShader:'uniform float opacity;void main(){gl_FragColor=vec4(.68,.78,.83,opacity);}'
    }));
    this.rain.name='Local rain';this.rain.frustumCulled=false;
    this.group.name='Tirana:cinematic-weather-and-time';this.group.add(this.sky,this.rain);scene.add(this.group);
    scene.fog=new T.FogExp2(0xb9c4c5,.0006);
  }
  update(seconds:number,camera:T.PerspectiveCamera,battery=false){
    if(this.dead)return;
    const p=this.current=environmentAt(this.seed,seconds);
    this.group.userData.environment=p;
    this.top.set('#739db7').lerp(this.temp.set('#526875'),p.cloud*.55).lerp(this.temp.set('#0c182c'),p.night);
    this.horizon.set('#ced5cf').lerp(this.temp.set('#d0a47d'),p.golden*(1-p.cloud*.75)).lerp(this.temp.set('#85969c'),p.cloud*.55).lerp(this.temp.set('#253449'),p.night);
    const angle=(p.hour-6)/24*Math.PI*2;
    this.direction.set(Math.cos(angle),p.sunHeight,Math.sin(angle)*.65).normalize();
    this.sky.position.copy(camera.position);this.sky.scale.setScalar(camera.far*.8);
    const u=this.sky.material.uniforms;u.cloud.value=p.cloud;u.night.value=p.night;u.time.value=seconds;
    const fog=this.scene.fog as T.FogExp2;fog.color.copy(this.horizon);fog.density=p.fog*(.85+p.night*.2);
    this.hemisphere.color.copy(this.top).lerp(this.temp.set('#eef2ee'),.55);
    this.hemisphere.groundColor.set('#696b50').lerp(this.temp.set('#293240'),p.night);
    this.hemisphere.intensity=.65+p.daylight*(1.05+p.cloud*.3);
    this.sun.color.set('#fff0d4').lerp(this.temp.set('#ffd097'),p.golden).lerp(this.temp.set('#91afe0'),p.night);
    this.sun.intensity=.12+p.daylight*3.2*(1-p.cloud*.8);
    this.renderer.toneMappingExposure=1.02+p.golden*.08+p.night*.12;
    this.scene.environmentIntensity=.22+p.daylight*.58;
    this.rain.visible=p.rain>.015;this.rain.position.set(camera.position.x,camera.position.y-8,camera.position.z);
    this.rain.geometry.setDrawRange(0,battery?360:1440);this.rain.material.uniforms.time.value=seconds;this.rain.material.uniforms.opacity.value=p.rain*.36;this.rain.material.uniforms.wind.value.set(p.windX,p.windZ);
    // Snap the moving shadow box to its texel grid; limit map rendering on phones.
    if(seconds<this.shadowAt||seconds-this.shadowAt>(battery?.25:.075)){
      const texel=120/this.sun.shadow.mapSize.x;
      this.sun.target.position.set(Math.round(camera.position.x/texel)*texel,0,Math.round(camera.position.z/texel)*texel);
      const lightDirection=this.direction.clone();if(lightDirection.y<.12)lightDirection.set(-lightDirection.x,.3,-lightDirection.z).normalize();
      this.sun.position.copy(this.sun.target.position).addScaledVector(lightDirection,200);
      this.sun.shadow.needsUpdate=true;this.shadowAt=seconds;
    }
    if(seconds<this.scanAt||seconds-this.scanAt>2){
      const found=new Set<T.MeshStandardMaterial>();this.emitters.clear();this.localLights.clear();
      this.scene.traverse(o=>{if(o instanceof T.PointLight&&o.userData.environmentLight)this.localLights.add(o);if(!(o instanceof T.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
        if(!(m instanceof T.MeshStandardMaterial))continue;
        if(m.userData.environmentLight)this.emitters.add(m);
        if(!m.userData.environmentSurface&&!m.userData.environmentWindow)continue;
        if(m.userData.environmentWindow)applyWindowLighting(m);
        found.add(m);if(!this.surfaces.has(m))this.surfaces.set(m,{roughness:m.roughness,color:m.color.clone(),emissive:m.emissive.clone(),intensity:m.emissiveIntensity,window:!!m.userData.environmentWindow});
      }});
      for(const m of this.surfaces.keys())if(!found.has(m))this.surfaces.delete(m);
      this.scanAt=seconds;
    }
    for(const light of this.localLights){
      if(!light.parent){this.localLights.delete(light);continue;}
      light.intensity=light.userData.lightAvailable===false?0:urbanLightLevel(p,light.userData.environmentLight)*light.userData.nightIntensity;
    }
    for(const m of this.emitters){
      if(!m.emissiveMap)m.emissive.set('#ffe2b4');
      m.emissiveIntensity=urbanLightLevel(p,m.userData.environmentLight)*(m.userData.nightIntensity||1);
    }
    for(const [m,dry] of this.surfaces){
      if(dry.window){m.emissive.set('#ffe3b0');m.emissiveIntensity=urbanLightLevel(p,'apartment')*1.15;}
      else{m.roughness=dry.roughness*(1-p.wetness*.65);m.color.copy(dry.color).multiplyScalar(1-p.wetness*.19);}
    }
  }
  dispose(){
    if(this.dead)return;this.dead=true;
    for(const [m,dry] of this.surfaces){m.roughness=dry.roughness;m.color.copy(dry.color);m.emissive.copy(dry.emissive);m.emissiveIntensity=dry.intensity;}this.surfaces.clear();
    this.sky.geometry.dispose();this.sky.material.dispose();this.rain.geometry.dispose();this.rain.material.dispose();
    this.emitters.clear();this.localLights.clear();this.group.removeFromParent();this.group.clear();
    if(this.ownSun){this.sun.removeFromParent();this.sun.target.removeFromParent();this.sun.dispose();}
    if(this.ownHemisphere)this.hemisphere.removeFromParent();
  }
}
