"""Ten open Parliament missions on OSM roads. No API key or network at runtime.
Usage: python build-racing-missions.py OVERPASS_ROADS_JSON [OVERPASS_BUILDINGS_JSON]
Closed event: one-way rules ignored; private, pedestrian and motorway ways excluded.
"""
import json, math, heapq, pathlib, re, sys, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE=ROOT/'webapp/src/games/tiranastreets/shared'
w=json.loads(re.search(r'export const WORLD\s*=\s*(\{.*\});',(BASE/'world.mjs').read_text(),re.S)[1])
source=pathlib.Path(sys.argv[1]);osm=json.loads(source.read_text());roads=list(w['roads'])
def xy(lat,lon):return (round((lon-19.8188)*111320*math.cos(math.radians(41.3275)),2),round((41.3275-lat)*111320,2))
def central(p):return -840<p[0]<695 and -415<p[1]<1185
allowed={'primary','secondary','tertiary','residential','unclassified','living_street','service','primary_link','secondary_link','tertiary_link'}
keys={tuple(sorted((tuple(r['a']),tuple(r['b'])))) for r in roads};ext=[]
for e in osm['elements']:
 t=e.get('tags',{});hw=t.get('highway')
 if hw not in allowed or t.get('access') in ('private','no') or t.get('tunnel')=='yes':continue
 g=[xy(p['lat'],p['lon']) for p in e.get('geometry',[])]
 try:width=float(t.get('width',max(5,int(t.get('lanes','2'))*3.1)))
 except ValueError:width=6.2
 for a,b in zip(g,g[1:]):
  key=tuple(sorted((a,b)))
  if key in keys or math.dist(a,b)<.2:continue
  # Preserve the original central snapshot; use exact shared nodes at its boundary.
  if central(a) and central(b):continue
  r=dict(a=a,b=b,w=round(max(5,min(15,width)),1),walk=False,name=t.get('name',''),bridge=t.get('bridge')=='yes',osmWay=str(e['id']))
  ext.append(r);roads.append(r);keys.add(key)
graph={}
for r in roads:
 if r['walk'] or r['w']<5:continue
 a,b=tuple(r['a']),tuple(r['b']);cost=math.dist(a,b)
 graph.setdefault(a,{})[b]=(cost,r);graph.setdefault(b,{})[a]=(cost,r)
# Largest connected component prevents starts on isolated car parks.
seen=set();groups=[]
for p in graph:
 if p in seen:continue
 todo=[p];seen.add(p);group=[]
 while todo:
  n=todo.pop();group.append(n)
  for q in graph[n]:
   if q not in seen:seen.add(q);todo.append(q)
 groups.append(group)
keep=set(max(groups,key=len));print('Connected nodes',len(keep),'of',len(graph),flush=True)
def snap(p):return min(keep,key=lambda q:math.dist(p,q))
def path(a,b, forbidden=None):
 queue=[(0,a)];ds={a:0};prev={}
 while queue:
  d,n=heapq.heappop(queue)
  if n==b:break
  if d!=ds[n]:continue
  for q,(length,r) in graph[n].items():
   if forbidden and q in forbidden:continue
   cost=d+length*(1.1 if r['w']<6 else 1)
   if cost<ds.get(q,1e15):ds[q]=cost;prev[q]=n;heapq.heappush(queue,(cost,q))
 else:raise ValueError('Disconnected route')
 res=[b]
 while res[-1]!=a:res.append(prev[res[-1]])
 return res[::-1]
# Parliament Assembly building is OSM way 256162012. Finish at its Bush Street
# forecourt access, not at the administrative HQ on Deshmoret e Kombit.
approach=snap((527.69,220.38));finish=snap((413.59,49.13));final=path(approach,finish)
plans=[
 ('skanderbeg','Skënderbej Departure','SHESHI SKËNDERBEJ',(-230,-165),'#ed3f45'),
 ('blloku','Blloku Departure','BLLOKU',(-365,980),'#ffd26f'),
 ('lana','Lana Riverside','LANA · GJERGJ FISHTA',(-755,530),'#5de1d4'),
 ('pyramid','Pyramid Departure','PIRAMIDA',(125,700),'#bece54'),
 ('stadium','Nënë Tereza Departure','SHESHI NËNË TEREZA',(218,1085),'#7dcaff'),
 ('myslym','Myslym Shyri Departure','MYSLYM SHYRI',(-765,325),'#f1a879'),
 ('pazari','Pazari i Ri Departure','PAZARI I RI',xy(41.3310,19.8255),'#d6a3ff'),
 ('toptani','Toptani Departure','ABDI TOPTANI',(190,-245),'#f185a5'),
 ('farka','Farka Departure','FARKË · EAST TIRANA',xy(41.3140,19.8650),'#76d698'),
 ('surrel','Surrel Departure','SURREL · FARKA HILLS',xy(41.33225,19.9065),'#f5c46b')]
routes=[]
for identity,name,district,anchor,accent in plans:
 start=snap(anchor);walk=path(start,approach,set(final[1:]))+final[1:]
 # Remove access loops before the compulsory final approach only.
 before=walk[:-len(final)];reduced=[]
 for p in before:
  if p in reduced:reduced=reduced[:reduced.index(p)+1]
  else:reduced.append(p)
 walk=reduced+final
 length=sum(math.dist(a,b) for a,b in zip(walk,walk[1:]));assert length>400,(identity,length)
 assert math.dist(start,anchor)<200,(identity,'anchor too far',start,anchor)
 streets=list(dict.fromkeys(graph[a][b][1]['name'] for a,b in zip(walk,walk[1:]) if graph[a][b][1]['name']))
 routes.append(dict(id=identity,name=name,district=district,accent=accent,points=walk,streets=streets,open=True,startLocation=list(anchor),destination='Kuvendi · George W. Bush',approach=final))
 print(identity,round(length),'m,',len(walk),'nodes, start',start,flush=True)
# Keep regional scenery within 140m of the two outer missions to bound GPU work.
pathpoints=[p for r in routes for p in r['points']];cells={}
for p in pathpoints:cells.setdefault((int(p[0]//140),int(p[1]//140)),[]).append(p)
def near(p):
 c=(int(p[0]//140),int(p[1]//140))
 return any(math.dist(p,q)<160 for dx in (-1,0,1) for dz in (-1,0,1) for q in cells.get((c[0]+dx,c[1]+dz),[]))
ext=[r for r in ext if near(r['a']) or near(r['b'])]
existing={b['id'] for b in w['buildings']};buildings=[]
if len(sys.argv)>2:
 for e in json.loads(pathlib.Path(sys.argv[2]).read_text())['elements']:
  if str(e['id']) in existing:continue
  t=e.get('tags',{});p=[xy(n['lat'],n['lon']) for n in e.get('geometry',[])]
  if len(p)<4:continue
  p=p[:-1] if p[0]==p[-1] else p
  c=[sum(q[i] for q in p)/len(p) for i in (0,1)]
  if not near(c):continue
  try:h=float(t.get('height',float(t.get('building:levels',2))*3.2))
  except ValueError:h=6.4
  existing.add(str(e['id']))
  buildings.append(dict(id=str(e['id']),p=p,h=max(3,min(65,h)),name=t.get('name',''),special=''))
region=dict(roads=ext,buildings=buildings,bounds=[min(p[0] for p in pathpoints)-180,min(p[1] for p in pathpoints)-180,max(p[0] for p in pathpoints)+180,max(p[1] for p in pathpoints)+180],origin=w['origin'],attribution=w['attribution'],source='https://overpass-api.de/api/interpreter',sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),osmTimestamp=osm.get('osm3s',{}).get('timestamp_osm_base'),query='way[highway](41.31,19.81,41.35,19.915);out geom;')
header='// © OpenStreetMap contributors, ODbL 1.0. Generated by build-racing-missions.py.\n'
(ROOT/'webapp/src/games/kartroyale/tirana-routes.mjs').write_text(header+'export const TIRANA_ROUTES = '+json.dumps(routes,ensure_ascii=False,separators=(',',':'))+';\n')
(BASE/'racingRegion.mjs').write_text(header+'export const RACING_REGION = '+json.dumps(region,ensure_ascii=False,separators=(',',':'))+';\n')
(ROOT/'webapp/public/assets/kart-royale/tirana-routes.json').write_text(json.dumps(routes,ensure_ascii=False,separators=(',',':'))+'\n')
(ROOT/'webapp/public/assets/kart-royale/tirana-region.json').write_text(json.dumps(region,ensure_ascii=False,separators=(',',':'))+'\n')
print('Regional scenery',len(ext),'road segments,',len(buildings),'buildings')
