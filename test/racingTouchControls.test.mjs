import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from '../webapp/node_modules/jsdom/lib/api.js';
import React from '../webapp/node_modules/react/index.js';
import {createRoot} from '../webapp/node_modules/react-dom/client.js';
import {act as legacyAct} from '../webapp/node_modules/react-dom/test-utils.js';
const act=React.act||legacyAct;
import ts from '../webapp/node_modules/typescript/lib/typescript.js';
import {createHeldRaceInput} from '../webapp/src/games/kartroyale/heldRaceInput.mjs';

test('production touch controls preserve two-thumb chords and release every pointer on suspension',async()=>{
  const rootUrl=new URL('../',import.meta.url);
  const source=readFileSync(new URL('webapp/src/games/kartroyale/KartControls.tsx',rootUrl),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.React}}).outputText
    .replace("'react'",JSON.stringify(new URL('webapp/node_modules/react/index.js',rootUrl).href))
    .replace("'lucide-react'",JSON.stringify(new URL('webapp/node_modules/lucide-react/dist/cjs/lucide-react.js',rootUrl).href));
  const {KartControls}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const dom=new JSDOM('<div id="root"></div>',{url:'https://racing.test'});
  const saved={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  dom.window.HTMLElement.prototype.setPointerCapture=function(){};
  const held=createHeldRaceInput(),root=createRoot(document.getElementById('root'));
  const render=async disabled=>act(()=>root.render(React.createElement(KartControls,{hold:held.hold,release:held.release,boost:0,disabled})));
  const event=async(selector,type,id,y=600)=>act(()=>{
    const target=document.querySelector(selector),e=new dom.window.Event(type,{bubbles:true,cancelable:true});
    Object.assign(e,{pointerId:id,pointerType:'touch',button:0,clientY:y});target.dispatchEvent(e);
  });
  try{
    await render(false);
    assert.deepEqual([...document.querySelectorAll('.kart-pedal-controls button')].map(b=>b.textContent),['BRAKE','GAS']);
    await event('.kart-gas','pointerdown',1);await event('.kart-steer-controls button','pointerdown',2);
    assert.equal(held.read().throttle,true);assert.equal(held.read().steer,-1);
    await event('.kart-steer-controls button','pointermove',2,550);assert.equal(held.read().drift,true);
    await event('.kart-gas','pointermove',1,550);assert.equal(held.read().boost,true);
    await event('.kart-steer-controls button','pointermove',2,600);assert.equal(held.read().drift,false);assert.equal(held.read().throttle,true);
    await event('.kart-steer-controls button','pointercancel',2);assert.equal(held.read().steer,0);assert.equal(held.read().boost,true);
    await event('.kart-brake','pointerdown',3);assert.equal(held.read().brake,true);
    await event('.kart-gas','lostpointercapture',1);assert.equal(held.read().throttle,false);assert.equal(held.read().boost,false);assert.equal(held.read().brake,true);
    await render(true);assert.equal(held.read().brake,false);assert.ok([...document.querySelectorAll('button')].every(b=>b.disabled));
    await render(false);await event('.kart-gas','pointerdown',4);
    await act(()=>dom.window.dispatchEvent(new dom.window.Event('blur')));assert.equal(held.read().throttle,false);
    await event('.kart-drift','pointerdown',5);await act(()=>root.unmount());assert.equal(held.read().drift,false);
  }finally{dom.window.close();Object.assign(globalThis,saved);}
});
