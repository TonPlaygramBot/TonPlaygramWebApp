import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {CityMap} from '../tiranastreets/map/CityMap';
import {subscribeAtlas,readAtlas} from './raceAtlasStore';
import './racingAtlas.css';
export function RacingAtlas(){
 const snapshot=useSyncExternalStore(subscribeAtlas,readAtlas,readAtlas),[open,setOpen]=useState(false),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(open)dialog.current?.showModal();return()=>dialog.current?.close();},[open]);
 const route=snapshot.points.length?[...snapshot.points,snapshot.points[0]]:[];
 return <><button className="kr-atlas-launch" onClick={()=>setOpen(true)}>CITY ATLAS</button>{open&&<dialog className="kr-atlas-dialog" ref={dialog} onCancel={e=>{e.preventDefault();setOpen(false);}}><header><h2>{snapshot.name}</h2><button onClick={()=>setOpen(false)}>CLOSE</button></header><p role="status">Driving continues while the atlas is open.</p><CityMap player={snapshot.player} state={null} route={route} large/><p>Explore Tirana, Farkë, Surrel and the lakes. The arrow shows your direction of travel.</p></dialog>}</>;
}
