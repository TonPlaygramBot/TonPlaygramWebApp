import { cityEconomySites, ECONOMY_BANKS, ECONOMY_PROPERTIES } from './cityEconomyCatalog.mjs';
import { WEAPON_BY_ID } from '../shared/weapons.mjs';
import { reportCrime, wantedStars } from '../shared/cityLife.mjs';
import { reserveCapacity } from '../shared/ammunition.mjs';

export const ECONOMY_LIMIT=10000000;
export const BANK_HOLD_SECONDS=18;
export const BANK_COOLDOWN_SECONDS=600;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const count=(n,max=ECONOMY_LIMIT)=>Number.isFinite(n)?Math.min(max,Math.max(0,Math.floor(n))):0;
const properties=new Map(ECONOMY_PROPERTIES.map(s=>[s.id,s]));
const banks=new Set(ECONOMY_BANKS.map(s=>s.id));
export function normalizeCityEconomy(raw) {
  const data={version:1,bank:0,owned:[],stash:{},cooldowns:{}};
  if(raw?.version!==1)return data;
  data.bank=count(raw.bank);
  data.owned=[...new Set((Array.isArray(raw.owned)?raw.owned:[]).filter(id=>properties.has(id)))];
  for(const id of data.owned){
    data.stash[id]={};
    for(const [weapon,w] of WEAPON_BY_ID){
      if(w.category==='melee')continue;
      const amount=count(raw.stash?.[id]?.[weapon],properties.get(id).stashMagazines*w.magazine);
      if(amount)data.stash[id][weapon]=amount;
    }
  }
  for(const id of banks){const remaining=count(raw.cooldowns?.[id],BANK_COOLDOWN_SECONDS);if(remaining)data.cooldowns[id]=remaining;}
  return data;
}
const descriptor=(site,label,point,p)=>({id:'interact',targetId:site.id,label,kind:'economy',visible:true,enabled:true,disabledReason:'',priority:105,score:105-distance(p,point),mode:'tap'});

/** Local street-cash economy. No account wallet, token balance or network writes. */
export class CityEconomySimulation {
  constructor(sim,raw,sites=cityEconomySites()){
    this.sim=sim;this.sites=sites;this.data=normalizeCityEconomy(raw);this.selectedId=null;this.robbery=null;
  }
  restore(raw){this.data=normalizeCityEconomy(raw);this.robbery=null;this.selectedId=null;}
  snapshot(){return normalizeCityEconomy(this.data);}
  owns(id){return this.data.owned.includes(id);}
  get selected(){return this.sites.find(s=>s.id===this.selectedId)||null;}
  get blockedReason(){
    const {player:p,body:b,state}=this.sim;
    if(p.health<=0||p.failed||p.finished||p.arrest||this.sim.arrest?.locked)return 'Unavailable while injured or under arrest.';
    if(p.carId||p.aircraftId||b.action||this.sim.access?.travel||b.interaction!=='free')return 'Stop and enter on foot.';
    if(state.missionId!=='free-roam')return 'Available during free roam. Finish or leave your job first.';
    return '';
  }
  near(site,entrance=false){
    const point=entrance?site.entrance:site.counter;
    // Keep the service focus distinct from the small villa's exit portal.
    return distance(this.sim.player,point)<=(entrance?4.5:2.3)&&Math.abs(this.sim.body.y-point.y)<1.4;
  }
  candidates(){
    const {player:p,body:b}=this.sim;
    if(p.carId||p.aircraftId||p.health<=0||!b.grounded||b.interaction!=='free'||b.action)return [];
    return this.sites.flatMap(site=>{
      if(site.kind!=='bank'&&!this.owns(site.id)&&this.near(site,true))return [descriptor(site,'VIEW PROPERTY · '+site.name,site.entrance,p)];
      if(this.near(site)&& (site.kind==='bank'||this.owns(site.id)))return [descriptor(site,site.kind==='bank'?'BANK · CASH / TPG WALLET':'HOME · AMMO STORAGE',site.counter,p)];
      return [];
    });
  }
  execute(action){
    if(!this.candidates().some(c=>c.targetId===action.targetId))return false;
    this.selectedId=action.targetId;this.sim.event('economy',{targetId:action.targetId});return true;
  }
  fail(message){this.sim.body.notice=message;return false;}
  transact(action,id,amount,weapon){
    const site=this.sites.find(s=>s.id===id),p=this.sim.player;
    if(!site)return this.fail('This location is unavailable.');
    if(this.blockedReason)return this.fail(this.blockedReason);
    if(this.robbery)return this.fail('Finish or abandon the active bank job first.');
    const buying=action==='purchase';
    if(!this.near(site,buying))return this.fail(buying?'Visit the property entrance first.':'Walk inside to the service counter.');
    const sum=Number(amount);
    if(action!=='purchase'&&action!=='rob'&&(!Number.isSafeInteger(sum)||sum<=0))return this.fail('Enter a positive whole amount.');
    if(buying){
      if(site.kind==='bank'||!properties.has(id))return false;
      if(this.owns(id))return this.fail('You already own this home.');
      if(wantedStars(p.wanted)>0)return this.fail('Lose your wanted stars before buying a home.');
      if(p.cash<site.price)return this.fail('Not enough street cash.');
      p.cash-=site.price;this.data.owned.push(id);this.data.stash[id]={};
      this.sim.body.notice='Home purchased · enter to store ammunition.';this.sim.event('property-purchased',{targetId:id});return true;
    }
    if(site.kind==='bank'){
      if(action==='rob')return this.startRobbery(site);
      if(wantedStars(p.wanted)>0)return this.fail('The teller is closed while you are wanted.');
      if(action==='deposit'){
        if(sum>p.cash||this.data.bank+sum>ECONOMY_LIMIT)return this.fail('Amount exceeds available cash or account capacity.');
        p.cash-=sum;this.data.bank+=sum;
      }else if(action==='withdraw'){
        if(sum>this.data.bank||p.cash+sum>ECONOMY_LIMIT)return this.fail('Amount exceeds your deposited cash or pocket capacity.');
        this.data.bank-=sum;p.cash+=sum;
      }else return false;
      this.sim.body.notice=`${sum} street cash ${action==='deposit'?'deposited':'withdrawn'}.`;this.sim.event('bank-transfer',{targetId:id});return true;
    }
    if(!this.owns(id))return this.fail('Buy this home before using its storage.');
    if(wantedStars(p.wanted)>0)return this.fail('Lose your wanted stars before accessing storage.');
    const w=WEAPON_BY_ID.get(weapon),inv=p.inventory?.[weapon];
    if(!w||w.category==='melee'||!inv)return this.fail('Equip a firearm you own first.');
    const stash=this.data.stash[id]|| (this.data.stash[id]={}),stored=stash[weapon]||0;
    if(action==='store'){
      if(sum>inv.reserve||stored+sum>site.stashMagazines*w.magazine)return this.fail('Amount exceeds reserve ammunition or home storage.');
      inv.reserve-=sum;stash[weapon]=stored+sum;
    }else if(action==='take'){
      // Shared pickup/shop upgrades use this same carry-capacity field.
      const capacity=reserveCapacity(w);
      if(sum>stored||inv.reserve+sum>capacity)return this.fail('Amount exceeds stored ammunition or carry capacity.');
      stash[weapon]=stored-sum;inv.reserve+=sum;
    }else return false;
    this.sim.body.notice=`${sum} rounds ${action==='store'?'stored':'collected'}.`;this.sim.event('home-storage',{targetId:id});return true;
  }
  startRobbery(site){
    if(this.data.cooldowns[site.id]>0)return this.fail('This branch is recovering. Try another bank later.');
    const w=WEAPON_BY_ID.get(this.sim.player.weapon);
    if(!w||w.category==='melee'||w.category==='throwable')return this.fail('Equip a firearm to start the fictional bank job.');
    this.data.cooldowns[site.id]=BANK_COOLDOWN_SECONDS;
    this.robbery={siteId:site.id,phase:'hold',remaining:BANK_HOLD_SECONDS,reward:site.reward};
    reportCrime(this.sim.state,this.sim.player,260);
    this.sim.body.notice='Alarm triggered · remain inside the teller zone.';this.sim.event('bank-alarm',{targetId:site.id});return true;
  }
  step(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    for(const id of Object.keys(this.data.cooldowns))this.data.cooldowns[id]=Math.max(0,this.data.cooldowns[id]-dt);
    const job=this.robbery;if(!job)return;
    const p=this.sim.player,site=this.sites.find(s=>s.id===job.siteId);
    if(!site||p.health<=0||p.arrest||p.failed||this.sim.arrest?.locked||this.sim.state.missionId!=='free-roam'){
      this.robbery=null;this.sim.body.notice='Bank job failed · no cash collected.';return;
    }
    if(job.phase==='hold'){
      if(distance(p,site.counter)>8||Math.abs(this.sim.body.y-site.counter.y)>1.5||p.carId||p.aircraftId){this.robbery=null;this.sim.body.notice='You left the teller zone · bank job abandoned.';return;}
      job.remaining=Math.max(0,job.remaining-dt);
      // Keep the alarm active while the player is holding the bank.
      p.lastCrime=this.sim.state.elapsed;
      if(job.remaining===0){job.phase='escape';this.sim.body.notice='Leave the bank, travel 100 m away and lose your wanted stars.';this.sim.event('bank-escape',{targetId:site.id});}
    }else if(distance(p,site.entrance)>=100&&wantedStars(p.wanted)===0){
      p.cash=Math.min(ECONOMY_LIMIT,p.cash+job.reward);this.robbery=null;
      this.sim.body.notice=`Bank job complete · ${job.reward} street cash.`;this.sim.event('bank-job-complete',{targetId:site.id});
    }
  }
  objective(){
    const job=this.robbery;if(!job)return null;
    return {title:job.phase==='hold'?`Bank alarm · ${Math.ceil(job.remaining)}s`:'Bank escape',detail:job.phase==='hold'?'Remain inside the teller zone. Police are responding.':'Travel 100 m from the bank and lose your wanted stars.',training:false};
  }
}
