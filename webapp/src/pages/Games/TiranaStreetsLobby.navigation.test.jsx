import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, expect, it, vi} from 'vitest';
import TiranaStreetsLobby from './TiranaStreetsLobby.jsx';
import {BATTLEFIELD_MAP_CATALOG} from '../../games/blackwater/shared/mapCatalog.mjs';
vi.mock('../../games/tiranastreets/PlayerPicker',()=>({PlayerPicker:({onStart})=><button onClick={onStart}>Choose player</button>}));

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,host;
afterEach(async()=>{await act(async()=>root?.unmount());host?.remove();});
it('lets the player choose every district and weapon before deploying',async()=>{
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async()=>root.render(<MemoryRouter initialEntries={['/games/tiranastreets/lobby']}><TiranaStreetsLobby/></MemoryRouter>));
  expect(host.querySelector('.tsl-picker')).toBeNull();
  await act(async()=>host.querySelector('button').click());
  const [map,weapon]=host.querySelectorAll('.tsl-picker select');
  const deploy=host.querySelector('.tsl-battle .tsl-launch');
  expect(map.disabled).toBe(false);expect(weapon.disabled).toBe(false);
  expect(map.options.length).toBe(BATTLEFIELD_MAP_CATALOG.length);
  for(const choice of BATTLEFIELD_MAP_CATALOG){
    await act(async()=>{map.value=choice.id;map.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(new URL(deploy.href).searchParams.get('map')).toBe(choice.id);
  }
  for(const option of weapon.options){
    await act(async()=>{weapon.value=option.value;weapon.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(new URL(deploy.href).searchParams.get('weapon')).toBe(option.value);
  }
  expect(host.querySelector('.tsl-featured .tsl-launch').getAttribute('href')).toContain('activity=street-career');
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Change player').click());
  expect(host.querySelector('.tsl-picker')).toBeNull();
});
