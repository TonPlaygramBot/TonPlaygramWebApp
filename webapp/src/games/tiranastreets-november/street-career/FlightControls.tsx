import type {HTMLAttributes} from 'react';
import type {Aircraft} from '../shared/engine.mjs';
import type {FlightSimulation} from './FlightSimulation.mjs';
import {flightReadout} from './flightView.mjs';
import {groundHeight} from '../../tirana-east/terrainCore.mjs';

type Controls={aircraft:Aircraft;lock:FlightSimulation['lock'];held:(kind:string)=>HTMLAttributes<HTMLButtonElement>;onAssist:(action:string)=>void;onLock:()=>void};
export function FlightControls({aircraft:a,lock,held,onAssist,onLock}:Controls){
  return <>
    <button className="tsc-slot-aim" aria-label="Hold to climb" {...held('ascend')}>UP</button>
    <button className="tsc-slot-secondary" aria-label="Hold to descend" {...held('brake')}>DOWN</button>
    <button className="tsc-slot-jump" aria-pressed={!!a.autoHover&&!a.autoLand} onClick={()=>onAssist('hover')}>HOVER</button>
    <button className="tsc-slot-crouch" aria-pressed={!!a.autoLand} onClick={()=>onAssist('land')}>LAND</button>
    {!a.civilian&&<>
      <button className="tsc-slot-primary" aria-label="Fire missile" disabled={!a.airborne||!a.missiles} {...held('fire')}>FIRE<small>{a.missiles??0} missiles</small></button>
      <button className="tsc-slot-vault" aria-label="Toggle target lock" aria-pressed={lock.enabled} disabled={!a.airborne} onClick={onLock}>{lock.enabled?'UNLOCK':'LOCK'}</button>
    </>}
  </>;
}
export function FlightInstruments({aircraft:a,lock}:{aircraft:Aircraft;lock:FlightSimulation['lock']}){
  const info=flightReadout(a,groundHeight(a.x,a.z));
  return <section className="tsc-flight-instruments" aria-label="Flight instruments">
    <div><span>HEADING</span><strong>{info.cardinal} {String(info.heading).padStart(3,'0')}°</strong></div>
    <div><span>ALTITUDE</span><strong>{info.altitude} m</strong></div>
    <div><span>AIRSPEED</span><strong>{info.speed} km/h</strong></div>
    <output className={lock.progress>=1?'is-locked':''} aria-label="Aircraft target lock">{a.civilian?'CIVILIAN AIRCRAFT':!a.airborne?'LIFT OFF TO ARM':!lock.enabled?'FREE AIM':!lock.targetId?'AIM AT A VEHICLE':lock.progress<1?`ACQUIRING ${Math.round(lock.progress*100)}%`:`LOCKED · ${lock.distance} m`}</output>
  </section>;
}
