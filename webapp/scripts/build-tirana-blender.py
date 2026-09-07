"""Original Tirana facade archetypes, authored with Blender 4.5 LTS.
Run: blender --background --python webapp/scripts/build-tirana-blender.py
Or import/run with the official bpy module. Output includes editable .blend and glTF.
Google Street View Sep 2025 is a visual reference only; no Google tiles are embedded.
"""
import bpy, math, os, sys
from pathlib import Path
from mathutils import Vector
BASE=Path(__file__).resolve().parent.parent/'public/assets/tirana-streets'
OUT=Path(__file__).resolve().parent.parent/'art/tirana-streets';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
materials={}
def mat(name,color,metal=0,rough=.7,texture=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if texture:
  for channel in ['diff','nor_gl','rough']:
   t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(BASE/'materials'/f'plastered_wall_02-{channel}.jpg'),check_existing=True)
   if channel!='diff':t.image.colorspace_settings.name='Non-Color'
   if channel=='nor_gl':
    n=m.node_tree.nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.32;m.node_tree.links.new(t.outputs['Color'],n.inputs['Color']);m.node_tree.links.new(n.outputs['Normal'],p.inputs['Normal'])
   elif channel=='rough':m.node_tree.links.new(t.outputs['Color'],p.inputs['Roughness'])
   else:
    mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*color,1);m.node_tree.links.new(t.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],p.inputs['Base Color'])
    # glTF Principled Base Color supports direct image + factor, applied after export in renderer.
    m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    m.diffuse_color=(*color,1)
 materials[name]=m;return m
plaster=mat('Tirana_PBR_Plaster',(1,.95,.83),texture=True)
cream=mat('Warm limestone trim',(.72,.69,.58),rough=.83)
white=mat('Painted window frames',(.69,.72,.7),metal=.15,rough=.43)
steel=mat('Iron balcony rail',(.065,.085,.079),metal=.74,rough=.38)
glass=mat('Green grey glazing',(.09,.18,.19),metal=.4,rough=.2)
glass2=mat('Closed shutters',(.30,.35,.32),metal=.1,rough=.8)
roof=mat('Roof membrane',(.16,.17,.16),rough=.95)
wood=mat('Timber shop panel',(.27,.13,.065),rough=.7)
accent=mat('Terracotta painted panels',(.54,.21,.11),rough=.83)
plant=mat('Balcony greenery',(.13,.25,.07),rough=.95)
class Builder:
 def __init__(self,name):
  self.root=bpy.data.objects.new(name,None);scene.collection.objects.link(self.root);self.parts={}
 def box(self,m,x,y,z,w,d,h):
  vs,fs,uvs=self.parts.setdefault(m,([],[],[]));i=len(vs)
  vs.extend([(x-w/2,y-d/2,z-h/2),(x+w/2,y-d/2,z-h/2),(x+w/2,y+d/2,z-h/2),(x-w/2,y+d/2,z-h/2),(x-w/2,y-d/2,z+h/2),(x+w/2,y-d/2,z+h/2),(x+w/2,y+d/2,z+h/2),(x-w/2,y+d/2,z+h/2)])
  for f in [(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)]:
   fs.append(tuple(i+n for n in f));a,b,c=[Vector(vs[i+n]) for n in f[:3]];normal=(b-a).cross(c-a);axis=max(range(3),key=lambda k:abs(normal[k]));uvs.extend([((vs[i+n][1] if axis==0 else vs[i+n][0])/2.2,(vs[i+n][1] if axis==2 else vs[i+n][2])/2.2) for n in f])
 def panel(self,m,x,y,z,w,h,side,sidewall=False):
  vs,fs,uvs=self.parts.setdefault(m,([],[],[]));i=len(vs)
  pts=[(-w/2,-h/2),(w/2,-h/2),(w/2,h/2),(-w/2,h/2)]
  if (side>0)!=sidewall:pts.reverse()
  vs.extend([(x,y+u,z+v) if sidewall else (x+u,y,z+v) for u,v in pts]);fs.append(tuple(range(i,i+4)));uvs.extend([(u/2.2,v/2.2) for u,v in pts])
 def finish(self,lod):
  for m,(vs,fs,uvs) in self.parts.items():
   mesh=bpy.data.meshes.new(self.root.name+' '+m.name);mesh.from_pydata(vs,[],fs);mesh.update();layer=mesh.uv_layers.new(name='UVMap')
   for i,uv in enumerate(uvs):layer.data[i].uv=uv
   obj=bpy.data.objects.new(mesh.name,mesh);scene.collection.objects.link(obj);obj.parent=self.root;obj.data.materials.append(m)
   if not lod and m in [plaster]:
    bevel=obj.modifiers.new('Architectural softened edges','BEVEL');bevel.width=.022;bevel.segments=2
    # Apply in Blender so the exported silhouette/normals match the authoring file.
    bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.modifier_apply(modifier=bevel.name);obj.select_set(False)
  return self.root
names=['tirana_apartment','tirana_lowrise','tirana_modern','tirana_courtyard']
roots=[]
for variant,name in enumerate(names):
 floors=[6,3,10,5][variant];W=[18,15,20,19][variant];D=[14,12,16,15][variant];H=3.6+floors*3.05
 for lod in [False,True]:
  b=Builder(name+('_lod' if lod else ''))
  b.box(plaster,0,0,H/2,W,D,H)
  b.box(cream,0,0,.32,W+.15,D+.15,.64)
  b.box(roof,0,0,H+.035,W-.15,D-.15,.08)
  # Parapet around the roof and horizontal floor edges.
  for sign in [-1,1]:
   b.box(cream,0,sign*(D/2-.09),H+.35,W,.18,.7);b.box(cream,sign*(W/2-.09),0,H+.35,.18,D,.7)
  for level in range(floors+1):
   z=3.6+level*3.05
   for sign in [-1,1]:b.box(cream,0,sign*(D/2+.045),z,W+.16,.16,.16)
  # Front/rear bays, real frames, shallow reveals and occasional glazed balconies.
  for side in [-1,1]:
   for col in range(5):
    x=(col-2)*W/5
    # Ground-floor shops and entries, with lintel and separate metal mullions.
    b.box(glass,x,side*(D/2+.025),1.65,W/5-.35,.065,2.65)
    for dx in [-1,1]:b.box(white,x+dx*(W/10-.14),side*(D/2+.09),1.65,.09,.15,2.8)
    if not lod:
     b.box(wood,x,side*(D/2+.13),3.12,W/5-.3,.12,.38)
     b.box(steel,x,side*(D/2+.11),1.6,.065,.12,2.55)
     b.box(cream,x,side*(D/2+.35),.15,W/5-.1,.7,.22)
    for level in range(floors):
     z=5.05+level*3.05
     balcony=(col%2==variant%2 and variant!=1)
     if lod:
      b.panel(white,x,side*(D/2+.08),z,2.24,2.08,side)
      b.panel(glass if (col+level)%4 else glass2,x,side*(D/2+.095),z,2.02,1.84,side)
      continue
     b.box(glass if (col+level)%4 else glass2,x,side*(D/2+.025),z,2.05,.06,1.88)
     for dx in [-1,1]:b.box(white,x+dx*1.06,side*(D/2+.10),z,.12,.2,2.06)
     for dz in [-1,1]:b.box(white,x,side*(D/2+.1),z+dz*.98,2.22,.2,.12)
     if lod:continue
     b.box(white,x,side*(D/2+.12),z,.07,.22,1.85)
     b.box(cream,x,side*(D/2+.19),z-1.04,2.32,.4,.12)
     if balcony:
      b.box(cream,x,side*(D/2+.59),z-1.03,2.8,1.22,.16)
      b.box(glass if variant==2 else steel,x,side*(D/2+1.12),z-.43,2.76,.04,.85 if variant==2 else .045)
      for dx in [-1,1]:b.box(steel,x+dx*1.34,side*(D/2+.64),z-.48,.055,1.04,.055)
      for dx in [-1.28,-.86,-.43,0,.43,.86,1.28]:b.box(steel,x+dx,side*(D/2+1.12),z-.59,.028,.028,.92)
      if (level+col)%3==0:
       b.box(accent,x-.6,side*(D/2+.78),z-.71,.8,.27,.32)
       b.box(plant,x-.6,side*(D/2+.78),z-.47,.86,.33,.26)
     elif level%2==0:
      b.box(cream,x+1.42,side*(D/2+.22),z-.66,.62,.38,.45)
      for slat in range(4):b.box(steel,x+1.42,side*(D/2+.42),z-.78+slat*.065,.5,.02,.015)
  # Side facades are not blank when viewed along streets.
  for side in [-1,1]:
   for col in range(3):
    y=(col-1)*D/3
    for level in range(floors):
     z=5.05+level*3.05
     if lod:
      b.panel(white,side*(W/2+.07),y,z,1.98,2.12,side,True)
      b.panel(glass,side*(W/2+.09),y,z,1.72,1.85,side,True)
      continue
     b.box(glass,side*(W/2+.025),y,z,.06,1.75,1.9)
     for dy in [-1,1]:b.box(white,side*(W/2+.09),y+dy*.9,z,.16,.1,2.03)
     for dz in [-1,1]:b.box(white,side*(W/2+.09),y,z+dz*.98,.16,1.88,.1)
   if not lod:b.box(steel,side*(W/2+.1),D/2-.22,H/2,.09,.09,H)
  if variant in [0,2]:
   for x in [-W/2+.3,W/2-.3]:b.box(accent,x,-D/2-.1,H/2,.48,.22,H)
  b.box(plaster,-W*.2,0,H+1.05,3.7,3,2.1)
  if not lod:
   b.box(roof,-W*.2,0,H+2.15,4,3.3,.15)
   for k in range(3):
    b.box(white,k*1.45-.5,D*.18,H+.43,1.1,1.6,.7)
    for slat in range(4):b.box(steel,k*1.45-.5,D*.18+.815,H+.2+slat*.12,.88,.02,.04)
  roots.append(b.finish(lod))
# Store original, editable Blender models with packed licensed texture maps.
for image in bpy.data.images:
 if image.source=='FILE':image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'tirana-buildings.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(BASE/'tirana-buildings.glb'),export_format='GLB',export_yup=True,export_apply=True,export_image_format='AUTO')
# Independent CPU visual check: a full-detail apartment and low-rise, in daylight.
for obj in list(scene.objects):
 if obj.type=='EMPTY':obj.hide_render=True
for root in roots:
 if root.name in ['tirana_apartment','tirana_lowrise']:
  root.hide_render=False
  root.location.x=-13 if root.name=='tirana_apartment' else 13
 else:
  for child in root.children:child.hide_render=True
bpy.ops.mesh.primitive_plane_add(size=160,location=(0,0,-.03));plane=bpy.context.object;plane.data.materials.append(cream)
bpy.ops.object.light_add(type='SUN',location=(0,0,35));sun=bpy.context.object;sun.rotation_euler=(.42,-.5,-.5);sun.data.energy=3;sun.data.angle=.07
bpy.ops.object.camera_add(location=(49,-66,29));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,11))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=42;scene.camera=camera
scene.world=bpy.data.worlds.new('Daylight');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.66,.76,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=1100;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.filepath=str(OUT/'blender-model-check.png');bpy.ops.render.render(write_still=True)
print('BLENDER_BUILD_OK',bpy.app.version_string, 'models',len(roots),'glb_bytes',(BASE/'tirana-buildings.glb').stat().st_size,flush=True)
# Avoid background bpy library shutdown teardown in embedded Python.
if not bpy.app.background:pass
