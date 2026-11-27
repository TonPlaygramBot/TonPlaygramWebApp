import { test } from 'node:test';
import assert from 'node:assert/strict';
import {corridorMaterialId} from './streetCorridorMaterial.mjs';

test('nine established map names receive seven corridor families',()=>{
 const profiles=[['Bulevardi Dëshmorët e Kombit',1],['Bulevardi Bajram Curri',2],['Bulevardi Gjergj Fishta',2],['Rruga e Kavajës',3],['Rruga e Durrësit',4],['Rruga Ali Demi',5],['Rruga Petro Nini Luarasi',5],['Bulevardi Zogu i Parë',6],['Bulevardi i Ri',7]];
 for(const [name,id] of profiles)assert.equal(corridorMaterialId(name),id);
});
test('standard accent and spacing variants match without guessing partial names',()=>{
 assert.equal(corridorMaterialId('   RRUGA  E  DURRESIT  '),4);
 for(const name of [undefined,null,false,0,'','Durrësit','Rruga Gjergj Fishta','Rruga e Kavajës (service road)','Rruga Dëshmorët e 4 Shkurtit'])assert.equal(corridorMaterialId(name),0,name);
});
