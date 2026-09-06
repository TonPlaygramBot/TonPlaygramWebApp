"""Derive a small, redistributable ODbL game map from an OSM API snapshot."""
from pathlib import Path
import xml.etree.ElementTree as ET
import math, json, hashlib

import argparse
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('osm_xml',type=Path)
parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'src/games/tiranastreets/shared/world.mjs')
args=parser.parse_args()
OUT=args.output.parent
OUT.mkdir(parents=True,exist_ok=True)
src=args.osm_xml
root = ET.parse(src).getroot()
origin = [41.3275, 19.8188]
def xy(lat, lon):
    return [round((lon-origin[1])*111320*math.cos(math.radians(origin[0])),2),round((origin[0]-lat)*111320,2)]
bounds = [-805, -380, 660, 1150]
def inside(p, margin=0):
    return bounds[0]-margin < p[0] < bounds[2]+margin and bounds[1]-margin < p[1] < bounds[3]+margin
nodes = {n.get('id'): xy(float(n.get('lat')), float(n.get('lon'))) for n in root.findall('node')}
ways = []
for w in root.findall('way'):
    tags = {t.get('k'): t.get('v') for t in w.findall('tag')}
    refs = [n.get('ref') for n in w.findall('nd')]
    pts = [nodes[n] for n in refs if n in nodes]
    if len(pts)>1: ways.append((w.get('id'), tags, refs, pts))
roads=[];buildings=[];parks=[];water=[];areas=[];landmarks=[];graph_nodes=[];graph_edges=[];lookup={}
drivable={'primary','secondary','tertiary','residential','unclassified','living_street','service','primary_link','secondary_link','tertiary_link'}
foot={'footway','pedestrian','path','cycleway','steps'}
special={'174510408':'pyramid','175108083':'mosque','233519333':'clock'}
for wid,t,refs,pts in ways:
    center=[sum(p[i] for p in pts)/len(pts) for i in (0,1)]
    name=t.get('name:en', t.get('name',''))
    hw=t.get('highway')
    if hw in drivable | foot:
        if t.get('access')=='private' or t.get('tunnel')=='yes': continue
        walk=hw in foot
        try: width=float(t.get('width') or max(3,int(t.get('lanes','2'))*3.1))
        except ValueError: width=6.2
        width=round(max(2,min(15,width if not walk else 3)),1)
        for i in range(len(pts)-1):
            a,b=pts[i],pts[i+1]
            if not inside(a,35) or not inside(b,35) or math.dist(a,b)<.2:continue
            roads.append({'a':a,'b':b,'w':width,'walk':walk,'name':t.get('name',''),'bridge':t.get('bridge')=='yes'})
            if not walk and inside(a,8) and inside(b,8):
                edge=[]
                for ref,p in ((refs[i],a),(refs[i+1],b)):
                    if ref not in lookup:
                        lookup[ref]=len(graph_nodes);graph_nodes.append(p)
                    edge.append(lookup[ref])
                graph_edges.append(edge)
    if not inside(center): continue
    poly=pts[:-1] if pts[0]==pts[-1] else pts
    if 'building' in t and len(poly)>2 and t['building']!='no':
        try:h=float(t.get('height','').split(' ')[0])
        except ValueError:
            try:h=float(t.get('building:levels',''))*3.2
            except ValueError:h=9+(int(wid)%6)*3
        buildings.append({'id':wid,'p':poly,'h':round(max(3,min(85,h)),1),'name':name,'special':special.get(wid,'')})
    if t.get('leisure') in ('park','garden') and len(poly)>2:parks.append(poly)
    if t.get('natural')=='water' or t.get('waterway')=='riverbank': water.append(poly)
    if t.get('waterway') in ('river','stream','canal'):water.append({'line':pts,'width':12 if 'Lan' in t.get('name','') else 4})
    if t.get('area')=='yes' and hw=='pedestrian':areas.append(poly)
    if wid in special:
        landmarks.append({'id':special[wid],'name':name,'x':round(center[0],2),'z':round(center[1],2)})
    if wid=='248355618':landmarks.append({'id':'rinia','name':'Rinia Park','x':round(center[0],2),'z':round(center[1],2)})
    if wid=='1292145197':landmarks.append({'id':'mother','name':'Mother Teresa Square','x':round(center[0],2),'z':round(center[1],2)})
# Keep the largest connected road graph; mission points cannot fall on islands.
adj=[[] for _ in graph_nodes]
for a,b in graph_edges:adj[a].append(b);adj[b].append(a)
seen=set();components=[]
for n in range(len(adj)):
    if n in seen:continue
    group=[];stack=[n];seen.add(n)
    while stack:
        cur=stack.pop();group.append(cur)
        for v in adj[cur]:
            if v not in seen:seen.add(v);stack.append(v)
    components.append(group)
keep=set(max(components,key=len));remap={n:i for i,n in enumerate(sorted(keep))}
graph={'nodes':[graph_nodes[n] for n in sorted(keep)],'edges':[[remap[a],remap[b]] for a,b in graph_edges if a in keep and b in keep]}
landmarks += [{'id':'square','name':'Skanderbeg Square','x':0,'z':0},{'id':'blloku','name':'Blloku','x':-160,'z':830},{'id':'lana','name':'Lana River','x':75,'z':675}]
data={'origin':origin,'bounds':bounds,'roads':roads,'buildings':buildings,'parks':parks,'water':water,'areas':areas,'landmarks':landmarks,'graph':graph,'attribution':'© OpenStreetMap contributors · ODbL 1.0','source':'https://api.openstreetmap.org/api/0.6/map?bbox=19.809,41.317,19.827,41.331','sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest()}
args.output.write_text('// Geography © OpenStreetMap contributors, ODbL 1.0. See DATA-LICENSE.md.\nexport const WORLD = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
print(json.dumps({'roads':len(roads),'buildings':len(buildings),'graphNodes':len(graph['nodes']),'landmarks':landmarks,'bytes':args.output.stat().st_size},ensure_ascii=False))
