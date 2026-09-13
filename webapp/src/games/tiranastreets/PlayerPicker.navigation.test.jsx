import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PlayerPicker} from './PlayerPicker';
import {selectedPlayerAsset} from './playerCatalog.mjs';

const preview=vi.hoisted(()=>({props:null}));
vi.mock('./PlayerPreview',()=>({PlayerPreview:props=>{preview.props=props;return <div aria-label="Model preview"/>;}}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const manifest={players:Object.fromEntries(['tactical','polish','agent-47'].map(id=>[id,{url:`/assets/tirana-streets/players/${id}.glb`,rigValidated:true}]))};
let host,root,start,back;
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);start=vi.fn();back=vi.fn();vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>manifest}));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const render=()=>act(async()=>root.render(<PlayerPicker onStart={start} onBack={back}/>));
const button=()=>host.querySelector('.player-continue');
it('offers exactly the supplied three and waits for the selected model to render before continuing',async()=>{
 await render();
 expect([...host.querySelectorAll('.player-options button')].map(b=>b.textContent)).toEqual(['01Tactical Soldier','02Polish Soldier','03Agent 47']);
 expect(button().disabled).toBe(true);
 const old=preview.props;
 await act(async()=>host.querySelectorAll('.player-options button')[1].click());
 await act(async()=>old.onState({url:old.url,ready:true,message:'ready'}));
 expect(button().disabled).toBe(true);
 await act(async()=>preview.props.onState({url:preview.props.url,ready:true,message:'ready'}));
 expect(button().disabled).toBe(false);
 await act(async()=>button().click());
 expect(start).toHaveBeenCalledOnce();expect(selectedPlayerAsset().id).toBe('polish');
 await act(async()=>preview.props.onState({url:preview.props.url,ready:false,message:'3D preview interrupted'}));
 expect(button().disabled).toBe(true);
});
it('recovers a missing manifest and keeps Back usable without a model',async()=>{
 fetch.mockRejectedValueOnce(Error('offline'));
 await render();expect(button().disabled).toBe(true);expect(host.textContent).toContain('Could not load the characters');
 await act(async()=>host.querySelector('.player-back').click());expect(back).toHaveBeenCalledOnce();
 await act(async()=>host.querySelector('.player-retry').click());
 expect(fetch).toHaveBeenCalledTimes(2);expect(preview.props.url).toContain('.glb');expect(button().disabled).toBe(true);
});
it('shows attribution for the selected source and preserves Agent 47’s noncommercial notice',async()=>{
 await render();await act(async()=>host.querySelectorAll('.player-options button')[2].click());
 expect(host.querySelector('.player-credits').textContent).toContain('CC BY-NC 4.0');
 expect(button().disabled).toBe(true);
});
