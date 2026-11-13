import type {Frame,Result} from './renderer';
import {formatTime} from './career';
import './raceTelemetry.css';

export function RaceTelemetryHud({frame}:{frame:Frame|null}){
  if(!frame||frame.countdown||frame.freeRoam)return null;
  const timing=frame.telemetry,delta=frame.splitDelta;
  return <div className="rr-telemetry" aria-label="Race telemetry">
    <div className="rr-sector-panel">
      <div className="rr-sector-strip" aria-label={`${timing?.sectors.length||0} of 4 timing sectors complete`}>
        {[0,1,2,3].map(i=><span key={i} className={i<(timing?.sectors.length||0)?'complete':''}>S{i+1}</span>)}
      </div>
      {timing?.valid===false?<strong className="rr-invalid">RECOVERY · LAP INVALID</strong>:
        delta!==undefined&&delta!==null?<strong className={delta<=0?'rr-faster':'rr-slower'}>{delta>0?'+':''}{delta.toFixed(2)}s <small>AT LAST SPLIT</small></strong>:
        <small>{frame.timeTrial?'SET YOUR BEST LAP':frame.lap===3?'FINAL LAP':'CHASE THE PODIUM'}</small>}
      {frame.timeTrial&&<small>{frame.personalBest?`PERSONAL BEST ${formatTime(frame.personalBest)}`:'Your first valid lap creates a ghost'}</small>}
      {frame.ghostSaved===false&&<small role="status">Ghost kept for this session; device save unavailable</small>}
    </div>
    {!frame.timeTrial&&<ol className="rr-rival-tower" aria-label="Nearby race positions">
      {frame.rivals?.map(r=><li key={r.id} className={r.player?'you':''}><b>{r.position}</b><span>{r.player?'YOU':r.name}</span><small>{r.player?'':r.finished?'FIN':`${r.ahead?'+':'−'}${r.meters}m`}</small></li>)}
    </ol>}
    {!!frame.slipstream&&frame.slipstream>.1&&<div className="rr-draft-indicator"><span>SLIPSTREAM</span><progress max={1.5} value={frame.slipstream} aria-label="Slipstream charge"/></div>}
  </div>;
}

export function RaceDebrief({result}:{result:Result}){
  const me=result.racers.find(r=>r.id===result.playerId),timing=me?.telemetry;
  if(!timing)return null;
  return <section className="rr-debrief" aria-label="Driving report">
    <div><span>BEST VALID LAP</span><b>{timing.bestLap?formatTime(timing.bestLap):'—'}</b></div>
    <div><span>TOP SPEED</span><b>{Math.round(timing.topSpeed*3.6)} <small>km/h</small></b></div>
    <div><span>DRIFT DISTANCE</span><b>{Math.round(timing.driftDistance)} <small>m</small></b></div>
    <div><span>SLIPSTREAM</span><b>{timing.draftSeconds.toFixed(1)} <small>s</small></b></div>
    {result.timeTrial&&<p>{result.newBest?'NEW PERSONAL BEST · GHOST UPDATED':result.personalBest?`PERSONAL BEST ${formatTime(result.personalBest)}`:'Complete a lap without recovering to record a ghost.'}{result.ghostSaved===false?' · Device save unavailable; kept for this session.':''}</p>}
  </section>;
}

export function RaceRevBar({frame}:{frame:Frame|null}){
  const rpm=frame?.powertrain?.rpm||1900;
  return <div className="rr-revbar" aria-label={`Gear ${frame?.reversing?'reverse':frame?.powertrain?.gear||1}`}>
    <span>{frame?.reversing?'R':`G${frame?.powertrain?.gear||1}`}</span><i><i style={{width:`${Math.min(100,rpm/108)}%`,background:rpm>9200?'#ff9f78':'#b9f580'}}/></i>
  </div>;
}
