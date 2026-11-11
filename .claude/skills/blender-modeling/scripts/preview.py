"""Render a contact sheet of a model so it can be LOOKED at before it ships.

    python3 preview.py <model.glb|.gltf|.json|.blend|.obj|.fbx> <out.png> [--size 512] [--samples 24] [--clay] [--frame N] [--clip NAME]

Six views: front, three-quarter, side, back, top, and a close-up of the upper third. Neutral studio light on a grey floor.
--clay overrides materials with matte grey to judge form alone. --clip/--frame pose an animated model.
"""
import bpy, sys, os, math, json, shutil, tempfile
from mathutils import Vector

a = sys.argv[1:]
src, out = a[0], a[1]
opt = lambda k, d: type(d)(a[a.index(k) + 1]) if k in a else d
size, samples, clay, frame, clip = opt('--size', 512), opt('--samples', 24), '--clay' in a, opt('--frame', 1), opt('--clip', '')

ext = os.path.splitext(src)[1].lower()
if ext == '.blend': bpy.ops.wm.open_mainfile(filepath=src)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if ext == '.json':  # glTF JSON with an embedded buffer
        t = os.path.join(tempfile.mkdtemp(), 'm.gltf'); shutil.copy(src, t)
        tex = os.path.join(os.path.dirname(src), 'textures')
        if os.path.isdir(tex): shutil.copytree(tex, os.path.join(os.path.dirname(t), 'textures'))
        bpy.ops.import_scene.gltf(filepath=t)
    elif ext in ('.glb', '.gltf'): bpy.ops.import_scene.gltf(filepath=src)
    elif ext == '.obj': bpy.ops.wm.obj_import(filepath=src)
    elif ext == '.fbx': bpy.ops.import_scene.fbx(filepath=src)
    else: sys.exit('unsupported format ' + ext)
scene = bpy.context.scene
for o in list(scene.objects):
    if o.type in ('CAMERA', 'LIGHT'): bpy.data.objects.remove(o, do_unlink=True)

if clip:
    for o in scene.objects:
        if o.animation_data:
            act = bpy.data.actions.get(clip) or next((x for x in bpy.data.actions if clip in x.name), None)
            if act: o.animation_data.action = act
scene.frame_set(frame)

# the glTF importer adds a hidden icosphere used as the bone display shape: only count what renders
meshes = [o for o in scene.objects if o.type == 'MESH' and o.visible_get() and not o.hide_render]
dg = bpy.context.evaluated_depsgraph_get()
lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
for o in meshes:
    eo = o.evaluated_get(dg); me = eo.to_mesh()
    for v in me.vertices:
        w = eo.matrix_world @ v.co
        lo = Vector((min(lo[i], w[i]) for i in range(3))); hi = Vector((max(hi[i], w[i]) for i in range(3)))
    eo.to_mesh_clear()
c = (lo + hi) / 2; dim = hi - lo; r = max(dim.length / 2, 1e-3)

if clay:
    m = bpy.data.materials.new('clay'); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); b.inputs['Base Color'].default_value = (0.6, 0.6, 0.6, 1); b.inputs['Roughness'].default_value = 0.7
    for o in meshes: o.data.materials.clear(); o.data.materials.append(m)

# floor, lights, world
bpy.ops.mesh.primitive_plane_add(size=r * 40, location=(c.x, c.y, lo.z - 0.0005))
fm = bpy.data.materials.new('floor'); fm.use_nodes = True
next(n for n in fm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (0.18, 0.18, 0.2, 1)
bpy.context.object.data.materials.append(fm)
def light(name, loc, energy, sz, col=(1, 1, 1)):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy * r * r; l.size = sz * r; l.color = col
    o = bpy.data.objects.new(name, l); o.location = c + Vector(loc) * r; scene.collection.objects.link(o)
    o.rotation_euler = (c - o.location).to_track_quat('-Z', 'Y').to_euler()
light('key', (-2.2, -2.6, 2.6), 260, 2.5, (1, 0.96, 0.9)); light('fill', (2.8, -1.6, 1.2), 90, 4, (0.85, 0.9, 1)); light('rim', (0.5, 3, 2.4), 220, 2)
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.2, 0.21, 0.23, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.6; scene.world = w

cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 70; cam = bpy.data.objects.new('cam', cam_d); scene.collection.objects.link(cam); scene.camera = cam
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = samples; scene.cycles.use_denoising = False
scene.render.resolution_x = scene.render.resolution_y = size; scene.render.image_settings.file_format = 'PNG'
try: scene.view_settings.view_transform = 'Standard'
except Exception: pass

dist = r / math.tan(cam_d.angle / 2) * 1.12
def shot(az, el, target=c, d=dist):
    az, el = math.radians(az), math.radians(el)
    # azimuth 0 looks at the model's front (-Y in Blender = +Z after glTF export)
    cam.location = target + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * d
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
views = [('front', 0, 8, c, dist), ('three-quarter', 40, 18, c, dist), ('side', 90, 8, c, dist), ('back', 180, 8, c, dist), ('top', 0, 80, c, dist),
         ('detail', 25, 10, Vector((c.x, c.y, lo.z + dim.z * 0.82)), dist * 0.42)]
tmp = tempfile.mkdtemp(); paths = []
for n, az, el, t, d in views:
    shot(az, el, t, d); p = os.path.join(tmp, n + '.png'); scene.render.filepath = p; bpy.ops.render.render(write_still=True); paths.append(p)

# stitch 3x2 with Blender's own image API (no PIL dependency)
import numpy as np
sheet = np.zeros((size * 2, size * 3, 4), dtype=np.float32)
for i, p in enumerate(paths):
    im = bpy.data.images.load(p); px = np.array(im.pixels[:], dtype=np.float32).reshape(size, size, 4)
    row, col = 1 - i // 3, i % 3  # image rows are bottom-up
    sheet[row * size:(row + 1) * size, col * size:(col + 1) * size] = px
o = bpy.data.images.new('sheet', size * 3, size * 2, alpha=False); o.pixels = sheet.ravel().tolist()
o.filepath_raw = os.path.abspath(out); o.file_format = 'PNG'; o.save()
tris = 0
for m in meshes:
    m.data.calc_loop_triangles(); tris += len(m.data.loop_triangles)
print('PREVIEW', json.dumps({'out': out, 'views': [v[0] for v in views], 'tris': tris, 'size_m': [round(x, 3) for x in dim], 'min_z': round(lo.z, 3)}))
