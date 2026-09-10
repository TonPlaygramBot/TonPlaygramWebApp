from PIL import Image,ImageFilter
import numpy as np, os
from pathlib import Path
os.chdir(Path(__file__).resolve().parent)

rng=np.random.default_rng(7326); n=256
for name in ['paint','rubber','fabric']:
    noise=rng.normal(0,1,(n,n)); yy,xx=np.mgrid[:n,:n]
    if name=='paint':
        h=noise*.2+np.sin(xx*.7)*.015; base=224+noise*5; rough=200+noise*6
    elif name=='rubber':
        h=noise*.14+np.sin(xx*.6)*.1; base=215+noise*7; rough=235+noise*4
    elif name=='fabric':
        h=(np.sin(xx*1.55)*np.cos(yy*1.55))*.8+noise*.08; base=205+h*24; rough=246+noise*3
    else:
        h=noise*.4; base=170+noise*12; rough=240+noise*6
    Image.fromarray(np.uint8(np.clip(base,0,255))).convert('RGB').save(f'{name}_color.png',optimize=True)
    dx=np.roll(h,-1,1)-np.roll(h,1,1); dy=np.roll(h,-1,0)-np.roll(h,1,0)
    normal=np.stack([-dx*.28,-dy*.28,np.ones_like(h)],axis=2); normal/=np.linalg.norm(normal,axis=2,keepdims=True)
    Image.fromarray(np.uint8((normal*.5+.5)*255)).save(f'{name}_normal.png',optimize=True)
    orm=np.zeros((n,n,3),dtype=np.uint8); orm[:,:,0]=255; orm[:,:,1]=np.uint8(np.clip(rough,0,255)); orm[:,:,2]=255
    Image.fromarray(orm).save(f'{name}_orm.png',optimize=True)
print('Created nine original CC0 PBR texture maps (256 px).')
