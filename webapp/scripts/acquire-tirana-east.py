"""Bounded, cached acquisition of public OSM map extracts and Mapzen terrain.
Run from repository root. Raw response receipts retain hashes; no imagery is shipped.
"""
import concurrent.futures as cf, datetime, gzip, hashlib, io, json, math, os, pathlib, urllib.request, xml.etree.ElementTree as ET
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'assets-source/tirana-east'; OUT.mkdir(exist_ok=True)
CACHE=pathlib.Path(os.environ.get('TIRANA_EAST_CACHE','/tmp/tirana-east-source')); CACHE.mkdir(exist_ok=True)
def get(url):
 p=CACHE/hashlib.sha256(url.encode()).hexdigest()
 if not p.exists():
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'TonPlaygram-TiranaSource/1.0 (map asset research)'}),timeout=50) as r: b=r.read()
  p.write_bytes(b)
 b=p.read_bytes()
 return b,dict(url=url,sha256=hashlib.sha256(b).hexdigest(),bytes=len(b),acquiredAt=datetime.datetime.fromtimestamp(p.stat().st_mtime,datetime.timezone.utc).isoformat())
def osm(box):
 url='https://api.openstreetmap.org/api/0.6/map?bbox='+','.join(f'{v:.3f}' for v in box)
 b,receipt=get(url); root=ET.fromstring(b)
 if root.tag!='osm': raise ValueError('Incomplete map response')
 elements=[]
 for o in root:
  if o.tag not in ['node','way','relation']: continue
  e=dict(type=o.tag,id=int(o.attrib['id']),tags={t.attrib['k']:t.attrib['v'] for t in o.findall('tag')})
  if o.tag=='node': e.update(lat=float(o.attrib['lat']),lon=float(o.attrib['lon']))
  if o.tag=='way': e['nodes']=[int(n.attrib['ref']) for n in o.findall('nd')]
  if o.tag=='relation': e['members']=[dict(type=m.attrib['type'],ref=int(m.attrib['ref']),role=m.attrib.get('role','')) for m in o.findall('member')]
  elements.append(e)
 print('OSM',box,len(elements),flush=True)
 return elements,receipt
# Include an overlap strip so source node identities connect to the urban graph.
boxes=[(19.860+i*.022,41.265+j*.020,19.860+(i+1)*.022,41.265+(j+1)*.020) for i in range(5) for j in range(7)]
if not (OUT/'source.osm.json.gz').exists():
 elements={};receipts=[]
 with cf.ThreadPoolExecutor(max_workers=2) as pool:
  for es,r in pool.map(osm,boxes):
   receipts.append(r)
   for e in es: elements[(e['type'],e['id'])]=e
 raw=json.dumps({'elements':list(elements.values())},separators=(',',':')).encode()
 (OUT/'source.osm.json.gz').write_bytes(gzip.compress(raw,mtime=0))
 (OUT/'osm-receipts.json').write_text(json.dumps({'bbox':[19.860,41.265,19.970,41.405],'license':'ODbL-1.0','attribution':'© OpenStreetMap contributors','receipts':receipts},indent=2)+'\n')
# Terrain rectangular grid in the existing metre frame, one metre quantisation.
origin=[41.3275,19.8188]; zoom=12
xmin,zmin,xmax,zmax=-16000,-26000,18500,19500; spacing=100
nx=round((xmax-xmin)/spacing)+1;nz=round((zmax-zmin)/spacing)+1
# Fine eastern travel region, plus a coarse Kruje/Krrabe skyline from same source.
grids=[dict(id='region',x=xmin,z=zmin,step=spacing,nx=nx,nz=nz),dict(id='east',x=0,z=-9500,step=30,nx=435,nz=568)]
def pixel(x,z):
 lat=origin[0]-z/111320;lon=origin[1]+x/(111320*math.cos(math.radians(origin[0])))
 return (lon+180)/360*(2**zoom)*256,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*(2**zoom)*256
keys=set()
for g in grids:
 for j in range(g['nz']):
  for i in range(g['nx']):
   px,py=pixel(g['x']+i*g['step'],g['z']+j*g['step']);keys.add((int(px)//256,int(py)//256))
def tile(k):
 x,y=k;b,r=get(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{x}/{y}.png')
 im=Image.open(io.BytesIO(b)).convert('RGB');assert im.size==(256,256)
 return k,im,r
if not (OUT/'terrain.json.gz').exists():
 tiles={};receipts=[]
 with cf.ThreadPoolExecutor(max_workers=4) as pool:
  for k,im,r in pool.map(tile,sorted(keys)): tiles[k]=im;receipts.append(r)
 for g in grids:
  g['heights']=[]
  for j in range(g['nz']):
   for i in range(g['nx']):
    px,py=pixel(g['x']+i*g['step'],g['z']+j*g['step']);ix,iy=int(px),int(py)
    r,green,b=tiles[(ix//256,iy//256)].getpixel((ix%256,iy%256));g['heights'].append(round(r*256+green+b/256-32768))
 terrain=dict(origin=origin,grids=grids,source='https://registry.opendata.aws/terrain-tiles/',format='Terrarium zoom 12; nearest source pixel resampled to 30 m / 100 m grid; integer metres; no survey precision',attribution='Mapzen; Europe terrain produced using Copernicus data and information funded by the European Union – EU-DEM layers; SRTM/GMTED2010 courtesy of USGS.')
 (OUT/'terrain.json.gz').write_bytes(gzip.compress(json.dumps(terrain,separators=(',',':')).encode(),mtime=0))
 (OUT/'terrain-receipts.json').write_text(json.dumps({'tiles':receipts,'source':terrain['source'],'attribution':terrain['attribution'],'licenseDocumentation':'https://github.com/tilezen/joerd/blob/master/docs/attribution.md'},indent=2)+'\n')
 print('TERRAIN',len(tiles),[(g['id'],g['nx'],g['nz'],min(g['heights']),max(g['heights'])) for g in grids],flush=True)
