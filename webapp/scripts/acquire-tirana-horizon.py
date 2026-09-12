"""Acquire forest/wood polygons for the Krujë and Krrabë horizon from public OSM.
No imagery extraction. Retain full source responses and receipts.
"""
import pathlib,urllib.request,hashlib,json,gzip,xml.etree.ElementTree as ET,datetime,concurrent.futures as cf
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'assets-source/tirana-east';cache=pathlib.Path('/tmp/tirana-east-source');cache.mkdir(exist_ok=True)
boxes=[(w+i*.04,s+j*.04,w+(i+1)*.04,s+(j+1)*.04) for w,s in [(19.77,41.48),(19.95,41.19)] for i in range(2) for j in range(2)]
def fetch(box):
 url='https://api.openstreetmap.org/api/0.6/map?bbox='+','.join(f'{n:.3f}' for n in box);p=cache/hashlib.sha256(url.encode()).hexdigest()
 if not p.exists():
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'TonPlaygram-TiranaSource/1.0'}),timeout=50) as r:p.write_bytes(r.read())
 data=p.read_bytes();root=ET.fromstring(data);assert root.tag=='osm';out=[]
 for e in root:
  if e.tag not in ['node','way','relation']:continue
  item={'type':e.tag,'id':int(e.attrib['id']),'tags':{t.attrib['k']:t.attrib['v'] for t in e.findall('tag')}}
  if e.tag=='node':item.update(lat=float(e.attrib['lat']),lon=float(e.attrib['lon']))
  if e.tag=='way':item['nodes']=[int(n.attrib['ref']) for n in e.findall('nd')]
  if e.tag=='relation':item['members']=[dict(type=m.attrib['type'],ref=int(m.attrib['ref']),role=m.attrib.get('role','')) for m in e.findall('member')]
  out.append(item)
 print(box,len(out),flush=True);return out,dict(url=url,sha256=hashlib.sha256(data).hexdigest(),acquiredAt=datetime.datetime.fromtimestamp(p.stat().st_mtime,datetime.timezone.utc).isoformat())
elements={};receipts=[]
with cf.ThreadPoolExecutor(max_workers=2) as pool:
 for es,r in pool.map(fetch,boxes):
  receipts.append(r)
  for e in es:elements[(e['type'],e['id'])]=e
(OUT/'horizon.osm.json.gz').write_bytes(gzip.compress(json.dumps(dict(elements=list(elements.values())),separators=(',',':')).encode(),mtime=0));(OUT/'horizon-receipts.json').write_text(json.dumps(receipts,indent=2)+'\n')
