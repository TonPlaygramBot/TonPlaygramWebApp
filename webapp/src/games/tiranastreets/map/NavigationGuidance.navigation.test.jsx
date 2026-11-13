import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {NavigationGuidance} from './NavigationGuidance';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let host,root,props;
beforeEach(()=>{
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 props={route:[{x:0,z:100},{x:0,z:0},{x:100,z:0}],player:{x:0,z:60,speed:10,carId:'car'},destination:{x:100,z:0,name:'Arsenal 24'},onClear:vi.fn()};
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=()=>act(async()=>root.render(<NavigationGuidance {...props}/>));

it('renders the upcoming visible-right turn with route distance, destination and ETA',async()=>{
 await render();expect(host.querySelector('[aria-label="Route guidance"]')).toBeTruthy();
 expect(host.querySelector('strong').textContent).toBe('Turn right · 60 m');expect(host.textContent).toContain('Arsenal 24');expect(host.textContent).toContain('160 m remaining · about 1 min');
 expect(host.querySelector('[aria-hidden="true"]').textContent).toBe('↱');
 props.route=[{x:0,z:100},{x:0,z:0},{x:-100,z:0}];props.destination={x:-100,z:0,name:'City bank'};await render();
 expect(host.querySelector('strong').textContent).toBe('Turn left · 60 m');expect(host.textContent).toContain('City bank');
});

it('clears through the callback and hides when destination is cleared or player is in an aircraft',async()=>{
 await render();await act(async()=>host.querySelector('button[aria-label="Clear destination"]').click());expect(props.onClear).toHaveBeenCalledTimes(1);
 expect(props.route).toHaveLength(3);props.destination=null;await render();expect(host.children).toHaveLength(0);
 props.destination={x:100,z:0,name:'Bank'};props.player.aircraftId='helicopter';await render();expect(host.children).toHaveLength(0);
});

it('distinguishes road-end parking, on-foot approach and actual arrival',async()=>{
 props.route=[{x:0,z:100},{x:0,z:0}];props.player={x:0,z:5,carId:'car'};props.destination={x:20,z:0,name:'Villa entrance'};await render();
 expect(host.querySelector('strong').textContent).toContain('Park, then walk to the entrance');
 props.player={x:0,z:5};await render();expect(host.querySelector('strong').textContent).toContain('Continue to the entrance');
 props.player={x:19,z:0};await render();expect(host.querySelector('strong').textContent).toBe('You have arrived');expect(host.textContent).not.toContain('remaining');
});

it('shows route recovery and unavailable routing without inventing a turn',async()=>{
 props.player={x:50,z:60,carId:'car'};await render();expect(host.querySelector('strong').textContent).toContain('Return to the highlighted route');
 props.route=[];await render();expect(host.querySelector('strong').textContent).toBe('Choose a nearby road or path');expect(host.textContent).not.toContain('about');
 props.destination=undefined;await render();expect(host.textContent).toBe('');
});
