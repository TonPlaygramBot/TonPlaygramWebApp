import {lazy,Suspense,useState} from 'react';
import type {ComponentProps} from 'react';
import {CityMap as ExistingCityMap} from './CityMapCore';
import {RegionalAtlas} from '../../tirana-region/RegionalAtlas';
import '../../tirana-region/region.css';
const LandmarkExplorer=lazy(()=>import('../../tirana-city-source/LandmarkExplorer'));
const StreetLifeExplorer=lazy(()=>import('../../tirana-street-life/StreetLifeExplorer'));
export function CityMap(props:ComponentProps<typeof ExistingCityMap>){
 const [tab,setTab]=useState<'regional'|'buildings'|'streets'>('regional'),[guides,setGuides]=useState(false);
 if(!props.large)return <ExistingCityMap {...props}/>;
 return <div className="tr-atlas-shell">
  <ExistingCityMap {...props}/>
  <details className="ts-map-guides" onToggle={e=>setGuides(e.currentTarget.open)}><summary>More city guides</summary>
   {guides&&<><div className="ts-map-tabs" role="group" aria-label="Tirana city guides">
    <button aria-pressed={tab==='regional'} onClick={()=>setTab('regional')}>Greater Tirana</button>
    <button aria-pressed={tab==='buildings'} onClick={()=>setTab('buildings')}>Buildings</button>
    <button aria-pressed={tab==='streets'} onClick={()=>setTab('streets')}>Streets</button>
   </div>
   {tab==='regional'&&<RegionalAtlas player={props.player}/>}
   {tab==='buildings'&&<Suspense fallback={<p role="status">Loading Tirana buildings…</p>}><LandmarkExplorer/></Suspense>}
   {tab==='streets'&&<Suspense fallback={<p role="status">Loading Tirana streets…</p>}><StreetLifeExplorer/></Suspense>}
   </>}
  </details>
 </div>;
}
