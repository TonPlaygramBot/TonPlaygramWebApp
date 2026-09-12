import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { createSnakeDie, getDiceOrientationQuaternion } from './components/SnakeBoard3D';
import { createRoyalDiceMotion, ROYAL_DICE_READ_MS } from './utils/royalDiceMotion';
import SnakeTurnPanel from './components/SnakeTurnPanel';
import './pages/Games/SnakeAndLadder.css';

function DiceMotionPreview() {
  const mount = useRef<HTMLDivElement>(null);
  const throwDie = useRef<(() => void) | null>(null);
  const [rolling, setRolling] = useState(false);
  const [holding, setHolding] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Production Snakes and Ladders die');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, .01, 10);
    camera.position.set(.20,.36,.46); camera.lookAt(0,.025,0);
    scene.add(new THREE.HemisphereLight('#e7eeff','#2b1b13',3));
    const light = new THREE.DirectionalLight('#fff2d4',5); light.position.set(.3,.8,.4); light.castShadow=true;
    light.shadow.mapSize.set(1024,1024); light.shadow.camera.near=.01; light.shadow.camera.far=3;
    light.shadow.camera.left=-.5; light.shadow.camera.right=.5; light.shadow.camera.top=.5; light.shadow.camera.bottom=-.5;
    light.shadow.bias=-.0004; scene.add(light);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.025,64),new THREE.MeshStandardMaterial({color:'#153a39',roughness:.85}));
    floor.position.y=-.016; floor.receiveShadow=true; scene.add(floor);
    const die = createSnakeDie({body:'#f8fafc',pip:'#111827',rim:'#fbbf24'});
    die.position.set(0,.0345,0); scene.add(die);
    let frame=0, timer: ReturnType<typeof setTimeout>, busy=false, alive=true;
    const resize=()=> { const w=host.clientWidth; renderer.setSize(w,320); camera.aspect=w/320; camera.updateProjectionMatrix(); renderer.render(scene,camera); };
    const observer=new ResizeObserver(resize); observer.observe(host); resize();
    throwDie.current=()=> {
      if(busy) return; busy=true; setRolling(true); setResult(null);
      const bytes=new Uint32Array(1); let random=0;
      do { crypto.getRandomValues(bytes); random=bytes[0]; } while(random>=4294967292);
      const value=random%6+1;
      const motion=createRoyalDiceMotion(die,new THREE.Vector3(.04,.105,.19),new THREE.Vector3(0,.0345,0),{
        target:getDiceOrientationQuaternion(value),height:.06,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches
      });
      const update=(now:number)=> {
        if(!alive)return;
        const done=motion.update(now); renderer.render(scene,camera);
        if(!done)frame=requestAnimationFrame(update);
        else {setResult(value);setRolling(false);setHolding(true);timer=setTimeout(()=>{busy=false;setHolding(false);},ROYAL_DICE_READ_MS);}
      };
      frame=requestAnimationFrame(update);
    };
    return ()=> {alive=false;throwDie.current=null;cancelAnimationFrame(frame);clearTimeout(timer);observer.disconnect();scene.traverse(obj=>{const mesh=obj as THREE.Mesh;if(mesh.geometry)mesh.geometry.dispose();if(mesh.material)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>m.dispose());});renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <div className="snake-motion-review">
    <div className="snake-motion-heading"><strong>Snakes & Ladders</strong><span>Dice motion preview</span></div>
    <div ref={mount} className="snake-motion-canvas" />
    {error ? <p role="alert">3D preview needs WebGL enabled on your device.</p> : <SnakeTurnPanel canRoll={!rolling && !holding} rolling={rolling} moving={false} waiting={false} message={result===6?'Six! Roll again':'Your turn'} result={result} position={0} finalTile={50} seconds={15} playerName="You" onRoll={()=>throwDie.current?.()} />}
  </div>;
}

createRoot(document.getElementById('snake-motion-root')!).render(<DiceMotionPreview/>);
