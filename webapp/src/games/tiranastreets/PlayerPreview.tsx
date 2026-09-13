import {useEffect,useRef} from 'react';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {normalizePlayableHuman} from './street-career/humanoidRig.mjs';
import {disposeWeaponResources} from './weaponModelResources';
export type PreviewState = {url:string;ready:boolean;message:string};
/** One model and one WebGL context at a time, released before the game mounts. */
export function PlayerPreview({url,label,onState}:{url:string|null;label:string;onState:(state:PreviewState)=>void}) {
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!host.current||!url)return;
    const root=host.current,abort=new AbortController();
    let closed=false,contextLost=false,frame=0,model:T.Object3D|undefined,mixer:T.AnimationMixer|undefined,renderer:T.WebGLRenderer|undefined;
    const scene=new T.Scene();scene.background=new T.Color('#15232b');
    const camera=new T.PerspectiveCamera(34,1,.05,30);camera.position.set(0,1.05,3.6);
    const clock=new T.Clock();let controls:OrbitControls|undefined,observer:ResizeObserver|undefined;
    const report=(ready:boolean,message:string)=>{if(!closed)onState({url,ready,message});};
    report(false,`Loading ${label}…`);
    const timer=setTimeout(()=>abort.abort(),45000);
    const lost=(event:Event)=>{event.preventDefault();contextLost=true;cancelAnimationFrame(frame);report(false,'3D preview was interrupted. Tap Retry.');};
    try {
      renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
      renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
      renderer.domElement.setAttribute('aria-label',`${label} 3D preview`);renderer.domElement.setAttribute('role','img');
      root.appendChild(renderer.domElement);renderer.domElement.addEventListener('webglcontextlost',lost);
      scene.add(new T.HemisphereLight(0xd7e9ff,0x6b6257,2.4));
      const key=new T.DirectionalLight(0xffefda,3.4);key.position.set(3,5,4);scene.add(key);
      const rim=new T.DirectionalLight(0x9dc8f4,2.2);rim.position.set(-3,3,-3);scene.add(rim);
      const floor=new T.Mesh(new T.CircleGeometry(1.5,48),new T.MeshStandardMaterial({color:0x344650,roughness:.9}));
      floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);
      controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.94,0);controls.enablePan=false;controls.enableDamping=true;
      controls.minDistance=2.4;controls.maxDistance=5;controls.minPolarAngle=Math.PI*.22;controls.maxPolarAngle=Math.PI*.62;
      const resize=()=>{const width=root.clientWidth||320,height=root.clientHeight||330;camera.aspect=width/height;camera.updateProjectionMatrix();renderer?.setSize(width,height,false);};
      observer=new ResizeObserver(resize);observer.observe(root);resize();
      const render=()=>{if(closed)return;frame=requestAnimationFrame(render);if(document.hidden)return;const dt=Math.min(.05,clock.getDelta());mixer?.update(dt);controls?.update();renderer?.render(scene,camera);};render();
      void (async()=>{
        const response=await fetch(url,{signal:abort.signal});
        if(!response.ok)throw Error(`Character download failed (${response.status}).`);
        const bytes=await response.arrayBuffer();if(closed)return;
        if(bytes.byteLength<20||new DataView(bytes).getUint32(0,true)!==0x46546c67)throw Error('Character file is unavailable.');
        const gltf=await new GLTFLoader().parseAsync(bytes,url.slice(0,url.lastIndexOf('/')+1));
        if(closed){disposeWeaponResources([gltf.scene]);return;}
        try{model=normalizePlayableHuman(gltf.scene);}catch(error){disposeWeaponResources([gltf.scene]);throw error;}
        scene.add(model);
        const idle=gltf.animations.find(clip=>/idle/i.test(clip.name));
        if(idle){mixer=new T.AnimationMixer(model);mixer.clipAction(idle).play();}
        if(!contextLost){renderer?.render(scene,camera);report(true,'Drag to rotate · pinch to zoom');}
      })().catch(error=>report(false,abort.signal.aborted?'The character download took too long. Tap Retry.':String(error?.message||error))).finally(()=>clearTimeout(timer));
    }catch{report(false,'WebGL is unavailable. Enable hardware graphics, then retry.');}
    return ()=>{
      closed=true;clearTimeout(timer);abort.abort();cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();
      mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);disposeWeaponResources([scene]);
      renderer?.domElement.removeEventListener('webglcontextlost',lost);renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();
    };
  },[url,label,onState]);
  return <div ref={host} className="player-preview" />;
}
