import {lazy,Suspense,useState} from 'react';
import type {ComponentProps} from 'react';
import {CityMap as ExistingCityMap} from './CityMapCore';
import {RegionalAtlas} from '../../tirana-region/RegionalAtlas';
import '../../tirana-region/region.css';
const LandmarkExplorer=lazy(()=>import('../../tirana-city-source/LandmarkExplorer'));
/** Preserve original minimap, routes, favourites and city framing verbatim. */
export function CityMap(props:ComponentProps<typeof ExistingCityMap>){
 const [tab,setTab]=useState<'city'|'regional'|'buildings'>('city');
 if(!props.large)return <ExistingCityMap {...props}/>;
 return <div className="tr-atlas-shell">
  <div className="tr-tabs" role="group" aria-label="Tirana map coverage">
   <button aria-pressed={tab==='city'} onClick={()=>setTab('city')}>CITY &amp; ROUTES</button>
   <button aria-pressed={tab==='regional'} onClick={()=>setTab('regional')}>GREATER TIRANA</button>
   <button aria-pressed={tab==='buildings'} onClick={()=>setTab('buildings')}>BUILDINGS</button>
  </div>
  <div hidden={tab!=='city'}><ExistingCityMap {...props}/></div>
  {tab==='regional'&&<RegionalAtlas player={props.player}/>}
  {tab==='buildings'&&<Suspense fallback={<p role="status">Loading Tirana buildings…</p>}><LandmarkExplorer/></Suspense>}
 </div>;
}
