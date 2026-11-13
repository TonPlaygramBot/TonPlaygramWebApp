import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

test('the retained street GLB has local texture and decoder dependencies',()=>{
  const base=new URL('../webapp/public/assets/tirana-streets/',import.meta.url);
  for(const name of ['street-kit.glb','street-furniture.glb']) {
    const bytes=readFileSync(new URL(name,base));
    assert.equal(bytes.toString('ascii',0,4),'glTF');
    assert.equal(bytes.readUInt32LE(4),2);
    assert.equal(bytes.readUInt32LE(8),bytes.length);
    const data=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    for(const image of data.images||[]) if(image.uri) {
      assert.ok(!/^(https?:|\/)/.test(image.uri));
      assert.ok(existsSync(new URL(image.uri,base)),image.uri);
    }
    if(data.extensionsRequired?.includes('KHR_draco_mesh_compression'))
      for(const file of ['draco/draco_wasm_wrapper.js','draco/draco_decoder.wasm']) assert.ok(existsSync(new URL(file,base)));
  }
});
