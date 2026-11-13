import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {playerAssetFor} from '../webapp/src/games/tiranastreets/playerCatalog.mjs';

test('Turi ships the complete leaner-build model with verified embedded assets and locomotion',()=>{
 const base=new URL('../webapp/public/assets/tirana-streets/players/',import.meta.url);
 const bytes=readFileSync(new URL('turi.glb',base));
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',base),'utf8'));
 const entry=manifest.players.turi;
 assert.equal(entry.size,bytes.length);
 assert.equal(entry.sha256,createHash('sha256').update(bytes).digest('hex'));
 assert.equal(bytes.readUInt32LE(0),0x46546c67);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 assert.deepEqual(doc.animations.map(a=>a.name),['Idle','Walk','Run']);
 assert.ok(doc.skins.length>0);
 for(const resource of [...doc.images,...doc.buffers])assert.ok(!resource.uri||resource.uri.startsWith('data:'));
 assert.deepEqual(playerAssetFor('turi',manifest),{id:'turi',url:'/assets/tirana-streets/players/turi.glb'});
 assert.equal(playerAssetFor('turi',{players:{turi:{...entry,rigValidated:false}}}),null);
});
