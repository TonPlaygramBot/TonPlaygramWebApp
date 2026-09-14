import {lazy,Suspense,useCallback,useEffect,useState} from 'react';
import {PLAYER_CATALOG,playerAssetFor,selectPlayerAsset,selectedPlayerAsset} from './playerCatalog.mjs';
import type {PreviewState} from './PlayerPreview';
import {DEFAULT_LOADOUT,STARTING_WEAPON_CHOICES,validStartingLoadout,selectedStartingLoadout,selectStartingLoadout} from './startingLoadout.mjs';
import {WEAPON_BY_ID} from './shared/weapons.mjs';
import {GameModeBoundary} from '../shared/GameModeBoundary';
import './player-picker.css';
const PlayerPreview=lazy(()=>import('./PlayerPreview').then(m=>({default:m.PlayerPreview})));
type Manifest={players:Record<string,unknown>};
export function PlayerPicker({onStart,onBack}:{onStart:()=>void;onBack:()=>void}) {
  const [step,setStep]=useState<'character'|'weapons'>('character');
  const [loadout,setLoadout]=useState<string[]>(()=>[...(selectedStartingLoadout()||DEFAULT_LOADOUT)]);
  const [message,setMessage]=useState('');
  const [manifest,setManifest]=useState<Manifest>({players:{}});
  const [chosen,setChosen]=useState(selectedPlayerAsset()?.id||PLAYER_CATALOG[0].id);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const [preview,setPreview]=useState<PreviewState>({url:'',ready:false,message:''});
  const onPreview=useCallback((state:PreviewState)=>setPreview(state),[]);
  useEffect(()=>{
    const abort=new AbortController();let active=true;const timer=setTimeout(()=>abort.abort(),10000);
    setLoading(true);setError('');
    fetch('/assets/tirana-streets/players/manifest.json',{signal:abort.signal})
      .then(response=>{if(!response.ok)throw Error('The character list could not be loaded.');return response.json();})
      .then(value=>{if(active)setManifest(value);})
      .catch(()=>{if(active)setError('Could not load the characters. Check your download or connection and retry.');})
      .finally(()=>{clearTimeout(timer);if(active)setLoading(false);});
    return ()=>{active=false;clearTimeout(timer);abort.abort();};
  },[attempt]);
  const character=PLAYER_CATALOG.find(p=>p.id===chosen)!;
  const asset=playerAssetFor(chosen,manifest);
  const ready=!loading&&!error&&asset&&preview.url===asset.url&&preview.ready;
  const toggle=(id:string)=>{setMessage('');if(loadout.includes(id))setLoadout(loadout.filter(w=>w!==id));else if(loadout.length<3)setLoadout([...loadout,id]);else setMessage('Remove one selected weapon to choose another.');};
  const start=()=>{if(!ready||!asset||!validStartingLoadout(loadout))return;selectPlayerAsset(asset);selectStartingLoadout(loadout);onStart();};
  return <GameModeBoundary onBack={onBack}><main className="tirana-player-picker" aria-label="Choose your Tirana player">
    <div className="player-picker-shell">
      <button className="player-back" onClick={step==='weapons'?()=>setStep('character'):onBack}>← Back</button>
      <p className="player-eyebrow">TIRANA STREETS</p>
      <h1>{step==='character'?'Choose your player':'Choose three weapons'}</h1>
      <section hidden={step!=='character'} aria-label="Choose character">
      <div className="player-options" role="group" aria-label="Available players">
        {PLAYER_CATALOG.map((p,index)=><button key={p.id} aria-pressed={chosen===p.id} onClick={()=>setChosen(p.id)}>
          <span className="player-number">0{index+1}</span><span>{p.label}</span>
        </button>)}
      </div>
      <div className="player-stage">
        <Suspense fallback={<p role="status">Loading character preview…</p>}>
          <PlayerPreview key={`${chosen}-${attempt}`} url={loading?null:asset?.url||null} label={character.label} onState={onPreview}/>
        </Suspense>
        <span className="player-stage-label">{character.label}</span>
      </div>
      <p className="player-status" role="status">{loading?'Loading characters…':error||(!asset?'This character is missing from the game download.':preview.url===asset.url?preview.message:'Loading preview…')}</p>
      {!loading&&!ready&&<button className="player-retry" onClick={()=>setAttempt(n=>n+1)}>Retry</button>}
      <details className="player-credits"><summary>Character credits</summary>
        <p><a href={character.source} target="_blank" rel="noreferrer">{character.label}</a> by {character.author} · <a href={character.licenceUrl} target="_blank" rel="noreferrer">{character.licence}</a>. Texture sizes optimized for mobile; body rig adapted for gameplay.</p>
      </details>
      </section>
      {step==='weapons'&&<section aria-label="Choose starting weapons">
        <div className="loadout-slots" aria-label="Three selected weapons">{[0,1,2].map(i=><button key={i} disabled={!loadout[i]} onClick={()=>toggle(loadout[i])} aria-label={loadout[i]?`Remove ${WEAPON_BY_ID.get(loadout[i])!.label}`:`Empty weapon slot ${i+1}`}><span>0{i+1}</span><strong>{WEAPON_BY_ID.get(loadout[i])?.label||'Choose weapon'}</strong>{loadout[i]&&<span aria-hidden="true">×</span>}</button>)}</div>
        <p className="loadout-count" role="status">{message||`${loadout.length} of 3 weapons selected`}</p>
        <div className="loadout-weapons">{STARTING_WEAPON_CHOICES.map(id=>{const w=WEAPON_BY_ID.get(id)!,selected=loadout.includes(id);return <button key={id} className="loadout-weapon" aria-label={`Choose ${w.label}`} aria-pressed={selected} onClick={()=>toggle(id)}>
          <img src={`/assets/tirana-streets/weapon-thumbnails/${id}.webp`} alt="" loading="lazy"/>
          <span><strong>{w.label}</strong><small>{w.category} · {w.magazine} rounds</small></span><span className="loadout-check" aria-hidden="true">{selected?'✓':'+'}</span>
        </button>;})}</div>
        <details className="player-credits"><summary>Weapon credits</summary><p>Original creator and license details are included with each weapon in the <a href="/assets/tirana-streets/weapons/manifest.json" target="_blank" rel="noreferrer">asset credits</a>.</p></details>
      </section>}
      <button className="player-continue" disabled={!ready||(step==='weapons'&&!validStartingLoadout(loadout))} onClick={step==='character'?()=>setStep('weapons'):start}>{step==='character'?'Next · Choose weapons':`Continue as ${character.label} · ${loadout.length}/3`}</button>
    </div>
  </main></GameModeBoundary>;
}
