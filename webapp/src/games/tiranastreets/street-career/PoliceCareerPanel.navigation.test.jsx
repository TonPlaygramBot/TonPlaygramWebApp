import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {PoliceCareerPanel} from './PoliceCareerPanel';
import {AccessEquipmentControls} from './AccessEquipmentControls';
import {POLICE_SAVE_KEY,POLICE_UNITS,POLICE_MISSIONS,freshPoliceProfile,normalizePoliceProfile,beginPoliceMission,policeStage,interactPoliceMission,stepPoliceMission,settlePoliceMission} from './policeCareerCore.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let drive;
function Harness({streetBusy=false}){
  const [profile,setProfile]=useState(()=>normalizePoliceProfile(JSON.parse(localStorage.getItem(POLICE_SAVE_KEY)||'null')));
  const update=p=>{if(!p)return;localStorage.setItem(POLICE_SAVE_KEY,JSON.stringify(p));setProfile({...p});};
  drive={profile,settle:(fail=false)=>{
    const run=profile.active;if(!run)return;
    if(fail)stepPoliceMission(run,{health:100,civilianHarmed:true},.1);
    else while(run.status==='active'){
      interactPoliceMission(run,{eligible:true});const seconds=policeStage(run).seconds;
      for(let i=0;i<seconds*10+1&&run.channel;i++)stepPoliceMission(run,{eligible:true,health:100},.1);
    }
    update(settlePoliceMission(profile));
  }};
  const duty=profile.active?{unit:POLICE_UNITS.find(u=>u.id===profile.unit),mission:POLICE_MISSIONS.find(m=>m.id===profile.active.id),
    objective:{title:policeStage(profile.active).title,detail:'Ndiq itinerarin'}}:null;
  return <PoliceCareerPanel profile={profile} duty={duty} streetBusy={streetBusy}
    onUnit={unit=>update({...profile,unit})} onStart={id=>update(beginPoliceMission(profile,id))}
    onResume={()=>{}} onEnd={()=>update({...profile,active:null})}/>;
}
describe('police duty menu on a portrait phone',()=>{
  let root,container;
  const button=text=>[...container.querySelectorAll('button')].find(b=>b.textContent.includes(text));
  const click=async text=>act(async()=>button(text).click());
  beforeEach(async()=>{localStorage.clear();container=document.createElement('div');container.style.width='390px';document.body.append(container);root=createRoot(container);await act(async()=>root.render(<Harness/>));});
  afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
  it('selects a unit, locks later operations, starts duty and ends without a reward',async()=>{
    expect(button('SHQIPONJA').getAttribute('aria-pressed')).toBe('true');
    expect(button('Rruga e sigurt').disabled).toBe(true);
    await click('FNSH');expect(button('FNSH').getAttribute('aria-pressed')).toBe('true');
    expect(button('Evakuim në Ali Demi').disabled).toBe(true);
    await click('E drejta për t’u dëgjuar');
    expect(drive.profile.active.id).toBe('fnsh-protest');expect(drive.profile.merit).toBe(0);
    expect(button('RENEA').disabled).toBe(true);expect(container.textContent).toContain('Bisedo me organizatorin');
    await click('PËRFUNDO SHËRBIMIN');expect(drive.profile.active).toBeNull();expect(drive.profile.merit).toBe(0);
    expect(JSON.parse(localStorage.getItem(POLICE_SAVE_KEY)).completed).toEqual([]);
  });
  it('shows failure without payout, then saves success and prevents duplicate replay merit',async()=>{
    await click('Patrulla e Lanës');await act(async()=>drive.settle(true));
    expect(container.querySelector('[role="status"]').textContent).toContain('dështoi');expect(drive.profile.merit).toBe(0);
    await click('Patrulla e Lanës');await act(async()=>drive.settle());
    expect(drive.profile.merit).toBe(120);expect(button('Rruga e sigurt').disabled).toBe(false);
    expect(container.textContent).toContain('Riluajtja nuk jep merita të dyfishta');
    await click('Patrulla e Lanës');await act(async()=>drive.settle());expect(drive.profile.merit).toBe(120);
    const stored=JSON.parse(localStorage.getItem(POLICE_SAVE_KEY));expect(stored.completed).toEqual(['shqiponja-lana']);
    await act(async()=>root.render(<Harness key="reload"/>));expect(container.textContent).toContain('120 merita');
  });
  it('retains active operation across remount and blocks duty while a street chapter is active',async()=>{
    await click('RENEA');await click('Kthim i sigurt');
    await act(async()=>root.render(<Harness key="restore"/>));expect(drive.profile.unit).toBe('renea');expect(drive.profile.active.id).toBe('renea-rescue');
    await click('PËRFUNDO SHËRBIMIN');await act(async()=>root.render(<Harness key="busy" streetBusy/>));
    expect(button('Kthim i sigurt').disabled).toBe(true);expect(container.textContent).toContain('Përfundo punën e rrugës');
  });
  it('exposes real parachute and binocular actions without exposing unavailable equipment',async()=>{
    const action=vi.fn(),base={visible:true,enabled:true,disabledReason:'',priority:120,mode:'tap',targetId:null};
    await act(async()=>root.render(<AccessEquipmentControls actions={[]} onAction={action}/>));
    expect(container.querySelector('nav')).toBeNull();
    await act(async()=>root.render(<AccessEquipmentControls actions={[
      {...base,id:'parachute',label:'HAP PARASHUTËN'}, {...base,id:'binoculars',label:'MBYLL DYLBITË'},
      {...base,id:'fire',label:'FIRE'}]} onAction={action}/>));
    expect(container.querySelectorAll('button').length).toBe(2);
    await click('HAP PARASHUTËN');await click('MBYLL DYLBITË');
    expect(action.mock.calls).toEqual([['parachute'],['binoculars']]);
  });
});
