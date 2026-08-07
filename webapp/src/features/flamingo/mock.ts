import type { Document, Group, LiveUpdate, MapLocation, Protest, Task } from './types';

export const protests: Protest[] = [
  { id:'tirana', title:'Tubim qytetar në Tiranë', city:'Tiranë', place:'Sheshi Skënderbej', date:'Sot, 7 Gusht', time:'18:00', organizer:'Këshilli Qytetar', participants:2400, status:'LIVE', description:'Një tubim paqësor për transparencë, përgjegjshmëri dhe institucione që dëgjojnë qytetarët.' },
  { id:'durres', title:'Marshim për bregdetin', city:'Durrës', place:'Sheshi Liria', date:'10 Gusht', time:'19:00', organizer:'Qytetarët e Durrësit', participants:680, status:'E ARDHSHME', description:'Marshim paqësor për mbrojtjen e hapësirave publike.' },
  { id:'shkoder', title:'Tubim për komunitetin', city:'Shkodër', place:'Sheshi Demokracia', date:'14 Gusht', time:'18:30', organizer:'Forumi Shkodër', participants:430, status:'E ARDHSHME', description:'Takim qytetar dhe diskutim i hapur.' },
  { id:'vlore', title:'Zëri i qytetit', city:'Vlorë', place:'Sheshi i Flamurit', date:'2 Gusht', time:'19:00', organizer:'Nisma Vlorë', participants:950, status:'PËRFUNDUAR', description:'Tubim qytetar i përfunduar në mënyrë paqësore.' }
];
export const updates: LiveUpdate[] = [
  { id:'1', time:'19:42', author:'Këshilli Qytetar', type:'ZYRTARE', text:'Organizatorët njoftojnë se fjalimet fillojnë pas 20 minutash.' },
  { id:'2', time:'19:20', author:'Ekipi i sigurisë', type:'URGJENTE', text:'Pika e ndihmës së parë është zhvendosur pranë hyrjes veriore.' },
  { id:'3', time:'18:55', author:'Koordinimi', type:'INFO', text:'Zona kryesore është hapur për pjesëmarrësit.' },
  { id:'4', time:'18:30', author:'Transporti', type:'INFO', text:'Linja urbane 2 ka shtuar dy nisje pas përfundimit të tubimit.' }
];
export const groups: Group[] = [
  { id:'volunteers', name:'Vullnetarët', description:'Orientim dhe mbështetje për pjesëmarrësit.', admin:'Elira Hoxha', members:86, tasks:4 },
  { id:'media', name:'Media & Dokumentimi', description:'Dokumentim publik, fotografi dhe komunikim.', admin:'Arben Duka', members:32, tasks:2 },
  { id:'first-aid', name:'Ndihma e parë', description:'Mbështetje bazë mjekësore në pikat publike.', admin:'Dr. Era Leka', members:24, tasks:3 },
  { id:'legal', name:'Ligjore', description:'Informacion ligjor dhe vëzhgim.', admin:'Ina Kola', members:18, tasks:1 },
  { id:'logistics', name:'Logjistika', description:'Materiale, ujë dhe koordinim pikash.', admin:'Bledi Meta', members:47, tasks:5 }
];
export const tasks: Task[] = [
  { id:'t1', title:'Kërkohen 5 vullnetarë te pika e informacionit', description:'Ndihmë me orientimin nga ora 17:30.', group:'Vullnetarët', priority:'Lartë', people:5, deadline:'Sot • 17:30', status:'HAPUR' },
  { id:'t2', title:'Duhet një fotograf për zonën kryesore', description:'Dokumentim i programit dhe fjalimeve.', group:'Media', priority:'Mesëm', people:1, deadline:'Sot • 19:45', status:'HAPUR' },
  { id:'t3', title:'Transportoni materialet në pikën B', description:'Dy kuti me materiale informuese.', group:'Logjistika', priority:'Normal', people:3, deadline:'Sot • 17:00', status:'NË PROCES' }
];
export const locations: MapLocation[] = [
  { id:'m1', name:'Pika kryesore e takimit', type:'Takim', description:'Hyrja jugore e sheshit.', status:'E hapur', hours:'17:00–22:00', x:48, y:44 },
  { id:'m2', name:'Ndihma e parë', type:'Ndihmë', description:'Staf i trajnuar dhe pajisje bazë.', status:'E hapur', hours:'17:30–22:30', x:27, y:28 },
  { id:'m3', name:'Pika e informacionit', type:'Informacion', description:'Programi dhe orientimi.', status:'E hapur', hours:'16:30–22:00', x:70, y:30 },
  { id:'m4', name:'Stacioni urban', type:'Transport', description:'Linjat 1, 2 dhe 8.', status:'Normal', hours:'Deri 23:30', x:67, y:68 }
];
export const documents: Document[] = [
  { id:'d1', title:'Kërkesat kryesore të tubimit', category:'Kërkesat', date:'7 Gusht 2026', author:'Këshilli Qytetar' },
  { id:'d2', title:'Udhëzuesi i pjesëmarrjes paqësore', category:'Udhëzime', date:'6 Gusht 2026', author:'Ekipi ligjor' },
  { id:'d3', title:'Deklarata për mediat', category:'Materiale për media', date:'7 Gusht 2026', author:'Zyra e komunikimit' }
];
