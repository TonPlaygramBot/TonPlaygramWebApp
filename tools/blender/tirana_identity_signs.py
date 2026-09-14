"""Extruded logo silhouettes from packaged operator artwork, with exact image faces.
Mount dimensions are authored; trademarks retain their owners' rights.
Requires Blender 4.5, Pillow and OpenCV. No hand-drawn substitute brand marks.
"""
import bpy,cv2,math,json
import numpy as np
from PIL import Image
from pathlib import Path
from tirana_mobility import reset,mat,box,ROOT
OUT=ROOT/'webapp/public/assets/tirana-streets/city-mobility/signs'
SOURCE=ROOT/'assets-source/tirana-city-mobility/signs'
OUT.mkdir(parents=True,exist_ok=True);SOURCE.mkdir(parents=True,exist_ok=True)
BRANDS=['conad','mulliri','spar','bkt','credins','raiffeisen','plaza','rogner','vodafone','one','big-market','university-tirana']
CROPS={'mulliri':(74,37,989,316),'spar':(74,96,1148,274)}
stats={}
for brand in BRANDS:
 reset();image=Image.open(ROOT/f'webapp/public/assets/tirana-streets/signs/{brand}-logo.png').convert('RGBA')
 if brand in CROPS:image=image.crop(CROPS[brand])
 image.thumbnail((768,256));w,h=image.size;ratio=w/h
 # All assets are exactly 1 m high and ratio m wide; host fits the mapped sign bay.
 pixels=np.array(image);rgb=pixels[:,:,:3];alpha=pixels[:,:,3]
 background=rgb[0,0].astype(float);mask=((np.linalg.norm(rgb.astype(float)-background,axis=2)>50)&(alpha>100)).astype(np.uint8)*255
 contours,hierarchy=cv2.findContours(mask,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
 backing=mat('Brushed sign edge',(.23,.25,.27),.82,.24)
 box('Metal sign cassette',(0,.045,.5),(ratio+.045,.09,1.045),backing,.014)
 # Silhouette relief projects 26 mm off the cassette, including counters/holes.
 relief=mat('Raised logo sides',(.25,.27,.3),.66,.27)
 curve=bpy.data.curves.new('Logo outline from official artwork','CURVE');curve.dimensions='2D';curve.resolution_u=1;curve.extrude=.014;curve.bevel_depth=.0015;curve.bevel_resolution=1
 for i,c in enumerate(contours):
  c=cv2.approxPolyDP(c,.65,True).reshape(-1,2)
  if len(c)<3 or abs(cv2.contourArea(c))<6:continue
  spline=curve.splines.new('POLY');spline.points.add(len(c)-1)
  # The contour winding retains letter counters when Blender fills the curve.
  for p,(x,y) in zip(spline.points,c):p.co=((x/w-.5)*ratio,1-y/h,0,1)
  spline.use_cyclic_u=True
 logo=bpy.data.objects.new('Raised operator logo',curve);bpy.context.collection.objects.link(logo);logo.rotation_euler=(math.pi/2,0,0);logo.location=(0,-.02,0);curve.materials.append(relief)
 # Print/paint original pixels on the relief face. Embedded image, no runtime hotlink.
 texpath=SOURCE/(brand+'.png');image.save(texpath)
 paint=mat('Official logo face',(1,1,1),.08,.32);nodes=paint.node_tree.nodes;bs=nodes.get('Principled BSDF');tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(texpath));tex.image.pack()
 paint.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);paint.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha'])
 mesh=bpy.data.meshes.new('Logo face');mesh.from_pydata([(-ratio/2,-.038,0),(ratio/2,-.038,0),(ratio/2,-.038,1),(-ratio/2,-.038,1)],[],[(0,1,2,3)])
 uv=mesh.uv_layers.new();
 for l,co in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):l.uv=co
 face=bpy.data.objects.new('Original artwork',mesh);bpy.context.collection.objects.link(face);mesh.materials.append(paint)
 bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=face;bpy.ops.object.convert(target='MESH')
 bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(brand+'.blend')),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(brand+'.glb')),export_format='GLB',export_cameras=False,export_lights=False)
 stats[brand]={'width':ratio,'height':1,'bytes':(OUT/(brand+'.glb')).stat().st_size,'method':'Blender silhouette extrusion and official artwork face'}
(OUT/'manifest.json').write_text(json.dumps(stats,indent=2)+'\n')
