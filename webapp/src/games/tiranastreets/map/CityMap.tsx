import {useState} from 'react';
import type {ComponentProps} from 'react';
import {CityMap as ExistingCityMap} from './CityMapCore';
import {RegionalAtlas} from '../../tirana-region/RegionalAtlas';
import '../../tirana-region/region.css';
/** Preserve original minimap, routes, favourites and city framing verbatim. */
export function CityMap(props:ComponentProps<typeof ExistingCityMap>){
 const [regional,setRegional]=useState(false);
 if(!props.large)return <ExistingCityMap {...props}/>;
 return <div className="tr-atlas-shell">
  <div className="tr-tabs" role="group" aria-label="Tirana map coverage">
   <button aria-pressed={!regional} onClick={()=>setRegional(false)}>CITY &amp; ROUTES</button>
   <button aria-pressed={regional} onClick={()=>setRegional(true)}>GREATER TIRANA</button>
  </div>
  <div hidden={regional}><ExistingCityMap {...props}/></div>
  {regional&&<RegionalAtlas player={props.player}/>}
 </div>;
}
