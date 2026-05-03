const KEY='tonplaygram:bowlingInventory:v1';
const normalize=(inv={})=>({environmentHdri:Array.isArray(inv.environmentHdri)?inv.environmentHdri:['dancingHall'],floorFinish:Array.isArray(inv.floorFinish)?inv.floorFinish:['oakVeneer01']});
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
const write=(v)=>localStorage.setItem(KEY,JSON.stringify(v));
export const bowlingAccountId=(id)=>id||localStorage.getItem('accountId')||'guest';
export const getBowlingInventory=(accountId)=>{const all=read();const id=bowlingAccountId(accountId);const inv=normalize(all[id]);all[id]=inv;write(all);return inv;};
export const isBowlingOptionUnlocked=(type, optionId, accountId)=>getBowlingInventory(accountId)[type]?.includes(optionId);
export const addBowlingUnlock=(type, optionId, accountId)=>{const all=read();const id=bowlingAccountId(accountId);const cur=normalize(all[id]);if(!cur[type])cur[type]=[];if(!cur[type].includes(optionId))cur[type].push(optionId);all[id]=cur;write(all);window.dispatchEvent(new CustomEvent('bowlingInventoryUpdated',{detail:{accountId:id,inventory:cur}}));return cur;};
export const listOwnedBowlingOptions=(accountId)=>{const inv=getBowlingInventory(accountId);return Object.entries(inv).flatMap(([type,ids])=>ids.map(optionId=>({type,optionId})));};
