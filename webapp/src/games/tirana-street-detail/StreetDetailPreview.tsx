import React,{useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
/** Asset showroom only; the real games import WorldEnhancements instead. */
export function StreetDetailPreview({asset,glyph}:{asset:object;glyph:string}){
 const host=useRef<HTMLDivElement>(null),[error,setError]=useState(''),[ready,setReady]=useState(false);
 useEffect(()=>{
  if(!host.current)return;let dead=false,raf=0;const group=new T.Group(),scene=new T.Scene();
  let renderer:T.WebGLRenderer;try{renderer=new T.WebGLRenderer({antialias:true});}catch(e){setError(`WebGL unavailable: ${String(e)}`);return;}renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  host.current.appendChild(renderer.domElement);scene.background=new T.Color('#a8c1c8');scene.fog=new T.Fog('#a8c1c8',30,85);scene.add(new T.HemisphereLight('#ddeef3','#6b6955',2.7));
  const sun=new T.DirectionalLight('#ffedce',3);sun.position.set(15,25,10);scene.add(sun);scene.add(group);
  const camera=new T.PerspectiveCamera(52,1,.1,150);camera.position.set(15,13,22);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,2,-4);controls.enableDamping=true;controls.maxDistance=48;controls.minDistance=9;controls.maxPolarAngle=Math.PI/2.1;
  const owned=new Set<T.Material>(),textures=new Set<T.Texture>();
  const plane=(w:number,d:number,x:number,z:number,y:number,color:string)=>{const m=new T.MeshStandardMaterial({color,roughness:.92});owned.add(m);const o=new T.Mesh(new T.PlaneGeometry(w,d).rotateX(-Math.PI/2),m);o.position.set(x,y,z);group.add(o);return o;};
  plane(36,64,0,-9,-.02,'#a9a797');plane(12,60,0,-8,0,'#494f4d');plane(3,60,-7.5,-8,.02,'#c6c1b4');plane(3,60,7.5,-8,.02,'#c6c1b4');plane(1.5,60,-4.8,-8,.025,'#53604a');
  for(const x of [-5.7,5.7,-3.95])plane(.13,60,x,-8,.04,'#f2efe5');for(let z=-34;z<21;z+=7)if(Math.abs(z)>4)plane(.13,3,0,z,.045,'#f2efe5');
  plane(11.3,3,0,0,.05,'#883c36');for(let x=-5.2;x<5.3;x+=.95)plane(.48,2.6,x,0,.056,'#f2efe5');plane(5.2,.28,2.8,3,.056,'#f2efe5');
  const texture=new T.TextureLoader().load(glyph);texture.colorSpace=T.SRGBColorSpace;textures.add(texture);const sign=new T.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.1,depthWrite:false});owned.add(sign);const symbol=new T.Mesh(new T.PlaneGeometry(1.05,2.8).rotateX(-Math.PI/2),sign);symbol.position.set(-4.8,.06,8);group.add(symbol);
  const releaseLate=(root:T.Object3D)=>{root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const t of Object.values(m))if(t instanceof T.Texture)t.dispose();m.dispose();}}});};
  const loader=new GLTFLoader();void loader.parseAsync(JSON.stringify(asset),'').then(async g=>{
    if(dead){releaseLate(g.scene);return;}const material=await g.parser.getDependency('material',0) as T.MeshStandardMaterial;if(dead){releaseLate(g.scene);material.dispose();return;}owned.add(material);for(const v of Object.values(material))if(v instanceof T.Texture)textures.add(v);
    for(const x of [-6.5,6.5])for(const z of [-20,-14,-8,7,13,19]){const post=g.scene.clone(true);post.position.set(x,.02,z);group.add(post);}
    for(const x of [-13,13])for(const z of [-19,-6,8]){const mat=material.clone();mat.color.set(x<0?'#d9c4ae':'#b6c7bf');owned.add(mat);const geo=new T.BoxGeometry(8,10+(z+19)%7,9),p=geo.getAttribute('position'),n=geo.getAttribute('normal'),uv=geo.getAttribute('uv');for(let i=0;i<p.count;i++){const u=Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i);uv.setXY(i,u/4,p.getY(i)/4);}const b=new T.Mesh(geo,mat);geo.computeBoundingBox();b.position.set(x,(geo.boundingBox!.max.y-geo.boundingBox!.min.y)/2,z);group.add(b);
      const glass=new T.MeshStandardMaterial({color:'#385665',metalness:.2,roughness:.25});owned.add(glass);for(let y=2;y<9;y+=3)for(const dz of [-2.5,0,2.5]){const window=new T.Mesh(new T.BoxGeometry(.06,1.5,1.4),glass);window.position.set(x+(x<0?4.03:-4.03),y,z+dz);group.add(window);}}
    setReady(true);
  }).catch(e=>{if(!dead)setError(String(e));});
  const resize=()=>{if(!host.current)return;const w=host.current.clientWidth,h=host.current.clientHeight;renderer.setSize(w,h);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(host.current);resize();
  const frame=()=>{if(dead)return;controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(frame);};raf=requestAnimationFrame(frame);
  return()=>{dead=true;cancelAnimationFrame(raf);ro.disconnect();controls.dispose();const geometries=new Set<T.BufferGeometry>();group.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){owned.add(m);for(const t of Object.values(m))if(t instanceof T.Texture)textures.add(t);}}});geometries.forEach(g=>g.dispose());owned.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();};
 },[asset,glyph]);
 return <main style={{height:'100%',display:'flex',flexDirection:'column'}}><header style={{padding:'18px 16px'}}><small>TIRANA STREETS · RACING ROYAL</small><h1 style={{fontSize:22,margin:'7px 0'}}>Street detail study</h1><p style={{fontSize:12,lineHeight:1.5,margin:0}}>Authored sample block — not a map or live-game screenshot. Drag to orbit; pinch to inspect the materials.</p></header><div ref={host} style={{flex:1,minHeight:240}}/><footer style={{padding:14,fontSize:12}}>{error|| (ready?'glTF concrete posts · PBR walls · crossing and cycle markings':'Loading the glTF material kit…')}</footer></main>;
}
