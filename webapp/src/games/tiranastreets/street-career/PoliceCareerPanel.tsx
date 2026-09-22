import {POLICE_UNITS,POLICE_MISSIONS,policeMissionAvailable,type PoliceProfile} from './policeCareerCore.mjs';
import type {PoliceView} from './PoliceCareerController.mjs';
type Props={profile:PoliceProfile;duty:PoliceView|null;streetBusy:boolean;onUnit:(id:string)=>void;onStart:(id:string)=>void;onResume:()=>void;onEnd:()=>void};
export function PoliceCareerPanel({profile,duty,streetBusy,onUnit,onStart,onResume,onEnd}:Props){
  return <section className="tsc-police-career" aria-label="Karriera në polici">
    <p className="tsc-police-kicker">TIRANË · NË SHËRBIM TË QYTETARIT</p>
    <h3>Zgjidh njësinë tënde</h3>
    <p>Patrullo, shpëto dhe shoqëro. Operacione imagjinare me komunikim, ndalim dhe mbrojtje të civilëve.</p>
    <div className="tsc-police-units" role="group" aria-label="Njësia policore">
      {POLICE_UNITS.map(unit=><button key={unit.id} aria-pressed={profile.unit===unit.id}
        disabled={!!profile.active} onClick={()=>onUnit(unit.id)}>
        <strong>{unit.name}</strong><span>{unit.description}</span>
      </button>)}
    </div>
    <p><strong>{profile.merit} merita</strong> · {profile.completed.length}/{POLICE_MISSIONS.length} operacione · Ruhet në këtë pajisje.</p>
    {profile.lastResult&&<p className={profile.lastResult.success?'tsc-police-result is-success':'tsc-police-result'} role="status">{profile.lastResult.detail}</p>}
    {duty&&<section className="tsc-briefing">
      <small>{duty.mission.title}</small><h3>{duty.objective.title}</h3><p>{duty.objective.detail}</p>
      <button onClick={onResume}>VAZHDO OPERACIONIN</button><button onClick={onEnd}>PËRFUNDO SHËRBIMIN</button>
    </section>}
    {streetBusy&&<p>Përfundo punën e rrugës ose zgjidh FREE ROAM para se të hysh në shërbim.</p>}
    <div className="tsc-chapters">
      {POLICE_MISSIONS.filter(m=>m.unit===profile.unit).map(m=><button key={m.id}
        disabled={streetBusy||!!profile.active||!policeMissionAvailable(profile,m.id)} onClick={()=>onStart(m.id)}>
        <strong>{m.title}</strong><span>{m.description}</span>
        <small>{!policeMissionAvailable(profile,m.id)?`Kërkon: ${POLICE_MISSIONS.find(x=>x.id===m.requires)?.title}`:
          profile.completed.includes(m.id)?'Përfunduar · Riluajtja nuk jep merita të dyfishta':`${m.steps.length} faza · ${m.reward} merita`}</small>
      </button>)}
    </div>
    <p>Armët mbahen për mbrojtje; civilët, kolegët dhe të dyshuarit e dorëzuar mbrohen. Dëmtimi i tyre e dështon operacionin.</p>
  </section>;
}
