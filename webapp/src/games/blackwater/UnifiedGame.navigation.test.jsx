import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {Game} from './ui';
vi.mock('../tiranastreets/playerCatalog.mjs',()=>({selectedPlayerAsset:()=>({id:'chosen'})}));
vi.mock('./loadGameMode',()=>({loadGameMode:(_key,load)=>load()}));
vi.mock('./TiranaLoading',()=>({TiranaLoading:()=> <p>Loading</p>}));
vi.mock('../tiranastreets/street-career/StreetCareerGame',()=>({StreetCareerGame:({onExit,initialOperation})=><main data-runtime="city" data-operation={initialOperation}><button onClick={onExit}>Leave city</button></main>}));
vi.mock('./operationUi',()=>({Game:()=> <main data-runtime="online">Live online room</main>}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,host;
afterEach(async()=>{await act(async()=>root?.unmount());host?.remove();window.history.replaceState(null,'','/');});
async function render(search,mode='ai'){
 window.history.replaceState(null,'','/games/tiranastreets'+search);host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const onExit=vi.fn();await act(async()=>root.render(<Game mode={mode} onExit={onExit}/>));return onExit;
}
it.each(['','?activity=career','?activity=street-career','?activity=explore'])('mounts the same city runtime for solo URL %s',async search=>{
 const exit=await render(search);expect(host.querySelector('[data-runtime=city]')).not.toBeNull();expect(host.querySelector('[data-runtime=online]')).toBeNull();
 await act(async()=>host.querySelector('button').click());expect(exit).toHaveBeenCalledOnce();
});
it('legacy battlefield district links select a real mission inside the city',async()=>{await render('?map=stadium');expect(host.querySelector('[data-runtime=city]').dataset.operation).toBe('operation-stadium');});
it('an online room never mounts the local campaign even with a legacy career query',async()=>{await render('?activity=career','online');expect(host.querySelector('[data-runtime=online]')).not.toBeNull();expect(host.querySelector('[data-runtime=city]')).toBeNull();});
