import {useMemo} from 'react';
import {freeRoamWorld} from './freeRoam.mjs';
import type {Racer} from './simulation.mjs';

/** A local street map follows the kart through junctions without a race line. */
export function FreeRoamMap({racer}:{racer?:Racer}){
  const x=racer?.x??0,z=racer?.z??0,cx=Math.floor(x/80),cz=Math.floor(z/80);
  const roads=useMemo(()=>freeRoamWorld().nearbyRoads(cx*80,cz*80,340),[cx,cz]);
  const p=(a:number[])=>`${50+(a[0]-x)/6},${50+(a[1]-z)/6}`;
  return <svg className="kr-map" viewBox="0 0 100 100" role="img" aria-label="Nearby city roads and your kart">
    <g fill="none" stroke="#cce0d6" strokeWidth="1.5">{roads.map((r,i)=><polyline key={i} points={`${p(r.a)} ${p(r.b)}`} opacity={r.walk?.45:.8}/>)}</g>
    <circle cx="50" cy="50" r="3.5" fill="#c5ff76" stroke="#14352b" strokeWidth="1"/>
    <path d="M 50 43 L 48 47 L 52 47 Z" fill="#c5ff76" transform={`rotate(${180-(racer?.yaw??0)*180/Math.PI} 50 50)`}/>
  </svg>;
}
