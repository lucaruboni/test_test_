"""Builds the zombie model with Blender's Python module (pip install bpy).

    python3 tools/make_zombie.py assets/models/zombie

Body: a skin-modifier mesh grown from a stick figure, subdivided and roughened.
Colours are painted per vertex (skin, torn shirt, trousers, shoes, blood).
Rig: 17 bones with automatic weights. Clips: "walk" (looping) and "attack".
Output: <dir>/zombie.json, a glTF with its buffer embedded as base64.
"""
import bpy, bmesh, sys, os, json, math, random, base64
from mathutils import Vector, Matrix, noise

out = sys.argv[-1]
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---- stick figure: name -> (position, skin radius x/y). Faces -Y, Z up, A-pose arms.
J = {
    'pelvis': ((0, 0, 0.95), (0.155, 0.105)), 'spine': ((0, 0.01, 1.14), (0.14, 0.095)), 'chest': ((0, 0, 1.36), (0.185, 0.115)),
    'neck': ((0, -0.01, 1.51), (0.05, 0.05)), 'head': ((0, -0.03, 1.64), (0.092, 0.105)), 'top': ((0, -0.03, 1.75), (0.075, 0.085)),
    'sho.L': ((0.2, 0, 1.44), (0.062, 0.062)), 'elb.L': ((0.41, 0.01, 1.25), (0.044, 0.044)), 'wri.L': ((0.59, 0, 1.07), (0.032, 0.03)), 'han.L': ((0.67, -0.01, 0.99), (0.04, 0.02)),
    'hip.L': ((0.1, 0, 0.9), (0.085, 0.085)), 'kne.L': ((0.115, -0.015, 0.5), (0.058, 0.058)), 'ank.L': ((0.115, 0.02, 0.1), (0.042, 0.042)), 'toe.L': ((0.12, -0.15, 0.04), (0.045, 0.03)),
}
for k in list(J):
    if k.endswith('.L'):
        (x, y, z), r = J[k]; J[k[:-2] + '.R'] = ((-x, y, z), r)
E_ = [('pelvis', 'spine'), ('spine', 'chest'), ('chest', 'neck'), ('neck', 'head'), ('head', 'top')]
for s in ('.L', '.R'):
    E_ += [('chest', 'sho' + s), ('sho' + s, 'elb' + s), ('elb' + s, 'wri' + s), ('wri' + s, 'han' + s),
           ('pelvis', 'hip' + s), ('hip' + s, 'kne' + s), ('kne' + s, 'ank' + s), ('ank' + s, 'toe' + s)]
names = list(J)
me = bpy.data.meshes.new('Zombie')
me.from_pydata([J[n][0] for n in names], [(names.index(a), names.index(b)) for a, b in E_], [])
ob = bpy.data.objects.new('Zombie', me); scene.collection.objects.link(ob)
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
ob.modifiers.new('skin', 'SKIN')
for i, n in enumerate(names):
    sv = me.skin_vertices[0].data[i]; sv.radius = J[n][1]; sv.use_root = (n == 'pelvis')
sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = 2
tex = bpy.data.textures.new('rough', 'CLOUDS'); tex.noise_scale = 0.07
dis = ob.modifiers.new('rough', 'DISPLACE'); dis.texture = tex; dis.strength = 0.022; dis.mid_level = 0.5
for m in ('skin', 'sub', 'rough'): bpy.ops.object.modifier_apply(modifier=m)

# ---- face details and glowing eyes, added as geometry
bm = bmesh.new(); bm.from_mesh(me)
front = min(v.co.y for v in bm.verts if 1.6 < v.co.z < 1.72 and abs(v.co.x) < 0.03)
eyes = []
for sx in (-1, 1):
    r = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.017, matrix=Matrix.Translation((sx * 0.038, front + 0.012, 1.675)))
    eyes += [v.index for v in r['verts']]
bm.verts.ensure_lookup_table(); eye_set = set(bm.verts[i] for i in eyes)
eye_co = [v.co.copy() for v in eye_set]
bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True

# ---- vertex paint
SKIN, SHIRT, PANTS, SHOE, BLOOD = Vector((0.40, 0.46, 0.34)), Vector((0.30, 0.26, 0.21)), Vector((0.10, 0.11, 0.14)), Vector((0.04, 0.04, 0.04)), Vector((0.22, 0.015, 0.012))
co = [v.co.copy() for v in me.vertices]
is_eye = [any((c - e).length < 1e-5 for e in eye_co) for c in co]
blood = [(random.choice(co), random.uniform(0.04, 0.11)) for _ in range(16)] + [(Vector((0, front, 1.6)), 0.06), (Vector((0.1, -0.1, 1.3)), 0.12)]
tears = [(Vector((random.uniform(-0.18, 0.18), random.choice((-0.1, 0.1)), random.uniform(1.0, 1.45))), random.uniform(0.03, 0.07)) for _ in range(6)]
def paint(i):
    c = co[i]
    if is_eye[i]: return Vector((1.0, 0.32, 0.05))
    ax = abs(c.x)
    if c.z < 0.12: col = SHOE
    elif c.z < 0.99 and ax < 0.24: col = PANTS
    elif c.z < 1.5 and ax < 0.4: col = SHIRT
    else: col = SKIN
    col = col.copy()
    if col is not SHOE and any((c - t).length < r for t, r in tears) and c.z > 0.99: col = SKIN.copy()
    n = noise.noise(c * 9.0) * 0.5 + noise.noise(c * 31.0) * 0.25
    col *= 1.0 + n * 0.55
    for b, r in blood:
        if c.z < 0.14: break
        d = (c - b).length
        if d < r: col = col.lerp(BLOOD, min(1.0, (1 - d / r) * 1.6))
    # eye sockets, mouth, sunken cheeks
    for sx in (-1, 1):
        d = (c - Vector((sx * 0.038, front, 1.675))).length
        if d < 0.034: col *= 0.25
    d = (c - Vector((0, front + 0.005, 1.6))).length
    if d < 0.03: col = Vector((0.08, 0.01, 0.01))
    return Vector((max(0, min(1, x)) for x in col))
vc = [paint(i) for i in range(len(co))]
ca = me.color_attributes.new('Color', 'BYTE_COLOR', 'CORNER')
for l in me.loops:
    c = vc[l.vertex_index]; ca.data[l.index].color_srgb = (c.x, c.y, c.z, 1.0)
me.color_attributes.active_color = ca; me.color_attributes.render_color_index = 0
mat = bpy.data.materials.new('ZombieSkin'); mat.use_nodes = True
nt = mat.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
an = nt.nodes.new('ShaderNodeVertexColor'); an.layer_name = 'Color'; nt.links.new(an.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.9
me.materials.append(mat)

# ---- rig
arm = bpy.data.armatures.new('Rig'); ao = bpy.data.objects.new('Rig', arm); scene.collection.objects.link(ao)
bpy.context.view_layer.objects.active = ao; bpy.ops.object.mode_set(mode='EDIT')
P = lambda n: Vector(J[n][0])
def bone(name, a, b, parent=None):
    eb = arm.edit_bones.new(name); eb.head = a; eb.tail = b
    if parent: eb.parent = arm.edit_bones[parent]
bone('hips', P('pelvis'), P('spine')); bone('spine', P('spine'), P('chest'), 'hips'); bone('chest', P('chest'), P('neck'), 'spine')
bone('neck', P('neck'), P('neck') + Vector((0, -0.01, 0.07)), 'chest'); bone('head', P('neck') + Vector((0, -0.01, 0.07)), P('top') + Vector((0, 0, 0.06)), 'neck')
for s in ('.L', '.R'):
    bone('upperarm' + s, P('sho' + s), P('elb' + s), 'chest'); bone('forearm' + s, P('elb' + s), P('wri' + s), 'upperarm' + s); bone('hand' + s, P('wri' + s), P('han' + s), 'forearm' + s)
    bone('thigh' + s, P('hip' + s), P('kne' + s), 'hips'); bone('shin' + s, P('kne' + s), P('ank' + s), 'thigh' + s); bone('foot' + s, P('ank' + s), P('toe' + s), 'shin' + s)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); ao.select_set(True); bpy.context.view_layer.objects.active = ao
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# ---- animation. Rotations are given about the armature's X/Y/Z axes, relative to the parent bone.
Rx = lambda a: Matrix.Rotation(a, 3, 'X'); Ry = lambda a: Matrix.Rotation(a, 3, 'Y'); Rz = lambda a: Matrix.Rotation(a, 3, 'Z')
for pb in ao.pose.bones: pb.rotation_mode = 'QUATERNION'
def key(frame, pose):
    for pb in ao.pose.bones:
        R = pose.get(pb.name, Matrix.Identity(3)); M = pb.bone.matrix_local.to_3x3()
        pb.rotation_quaternion = (M.inverted() @ R @ M).to_quaternion(); pb.keyframe_insert('rotation_quaternion', frame=frame)
def arms(lift_l, lift_r, bend=0.45):
    return {'upperarm.L': Rx(lift_l) @ Rz(-1.35), 'upperarm.R': Rx(lift_r) @ Rz(1.35), 'forearm.L': Rx(-bend), 'forearm.R': Rx(-bend * 0.6), 'hand.L': Rx(0.3), 'hand.R': Rx(0.45)}
def walk(ph):
    s, c = math.sin(ph), math.cos(ph)
    p = {'hips': Rz(0.07 * s), 'spine': Rx(0.24) @ Ry(0.07 * s), 'chest': Rx(0.14) @ Rz(-0.1 * s), 'neck': Rx(-0.1), 'head': Rx(-0.2) @ Ry(0.12 * s + 0.1),
         'thigh.L': Rx(-0.42 * s - 0.06), 'thigh.R': Rx(0.42 * s - 0.06), 'shin.L': Rx(0.12 + 0.75 * max(0, c)), 'shin.R': Rx(0.12 + 0.75 * max(0, -c)),
         'foot.L': Rx(-0.1 * s), 'foot.R': Rx(0.1 * s)}
    p.update(arms(-0.5 + 0.1 * s, -0.25 - 0.12 * s)); return p
def attack(k):  # k 0..1
    up = math.sin(min(1, k / 0.4) * math.pi / 2) if k < 0.4 else max(0, 1 - (k - 0.4) / 0.25)
    hit = max(0, 1 - abs(k - 0.65) / 0.25)
    p = {'spine': Rx(0.2 + 0.3 * hit), 'chest': Rx(0.1 + 0.2 * hit), 'neck': Rx(-0.1), 'head': Rx(-0.25 - 0.2 * hit),
         'thigh.L': Rx(-0.25), 'thigh.R': Rx(0.2), 'shin.L': Rx(0.25), 'shin.R': Rx(0.3)}
    p.update(arms(-0.5 - 0.75 * up + 0.5 * hit, -0.4 - 0.85 * up + 0.55 * hit, 0.45 + 0.4 * hit)); return p
ao.animation_data_create()
def clip(name, frames, fn):
    act = bpy.data.actions.new(name); ao.animation_data.action = act
    for f in range(0, frames + 1, 2): key(f + 1, fn(f / frames))
    tr = ao.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 1, act); ao.animation_data.action = None
clip('walk', 24, lambda k: walk(k * 2 * math.pi))
clip('attack', 14, attack)
for pb in ao.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0)

os.makedirs(out, exist_ok=True)
path = os.path.join(out, 'zombie.gltf')
bpy.ops.export_scene.gltf(filepath=path, export_format='GLTF_SEPARATE', export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_skins=True, export_yup=True, export_vertex_color='ACTIVE', export_force_sampling=True)
d = json.load(open(path)); b = os.path.join(out, d['buffers'][0]['uri'])
d['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(open(b, 'rb').read()).decode()
json.dump(d, open(os.path.join(out, 'zombie.json'), 'w'), separators=(',', ':')); os.remove(path); os.remove(b)
print('verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons), 'anims', [a['name'] for a in d.get('animations', [])],
      'attrs', list(d['meshes'][0]['primitives'][0]['attributes']), 'kb', os.path.getsize(os.path.join(out, 'zombie.json')) // 1024)
