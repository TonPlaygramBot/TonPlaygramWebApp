/** Fictional police operations. Merit belongs to the local career, never a wallet.
 * Every stage needs a simulation observation and an explicit player interaction. */
export const POLICE_SAVE_KEY = 'tirana-streets:police-career:v1';
export const POLICE_UNITS = Object.freeze([
  {id:'shqiponja',name:'SHQIPONJA',description:'Patrullim i shpejtë, ndalim dhe shoqërim.',character:'shqiponja_officer',vehicle:'shqiponja_compact',weapon:'glockSidearmAttack',armor:35},
  {id:'fnsh',name:'FNSH',description:'Siguri publike, protesta paqësore dhe evakuim.',character:'fnsh_officer',vehicle:'fnsh_armored_van',weapon:'glockSidearmAttack',armor:65},
  {id:'renea',name:'RENEA',description:'Shpëtim pengjesh dhe mbrojtje e dëshmitarëve.',character:'renea_officer',vehicle:'renea_armored_van',weapon:'krsvBurstAttack',armor:85}
]);
const stage=(kind,anchor,title,actor=null,seconds=3)=>({kind,anchor,title,actor,seconds});
const report=()=>stage('report','station','Dorëzo raportin në drejtori');
const arrest=(anchor)=>[
  stage('warn',anchor,'Jep urdhrin: ndalo!', 'suspect',2),
  stage('arrest',anchor,'Prangos të dyshuarin', 'suspect',3)
];
const mission=(id,unit,title,description,site,steps,reward,requires=null)=>({id,unit,title,description,site,steps,reward,requires,time:900});
export const POLICE_MISSIONS=Object.freeze([
  mission('shqiponja-lana','shqiponja','Patrulla e Lanës','Dëgjo dëshmitarin, ndiq të dyshuarin dhe bëj ndalimin pa dëmtime.','tabake',[
    stage('talk','tabake','Merr deklaratën e dëshmitarit','witness'),...arrest('tabake'),report()],120),
  mission('shqiponja-school','shqiponja','Rruga e sigurt','Ndihmo një këmbësor pranë Petro Nini Luarasit dhe shoqëroje në pikën e sigurt.','petro',[
    stage('talk','petro','Kontakto koordinatorin e rrugës','witness'),stage('rescue','petro','Ndihmo këmbësorin','protected'),
    stage('escort','safePetro','Shoqëro këmbësorin në trotuarin e sigurt','protected',2),report()],160,'shqiponja-lana'),
  mission('shqiponja-vip','shqiponja','Eskorta e qytetit','Drejto mjetin e caktuar. Merr pasagjerin dhe çoje të sigurt në destinacion.','rinia',[
    stage('talk','rinia','Kontrollo identitetin e pasagjerit','protected'),stage('board','rinia','Merr pasagjerin në mjetin e njësisë','protected'),
    stage('drive','pyramid','Pika e parë e eskortës',null,2),stage('drive','mother','Mbërrit në zonën e sigurt',null,2),report()],210,'shqiponja-school'),
  mission('fnsh-protest','fnsh','E drejta për t’u dëgjuar','Mbro protestën paqësore: fol me organizatorin, ndihmo mjekun dhe mbaj korridorin të lirë.','square',[
    stage('talk','square','Bisedo me organizatorin','witness'),stage('rescue','square','Ndihmo pjesëmarrësin e lënduar','protected'),
    stage('escort','safeSquare','Shoqëro të lënduarin te mjeku','protected',2),stage('hold','safeSquare','Mbaj korridorin e ndihmës të hapur',null,25),report()],150),
  mission('fnsh-evacuation','fnsh','Evakuim në Ali Demi','Kontrollo zonën, ndihmo banorët dhe shoqëro grupin larg incidentit.','ali',[
    stage('talk','ali','Merr informacion nga koordinatori','witness'),stage('rescue','ali','Bashko banorët për evakuim','protected'),
    stage('escort','safeAli','Shoqëro banorët në pikën e ndihmës','protected',3),stage('hold','safeAli','Prit ekipin mjekësor',null,18),report()],190,'fnsh-protest'),
  mission('fnsh-convoy','fnsh','Transport humanitar','Merr mjekun në furgonin e njësisë dhe siguro transportin e qetë drejt Ali Demit.','rinia',[
    stage('talk','rinia','Konfirmo transportin me mjekun','protected'),stage('board','rinia','Hip mjekun në furgon','protected'),
    stage('drive','petro','Kalimi në Petro Nini Luarasi',null,2),stage('drive','ali','Dorëzo ekipin mjekësor',null,3),report()],230,'fnsh-evacuation'),
  mission('renea-rescue','renea','Kthim i sigurt','Operacion imagjinar shpëtimi: negocio dorëzimin, ndalo të dyshuarin dhe nxirr pengun.','ali',[
    stage('talk','ali','Fol me negociatorin','witness'),...arrest('ali'),stage('rescue','ali','Liro pengun','protected'),
    stage('escort','safeAli','Shoqëro pengun në siguri','protected',3),report()],190),
  mission('renea-evidence','renea','Dëshmia e mbrojtur','Siguro dorëzimin e të dyshuarit dhe merr deklaratën e dëshmitarit.','petro',[
    ...arrest('petro'),stage('talk','petro','Merr deklaratën','witness'),stage('rescue','petro','Përgatit dëshmitarin për largim','protected'),
    stage('escort','safePetro','Shoqëro dëshmitarin jashtë zonës','protected',2),report()],230,'renea-rescue'),
  mission('renea-protection','renea','Mbrojtje e afërt','Kontrollo takimin dhe shoqëro personin e mbrojtur me mjetin e blinduar.','mother',[
    stage('talk','mother','Kontrollo ekipin e takimit','witness'),stage('talk','mother','Kontakto personin e mbrojtur','protected'),
    stage('board','mother','Siguro pasagjerin në mjet','protected'),stage('drive','pyramid','Pika e kontrollit',null,2),
    stage('drive','rinia','Mbërrit në takimin e sigurt',null,3),report()],280,'renea-evidence')
]);
const byId=new Map(POLICE_MISSIONS.map(m=>[m.id,m]));
const bounded=(v,f,max)=>Number.isFinite(v)?Math.max(0,Math.min(max,v)):f;
export function freshPoliceProfile(){return {version:1,unit:'shqiponja',completed:[],merit:0,best:{},active:null,lastResult:null};}
export function normalizePoliceProfile(raw){
  const p=freshPoliceProfile();if(raw?.version!==1)return p;
  if(POLICE_UNITS.some(u=>u.id===raw.unit))p.unit=raw.unit;
  for(const m of POLICE_MISSIONS)if(Array.isArray(raw.completed)&&raw.completed.includes(m.id)&&(!m.requires||p.completed.includes(m.requires))){
    p.completed.push(m.id);if(Number.isFinite(raw.best?.[m.id]))p.best[m.id]=bounded(raw.best[m.id],0,3600);
  }
  // Derive merit from unique verified completions, preventing repeated rewards.
  p.merit=p.completed.reduce((sum,id)=>sum+byId.get(id).reward,0);
  const a=raw.active,m=byId.get(a?.id);
  if(m&&m.unit===p.unit&&policeMissionAvailable(p,m.id))p.active={id:m.id,stage:Math.floor(bounded(a.stage,0,m.steps.length-1)),elapsed:bounded(a.elapsed,0,m.time),hold:0,
    status:'active',failure:'',channel:false,arrested:a.arrested===true,rescued:a.rescued===true,boarded:a.boarded===true,
    snapshot:a.snapshot&&typeof a.snapshot==='object'?a.snapshot:null};
  if(raw.lastResult&&byId.has(raw.lastResult.id))p.lastResult={id:raw.lastResult.id,success:raw.lastResult.success===true,detail:String(raw.lastResult.detail||'').slice(0,180)};
  return p;
}
export function policeMissionAvailable(p,id){const m=byId.get(id);return !!m&&m.unit===p.unit&&(!m.requires||p.completed.includes(m.requires));}
export function beginPoliceMission(p,id){
  const profile=normalizePoliceProfile(p),m=byId.get(id);
  if(profile.active||!policeMissionAvailable(profile,id))return null;
  profile.active={id:m.id,stage:0,elapsed:0,hold:0,status:'active',failure:'',channel:false,arrested:false,rescued:false,boarded:false,snapshot:null};
  profile.lastResult=null;return profile;
}
export function policeStage(run){return byId.get(run?.id)?.steps[run.stage]||null;}
export function failPoliceMission(run,reason){if(run?.status==='active'){run.status='failed';run.failure=reason;run.channel=false;run.hold=0;}}
/** Start a timed, interruptible action. Being near a marker never pays a reward. */
export function interactPoliceMission(run,frame){
  if(!run||run.status!=='active'||!frame.eligible)return false;
  run.channel=true;return true;
}
export function stepPoliceMission(run,frame,seconds){
  if(!run||run.status!=='active'||frame.paused||!Number.isFinite(seconds)||seconds<=0)return false;
  const dt=Math.min(seconds,.1),m=byId.get(run.id),s=policeStage(run);run.elapsed+=dt;
  if(frame.health<=0||frame.arrested)failPoliceMission(run,'Operacioni u ndërpre. Kthehu në bazë dhe provo përsëri.');
  else if(frame.civilianHarmed)failPoliceMission(run,'Një civil ose person i dorëzuar u dëmtua nga ti. Operacioni dështoi.');
  else if(frame.protectedLost)failPoliceMission(run,'Personi që duhej mbrojtur nuk është më i sigurt.');
  else if(frame.vehicleDestroyed)failPoliceMission(run,'Mjeti i caktuar u shkatërrua.');
  else if(run.elapsed>=m.time)failPoliceMission(run,'Koha e operacionit mbaroi.');
  if(run.status!=='active')return true;
  if(!run.channel)return false;
  if(!frame.eligible||frame.hurt||frame.firing){run.hold=0;run.channel=false;return false;}
  run.hold=Math.min(s.seconds,run.hold+dt);
  if(run.hold<s.seconds-1e-7)return false;
  if(s.kind==='arrest')run.arrested=true;
  if(s.kind==='rescue')run.rescued=true;
  if(s.kind==='board')run.boarded=true;
  run.stage++;run.channel=false;run.hold=0;
  if(run.stage>=m.steps.length)run.status='completed';
  return true;
}
export function settlePoliceMission(profile){
  const run=profile.active;if(!run||!['completed','failed'].includes(run.status))return null;
  const m=byId.get(run.id),success=run.status==='completed'&&run.stage===m.steps.length;
  const p={...profile,completed:[...profile.completed],best:{...profile.best},active:null};
  if(success){if(!p.completed.includes(m.id))p.completed.push(m.id);p.best[m.id]=Math.min(p.best[m.id]??Infinity,run.elapsed);}
  p.lastResult={id:m.id,success,detail:success?'Operacioni u përfundua. Merita u ruajt.':run.failure||'Operacioni u ndërpre.'};
  return normalizePoliceProfile(p);
}
