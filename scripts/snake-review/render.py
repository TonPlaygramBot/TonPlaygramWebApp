import sys,json
import numpy as np
from PIL import Image
from pathlib import Path
for name in sys.argv[1:]:
 data=json.loads(Path(name).read_text()); W,H=720,940
 rgb=np.zeros((H,W,3),dtype=np.float64);rgb[:]=[.13,.18,.17];depth=np.full((H,W),np.inf)
 m=np.array(data['camera']).reshape((4,4),order='F')
 light=np.array([.3,.8,-.5]);light/=np.linalg.norm(light)
 for mesh in data['meshes']:
  pts=np.array(mesh['points']);indices=np.array(mesh['indices']).reshape((-1,3));p=np.c_[pts,np.ones(len(pts))]@m.T
  screen=p[:,:3]/p[:,3,None];screen[:,0]=(screen[:,0]*.5+.5)*W;screen[:,1]=(.5-screen[:,1]*.5)*H
  color=np.array(mesh['color'])
  for ids in indices:
   a,b,c=screen[ids]
   if np.any(p[ids,3]<=0) or np.min([a[2],b[2],c[2]])>1:continue
   x0=max(0,int(np.floor(min(a[0],b[0],c[0]))));x1=min(W-1,int(np.ceil(max(a[0],b[0],c[0]))))
   y0=max(0,int(np.floor(min(a[1],b[1],c[1]))));y1=min(H-1,int(np.ceil(max(a[1],b[1],c[1]))))
   if x0>x1 or y0>y1:continue
   den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
   if abs(den)<1e-9:continue
   yy,xx=np.mgrid[y0:y1+1,x0:x1+1];xx=xx+.5;yy=yy+.5
   u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
   v=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;w=1-u-v
   z=u*a[2]+v*b[2]+w*c[2];view=depth[y0:y1+1,x0:x1+1];mask=(u>=0)&(v>=0)&(w>=0)&(z<view)
   if not np.any(mask):continue
   normal=np.cross(pts[ids[1]]-pts[ids[0]],pts[ids[2]]-pts[ids[0]]);n=np.linalg.norm(normal)
   shade=.48+.52*abs(np.dot(normal,light)/(n or 1))
   rgb[y0:y1+1,x0:x1+1][mask]=np.power(np.clip(color*shade,0,1),1/2.2)
   view[mask]=z[mask]
 out=Path(name).with_suffix('.png');Image.fromarray((rgb*255).astype('uint8')).resize((360,470),Image.Resampling.LANCZOS).save(out);print(out)
