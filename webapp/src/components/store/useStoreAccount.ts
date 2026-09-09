import { useCallback, useEffect, useRef, useState } from 'react';
import { buyBundle, getAccountBalance } from '../../utils/api.js';
import { poolRoyalAccountId, getCachedPoolRoyalInventory, getPoolRoyalInventory, isPoolOptionUnlocked, addPoolRoyalUnlock } from '../../utils/poolRoyalInventory.js';
import { getCachedSnookerRoyalInventory, getSnookerRoyalInventory, isSnookerOptionUnlocked, addSnookerRoyalUnlock } from '../../utils/snookerRoyalInventory.js';
import { getAirHockeyInventory, isAirHockeyOptionUnlocked, addAirHockeyUnlock } from '../../utils/airHockeyInventory.js';
import { getChessBattleInventory, isChessOptionUnlocked, addChessBattleUnlock } from '../../utils/chessBattleInventory.js';
import { getFourInRowInventory, isFourInRowOptionUnlocked, addFourInRowUnlock } from '../../utils/fourInRowInventory.js';
import { getTavullBattleInventory, isTavullOptionUnlocked, addTavullBattleUnlock } from '../../utils/tavullBattleInventory.js';
import { getLudoBattleInventory, isLudoOptionUnlocked, addLudoBattleUnlock } from '../../utils/ludoBattleInventory.js';
import { getMurlanInventory, isMurlanOptionUnlocked, addMurlanUnlock } from '../../utils/murlanInventory.js';
import { getDominoRoyalInventory, isDominoOptionUnlocked, addDominoRoyalUnlock } from '../../utils/dominoRoyalInventory.js';
import { getSnakeInventory, isSnakeOptionUnlocked, addSnakeUnlock } from '../../utils/snakeInventory.js';
import { getTexasHoldemInventory, isTexasOptionUnlocked, addTexasHoldemUnlock } from '../../utils/texasHoldemInventory.js';
import { isAppThemeOwned, addAppThemeUnlock } from '../../utils/appTheme.js';
import { addTrainingAttempts } from '../../utils/poolRoyaleTrainingProgress.js';
import { recordStorePurchase } from '../../utils/storeTransactions.js';
import { totalPrice, uniqueCart, type StoreItem } from './storeModel';

type Inventory = Record<string,unknown>;
type Adapter = { read:(account:string)=>unknown; owns:(type:string,id:string|number,inventory:unknown)=>boolean; unlock:(type:string,id:string|number,account:string)=>unknown };
const adapters: Record<string,Adapter> = {
  poolroyale:{read:getCachedPoolRoyalInventory,owns:isPoolOptionUnlocked,unlock:addPoolRoyalUnlock},
  snookerroyale:{read:getCachedSnookerRoyalInventory,owns:isSnookerOptionUnlocked,unlock:addSnookerRoyalUnlock},
  airhockey:{read:getAirHockeyInventory,owns:isAirHockeyOptionUnlocked,unlock:addAirHockeyUnlock},
  chessbattleroyal:{read:getChessBattleInventory,owns:isChessOptionUnlocked,unlock:addChessBattleUnlock},
  fourinrowroyale:{read:getFourInRowInventory,owns:isFourInRowOptionUnlocked,unlock:addFourInRowUnlock},
  tavullbattleroyal:{read:getTavullBattleInventory,owns:isTavullOptionUnlocked,unlock:addTavullBattleUnlock},
  ludobattleroyal:{read:getLudoBattleInventory,owns:isLudoOptionUnlocked,unlock:addLudoBattleUnlock},
  murlanroyale:{read:getMurlanInventory,owns:isMurlanOptionUnlocked,unlock:addMurlanUnlock},
  'domino-royal':{read:getDominoRoyalInventory,owns:isDominoOptionUnlocked,unlock:addDominoRoyalUnlock},
  snake:{read:getSnakeInventory,owns:isSnakeOptionUnlocked,unlock:addSnakeUnlock},
  texasholdem:{read:getTexasHoldemInventory,owns:isTexasOptionUnlocked,unlock:addTexasHoldemUnlock}
};
const family=(slug:string)=>({bilardoshqip:'poolroyale',checkersbattleroyal:'chessbattleroyal',weaponkart:'murlanroyale'} as Record<string,string>)[slug]||slug;
function readInventories(account:string): Inventory {
  return Object.fromEntries(Object.entries(adapters).map(([key,a])=>{try{return [key,a.read(account)];}catch{return [key,undefined];}}));
}
export interface PurchaseResult {ok:boolean;message:string;uncertain?:boolean}
export function useStoreAccount() {
  const [accountId,setAccountId]=useState(()=>poolRoyalAccountId());
  const [inventories,setInventories]=useState(()=>readInventories(accountId));
  const [balance,setBalance]=useState<number|null>(null);
  const [balanceError,setBalanceError]=useState(false);
  const [processing,setProcessing]=useState(false);
  const [confirmed,setConfirmed]=useState<Set<string>>(()=>new Set());
  const paying=useRef(false), mounted=useRef(true), generation=useRef(0);
  const uncertain=useRef(false);
  const linked=Boolean(accountId && accountId!=='guest');
  const refresh=useCallback(async()=>{
    const version=++generation.current;
    const nextAccount=poolRoyalAccountId();
    setAccountId(nextAccount);
    setBalance(null);
    setInventories(readInventories(nextAccount));
    if(!nextAccount || nextAccount==='guest'){setBalance(null);return;}
    setBalanceError(false);
    const tasks=await Promise.allSettled([getAccountBalance(nextAccount),getPoolRoyalInventory(nextAccount),getSnookerRoyalInventory(nextAccount)]);
    if(!mounted.current || version!==generation.current)return;
    const b=tasks[0];
    if(b.status==='fulfilled' && typeof b.value?.balance==='number' && Number.isFinite(b.value.balance))setBalance(b.value.balance);
    else {setBalance(null);setBalanceError(true);}
    setInventories(prev=>({...prev,...(tasks[1].status==='fulfilled'?{poolroyale:tasks[1].value}:{}),...(tasks[2].status==='fulfilled'?{snookerroyale:tasks[2].value}:{})}));
  },[]);
  useEffect(()=>{
    mounted.current=true;void refresh();
    const update=()=>{if(!paying.current)void refresh();};
    const inventoryEvents=['poolRoyalInventoryUpdate','snookerRoyalInventoryUpdate','airHockeyInventoryUpdate','chessBattleInventoryUpdate','fourInRowInventoryUpdate','tavullBattleInventoryUpdate','ludoBattleInventoryUpdate','murlanInventoryUpdate','dominoRoyalInventoryUpdate','snakeInventoryUpdate','texasHoldemInventoryUpdate','appThemeUpdate'];
    inventoryEvents.forEach(event=>window.addEventListener(event,update));
    window.addEventListener('storage',update);window.addEventListener('focus',update);
    return()=>{mounted.current=false;generation.current++;inventoryEvents.forEach(event=>window.removeEventListener(event,update));window.removeEventListener('storage',update);window.removeEventListener('focus',update);};
  },[refresh]);
  useEffect(()=>{setConfirmed(new Set());uncertain.current=false;},[accountId]);
  const isOwned=useCallback((item:StoreItem)=>{
    if(item.type==='poolTrainingAttempt')return false;
    if(confirmed.has(item.entitlementKey))return true;
    if(item.slug==='home')return isAppThemeOwned(item.optionId);
    const a=adapters[family(item.slug)];
    const type=item.slug==='weaponkart' && item.type==='humanCharacter'?'characters':item.type;
    try {return a ? a.owns(type,item.optionId,inventories[family(item.slug)]) : false;}catch{return false;}
  },[inventories,confirmed]);
  const purchase=useCallback(async(selected:StoreItem[]):Promise<PurchaseResult>=>{
    if(paying.current)return {ok:false,message:'A purchase is already in progress.'};
    if(uncertain.current)return {ok:false,uncertain:true,message:'The previous payment result is unconfirmed. Check your wallet and inventory before trying again.'};
    if(!linked || poolRoyalAccountId()!==accountId)return {ok:false,message:'Link your account, then review your basket again.'};
    const items=uniqueCart(selected).filter(item=>!isOwned(item));
    if(!items.length)return {ok:false,message:'These items are already in your collection.'};
    const total=totalPrice(items);
    if(items.some(item=>!Number.isFinite(item.price)||item.price<0) || !Number.isFinite(total) || total<=0)return {ok:false,message:'An item price is unavailable. Refresh the store.'};
    if(balance===null)return {ok:false,message:'Refresh your wallet balance before paying.'};
    if(total>balance)return {ok:false,message:'Your TPG balance is too low for this purchase.'};
    paying.current=true;setProcessing(true);
    let charged=false;
    try {
      // This is the existing authenticated store API. No wallet address or payment endpoint is changed.
      const response=await buyBundle(accountId,{items:items.map(({slug,type,optionId,price})=>({slug,type,optionId,price}))});
      if(response?.error)return {ok:false,message:String(response.error)};
      if(response?.paymentToken!=='TPG' || !Number.isFinite(response?.balance) || !response?.date){
        uncertain.current=true;return {ok:false,uncertain:true,message:'The payment response could not be verified. Check your wallet before trying again.'};
      }
      charged=true;
      if(mounted.current && poolRoyalAccountId()===accountId){setBalance(response.balance);setConfirmed(prev=>new Set([...prev,...items.filter(item=>item.type!=='poolTrainingAttempt').map(item=>item.entitlementKey)]));}
      // Local adapters mirror the existing Store.jsx delivery paths. Sequential delivery avoids cache races.
      let syncFailed=false;
      for(const item of items){
        try{
          if(item.type==='poolTrainingAttempt' && family(item.slug)==='poolroyale')addTrainingAttempts(Math.floor(Number(item.optionId)));
          else if(item.slug==='home')addAppThemeUnlock(item.type,item.optionId);
          else {
            const a=adapters[family(item.slug)];
            if(!a)throw new Error('Unknown inventory adapter');
            await a.unlock(item.slug==='weaponkart' && item.type==='humanCharacter'?'characters':item.type,item.optionId,accountId);
          }
        }catch{syncFailed=true;}
      }
      try{recordStorePurchase(accountId,{totalPrice:total,detail:`${items.length} store item${items.length===1?'':'s'}`,items:items.map(item=>({slug:item.slug,type:item.type,optionId:item.optionId,label:item.displayLabel,price:item.price}))});}catch{syncFailed=true;}
      if(mounted.current && poolRoyalAccountId()===accountId)setInventories(readInventories(accountId));
      return {ok:true,message:syncFailed?'Payment confirmed. Some inventory updates need to sync; do not purchase again.':'Purchase confirmed. Your collection has been updated.'};
    }catch{
      // The backend has no idempotency key. A lost response MUST NOT invite an immediate second charge.
      if(charged)return {ok:true,message:'Payment confirmed. Refresh your collection to finish syncing; do not purchase again.'};
      uncertain.current=true;return {ok:false,uncertain:true,message:'Payment result is unconfirmed. Check your wallet and inventory before trying again.'};
    }finally{paying.current=false;if(mounted.current)setProcessing(false);}
  },[accountId,balance,isOwned,linked]);
  return {accountId,linked,balance,balanceError,processing,isOwned,purchase,refresh};
}
