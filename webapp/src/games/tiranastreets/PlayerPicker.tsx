import {useCallback,useEffect,useState} from 'react';
import {PLAYER_CATALOG,playerAssetFor,selectPlayerAsset,selectedPlayerAsset} from './playerCatalog.mjs';
import {PlayerPreview,type PreviewState} from './PlayerPreview';
import './player-picker.css';
type Manifest={players:Record<string,unknown>};
export function PlayerPicker({onStart,onBack}:{onStart:()=>void;onBack:()=>void}) {
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
  const start=()=>{if(!ready||!asset)return;selectPlayerAsset(asset);onStart();};
  return <main className="tirana-player-picker" aria-label="Choose your Tirana player">
    <div className="player-picker-shell">
      <button className="player-back" onClick={onBack}>← Back</button>
      <p className="player-eyebrow">TIRANA STREETS</p>
      <h1>Choose your player</h1>
      <div className="player-options" role="group" aria-label="Available players">
        {PLAYER_CATALOG.map((p,index)=><button key={p.id} aria-pressed={chosen===p.id} onClick={()=>setChosen(p.id)}>
          <span className="player-number">0{index+1}</span><span>{p.label}</span>
        </button>)}
      </div>
      <div className="player-stage">
        <PlayerPreview key={`${chosen}-${attempt}`} url={loading?null:asset?.url||null} label={character.label} onState={onPreview}/>
        <span className="player-stage-label">{character.label}</span>
      </div>
      <p className="player-status" role="status">{loading?'Loading characters…':error||(!asset?'This character is missing from the game download.':preview.url===asset.url?preview.message:'Loading preview…')}</p>
      {!loading&&!ready&&<button className="player-retry" onClick={()=>setAttempt(n=>n+1)}>Retry</button>}
      <button className="player-continue" disabled={!ready} onClick={start}>Continue as {character.label}</button>
      <details className="player-credits"><summary>Character credits</summary>
        <p><a href={character.source} target="_blank" rel="noreferrer">{character.label}</a> by {character.author} · <a href={character.licenceUrl} target="_blank" rel="noreferrer">{character.licence}</a>. Texture sizes optimized for mobile; body rig adapted for gameplay.</p>
      </details>
    </div>
  </main>;
}
