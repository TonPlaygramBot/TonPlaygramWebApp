import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MissionReadout} from '../MissionReadout';
import {advanceBattleObjective} from '../../blackwater/shared/missionCore.mjs';
import {createMissionDirector,updateMissionDirector} from '../street-career/missionDirectorCore.mjs';
import './mission-director.css';

const battleFrame=()=>({mode:'extraction' as const,elapsed:10,wave:1,health:100,driving:false,lastDamage:-100,
  player:{x:15,z:0},center:{x:0,z:0},intelPoint:{x:15,z:0},extractionPoint:{x:30,z:0},enemies:[{x:40,z:0,hp:100}]});
const freshBattle=()=>advanceBattleObjective({progress:0,intel:false,extracting:false,extraction:0},battleFrame(),0);
const freshCareer=()=>createMissionDirector({vehicleId:'courier',lastVehicleHealth:140});
const careerFrame=()=>({health:100,vehicleHealth:140,vehicleId:'courier',parcel:true,wanted:0,distance:0,driving:true,onFoot:false,grounded:true,speed:0,firing:false,final:true,remaining:0,correctAircraft:false,airborne:false,verticalSpeed:0,vehicleDestroyed:false,paused:false});
/** Interactive review of production objective logic and the production HUD.
 * This deliberately has no city/3D renderer; device GPU validation is separate. */
export function MissionDirectorReview(){
  const [mode,setMode]=useState('battle'),[battle,setBattle]=useState(freshBattle),[frame,setFrame]=useState(battleFrame),
    [career,setCareer]=useState(freshCareer),[condition,setCondition]=useState('clear');
  const reset=(next=mode)=>{setMode(next);setBattle(freshBattle());setFrame(battleFrame());setCareer(freshCareer());setCondition('clear');};
  const advance=()=>{
    if(mode==='battle'){
      const f={...frame,player:battle.intel?{...frame.extractionPoint}:{...frame.intelPoint},enemies:[{x:condition==='guard'?(battle.intel?30:15):40,z:0,hp:100}]};
      let next=battle;
      for(let i=0;i<60;i++){f.elapsed+=1/60;if(condition==='damage')f.lastDamage=f.elapsed;next=advanceBattleObjective(next,f,1/60);}
      setFrame(f);setBattle(next);
    }else{
      const f={...careerFrame(),damageAt:career.lastDamageAt},next=createMissionDirector(career);
      f.health=condition==='damage'?Math.max(0,next.lastHealth-15):next.lastHealth;
      f.vehicleHealth=condition==='damage'?Math.max(0,(next.lastVehicleHealth??140)-20):(next.lastVehicleHealth??140);
      f.wanted=condition==='guard'?2:0;
      for(let i=0;i<60;i++){
        if(condition==='damage')f.damageAt=frame.elapsed+(i+1)/60;
        updateMissionDirector(next,{id:mode==='cargo'?'city-delivery':'pursuit-review',type:mode==='cargo'?'delivery':'pursuit'},f,1/60);
      }
      setFrame(previous=>({...previous,elapsed:previous.elapsed+1}));
      setCareer(next);
    }
  };
  const victory=mode==='battle'?battle.status==='won':mode==='pursuit'&&career.hold>=3-1e-7;
  return <main className="ts-director-review">
    <header><span>TIRANA STREETS</span><strong>Mission HUD preview</strong></header>
    <label>Mission<select value={mode} onChange={e=>reset(e.target.value)}><option value="battle">Battlefield · Intel extraction</option><option value="pursuit">Career · Pursuit hideout</option><option value="cargo">Career · Courier integrity</option></select></label>
    <section className="ts-director-panel" aria-live="polite">
      {mode==='battle'?<MissionReadout label="Battlefield objective" eyebrow={`INTEL EXTRACTION · ${battle.stage.toUpperCase()}`} title={victory?'Objective complete':battle.intel?'Reach extraction':'Collect district intel'} detail={battle.hint} progress={battle.progressRatio} contested={battle.contested} meta={[battle.intel?'Intel secured':'Intel pending',victory?'Secured':`${Math.round((battle.intel?battle.extraction:battle.progress)*10)/10} s held`]}/>
      :<MissionReadout label="Career objective" eyebrow={mode==='cargo'?'COURIER · DELIVERY':'PURSUIT · HIDEOUT'} title={career.failure?'Delivery failed':mode==='cargo'?'Protect the delivery':victory?'Hideout secured':'Park at the safe point'} detail={career.failure||(mode==='cargo'?'Cargo condition reflects injury and vehicle impacts.':condition==='guard'?'Break contact before parking at the hideout.':'Stop inside the marker for three seconds without firing.')} progress={mode==='cargo'?career.integrity/100:career.hold/3} remaining={mode==='pursuit'?(victory?0:3-career.hold):null} meta={mode==='cargo'?[`Cargo ${Math.round(career.integrity)}%`]:[condition==='guard'?'Wanted · 2':'Wanted · 0']} contested={condition!=='clear'}/>}
    </section>
    <label>Situation<select value={condition} onChange={e=>setCondition(e.target.value)}><option value="clear">Area clear / stationary</option>{mode!=='cargo'&&<option value="guard">{mode==='battle'?'Guard at objective':'Patrol still pursuing'}</option>}<option value="damage">{mode==='cargo'?'Injury + vehicle impact':'Incoming damage'}</option></select></label>
    <div className="ts-director-actions"><button type="button" onClick={advance} disabled={victory||!!career.failure}>Advance 1 second</button><button type="button" onClick={()=>reset()}>Restart</button></div>
  </main>;
}
const root=document.getElementById('tirana-mission-preview');
if(root)createRoot(root).render(<MissionDirectorReview/>);
