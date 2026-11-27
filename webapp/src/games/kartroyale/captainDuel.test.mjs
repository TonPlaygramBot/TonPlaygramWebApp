import {describe,expect,it} from 'vitest';
import {CAPTAIN_ID,CAPTAIN_NAME,createCaptainGrid,captainDuelOutcome} from './captainDuel.mjs';
import {aiInput,LAPS,makeTrack,RACE_LIMIT,STEP,stepRace,TRACKS} from './simulation.mjs';
describe('local Captain duel',()=>{
  it('uses the existing first row with one human and exactly one equal-kart AI',()=>{
    const t=makeTrack(TRACKS[0].id);
    const [you,boss]=createCaptainGrid(t,'apex');
    expect([you.id,boss.id]).toEqual(['you',CAPTAIN_ID]);
    expect(boss.name).toBe(CAPTAIN_NAME);
    expect([you.ai,boss.ai]).toEqual([false,true]);
    expect(you.kartId).toBe(boss.kartId);
    expect(you.index).toBe(boss.index);
    expect(you.boost).toBe(boss.boost);
    // Lateral separation only, without an arbitrary Captain head start.
    const along=(boss.x-you.x)*Math.sin(you.yaw)+(boss.z-you.z)*Math.cos(you.yaw);
    expect(along).toBeCloseTo(0);
    expect(you.x!==boss.x||you.z!==boss.z).toBe(true);
  });
  it.each([[TRACKS[0].id,'rookie'],['tirana-brryli','rookie'],['tirana-brryli','street'],['tirana-brryli','pro']])('finishes three legal laps on %s at %s difficulty',(route,level)=>{
    const t=makeTrack(route);
    expect(t.id).toBe(route);
    const racers=createCaptainGrid(t,'apex'),[you,boss]=racers;
    let time=0;
    while(!boss.finished&&time<RACE_LIMIT){
      time+=STEP;
      // Deterministic stand-in for driving controls; the engine sees a real human slot.
      you.input=aiInput(you,t,time,level,racers);
      stepRace(racers,t,STEP,time,level);
    }
    expect(boss.finished).toBe(true);
    expect(boss.lapTimes).toHaveLength(LAPS);
    expect(boss.lapTimes.every(lap=>lap>2&&Number.isFinite(lap))).toBe(true);
    expect(boss.finishTime).toBeLessThan(RACE_LIMIT);
    console.info('CPU finished',t.id,boss.finishTime.toFixed(2),'seconds',boss.lapTimes.map(x=>x.toFixed(2)).join(', '));
  },15000);
  it('distinguishes win, loss, same-tick tie and no finish',()=>{
    const done=finishTime=>({finished:true,finishTime});
    expect(captainDuelOutcome(done(70),done(71))).toBe('win');
    expect(captainDuelOutcome(done(71),done(70))).toBe('loss');
    expect(captainDuelOutcome(done(71),done(71))).toBe('tie');
    expect(captainDuelOutcome({finished:false},done(71))).toBe('loss');
    expect(captainDuelOutcome(done(71),{finished:false})).toBe('win');
    expect(captainDuelOutcome(done(71),undefined)).toBe('incomplete');
    expect(captainDuelOutcome(undefined,undefined)).toBe('incomplete');
  });
});
