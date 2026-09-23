"""Bake operator artwork contours once, outside the mobile game loop.
The same contours feed Three.js and the Blender export script. Pillow only.
"""
import json, math
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
BRANDS = 'intesa otp union abi tirana-bank fibank procredit uba eco-market sophie kfc burger-king tirana-international teg qtu rossmann-lala neranxi pizzahut marriott'.split()

def area(points):
    return sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1]))/2

def simplify(points, tolerance=.7):
    if len(points)<3:return points
    a,b=points[0],points[-1];dx,dy=b[0]-a[0],b[1]-a[1];den=dx*dx+dy*dy
    def dist(p):
        t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(den or 1)))
        return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
    i=max(range(1,len(points)-1),key=lambda i:dist(points[i]));d=dist(points[i])
    return simplify(points[:i+1],tolerance)[:-1]+simplify(points[i:],tolerance) if d>tolerance else [a,b]

def inside(p,ring):
    result=False
    for a,b in zip(ring,ring[1:]+ring[:1]):
        if (a[1]>p[1])!=(b[1]>p[1]) and p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]:result=not result
    return result

def outlines(image):
    image=image.copy();image.thumbnail((768,128));w,h=image.size
    pixels=image.load();bg=pixels[0,0]
    border=[pixels[x,y] for x in range(w) for y in [0,h-1]]+[pixels[x,y] for x in [0,w-1] for y in range(h)]
    # A few antialiased transparent corner pixels do not make an opaque white
    # panel a cutout (QTU). Require most of the border to be transparent.
    transparent=sum(p[3]<100 for p in border)>len(border)/2
    mask={(x,y) for y in range(h) for x in range(w) if pixels[x,y][3]>140 and
          (transparent or sum((pixels[x,y][i]-bg[i])**2 for i in range(3))>55**2)}
    edges={}
    def edge(a,b):edges.setdefault(a,[]).append(b)
    for x,y in sorted(mask):
        if (x,y-1) not in mask:edge((x,y),(x+1,y))
        if (x+1,y) not in mask:edge((x+1,y),(x+1,y+1))
        if (x,y+1) not in mask:edge((x+1,y+1),(x,y+1))
        if (x-1,y) not in mask:edge((x,y+1),(x,y))
    rings=[]
    while edges:
        start=next(iter(edges));p=start;ring=[]
        while True:
            ring.append(p);targets=edges.get(p)
            if not targets:break
            q=targets.pop()
            if not targets:del edges[p]
            p=q
            if p==start:break
        if len(ring)<4 or abs(area(ring))<3:continue
        closed=simplify(ring+[ring[0]])[:-1]
        if len(closed)<3:continue
        rings.append([[round((x/w-.5)*w/h,5),round(.5-y/h,5)] for x,y in closed])
    outer=[{'outer':r,'holes':[]} for r in rings if area(r)<0]
    for ring in rings:
        if area(ring)<=0:continue
        parents=[s for s in outer if inside(ring[0],s['outer'])]
        if parents:min(parents,key=lambda s:abs(area(s['outer'])))['holes'].append(ring)
    return {'ratio':round(w/h,6),'shapes':outer}

def main():
    result={}
    for brand in BRANDS:
        file=ROOT/f'webapp/public/assets/tirana-streets/signs/{brand}-logo.png'
        with Image.open(file) as image:result[brand]=outlines(image.convert('RGBA'))
    out=ROOT/'webapp/src/games/tirana-street-life/identityReliefs.json'
    out.write_text(json.dumps(result,separators=(',',':'))+'\n')
    print(f'{len(result)} brands; {out.stat().st_size} bytes of reusable relief contours')
if __name__=='__main__':main()
