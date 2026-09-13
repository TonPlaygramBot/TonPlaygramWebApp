import {useEffect,useMemo,useState} from 'react';
import {WORLD} from '../shared/world.mjs';
import {project,unproject} from '../../tirana-expansion/geography.mjs';

const SERVICE='https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';
const lat=(y:number,n:number)=>Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI;
/** Display only visible tiles; positions remain in the game's geographic frame. */
export function SatelliteLayer({view,width,onError}:{view:{x:number;z:number;w:number;h:number};width:number;onError:()=>void}) {
  const tiles=useMemo(()=>{
    const nw=unproject(WORLD.origin,view),se=unproject(WORLD.origin,{x:view.x+view.w,z:view.z+view.h});
    const zoom=Math.max(10,Math.min(19,Math.floor(Math.log2(40075016.686*Math.cos(nw.latitude*Math.PI/180)*width/(256*view.w)))));
    const n=2**zoom,toY=(v:number)=>(1-Math.asinh(Math.tan(v*Math.PI/180))/Math.PI)/2*n;
    const out=[];
    for(let y=Math.floor(toY(nw.latitude));y<=Math.floor(toY(se.latitude));y++)for(let x=Math.floor((nw.longitude+180)/360*n);x<=Math.floor((se.longitude+180)/360*n);x++){
      const a=project(WORLD.origin,lat(y,n),x/n*360-180),b=project(WORLD.origin,lat(y+1,n),(x+1)/n*360-180);
      out.push({id:`${zoom}/${y}/${x}`,x:a.x,y:a.z,w:b.x-a.x,h:b.z-a.z});
    }
    return out.slice(0,48);
  },[view.x,view.z,view.w,view.h,width]);
  return <g aria-label="Satellite imagery">{tiles.map(t=><image key={t.id} href={`${SERVICE}/tile/${t.id}`} x={t.x} y={t.y} width={t.w+.03} height={t.h+.03} preserveAspectRatio="none" onError={onError}/>)}</g>;
}
export function SatelliteCredit({failed}:{failed:boolean}) {
  const [credit,setCredit]=useState('Esri, Maxar, Earthstar Geographics, and the GIS User Community');
  useEffect(()=>{const controller=new AbortController();void fetch(`${SERVICE}?f=json`,{signal:controller.signal}).then(r=>r.json()).then(data=>{if(data.copyrightText)setCredit(data.copyrightText);}).catch(()=>{});return()=>controller.abort();},[]);
  return <div className="ts-map-credit" role="status">{failed?'Satellite imagery could not load. The map and saved places are still available. ':''}<a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noreferrer">Powered by Esri</a> · {credit}</div>;
}
