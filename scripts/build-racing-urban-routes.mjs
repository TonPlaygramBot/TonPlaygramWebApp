/** Offline closed-event authoring from the checked-in Tirana OSM street graph.
 * No road geometry, building footprint, or carriageway width is invented.
 * © OpenStreetMap contributors, ODbL 1.0. Source attribution remains in WORLD.
 * Faces are selected by stable coordinate fingerprints, not array positions.
 * A source snapshot change must be re-audited instead of silently rerouting.
 */
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {roadGraph,routeLength} from '../webapp/src/games/kartroyale/grandRouteCore.mjs';
import {buildingClearance} from '../webapp/src/games/kartroyale/raceCourse.mjs';
import {buildRaceCatalog} from '../webapp/src/games/kartroyale/raceCatalog.mjs';
import {MAIN_ROAD_ROUTES} from '../webapp/src/games/kartroyale/main-road-routes.mjs';
import {parallelRoadOverlap} from '../webapp/src/games/kartroyale/raceRouteAudit.mjs';
const key=p=>p.join(',');
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const fingerprint=points=>createHash('sha256').update(points.map(key).sort().join('|')).digest('hex').slice(0,16);
const DEFINITIONS = [
  {
  "id": "tirana-prokop-mima",
  "name": "Prokop Mima",
  "faces": [
    "a88fe29ab1ece16d"
  ]
},
  {
    "id": "tirana-myslym-shyri",
    "name": "Myslym Shyri",
    "faces": [
      "137717508db2e2d4"
    ]
  },
  {
    "id": "tirana-sulejman-delvina",
    "name": "Lana · Fishta–Bajram Curri",
    "faces": [
      "0393f2285180fbc3", "85769e2d3219a835"
    ]
  },
  {
    "id": "tirana-kavaja-center",
    "name": "Kavaja · Qendra",
    "faces": [
      "f38042ae8e6f764d"
    ]
  },
  {
    "id": "tirana-zogu-pare",
    "name": "Zogu i Parë",
    "faces": [
      "ccc3a4597e792a76"
    ]
  },
  {
    "id": "tirana-gurakuqi",
    "name": "Luigj Gurakuqi",
    "faces": [
      "baa35082ad2990df"
    ]
  },
  {
  "id": "tirana-riza-abazi",
  "name": "Riza Abazi",
  "faces": [
    "0741954ca870d3f2"
  ]
},
  {
  "id": "tirana-sadik-petrela",
  "name": "Sadik Petrela",
  "faces": [
    "dd72a9e5efa7d673"
  ]
},
  {
    "id": "tirana-marie-kraja",
    "name": "Marie Kraja",
    "faces": [
      "8afeebcea7a6fadb"
    ]
  },
  {
    "id": "tirana-nesheraku",
    "name": "Ura e Nesherakut",
    "faces": [
      "5b058cce2f5e378a"
    ]
  },
  {
    "id": "tirana-kavaja-gjollesha",
    "name": "Kavaja · Gjollesha",
    "faces": [
      "fa5a7117c1ba44ec"
    ]
  },
  {
    "id": "tirana-gjollesha-lana",
    "name": "Gjollesha · Lana",
    "faces": [
      "53e713c012dda16e"
    ]
  },
  {
    "id": "tirana-kastriot-feska",
    "name": "Kastriot Feska",
    "faces": [
      "68704ea1bee32493"
    ]
  },
  {
    "id": "tirana-brryli",
    "name": "Ura te Brryli",
    "faces": [
      "de32814a339022a5"
    ]
  },
  {
    "id": "tirana-andrea-kushi",
    "name": "Andrea Kushi",
    "faces": [
      "bda367444243dff1"
    ]
  },
  {
    "id": "tirana-shqiponja",
    "name": "Shqiponja · Dritan Hoxha",
    "faces": [
      "936f1717830b46d6"
    ]
  },
  {
    "id": "tirana-riglata",
    "name": "Riglata",
    "faces": [
      "3e32b934821d9a7e"
    ]
  },
  {
    "id": "tirana-pese-maji",
    "name": "5 Maji",
    "faces": [
      "91294233e333c337"
    ]
  },
  {
    "id": "tirana-vangjel-noti",
    "name": "Vangjel Noti",
    "faces": [
      "b32b06b539fbb7ab",
      "5d1f96b876be9d5f"
    ]
  },
  {
    "id": "tirana-don-bosko",
    "name": "Don Bosko",
    "faces": [
      "e955b79c40c72b23",
      "36af367573d10b1b"
    ]
  }
];
const roads=WORLD.roads.filter(r=>!r.walk&&r.w>=6.2&&!/Liqeni|Surrel|Fark/i.test(r.name||'')&&[r.a,r.b].every(p=>p[0]>-4000&&p[0]<3200&&p[1]>-3000&&p[1]<1800)).filter(r=>{
  const n=Math.max(1,Math.ceil(distance(r.a,r.b)/3));
  for(let i=0;i<=n;i++)if(buildingClearance(r.a[0]+(r.b[0]-r.a[0])*i/n,r.a[1]+(r.b[1]-r.a[1])*i/n)<4.2)return false;
  return true;
});
const graph=roadGraph(roads);
const adjacent=new Map([...graph.edges].map(([id,edges])=>{
  const p=graph.nodes.get(id);
  return [id,[...edges.keys()].sort((a,b)=>{
    const x=graph.nodes.get(a),y=graph.nodes.get(b);
    return Math.atan2(x[1]-p[1],x[0]-p[0])-Math.atan2(y[1]-p[1],y[0]-p[0]);
  })];
}));
// Directed half-edge face walk: each edge belongs to the face on its left.
const visited=new Set(),faces=new Map();
for(const [u,neighbors]of adjacent)for(const v of neighbors){
  if(visited.has(u+'>'+v))continue;
  let a=u,b=v;const ids=[],local=new Set();
  for(let count=0;count<20000;count++){
    const edge=a+'>'+b;if(local.has(edge))break;
    local.add(edge);visited.add(edge);ids.push(a);
    const next=adjacent.get(b);const c=next[(next.indexOf(a)+next.length-1)%next.length];
    a=b;b=c;if(a===u&&b===v)break;
  }
  if(a!==u||b!==v||ids.length<3||new Set(ids).size!==ids.length)continue;
  const points=ids.map(id=>graph.nodes.get(id));
  const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1]},0)/2;
  const length=routeLength(points);
  if(area>=5000&&length>=350&&length<=5500)faces.set(fingerprint(points),points);
}
function joinFaces(fingerprints){
  const edges=new Map();
  for(const id of fingerprints){
    const points=faces.get(id);if(!points)throw Error('Source face changed: '+id);
    for(let i=0;i<points.length;i++){
      const a=key(points[i]),b=key(points[(i+1)%points.length]);
      if(edges.has(b+'>'+a))edges.delete(b+'>'+a);else edges.set(a+'>'+b,[a,b]);
    }
  }
  const next=new Map();
  for(const [a,b]of edges.values()){if(next.has(a))throw Error('Non-simple union');next.set(a,b)}
  const start=next.keys().next().value,points=[],seen=new Set();let a=start;
  while(!seen.has(a)&&next.has(a)){seen.add(a);points.push(graph.nodes.get(a));a=next.get(a)}
  if(a!==start||points.length!==edges.size)throw Error('Disconnected union');
  return points;
}
const routes=[];
for(const definition of DEFINITIONS){
  const points=joinFaces(definition.faces),ids=points.map(key);
  const edges=ids.map((id,i)=>graph.edges.get(id).get(ids[(i+1)%ids.length]));
  const length=routeLength(points);
  const route={id:definition.id,name:definition.name,points,streets:[...new Set(edges.map(e=>e.name).filter(Boolean))].sort(),length,originalLength:length,routeClass:'main-roads',routeStats:{minimumSourceWidth:Math.min(...edges.map(e=>e.width)),broadRoadShare:Number((edges.reduce((s,e)=>s+(e.width>=9?e.cost:0),0)/length).toFixed(4)),averageSourceWidth:Number((edges.reduce((s,e)=>s+e.width*e.cost,0)/length).toFixed(2))}};
  const catalog=buildRaceCatalog({TRACKS:[route],CUPS:[],normalizeTrack:id=>id},[],[route]);
  const track=catalog.makeTrack(route.id);
  const overlap=parallelRoadOverlap(points,edges.map(e=>e.width));
  if(track.passingAudit.minimumWidth<4.8||track.passingAudit.unresolved.length||track.startGrid.turn>=.15||overlap>=.1)throw Error('Unsafe course '+route.id);
  routes.push(route);
  console.log(route.id,Math.round(length)+'m','grid '+track.startGrid.minimumWidth.toFixed(2)+'m','min '+track.passingAudit.minimumWidth.toFixed(2)+'m');
}
// Reject rotations, reversals, and minor shortcuts of either new or shipped events.
// Weighted edge overlap ignores source densification and route start positions.
const compared=[...routes,...MAIN_ROAD_ROUTES];
const edgeMaps=compared.map(route=>new Map(route.points.map((p,i)=>{
  const q=route.points[(i+1)%route.points.length];
  return [[key(p),key(q)].sort().join('|'),distance(p,q)];
})));
for(let i=0;i<routes.length;i++)for(let j=i+1;j<compared.length;j++){
  const a=edgeMaps[i],b=edgeMaps[j];
  const shared=[...a].reduce((sum,[edge,length])=>sum+(b.has(edge)?length:0),0);
  const total=map=>[...map.values()].reduce((sum,length)=>sum+length,0);
  if(shared/Math.min(total(a),total(b))>.7)throw Error('Routes share too much road: '+compared[i].id+' / '+compared[j].id);
}
await writeFile(new URL('../webapp/src/games/kartroyale/urban-race-routes.mjs',import.meta.url),
  '// Generated by scripts/build-racing-urban-routes.mjs. Do not edit coordinates by hand.\n'+
  '// Exact closed OSM source edges, © OpenStreetMap contributors, ODbL 1.0.\n'+
  '// Technical urban circuits: narrower than boulevard events; source roads stay unchanged.\n'+
  'export const URBAN_RACE_ROUTES = '+JSON.stringify(routes)+';\n');
