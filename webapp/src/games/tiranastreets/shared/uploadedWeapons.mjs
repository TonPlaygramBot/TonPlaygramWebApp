// The five user-supplied firearms. All stats are fictional game balance.
export const UPLOADED_WEAPONS = Object.freeze([
  {id:'adaptiveCombatRifleAttack',battlefieldId:'acr',label:'Adaptive Combat Rifle',category:'rifle',magazine:30,damage:22,interval:.12,range:52,reload:2.1,price:330,priceTPG:3200,length:.9},
  {id:'dragunovAttack',battlefieldId:'dragunov',label:'SVD 63 · Dragunov',category:'marksman',magazine:10,damage:66,interval:.8,range:85,reload:2.7,price:440,priceTPG:3900,length:1.05},
  {id:'vityazAttack',battlefieldId:'vityaz',label:'PP-19-01 · Vityaz',category:'smg',magazine:30,damage:16,interval:.09,range:32,reload:1.8,price:250,priceTPG:2100,length:.7},
  {id:'ar15Attack',battlefieldId:'ar15',label:'AR15 Rifle',category:'rifle',magazine:30,damage:24,interval:.15,range:56,reload:2.2,price:350,priceTPG:3000,length:.9},
  {id:'makarovAttack',battlefieldId:'makarov',label:'Makarov PM',category:'sidearm',magazine:8,damage:30,interval:.32,range:24,reload:1.4,price:120,priceTPG:950,length:.32}
].map(w=>Object.freeze({...w,model:w.id,radius:0,modelUrl:`/assets/tirana-streets/weapons/${w.id}.glb`,thumbnail:`/assets/tirana-streets/weapon-thumbnails/${w.id}.webp`})));

/** Role-based fictional equipment, shared by city dispatch and FPS combatants. */
export function forceWeaponFor(character, slot=0) {
  const choices = character === 'army_soldier'
    ? ['adaptiveCombatRifleAttack','ar15Attack','dragunovAttack']
    : character === 'renea_officer' || character === 'fnsh_officer'
      ? ['ar15Attack','vityazAttack','adaptiveCombatRifleAttack']
      : character === 'shqiponja_officer'
        ? ['vityazAttack','makarovAttack'] : ['makarovAttack'];
  return choices[Math.abs(Math.floor(Number.isFinite(slot)?slot:0))%choices.length];
}
