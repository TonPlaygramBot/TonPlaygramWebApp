import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

// Filled by the reproducible exporter from the game's actual Blender GLBs.
declare const __TIRANA_EMBEDDED_MODELS__: {near:string;far:string};
const models=__TIRANA_EMBEDDED_MODELS__;

async function decode(encoded:string){
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

function Preview(){
  const host=useRef<HTMLDivElement>(null);
  const viewer=useRef<{setDetail:(near:boolean)=>void}>();
  const [near,setNear]=useState(true),[ready,setReady]=useState(false),[error,setError]=useState(false);
  useEffect(()=>{
    const el=host.current!;
    let dead=false,frame=0;
    const groups:T.Group[]=[];
    let renderer:T.WebGLRenderer;
    try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}
    catch{setError(true);return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.domElement.setAttribute('role','img');
    renderer.domElement.setAttribute('aria-label','Interactive Blender model of the 85 metre Skanderbeg Building; drag to orbit and pinch to zoom.');
    el.appendChild(renderer.domElement);
    const scene=new T.Scene();
    const camera=new T.PerspectiveCamera(43,1,.1,900);
    camera.position.set(-58,16,140);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.target.set(0,42,0);controls.minDistance=38;controls.maxDistance=260;
    controls.maxPolarAngle=Math.PI*.62;controls.enableDamping=true;
    controls.enablePan=true;controls.screenSpacePanning=true;controls.update();
    scene.add(new T.HemisphereLight(0xebf6ff,0x727469,2.7));
    const sun=new T.DirectionalLight(0xfff0d7,3.3);sun.position.set(-70,130,95);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-75,right:75,top:115,bottom:-40,near:1,far:350});sun.shadow.bias=-.00025;scene.add(sun);
    const ground=new T.Mesh(new T.CircleGeometry(80,64),new T.ShadowMaterial({opacity:.17}));
    ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
    const render=()=>{
      if(dead)return;
      if(frame)cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{frame=0;controls.update();renderer.render(scene,camera);});
    };
    controls.addEventListener('change',render);
    const resize=new ResizeObserver(()=>{
      const w=el.clientWidth,h=el.clientHeight;
      camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);render();
    });resize.observe(el);
    void Promise.all([models.near,models.far].map(async encoded=>{
      const {scene:group}=await new GLTFLoader().parseAsync(await decode(encoded),'');
      group.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
      groups.push(group);return group;
    })).then(([detailed,distant])=>{
      if(dead)return;
      scene.add(detailed,distant);distant.visible=false;
      viewer.current={setDetail(value){detailed.visible=value;distant.visible=!value;render();}};
      setReady(true);render();
    }).catch(()=>{if(!dead)setError(true);});
    render();
    return()=>{
      dead=true;cancelAnimationFrame(frame);resize.disconnect();controls.dispose();viewer.current=undefined;
      for(const group of [...groups,ground])group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
      renderer.dispose();renderer.domElement.remove();
    };
  },[]);
  const choose=(value:boolean)=>{setNear(value);viewer.current?.setDetail(value);};
  return <div>
    <div className="viz-row"><span>Skanderbeg Building</span><span className="text-small text-muted">85 m · Tirana</span></div>
    <div ref={host} className="tirana-sculpture-canvas" />
    <div className="viz-controls" aria-label="Building detail">
      <button className="btn" type="button" disabled={!ready} aria-pressed={near} onClick={()=>choose(true)}>Detailed</button>
      <button className="btn" type="button" disabled={!ready} aria-pressed={!near} onClick={()=>choose(false)}>Distant</button>
      <span className="text-small" aria-live="polite">{error?'Unable to open the 3D view':ready?'Original Blender recreation':'Opening 3D view…'}</span>
    </div>
  </div>;
}
createRoot(document.getElementById('tirana-realism-repairs')!).render(<Preview/>);
