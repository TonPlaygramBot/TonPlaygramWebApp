import {formatRouteDistance, navigationGuidance} from './navigationGuidance.mjs';
import './map.css';
type Point={x:number;z:number};
type Props={route:Point[];player?:Point&{speed?:number;carId?:string|null;aircraftId?:string|null};destination?:(Point&{name:string})|null;onClear?:()=>void};
const icons:Record<string,string>={left:'↰',right:'↱',uturn:'↶',straight:'↑',destination:'◎',arrive:'✓',rejoin:'↗',unavailable:'?'};
export function NavigationGuidance({route,player,destination,onClear}:Props){
  const guidance=navigationGuidance(route,player,destination,player?.carId?'drive':'walk');
  if(!guidance||!destination||player?.aircraftId)return null;
  return <section className="ts-navigation-guidance" aria-label="Route guidance">
    <span className="ts-navigation-arrow" aria-hidden="true">{icons[guidance.direction]}</span>
    <div><strong>{guidance.instruction}{!guidance.arrived&&guidance.direction!=='unavailable'&&` · ${formatRouteDistance(guidance.nextDistance)}`}</strong>
      <span>{destination.name}</span>
      {!guidance.arrived&&<small>{formatRouteDistance(guidance.remaining)} remaining{guidance.etaSeconds!==null&&` · about ${Math.max(1,Math.ceil(guidance.etaSeconds/60))} min`}</small>}
    </div>
    {onClear&&<button type="button" aria-label="Clear destination" onClick={onClear}>×</button>}
  </section>;
}
