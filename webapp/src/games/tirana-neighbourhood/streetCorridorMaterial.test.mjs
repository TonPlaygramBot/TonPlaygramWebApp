import { test } from 'node:test';
import assert from 'node:assert/strict';
import {corridorMaterialId,corridorRoadMaterialId} from './streetCorridorMaterial.mjs';

test('nine established map names receive seven corridor families',()=>{
 const profiles=[['Bulevardi Dëshmorët e Kombit',1],['Bulevardi Bajram Curri',2],['Bulevardi Gjergj Fishta',2],['Rruga e Kavajës',3],['Rruga e Durrësit',4],['Rruga Ali Demi',5],['Rruga Petro Nini Luarasi',5],['Bulevardi Zogu i Parë',6],['Bulevardi i Ri',7]];
 for(const [name,id] of profiles)assert.equal(corridorMaterialId(name),id);
});
test('standard accent and spacing variants match without guessing partial names',()=>{
 assert.equal(corridorMaterialId('   RRUGA  E  DURRESIT  '),4);
 for(const name of [undefined,null,false,0,'','Durrësit','Rruga Gjergj Fishta','Rruga e Kavajës (service road)','Rruga Dëshmorët e 4 Shkurtit'])assert.equal(corridorMaterialId(name),0,name);
});

test('Mine Peza, Bardhyl, Brryli square and named bridge approach opt in by exact map name',()=>{
 for(const [name,id] of [['Rruga Mine Peza',9],['Rruga Bardhyl',10],['Sheshi Brryli',11],['Ura te Brryli',11]])assert.equal(corridorMaterialId(name),id);
 for(const name of ['Mine Peza','Brryli','Rruga Bardhyl (service road)','Rruga Mine Peza Park'])assert.equal(corridorMaterialId(name),0);
});
test('only tagged Durrësit concrete drive surfaces and Brryli bridge deck get their own material',()=>{
 const asphalt={name:'Rruga e Durrësit',tags:{surface:'asphalt'}};
 const concrete={...asphalt,tags:{surface:'concrete'}};
 assert.equal(corridorRoadMaterialId(asphalt),4);
 assert.equal(corridorRoadMaterialId(concrete),12);
 assert.equal(corridorRoadMaterialId({...concrete,walk:true}),4);
 assert.equal(corridorRoadMaterialId({...concrete,name:'Rruga Bardhyl'}),10);
 assert.equal(corridorRoadMaterialId({name:'Ura te Brryli',bridge:true}),13);
 assert.equal(corridorRoadMaterialId({name:'Ura te Brryli',bridge:false}),11);
 assert.equal(corridorRoadMaterialId(null),0);
});

test('Myslym Shyri has its own surface and Blloku avoids identically named streets outside the district',()=>{
 assert.equal(corridorRoadMaterialId({name:'Rruga Myslym Shyri'}),14);
 assert.equal(corridorRoadMaterialId({name:'Rruga Myslym Lela'}),0);
 const road={name:'Rruga Ismail Qemali',a:[-180,815],b:[-130,815]};
 assert.equal(corridorRoadMaterialId(road),15);
 assert.equal(corridorRoadMaterialId(road,true),15);
 assert.equal(corridorRoadMaterialId({...road,a:[-2138,-2033],b:[-2140,-2043]}),0);
 assert.equal(corridorRoadMaterialId({name:road.name}),0);
 assert.equal(corridorRoadMaterialId({name:'Rruga e Durrësit',tags:{surface:'concrete'}},true),4);
});
