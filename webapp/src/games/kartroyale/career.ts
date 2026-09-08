import { CUPS } from './simulation.mjs';
export interface Career {version:1;cups:number[];best:Record<string,number>;credits:number;races:number;wins:number;}
const key='tonplaygram.kartroyale.career.v1';
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,v):0;
export function loadCareer():Career {
  try{const d=JSON.parse(localStorage.getItem(key)||'{}');if(d.version===1)return {version:1,cups:CUPS.map((_,i)=>Math.min(3,finite(Number(d.cups?.[i])))),best:Object.fromEntries(Object.entries(d.best||{}).filter((e):e is [string,number]=>typeof e[1]==='number'&&Number.isFinite(e[1])&&e[1]>0)),credits:finite(Number(d.credits)),races:finite(Number(d.races)),wins:finite(Number(d.wins))};}catch{}
  return {version:1,cups:CUPS.map(()=>0),best:{},credits:0,races:0,wins:0};
}
export function recordRace(c:Career,track:string,place:number,time:number,cup:number|null){
  const next={...c,cups:CUPS.map((_,i)=>finite(c.cups[i])),best:{...c.best},races:c.races+1,wins:c.wins+Number(place===1)};
  if(Number.isFinite(time)&&time>0)next.best[track]=Math.min(next.best[track]||Infinity,time);
  let reward=0;
  if(cup!==null&&Number.isInteger(cup)&&CUPS[cup]&&CUPS[cup].track===track&&Number.isInteger(place)&&place>=1&&place<=CUPS[cup].target&&Number.isFinite(time)&&time>0){if(!next.cups[cup])reward=CUPS[cup].reward;next.cups[cup]=Math.max(next.cups[cup],Math.max(1,4-place));next.credits+=reward;}
  let saved=true;try{localStorage.setItem(key,JSON.stringify(next));}catch{saved=false;}return {career:next,reward,saved};
}
export const formatTime=(s:number)=>`${Math.floor(s/60)}:${(s%60).toFixed(2).padStart(5,'0')}`;
