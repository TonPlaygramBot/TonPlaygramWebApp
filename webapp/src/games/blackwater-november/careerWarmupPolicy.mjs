// The sizable career module is speculative only on an explicit good link.
export function canWarmCareer(connection,visibility){
 return visibility==='visible'&&connection?.saveData!==true&&connection?.effectiveType==='4g';
}
export function createSharedCareerLoad(importCareer){
 let pending;
 return ()=>{
   if(!pending){
     // Retain a successful import, but a failed speculative attempt must not
     // block navigation/retry later.
     pending=Promise.resolve().then(importCareer).catch(error=>{pending=undefined;throw error;});
   }
   return pending;
 };
}
