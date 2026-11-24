// @vitest-environment node

import {readFileSync} from 'node:fs';
import * as T from 'three';
import {expect,test,vi} from 'vitest';
import {TuriWalker} from './TuriWalker.js';

test('actual frozen Turi GLB parses and preserves normalized height/roots through authored animations',async()=>{
  const file=new URL('../../../public/assets/tirana-streets/players/turi.glb',import.meta.url);
  const bytes=readFileSync(file);
  const exact=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const load=vi.fn(async source=>{
    if(source==='/assets/tirana-streets/players/turi.glb')return {ok:true,arrayBuffer:async()=>exact};
    if(String(source).startsWith('blob:'))return {ok:true,blob:async()=>new Blob()};
    throw new Error('Unexpected network destination: '+String(source));
  });
  vi.stubGlobal('self',globalThis);
  vi.stubGlobal('window',{location:{href:'http://127.0.0.1:4183/games/tiranastreets'}});
  vi.stubGlobal('createImageBitmap',async()=>({width:1,height:1}));
  vi.stubGlobal('fetch',load);
  const walker=new TuriWalker();
  try{
    expect(await walker.load(new AbortController().signal,vi.fn())).toBe(true);
    const bounds=new T.Box3().setFromObject(walker.root);
    expect(bounds.min.y).toBeCloseTo(0,3);expect(bounds.max.y).toBeCloseTo(1.78,3);
    const frame={x:11,z:-4,yaw:.45,walkY:0,walkSpeed:0};
    walker.update(frame,true,.033);expect(walker.active).toBe('Idle');
    walker.update({...frame,walkSpeed:2.55},true,.15);expect(walker.active).toBe('Walk');
    walker.update({...frame,walkSpeed:4.25},true,.15);expect(walker.active).toBe('Run');
    expect(walker.root.position.toArray()).toEqual([11,.065,-4]);
    expect(walker.root.rotation.y).toBe(.45);
    walker.update({...frame,walkYaw:.9,walkSpeed:2.55},true,.016);
    expect(walker.root.rotation.y).toBeGreaterThan(.45);expect(walker.root.rotation.y).toBeLessThan(.9);
    const duration=walker.mixer.time;
    walker.update(frame,false,.4);expect(walker.root.visible).toBe(false);
    expect(walker.mixer.time).toBe(duration);
    expect(load.mock.calls.map(([url])=>url).filter(url=>typeof url==='string'&&!url.startsWith('blob:')))
      .toEqual(['/assets/tirana-streets/players/turi.glb']);
  }finally{walker.dispose();vi.unstubAllGlobals();}
});
