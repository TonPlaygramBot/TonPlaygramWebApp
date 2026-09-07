'use client';
import {memo,useCallback,useEffect,useMemo,useRef,useState,type ComponentProps} from 'react';
import * as THREE from 'three';
import {Game as OriginalGame} from './baseUi';
import type {GameEngine} from './engine';
import {ORIGIN} from './shared/layout.mjs';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {CityMap} from '../tiranastreets/map/CityMap';
import {buildMapGraph,findMapRoute,type Point} from '../tiranastreets/map/mapCore.mjs';
import {worldPlayer,sceneRoute,openMapSession} from '../tiranastreets/map/fpsMapBridge.mjs';
import './cityMapOverlay.css';
export * from './baseUi';
const BaseGame=memo(OriginalGame);
type Place=Point&{name:string;id?:string;available?:boolean};

/** Adds map UI to the active merged FPS game. The original combat UI and engine
 * remain unchanged; no second simulation or camera is started. */
export function Game(props:ComponentProps<typeof OriginalGame>){
  const [game,setGame]=useState<GameEngine|null>(null),callback=useRef(props.onEngine);
  callback.current=props.onEngine;
  const capture=useCallback((engine:GameEngine)=>{setGame(engine);callback.current?.(engine);},[]);
  const [player,setPlayer]=useState<(Point&{heading:number})|undefined>(),[phase,setPhase]=useState('menu');
  const [open,setOpen]=useState(false),session=useRef<{close():void}|null>(null);
  const [destination,setDestination]=useState<Place|null>(null),[route,setRoute]=useState<Point[]>([]),[notice,setNotice]=useState('');
  const dialog=useRef<HTMLDialogElement>(null),launch=useRef<HTMLButtonElement>(null);
  const graph=useMemo(()=>buildMapGraph(WORLD,'walk'),[]);
  const close=()=>{setOpen(false);session.current?.close();session.current=null;launch.current?.focus();};
  useEffect(()=>{
    if(!game)return;
    const line=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xddf67d,transparent:true,opacity:.86}));
    line.name='Tirana:personal-navigation-route';line.visible=false;line.renderOrder=5;game.scene.add(line);
    let last=0,lastX=Infinity,lastZ=Infinity;
    const tick=()=>{
      const p=worldPlayer(game.player,game.yaw,ORIGIN);setPlayer(p);setPhase(game.phase);
      const now=performance.now();
      if(destination&&(!last||now-last>1000&&(Math.hypot(p.x-lastX,p.z-lastZ)>4||open))){
        const result=findMapRoute(graph,p,destination);setRoute(result.points);setNotice(result.message);
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(sceneRoute(result.points,ORIGIN),3));geometry.computeBoundingSphere();
        line.geometry.dispose();line.geometry=geometry;line.visible=result.points.length>1;
        last=now;lastX=p.x;lastZ=p.z;
      }else if(!destination){setRoute(previous=>previous.length?[]:previous);setNotice('');}
    };
    tick();const timer=window.setInterval(tick,200);
    return()=>{window.clearInterval(timer);line.removeFromParent();line.geometry.dispose();(line.material as THREE.Material).dispose();};
  },[game,destination,graph,open]);
  useEffect(()=>{if(open)dialog.current?.showModal();return()=>dialog.current?.close();},[open]);
  const available=game&&(phase==='playing'||phase==='paused');
  return <>
    <BaseGame {...props} onEngine={capture}/>
    {available&&<button ref={launch} className="ts-fps-map-launch" aria-label="Open Tirana city map" onClick={()=>{if(!game)return;session.current=openMapSession(game);setOpen(true);}}>◎ CITY MAP</button>}
    {destination&&!open&&available&&<div className="ts-fps-route-note" role="status">To {destination.name}<small>{notice}</small></div>}
    {open&&<dialog ref={dialog} className="ts-fps-map-dialog" aria-labelledby="ts-city-map-title" onCancel={e=>{e.preventDefault();close();}}>
      <header><h2 id="ts-city-map-title">TIRANA · EXPLORE</h2><button onClick={close} aria-label="Close city map">×</button></header>
      <CityMap player={player} state={null} route={route} large destination={destination} onDestination={setDestination} routeNotice={notice}/>
      <p className="ts-fps-map-notice">{props.mode==='online'?'Online play continues while the map is open. Close the map and resume from the pause menu.':'Your solo operation is paused while the map is open.'} Routes guide you on mapped paths; they do not move your character or change mission objectives.</p>
      <p className="ts-fps-map-notice">© OpenStreetMap contributors · ODbL. Building exteriors and fixture positions are artistic approximations. The current playable district does not yet include the full lake area.</p>
    </dialog>}
  </>;
}
