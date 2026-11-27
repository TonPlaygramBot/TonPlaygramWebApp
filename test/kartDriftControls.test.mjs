import {test} from 'node:test';
import assert from 'node:assert/strict';
import {after} from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';

const web=fileURLToPath(new URL('../webapp/',import.meta.url));
const dir=mkdtempSync(join(tmpdir(),'kart-drift-controls-'));
after(()=>rmSync(dir,{recursive:true,force:true}));
const out=join(dir,'controls.cjs');
const require=createRequire(resolve(web,'package.json'));
await require('esbuild').build({stdin:{contents:`
 const React=require('react');
 const {renderToStaticMarkup}=require('react-dom/server');
 const {KartControls}=require('./KartControls.tsx');
 const {stepDrift}=require('./arcadeRules.mjs');
 module.exports={stepDrift,render:props=>renderToStaticMarkup(React.createElement(KartControls,{hold(){},release(){},...props}))};
`,resolveDir:resolve(web,'src/games/kartroyale')},outfile:out,bundle:true,platform:'node',format:'cjs'});
const {default:{render,stepDrift}}=await import(pathToFileURL(out));

const button = (html, cls) => html.match(new RegExp(`<button[^>]+class="kart-${cls}[^"]*"[\\s\\S]*?</button>`))?.[0] || '';

test('charge lives on drift pedal and does not replace the manual boost reserve', () => {
  const html = render({ boost:35, drifting:true, driftCharge:.3 });
  assert.match(button(html,'boost'), /width:35%/);
  assert.match(button(html,'drift'), />CHARGE</);
  assert.match(button(html,'drift'), /width:16%/);
  assert.doesNotMatch(button(html,'drift'), />RELEASE</);
});

test('release instruction changes only at real simulation thresholds', () => {
  for (const [charge,tier,name] of [[.55,1,'MINI'],[1.15,2,'SUPER'],[1.9,3,'ROYAL']]) {
    const r = { speed:11, steering:.7, turbo:0, boost:35, drifting:true, driftCharge:charge };
    const html = render(r);
    assert.match(button(html,'drift'), new RegExp(`data-drift-tier="${tier}"`));
    assert.match(button(html,'drift'), />RELEASE</);
    assert.match(html,new RegExp(`${name} turbo ready\\. Release drift\\.`));
    stepDrift(r, {drift:false}, .016);
    const after = render(r);
    assert.match(button(after,'boost'), />TURBO</);
    assert.match(button(after,'boost'), new RegExp(`width:${35+8*tier}%`));
    assert.match(button(after,'drift'), />DRIFT</);
    assert.doesNotMatch(after, /turbo ready/);
  }
});

test('braking cancels charged drift without advertising a turbo', () => {
  const r = { speed:11, steering:.7, turbo:0, boost:35, drifting:true, driftCharge:1.9 };
  stepDrift(r, {drift:true,brake:true}, .016);
  const html=render(r);
  assert.match(button(html,'boost'), />BOOST</);
  assert.match(button(html,'boost'), /width:35%/);
  assert.doesNotMatch(html, />RELEASE<|turbo ready/);
});
