import {useCallback,useEffect,useState} from 'react';
import {PLAYER_CATALOG,playerAssetFor,selectPlayerAsset,selectedPlayerAsset} from './playerCatalog.mjs';
import {DEFAULT_LOADOUT,STARTING_WEAPON_CHOICES,validStartingLoadout,selectedStartingLoadout,selectStartingLoadout} from './startingLoadout.mjs';
import {WEAPON_BY_ID} from './shared/weapons.mjs';
import {LoadoutPreview,type PreviewState} from './LoadoutPreview';
import './player-picker.css';

export function PlayerPicker({onStart,onBack}:{onStart:()=>void;onBack:()=>void}) {
  const [manifest,setManifest]=useState({players:{}});
  const [chosen,setChosen]=useState(selectedPlayerAsset()?.id||'human');
  const [loadout,setLoadout]=useState<string[]>(()=>[...(selectedStartingLoadout()||DEFAULT_LOADOUT)]);
  const [step,setStep]=useState<'character'|'weapons'>('character');
  const [attempt,setAttempt]=useState(0),[message,setMessage]=useState('');
  const [preview,setPreview]=useState<PreviewState>({url:'',ready:false,message:''});
  const onPreview=useCallback((state:PreviewState)=>setPreview(state),[]);
  useEffect(()=>{
    const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),8000);
    fetch('/assets/tirana-streets/players/manifest.json',{signal:abort.signal}).then(r=>r.ok?r.json():null)
      .then(m=>{if(m&&!abort.signal.aborted)setManifest(m);}).catch(()=>{}).finally(()=>clearTimeout(timer));
    return()=>{clearTimeout(timer);abort.abort();};
  },[]);
  const available=PLAYER_CATALOG.filter(p=>playerAssetFor(p.id,manifest));
  const character=available.find(p=>p.id===chosen)||available[0];
  const asset=playerAssetFor(character.id,manifest)!;
  const ready=preview.url===asset.url&&preview.ready;
  const toggle=(id:string)=>{
    setMessage('');
    if(loadout.includes(id))setLoadout(loadout.filter(w=>w!==id));
    else if(loadout.length<3)setLoadout([...loadout,id]);
    else setMessage('Remove one selected weapon to choose another.');
  };
  const start=()=>{if(!ready||!validStartingLoadout(loadout))return;selectPlayerAsset(asset);selectStartingLoadout(loadout);onStart();};
  return <main className="tirana-player-picker" aria-label="Tirana starting loadout">
    <div className="player-picker-shell">
      <header className="loadout-header"><button className="player-back" onClick={step==='weapons'?()=>setStep('character'):onBack}>← Back</button><span>TIRANA STREETS</span><span>{step==='character'?'01':'02'} / 02</span></header>
      <h1>{step==='character'?'Choose your character':'Choose three weapons'}</h1>
      <p className="loadout-intro">{step==='character'?'Your character, your streets.':'Your starting kit for this solo session.'}</p>
      <section hidden={step!=='character'} aria-label="Choose character">
        <div className="player-stage"><LoadoutPreview key={attempt} url={asset.url} label={character.label} onState={onPreview}/><strong>{character.label}</strong></div>
        <p className="player-status" role="status">{preview.message}</p>
        {!ready&&/retry/i.test(preview.message)&&<button onClick={()=>setAttempt(n=>n+1)}>Retry preview</button>}
        <div className="player-options" role="group" aria-label="Playable characters">{available.map(p=><button key={p.id} aria-pressed={character.id===p.id} onClick={()=>setChosen(p.id)}>{p.label}</button>)}</div>
        <details className="player-credits"><summary>Character credits</summary><p>{character.label} · {character.author} · {character.licence}</p></details>
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
      <footer className="player-start"><button className="player-continue" disabled={!ready||(step==='weapons'&&!validStartingLoadout(loadout))} onClick={step==='character'?()=>setStep('weapons'):start}>{step==='character'?'Next · Choose weapons':`Continue · ${loadout.length}/3 ready`}</button></footer>
    </div>
  </main>;
}
