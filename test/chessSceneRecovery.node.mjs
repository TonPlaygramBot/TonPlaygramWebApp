import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../webapp/src/pages/Games/ChessBattleRoyal.jsx',import.meta.url),'utf8');
const start=source.indexOf('    setup().catch((error) => {');
const end=source.indexOf('\n    });',start);
const callback=source.slice(start,end+'\n    });'.length);
test('actual setup rejection displays recovery for mounted scene',async()=>{
 const updates=[];const error=new Error('WebGL unavailable');
 await vm.runInNewContext(callback,{setup:()=>Promise.reject(error),cancelled:false,setSceneFailed:v=>updates.push(v),console:{error(){}}});
 assert.deepEqual(updates,[true]);
});
test('late failure after unmount does not update recovery state',async()=>{
 const updates=[];
 await vm.runInNewContext(callback,{setup:()=>Promise.reject(new Error('disposed')),cancelled:true,setSceneFailed:v=>updates.push(v),console:{error(){}}});
 assert.deepEqual(updates,[]);
});
test('recovery is gated and returns to the existing chess lobby',()=>{
 assert.ok(source.includes("{sceneFailed && <SceneStartupError onReload={() => window.location.reload()} onLobby={() => navigate('/games/chessbattleroyal/lobby')} />}"));
 assert.ok(source.includes('const [sceneFailed, setSceneFailed] = useState(false)'));
});
