import test from 'node:test';
import assert from 'node:assert/strict';
import {BRIDGE,BRIDGE_CURB,BRIDGE_ENTRY,bridgeDeckHeight,bridgeDeckSections,tabakeveBridgeHeight,tabakeveCurbBlocks}
 from '../webapp/src/games/tirana-tabakeve/quarterCore.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets-november/street-career/spatialCore.mjs';
import {createBody,stepMotor} from '../webapp/src/games/tiranastreets-november/street-career/playerCore.mjs';
const half=BRIDGE.length/2,c=Math.cos(BRIDGE.yaw),s=Math.sin(BRIDGE.yaw);
const position=(u,v,y=bridgeDeckHeight(u))=>({x:BRIDGE.x+c*u-s*v,z:BRIDGE.z+s*u+c*v,y});
const along=p=>(p.x-BRIDGE.x)*c+(p.z-BRIDGE.z)*s;
const side=p=>-(p.x-BRIDGE.x)*s+(p.z-BRIDGE.z)*c;
test('physical deck exactly interpolates its continuous render sections and approaches',()=>{
 const sections=bridgeDeckSections();
 assert.equal(sections.length,67);
 assert.ok(Math.abs(bridgeDeckHeight(sections[0])-.08)<1e-10);
 for(let i=1;i<sections.length;i++){
  const a=sections[i-1],b=sections[i],u=a*.62+b*.38,p=position(u,0);
  assert.ok(Math.abs(tabakeveBridgeHeight(p.x,p.z)-(.62*bridgeDeckHeight(a)+.38*bridgeDeckHeight(b)))<1e-8);
 }
 for(const d of [-1,1]){
  const p=position(d*(half+BRIDGE_ENTRY+.3),0);
  assert.equal(tabakeveBridgeHeight(p.x,p.z),undefined);
 }
});
const world=new StreetWorld();
test('actual November StreetWorld walks across each direction at centre and off-centre, with no jump',()=>{
 for(const d of [-1,1])for(const v of [-.60,0,.60]){
  const p={...position(-d*17,v),heading:0,speed:0},b=createBody(),state={elapsed:0};
  b.y=world.surface(p.x,p.z,.5);
  let highest=b.y,damage=0;
  for(let i=0;i<420;i++){
   state.elapsed+=1/60;
   stepMotor(state,p,b,{x:0,y:1,yaw:Math.atan2(-d*c,-d*s),pitch:0},1/60,world,()=>{},n=>{damage+=n;});
   highest=Math.max(highest,b.y);
   if(Math.abs(along(p))<half)assert.ok(b.grounded,'no false airborne steps on the cobbles');
  }
  assert.ok(highest>4);
  assert.ok(d*along(p)>half+BRIDGE_ENTRY+5,'exit at the opposite street approach');
  assert.equal(damage,0);assert.ok(b.grounded);
 }
});
test('curbs stop sideways drift but leave approaches open and do not block a jump above the curb',()=>{
 for(const d of [-1,1]){
  const p=position(0,d*.62),dx=-s*d*1.3,dz=c*d*1.3;
  assert.ok(world.move(p,dx,dz,1.7,.28));
  assert.ok(Math.abs(side(p))<1,'world stays on the deck');
  const a=position(d*(half-.1),0),b=position(d*(half-.1),.92);
  assert.equal(tabakeveCurbBlocks(a,b,1.7),false);
  const yy=bridgeDeckHeight(0)+BRIDGE_CURB.height+.04;
  assert.equal(tabakeveCurbBlocks(position(0,0,yy),position(0,.95,yy),1.7),false);
 }
});
