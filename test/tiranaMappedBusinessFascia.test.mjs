import test from 'node:test';
import assert from 'node:assert/strict';
import {mappedBusinessFascia,fasciaAtlasLayout} from '../webapp/src/games/tirana-street-life/mappedBusinessFascia.mjs';
import {STREET_LIFE} from '../webapp/src/games/tirana-street-life/registry.mjs';
import {NEIGHBOURHOOD} from '../webapp/src/games/tirana-neighbourhood/data.mjs';
import {BUSINESS_SIGNS} from '../webapp/src/games/tirana-city-source/businessSignRegistry.mjs';
import {pointInUrbanBounds} from '../webapp/src/games/tiranastreets/shared/urbanBounds.mjs';

test('shared map source has unique identities and original captions for every requested mapped trade category',()=>{
 const eligible=[...STREET_LIFE.storefronts,...NEIGHBOURHOOD.storefronts,...BUSINESS_SIGNS].filter(s=>pointInUrbanBounds(s,4));
 assert.equal(eligible.length,new Set(eligible.map(s=>s.id)).size);
 assert.equal(eligible.length,2218);
 const counts={};
 for(const site of eligible){
  const face={text:site.name};
  const style=mappedBusinessFascia(site,face);
  if(!style)continue;
  assert.deepEqual(Object.keys(style).sort(),['bg','caption','fg','frontage']);
  assert.equal(face.text,site.name,'do not substitute verified tenant names');
  counts[style.caption]=(counts[style.caption]||0)+1;
 }
 assert.ok(counts.KAFE>=250);
 assert.ok(counts.RESTORANT>=300);
 assert.ok(counts.BAR>=170);
 assert.ok(counts.MARKET>=350);
 assert.ok(counts.FARMACI>=100);
 assert.ok(counts['FURRË BUKE']>=210);
 assert.ok(counts.PASTIÇERI>=9);
 assert.ok(counts.BERBER>=80);
 assert.ok(counts.HOTEL>=200);
 assert.ok(counts['BANKË']>=150);
 assert.equal(mappedBusinessFascia({kind:'building-sign',category:'hotel',visualStyle:'custom'},{text:'test'}),null);
 assert.equal(mappedBusinessFascia({kind:'fuel-sign',category:'hotel'},{text:'test'}),null);
 assert.equal(mappedBusinessFascia({kind:'weapons'},{text:'test'}),null);
});
test('full district labels fit a 4096 pixel GPU texture; no names are dropped',()=>{
 for (const entries of [0,350,1360,1486,2238,4096]){
  const {columns,rows,cellHeight}=fasciaAtlasLayout(entries);
  assert.ok(columns*rows>=entries);
  assert.ok(columns*256<=4096);
  assert.ok(rows*cellHeight<=4096);
  assert.ok(cellHeight>=16);
 }
});
