"""Render the real skinned meshes without a browser; requires Node, g++, Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, subprocess, sys, os
p=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/domino-hand-poses')
source=Path(__file__).resolve().parent
p.mkdir(parents=True,exist_ok=True)
renderer=p/'domino-pose-rasterizer'
subprocess.run(['g++','-O2',str(source/'domino-pose-rasterizer.cpp'),'-o',str(renderer)],check=True)
subprocess.run([os.environ.get('CODEX_PRIMARY_RUNTIME_NODE','node'),str(source/'render-domino-hand-poses.mjs'),str(p)],check=True)
m=json.loads((p/'manifest.json').read_text())
for item in m:
    name=item['name']; ppm=p/(name+'.ppm')
    subprocess.run([str(renderer),str(p/(name+'.bin')),str(ppm),str(item['width']),str(item['height'])],check=True)
    Image.open(ppm).save(p/(name+'.png')); ppm.unlink()
try:
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
except OSError:
    font=ImageFont.load_default()
for seat in [0,1,2,3]:
    items=[i for i in m if i['name'].startswith('seat-'+str(seat))]
    for detail in [False,True]:
        rows=[i for i in items if i['name'].endswith('-hand')==detail]
        if not rows: continue
        sheet=Image.new('RGB',(1500,450*((len(rows)+2)//3)),'#172522'); draw=ImageDraw.Draw(sheet)
        for index,item in enumerate(rows):
            im=Image.open(p/(item['name']+'.png')); im.thumbnail((480,410)); x=(index%3)*500; y=(index//3)*450
            sheet.paste(im,(x+(500-im.width)//2,y+35)); draw.text((x+10,y+8),item['name'],fill='white',font=font)
        sheet.save(p/('seat-'+str(seat)+('-hands' if detail else '-poses')+'-sheet.png'))
print('Rendered',len(m),'actual skinned mesh poses.')
