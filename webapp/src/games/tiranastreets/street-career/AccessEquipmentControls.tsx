import type {StreetAction} from './StreetSimulation.mjs';
import {touchAction} from '../touchActions';
export function AccessEquipmentControls({actions,onAction}:{actions:StreetAction[];onAction:(id:string)=>void}){
  const equipment=actions.filter(a=>a.visible&&(a.id==='parachute'||a.id==='binoculars'));
  if(!equipment.length)return null;
  return <nav className="tsc-access-tools" aria-label="Pajisjet e tarracës">
    {equipment.map(a=><button key={a.id} aria-label={a.label} aria-disabled={!a.enabled}
      data-action={a.id} {...touchAction(()=>onAction(a.id),a.enabled)}>{a.label}</button>)}
  </nav>;
}
