export type Point=[number,number];
export interface Layout {bounds:[number,number,number,number];blocks:[number,number,number,number][];patrols:[number,number,number,number][]}
export interface Mission{ id:string; name:string; info:string; symbol:string; sky:[number,number,number]; sun:number; sunDirection:[number,number,number]; haze:number; ground:number; weather:'rain'|'snow'|'clear' }
export const missions:Mission[]=[
 {id:'harbor',name:'Porti i vjetër',info:'Kalata e anijeve',symbol:'ship',sky:[0x233b4a,0x9daea9,0xdcc4a4],sun:0xffdfb1,sunDirection:[-31,36,-42],haze:0xa8b1ab,ground:0x656157,weather:'rain'},
 {id:'airfield',name:'Aerodromi',info:'Pista e vjetër',symbol:'plane',sky:[0x385c7d,0xb3c4cb,0xe3d3b9],sun:0xffe5bd,sunDirection:[-32,42,-25],haze:0xb7c1ba,ground:0x766d56,weather:'clear'},
 {id:'valley',name:'Lugina e artë',info:'Rruga e fshatit',symbol:'hill',sky:[0x42667d,0xcec7ac,0xf2ca91],sun:0xffce8c,sunDirection:[-32,31,-49],haze:0xc8b899,ground:0x88745c,weather:'clear'},
 {id:'alpine',name:'Treni alpin',info:'Stacioni malor',symbol:'train',sky:[0x315a79,0xbcd0df,0xe7ddd0],sun:0xffe6d0,sunDirection:[-48,59,-18],haze:0xb3c6d0,ground:0xa2aeb7,weather:'snow'}
];
export const pad=(n:number)=>String(n).padStart(2,'0');
export function saved<T>(key:string,def:T):T{try{return JSON.parse(localStorage.getItem('optika3d-'+key)||'null')??def}catch{return def}}
export function save(key:string,val:unknown){try{localStorage.setItem('optika3d-'+key,JSON.stringify(val))}catch{}}
