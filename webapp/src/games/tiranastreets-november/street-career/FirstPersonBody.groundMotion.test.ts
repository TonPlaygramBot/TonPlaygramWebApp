import {expect,test} from 'vitest';
import * as T from 'three';
import {FirstPersonBody} from './FirstPersonBody';
import {createBody,MOTOR} from './playerCore.mjs';
import type {Actor} from '../cityBaseRenderer';
import type {Player} from '../shared/engine.mjs';

test('the rendered unarmed body mixes a measured Walk and Run, and stops against a collision',()=>{
  const group=new T.Group();
  const mixer=new T.AnimationMixer(group);
  const animation=(name:string,duration:number)=>mixer.clipAction(new T.AnimationClip(name,duration,[]));
  const idle=animation('Idle',3),walk=animation('Walk',1.2),run=animation('Run',.7);
  const actor={group,mixer,idle,walk,run,clips:{Idle:idle,Walk:walk,Run:run}} as Actor;
  const player={x:0,z:0,speed:0,health:100,weapon:'',nextShot:0} as Player;
  const body=createBody(), rig=new FirstPersonBody(new T.Scene());
  let time=0;
  function sample(speed:number,travel:number,frames:number){
    player.speed=speed;body.travelX=travel;body.travelZ=0;
    for(let frame=0;frame<frames;frame++){
      time+=1/60;rig.update(actor,player,body,time,1/60,undefined,false);
    }
  }
  const weight=(action:T.AnimationAction|undefined)=>action?.isRunning()?action.getEffectiveWeight():0;
  sample(0,0,14);
  expect(weight(actor.idle)).toBeCloseTo(1);
  sample(MOTOR.walk,MOTOR.walk,40);
  expect(weight(actor.walk)).toBeCloseTo(1);
  expect(actor.walk!.getEffectiveTimeScale()).toBeCloseTo(1);
  expect(weight(actor.run)).toBeCloseTo(0);
  sample(MOTOR.run,MOTOR.run,40);
  expect(weight(actor.run)).toBeCloseTo(1);
  expect(actor.run!.getEffectiveTimeScale()).toBeCloseTo(1);
  expect(weight(actor.walk)).toBeCloseTo(0);
  sample(MOTOR.run,0,16); // measured displacement blocked while the previous report is stale
  expect(weight(actor.idle)).toBeCloseTo(1);
  expect(weight(actor.run)).toBeCloseTo(0);
});
