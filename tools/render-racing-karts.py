"""Offline GLB inspection, not browser/phone QA. Requires trimesh, pyrender, Pillow.
PYOPENGL_PLATFORM=egl python tools/render-racing-karts.py OUTPUT.png
"""
import os, sys, pathlib
os.environ.setdefault('PYOPENGL_PLATFORM', 'egl')
import numpy as np
# pyrender 0.1.x still uses the NumPy 1.x spelling.
if not hasattr(np,'infty'): np.infty=np.inf
import trimesh, pyrender
from PIL import Image, ImageDraw

root=pathlib.Path(__file__).resolve().parents[1]
ids=['apex','oobi','oodi','ooli','oopi','photon','vortex','aegis']
def pose(eye,target):
    z=np.array(eye,dtype=float)-target;z/=np.linalg.norm(z)
    x=np.cross([0,1,0],z);x/=np.linalg.norm(x);y=np.cross(z,x)
    result=np.eye(4);result[:3,:3]=np.array([x,y,z]).T;result[:3,3]=eye
    return result

renderer=pyrender.OffscreenRenderer(520,420)
sheet=Image.new('RGB',(520*4,450*2),'#17212b');draw=ImageDraw.Draw(sheet)
for index,id in enumerate(ids):
    asset=trimesh.load(root/f'webapp/public/assets/kart-royale/karts/{id}.glb',force='scene')
    scene=pyrender.Scene.from_trimesh_scene(asset,bg_color=[.07,.10,.14,1],ambient_light=[.38,.38,.38])
    floor=trimesh.creation.box([12,.03,12]);floor.apply_translation([0,-.055,0])
    scene.add(pyrender.Mesh.from_trimesh(floor,material=pyrender.MetallicRoughnessMaterial(baseColorFactor=[.14,.18,.23,1],roughnessFactor=.8)))
    scene.add(pyrender.PerspectiveCamera(yfov=np.deg2rad(35)),pose=pose([3.4,2.9,4.4],[0,.48,0]))
    for p,power,color in [([2,6,4],3.2,[1,.92,.82]),([-4,3,-2],2.4,[.65,.8,1]),([0,4,-4],2,[1,1,1])]:
        scene.add(pyrender.DirectionalLight(color=color,intensity=power),pose=pose(p,[0,0,0]))
    color,_=renderer.render(scene,flags=pyrender.RenderFlags.SHADOWS_DIRECTIONAL)
    x=(index%4)*520;y=(index//4)*450
    sheet.paste(Image.fromarray(color[:,:,:3]),(x,y));draw.text((x+20,y+426),id.upper(),fill='white')
renderer.delete();sheet.save(sys.argv[1])
print(sys.argv[1])
