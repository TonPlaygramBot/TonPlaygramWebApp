import bpy, math, json, os
from mathutils import Vector,Matrix
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.environ.get('FACADE_SOURCE', '/tmp/tirana-facade/source.gltf'))
selected=[];report=[]
for label,wall,detail in [('window_small_01','wall_window_centered_small_01','window_centered_small_01'),('window_small_03','wall_window_centered_small_03','window_centered_small_03'),('window_large_01','wall_window_centered_large_01','window_centered_large_01'),('door_small_02','wall_door_centered_small_02','door_centered_small_02')]:
 w=bpy.data.objects[wall];coords=[w.matrix_world@Vector(c) for c in w.bound_box];lo=Vector([min(c[i] for c in coords) for i in range(3)]);hi=Vector([max(c[i] for c in coords) for i in range(3)]);origin=Vector(((lo.x+hi.x)/2,0,lo.z))
 parent=bpy.data.objects.new(label,None);bpy.context.collection.objects.link(parent);selected.append(parent);tris=0
 for name in [wall,detail]:
  o=bpy.data.objects[name];world=o.matrix_world.copy()
  for v in o.data.vertices:v.co=world@v.co-origin
  o.matrix_world=Matrix.Identity(4);o.parent=parent
  if name==wall:
   bpy.context.view_layer.objects.active=o
   mod=o.modifiers.new('Dissolve coplanar source tessellation','DECIMATE');mod.decimate_type='DISSOLVE';mod.angle_limit=.001;mod.delimit={'NORMAL','MATERIAL','UV'}
   bpy.ops.object.modifier_apply(modifier=mod.name)
  o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles);selected.append(o)
 report.append(dict(name=label,width=hi.x-lo.x,height=hi.z-lo.z,triangles=tris,sourceNodes=[wall,detail]))
bpy.ops.object.select_all(action='DESELECT')
for o in selected:o.select_set(True)
out=os.environ.get('FACADE_OUTPUT', 'webapp/public/assets/tirana-streets/facade-modules/')
os.makedirs(out,exist_ok=True)
if not out.endswith('/'):out+='/'
bpy.ops.export_scene.gltf(filepath=out+'facade-modules.glb',export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True)
json.dump(report,open(out+'modules.json','w'),indent=2)
print('MODULE_REPORT',json.dumps(report))
