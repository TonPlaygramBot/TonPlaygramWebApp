import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PyramidGamingMall} from './PyramidGamingMall';
import {MALL_GAMES} from './mallCatalog.mjs';
import {STORE_GAMES,STORE_ITEMS} from '../../components/store/storeCatalog';
const harness=vi.hoisted(()=>({scene:null,select:null}));
vi.mock('./PyramidMallScene',()=>({PyramidMallScene:class{constructor(root,select){harness.scene=this;harness.select=select;}setDestinations=vi.fn();visit=vi.fn();lobby=vi.fn();walk=vi.fn();dispose=vi.fn();}}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let host,root,onLaunch,onClose;
beforeEach(async()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);onLaunch=vi.fn();onClose=vi.fn();await act(async()=>root.render(<PyramidGamingMall onClose={onClose} onLaunch={onLaunch}/>));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);
it('visits a real hall before launching its existing lobby',async()=>{
 expect(host.querySelectorAll('.tpg-mall-grid button')).toHaveLength(MALL_GAMES.length);
 const game=MALL_GAMES.find(game=>game.slug==='ludobattleroyal');
 await act(async()=>harness.select(game.slug));expect(harness.scene.visit).toHaveBeenCalledWith(game.slug);expect(host.textContent).toContain(game.name);expect(onLaunch).not.toHaveBeenCalled();
 await act(async()=>button('ENTER GAME LOBBY').click());expect(onLaunch).toHaveBeenCalledWith(game.route);
});
it('includes all store items and non-gift shops using the existing checkout routes',async()=>{
 await act(async()=>button(`SHOPS · ${STORE_GAMES.length+1}`).click());
 expect(host.querySelectorAll('.tpg-mall-grid button')).toHaveLength(STORE_GAMES.length+1);
 await act(async()=>harness.select('all'));expect(harness.scene.setDestinations.mock.calls.at(-1)[0][0].count).toBe(STORE_ITEMS.length);
 await act(async()=>button('OPEN SHOP').click());expect(onLaunch).toHaveBeenLastCalledWith('/store/all');
 await act(async()=>button('CHOOSE ANOTHER SHOP').click());await act(async()=>harness.select('home'));await act(async()=>button('OPEN SHOP').click());expect(onLaunch).toHaveBeenLastCalledWith('/store/home');
});
it('walk controls, close and renderer cleanup work without navigating or charging',async()=>{
 await act(async()=>host.querySelector('[aria-label="Close mall directory"]').click());
 await act(async()=>host.querySelector('[aria-label="Walk forward in mall"]').click());expect(harness.scene.walk).toHaveBeenCalledWith(1);
 await act(async()=>button('EXIT MALL').click());expect(onClose).toHaveBeenCalledOnce();expect(onLaunch).not.toHaveBeenCalled();
 const scene=harness.scene;await act(async()=>root.unmount());root={unmount(){}};expect(scene.dispose).toHaveBeenCalledOnce();
});
