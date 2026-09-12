#!/usr/bin/env python3
"""Acquire the urban Tirana envelope from OSM, with reproducible receipts.

No footprints, heights or monuments are invented. API tiles include full ways;
relevant multipolygon relations are completed before the strict importer runs.
"""
import concurrent.futures, datetime, gzip, hashlib, json, pathlib, sys
import urllib.request, xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets-source/tirana-urban'
CACHE = OUT / 'tiles'
CACHE.mkdir(parents=True, exist_ok=True)
# Continuous urban envelope, including Kombinat, Astir, Laprake, Paskuqan edge,
# Kinostudio, Ali Demi, the lake and Sauk. Not the entire rural municipality.
WEST, SOUTH, EAST, NORTH = 19.752, 41.285, 19.878, 41.375
tiles = [(x, y, [round(WEST+x*.018,6), round(SOUTH+y*.018,6),
                  round(WEST+(x+1)*.018,6), round(SOUTH+(y+1)*.018,6)])
         for y in range(5) for x in range(7)]

def acquire(name, url, bbox=None):
    path = CACHE / f'{name}.osm'
    receipt = CACHE / f'{name}.json'
    if not path.exists() or not receipt.exists():
        request = urllib.request.Request(url, headers={'User-Agent':'TonPlaygram-Tirana-source-import/1.0'})
        with urllib.request.urlopen(request, timeout=90) as response:
            data = response.read()
        ET.fromstring(data)  # never cache an error page
        path.write_bytes(data)
        receipt.write_text(json.dumps({'url':url,'bbox':bbox,
            'acquiredAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'sha256':hashlib.sha256(data).hexdigest()}))
    return path, json.loads(receipt.read_text())

def tile(t):
    x,y,bbox=t
    value=acquire(f'{x}-{y}', 'https://api.openstreetmap.org/api/0.6/map?bbox='+','.join(map(str,bbox)),bbox)
    print(f'Tile {x},{y}: {value[0].stat().st_size} bytes',flush=True)
    return value

elements, receipts = {}, []
def merge(path):
    for e in ET.parse(path).getroot():
        if e.tag not in ('node','way','relation'): continue
        item={'type':e.tag,'id':int(e.attrib['id']),'version':int(e.attrib.get('version',1)),
              'tags':{t.attrib['k']:t.attrib['v'] for t in e.findall('tag')}}
        if e.tag=='node': item.update(lat=float(e.attrib['lat']),lon=float(e.attrib['lon']))
        if e.tag=='way': item['nodes']=[int(n.attrib['ref']) for n in e.findall('nd')]
        if e.tag=='relation': item['members']=[{'type':m.attrib['type'],'ref':int(m.attrib['ref']),'role':m.attrib.get('role','')} for m in e.findall('member')]
        key=f"{e.tag}/{item['id']}"
        if key not in elements or item['version']>elements[key]['version']: elements[key]=item

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for path,receipt in pool.map(tile,tiles): merge(path); receipts.append(receipt)
for e in list(elements.values()):
    t=e['tags']
    if e['type']!='relation' or t.get('type')!='multipolygon': continue
    if not (t.get('building') or t.get('building:part') or t.get('natural')=='water' or t.get('landuse')=='reservoir'): continue
    if any(f"{m['type']}/{m['ref']}" not in elements for m in e['members'] if m['type']=='way'):
        path,receipt=acquire(f"relation-{e['id']}",f"https://api.openstreetmap.org/api/0.6/relation/{e['id']}/full")
        merge(path); receipts.append(receipt)
raw={'version':0.6,'elements':sorted(elements.values(),key=lambda e:(e['type'],e['id'])),
     'receipts':receipts,'selection':{'bbox':[WEST,SOUTH,EAST,NORTH],'kind':'urban envelope, not municipal boundary'}}
OUT.mkdir(parents=True,exist_ok=True)
data=gzip.compress(json.dumps(raw,separators=(',',':')).encode(),mtime=0)
parts=[]
for i,offset in enumerate(range(0,len(data),1024*1024)):
    name=f'source.osm.json.gz.{i:03d}'
    chunk=data[offset:offset+1024*1024]
    (OUT/name).write_bytes(chunk)
    parts.append({'file':name,'bytes':len(chunk),'sha256':hashlib.sha256(chunk).hexdigest()})
(OUT/'source.osm.json.gz.parts.json').write_text(json.dumps({'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'parts':parts},indent=2)+'\n')
(OUT/'source.osm.json.gz').unlink(missing_ok=True)
for old in OUT.glob('source.osm.json.gz.[0-9][0-9][0-9]'):
    if old.name not in {p['file'] for p in parts}: old.unlink()
print(json.dumps({'elements':len(elements),'receipts':len(receipts),'parts':len(parts)}))
