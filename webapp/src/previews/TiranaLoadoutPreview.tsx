import React,{useCallback,useState,lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {PlayerPicker} from '../games/tiranastreets/PlayerPicker';
import {LoadoutPreview,type PreviewState} from '../games/tiranastreets/LoadoutPreview';
import {UPLOADED_WEAPONS} from '../games/tiranastreets/shared/uploadedWeapons.mjs';
const Game=lazy(()=>import('../games/tiranastreets/street-career/StreetCareerGame').then(m=>({default:m.StreetCareerGame})));
function Preview(){
 const [started,setStarted]=useState(false),[state,setState]=useState<PreviewState>({url:'',ready:false,message:''});
 const onState=useCallback((s:PreviewState)=>setState(s),[]);
 const weapon=UPLOADED_WEAPONS.find(w=>w.id===new URLSearchParams(location.search).get('weapon'));
 if(weapon)return <main style={{maxWidth:600,margin:'auto',color:'white',fontFamily:'system-ui'}}><h1>{weapon.label}</h1><LoadoutPreview url={weapon.modelUrl} label={weapon.label} kind="weapon" onState={onState}/><p role="status">{state.message}</p><nav>{UPLOADED_WEAPONS.map(w=><p key={w.id}><a style={{color:'#c7ef77'}} href={`?weapon=${w.id}`}>{w.label}</a></p>)}</nav></main>;
 return started?<Suspense fallback={<p style={{color:'white'}}>Loading Tirana Streets…</p>}><Game onExit={()=>setStarted(false)}/></Suspense>:<PlayerPicker onStart={()=>setStarted(true)} onBack={()=>history.back()}/>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
