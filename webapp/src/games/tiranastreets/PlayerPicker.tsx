import {useEffect,useState} from 'react';
import {PLAYER_CATALOG,playerAssetFor,selectPlayerAsset} from './playerCatalog.mjs';
import './player-picker.css';
export function PlayerPicker({onStart,onBack}:{onStart:()=>void;onBack:()=>void}){
  const [manifest,setManifest]=useState<{players:Record<string,unknown>}>({players:{}});
  const [chosen,setChosen]=useState('');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{const abort=new AbortController();const timer=setTimeout(()=>{abort.abort();setLoading(false);},5000);
    fetch('/assets/tirana-streets/players/manifest.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setManifest).catch(()=>{}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>{clearTimeout(timer);abort.abort();};
  },[]);
  const start=()=>{selectPlayerAsset(playerAssetFor(chosen,manifest));onStart();};
  return <main className="tirana-player-picker">
    <button className="player-back" onClick={onBack}>← Back</button>
    <h1>Choose your player</h1><p>Preview the five soldiers. Choose an available character to enter Tirana.</p>
    <div className="player-grid">{PLAYER_CATALOG.map(p=>{
      const asset=playerAssetFor(p.id,manifest);
      return <article key={p.id} className={chosen===p.id?'player-card selected':'player-card'}>
        <a href={p.source} target="_blank" rel="noreferrer" aria-label={`Open 3D preview of ${p.label}`}><img src={p.preview} alt={p.label} loading="lazy" /></a>
        <h2>{p.label}</h2><p>{p.author} · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">{p.licence}</a></p>
        <a href={p.source} target="_blank" rel="noreferrer">Rotate in 3D ↗</a>
        <button disabled={!asset||loading} aria-pressed={chosen===p.id} onClick={()=>setChosen(p.id)}>{asset?chosen===p.id?'Selected':'Choose player':'Model not installed yet'}</button>
      </article>;
    })}</div>
    <div className="player-start"><p>{loading?'Checking available characters…':chosen?'Your selection will use the shared weapon and movement controls.':'The five original model files are not installed. You can play with the current operator.'}</p>
      <button onClick={start}>{chosen?'Start with selected player':'Play with current operator'}</button>
    </div>
  </main>;
}
