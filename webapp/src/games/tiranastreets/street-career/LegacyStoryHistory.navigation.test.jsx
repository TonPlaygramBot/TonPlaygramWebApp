import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {LegacyStoryHistory} from './LegacyStoryHistory';
import {loadLegacyStoryHistory} from './legacyStoryHistory.mjs';
import {SAVE_KEY} from '../career/careerCore.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,host;
afterEach(async()=>{await act(async()=>root?.unmount());host?.remove();});
async function render(history){host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<LegacyStoryHistory history={history}/>));}
it('keeps the journal quiet without a valid earlier save',async()=>{
 for(const saved of [null,'broken','{}','{"version":2,"completed":[]}'])expect(loadLegacyStoryHistory({getItem:()=>saved})).toBeNull();
 await render(null);expect(host.textContent).toBe('');
});
it('shows exact validated chapter history and an earlier checkpoint without changing either save',async()=>{
 const raw=JSON.stringify({version:1,completed:['first-contact','culture-run','culture-run','last-delivery'],bestTimes:{},grades:{},active:{id:'city-ledger',routeVersion:2,step:1,elapsed:25},xp:99999,cash:99999});
 const storage={getItem:vi.fn(key=>key===SAVE_KEY?raw:null),setItem:vi.fn()};
 const history=loadLegacyStoryHistory(storage);await render(history);
 expect(history.completed).toEqual(['A name in the square','After the rehearsal']);
 expect(host.querySelector('summary').textContent).toContain('2/6 chapters completed');
 expect(host.textContent).toContain('The missing ledger');expect(host.textContent).toContain('Step 2 of 4');
 expect(host.textContent).toContain('do not mark current jobs complete or add rewards');
 expect(host.textContent).not.toContain('99999');expect(storage.setItem).not.toHaveBeenCalled();
 expect(storage.getItem(SAVE_KEY)).toBe(raw);
});
it('shows fresh earlier history only when that save actually exists',async()=>{
 const history=loadLegacyStoryHistory({getItem:()=>JSON.stringify({version:1,completed:[],active:null})});await render(history);
 expect(host.querySelector('summary').textContent).toContain('0/6 chapters completed');expect(host.querySelector('ul')).toBeNull();
});
