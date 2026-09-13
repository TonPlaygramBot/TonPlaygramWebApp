import {useEffect,useRef} from 'react';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {disposeWeaponResources} from './weaponModelResources';

export type PreviewState = {url:string;ready:boolean;message:string};
/** One selected model and one canvas. Shares the playable rig and releases all
 * owned graphics resources when the player changes the selection. */
export function LoadoutPreview({url,label,kind='person',onState}:{url:string;label:string;kind?:'person'|'weapon';onState:(s:PreviewState)=>void}) {
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!host.current||!url)return;
    const root=host.current,abort=new AbortController();let dead=false,raf=0;
    let model:T.Group|undefined,mixer:T.AnimationMixer|undefined,renderer:T.WebGLRenderer;
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(kind==='person'?32:30,1,.01,100);
    onState({url,ready:false,message:'Loading 3D preview…'});
    try{renderer=new T.WebGLRenderer({alpha:true,antialias:true});}
    catch{onState({url,ready:false,message:'3D graphics could not start. Retry the preview.'});return;}
    const view=renderer;
    view.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
    view.outputColorSpace=T.SRGBColorSpace;view.toneMapping=T.ACESFilmicToneMapping;
    root.appendChild(view.domElement);
    const controls=new OrbitControls(camera,view.domElement);
    controls.enablePan=false;controls.enableZoom=false;controls.enableDamping=true;
    controls.minPolarAngle=Math.PI*.25;controls.maxPolarAngle=Math.PI*.65;
    scene.add(new T.HemisphereLight(0xe7f3ff,0x485545,3));
    const key=new T.DirectionalLight(0xffe6c8,3.5);key.position.set(-3,4,4);scene.add(key);
    const rim=new T.DirectionalLight(0xb5dafa,2);rim.position.set(3,2,-3);scene.add(rim);
    const resize=()=>{const width=root.clientWidth,height=root.clientHeight;if(!width||!height)return;view.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(root);resize();
    const clock=new T.Clock();
    const draw=()=>{if(dead)return;const dt=Math.min(clock.getDelta(),.05);if(root.offsetWidth&&!document.hidden){mixer?.update(dt);controls.update();view.render(scene,camera);}raf=requestAnimationFrame(draw);};draw();
    const timer=setTimeout(()=>abort.abort(),20000);
    void (async()=>{
      try{
        const response=await fetch(url,{signal:abort.signal});if(!response.ok)throw Error(`HTTP ${response.status}`);
        const bytes=await response.arrayBuffer();if(dead)return;
        const gltf=await new GLTFLoader().parseAsync(bytes,new URL('.',new URL(url,window.location.href)).href);
        if(dead){disposeWeaponResources([gltf.scene]);return;}
        model=gltf.scene;model.traverse(o=>{if(o.name==='Pistol')o.visible=false;});
        const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3());
        if(!Number.isFinite(size.y)||size.length()<.001)throw Error('Empty model');
        const scale=(kind==='person'?1.78:1)/(kind==='person'?size.y:Math.max(size.x,size.y,size.z));
        model.scale.multiplyScalar(scale);model.position.sub(box.getCenter(new T.Vector3()).multiplyScalar(scale));
        if(kind==='person'){
          model.position.y+=.89;camera.position.set(0,1.03,3.9);controls.target.set(0,.92,0);
          mixer=new T.AnimationMixer(model);const idle=gltf.animations.find(a=>a.name.toLowerCase()==='idle');if(idle)mixer.clipAction(idle).play();
        }else{camera.position.set(1.6,.45,1.35);controls.target.set(0,0,0);}
        scene.add(model);controls.update();view.render(scene,camera);
        onState({url,ready:true,message:kind==='person'?'Drag to rotate your character':'Drag to rotate the weapon'});
      }catch{if(!dead)onState({url,ready:false,message:'Preview could not load. Check your connection and retry.'});}
      finally{clearTimeout(timer);}
    })();
    return()=>{dead=true;abort.abort();clearTimeout(timer);cancelAnimationFrame(raf);observer.disconnect();controls.dispose();mixer?.stopAllAction();if(model){mixer?.uncacheRoot(model);disposeWeaponResources([model]);}view.dispose();view.forceContextLoss();view.domElement.remove();};
  },[url,kind,onState]);
  return <div ref={host} className="loadout-model-preview" role="img" aria-label={`3D preview of ${label}`}/>;
}
