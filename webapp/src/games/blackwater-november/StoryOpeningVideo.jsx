import {useState} from 'react';
import './story-opening-video.css';

const VIDEO = '/assets/tirana-streets/cinematics/rikthimi-v1.mp4';

export function StoryOpeningVideo({onContinue,onExit}) {
 const [complete,setComplete]=useState(false);
 const [failed,setFailed]=useState(false);
 return <main className="tso-opening">
  <header><button type="button" onClick={onExit}>← Te hyrja</button><span>BLOOD, LOYALTY &amp; POWER</span></header>
  <h1>Rikthimi</h1>
  <p>Kapitulli 1 · Hyrja filmike</p>
  {!failed && <video controls playsInline preload="metadata" aria-label="Hyrja filmike e Turit"
    onEnded={()=>setComplete(true)} onError={()=>setFailed(true)}>
    <source src={VIDEO} type="video/mp4" onError={()=>setFailed(true)}/>
  </video>}
  {failed && <p role="status">Videoja nuk u ngarkua. Mund të hysh direkt në mision.</p>}
  <button type="button" className="tso-continue" onClick={onContinue}>
   {complete||failed?'Hyr në mision':'Kapërce videon dhe hyr në mision'}
  </button>
 </main>;
}

export function StoryCareerGate({children,onExit}) {
 const [entered,setEntered]=useState(false);
 return entered?children:<StoryOpeningVideo onContinue={()=>setEntered(true)} onExit={onExit}/>;
}
