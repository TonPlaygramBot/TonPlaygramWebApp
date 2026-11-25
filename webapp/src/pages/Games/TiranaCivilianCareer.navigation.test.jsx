import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {SAVE_KEY} from '../../games/tiranastreets/career/careerCore.mjs';
import TiranaStreets from './TiranaStreets.jsx';

const calls=vi.hoisted(()=>({mode:[],starts:0,interacts:0,disposed:0}));
vi.mock('../../games/tirana-standalone/CityRoamView.js',()=>({
  CityRoamView:class{
    constructor(_root,publish,{careerMode}){
      calls.mode.push(careerMode);this.publish=publish;this.mode=careerMode;this.touch={};
      this.publish({ready:true,state:'walk',assetReady:false,career:careerMode?{completed:0,next:{id:'first-contact'},storageOK:true}:undefined});
    }
    startCareer(){
      calls.starts++;
      this.publish({career:{position:1,steps:2,storageOK:true,task:{name:'Sheshi Skënderbej',text:'Pika e takimit me Arbenin',distance:2,bearing:0,canInteract:true}}});
    }
    interactCareer(){calls.interacts++;this.publish({career:{completed:1,next:{id:'culture-run'},storageOK:true}});}
    dispose(){calls.disposed++;}
  }
}));

let root,host;
const mount=async(path)=>{
  await act(async()=>root.render(<MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/games/tiranastreets/lobby" element={<TiranaStreets/>}/>
      <Route path="/games/tiranastreets" element={<TiranaStreets/>}/>
    </Routes>
  </MemoryRouter>));
};
const button=text=>[...host.querySelectorAll('button')].find(el=>el.textContent===text);
beforeEach(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();
  Object.assign(calls,{mode:[],starts:0,interacts:0,disposed:0});
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});

it('lobby exposes separate free roam and historical Career, and only mounts renderer on entering',async()=>{
  await mount('/games/tiranastreets/lobby');
  const roam=host.querySelector('a[href="/games/tiranastreets"]');
  const career=host.querySelector('a[href="/games/tiranastreets?mode=career"]');
  expect(roam?.textContent).toBe('Eksploro Tiranën');
  expect(career?.textContent).toBe('Hap karrierën');
  expect(host.querySelectorAll('.tsc-career-card li')).toHaveLength(6);
  expect(host.textContent.match(/Nuk është hapur në këtë version/g)).toHaveLength(1);
  expect(calls.mode).toEqual([]);
  await act(async()=>career.click());
  expect(calls.mode).toEqual([true]);
  await act(async()=>button('Fillo kapitullin').click());
  expect(calls.starts).toBe(1);
  expect(host.querySelector('.tsc-career-hud').textContent).toContain('Detyra 1/2');
  await act(async()=>button('Ndërvepro').click());
  expect(calls.interacts).toBe(1);
  expect(host.textContent).toContain('Kapitulli u përfundua.');
  expect(button('Fillo kapitullin tjetër')).toBeTruthy();
  await act(async()=>host.querySelector('.tsc-top-actions a').click());
  expect(calls.disposed).toBe(1);
});

it('existing local save shows Continue without changing it, and free roam remains independent',async()=>{
  const checkpoint=JSON.stringify({version:1,completed:[],active:{id:'first-contact',routeVersion:2,step:1,elapsed:12}});
  localStorage.setItem(SAVE_KEY,checkpoint);
  await mount('/games/tiranastreets/lobby');
  expect(host.querySelector('a[href="/games/tiranastreets?mode=career"]').textContent).toBe('Vazhdo karrierën');
  await act(async()=>host.querySelector('a[href="/games/tiranastreets"]').click());
  expect(calls.mode).toEqual([false]);
  expect(host.querySelector('.tsc-career-hud')).toBeNull();
  expect(localStorage.getItem(SAVE_KEY)).toBe(checkpoint);
});
