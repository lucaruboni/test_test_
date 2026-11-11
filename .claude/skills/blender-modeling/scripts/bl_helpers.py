"""Helpers for headless Blender modelling scripts. Import after putting this folder on sys.path:

    import sys; sys.path.insert(0, '<skill>/scripts'); from bl_helpers import *
"""
import bpy, bmesh, json, os, base64, math
from mathutils import Vector, Matrix


def reset():
    """Empty scene with one collection. Call first: the default scene has a cube, camera and light."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def activate(ob):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    return ob


def new_object(name, verts, edges=(), faces=()):
    me = bpy.data.meshes.new(name); me.from_pydata(list(verts), list(edges), list(faces)); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return activate(ob)


def box(name, size, loc=(0, 0, 0)):
    """Axis-aligned box from full dimensions, built with bmesh (no bpy.ops context needed)."""
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); ob.location = loc; bpy.context.scene.collection.objects.link(ob)
    return activate(ob)


def cylinder(name, radius, depth, loc=(0, 0, 0), axis='Z', segments=24, radius2=None):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius if radius2 is None else radius2, depth=depth)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); ob.location = loc
    if axis == 'X': ob.rotation_euler = (0, math.pi / 2, 0)
    if axis == 'Y': ob.rotation_euler = (math.pi / 2, 0, 0)
    bpy.context.scene.collection.objects.link(ob)
    return activate(ob)


def apply_modifiers(ob):
    activate(ob)
    for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)


def hard_surface_finish(ob, bevel=0.004, segments=2, angle_deg=35, apply=True):
    """The standard hard-surface finish: bevel sharp edges so they catch light, then weighted normals so
    the flat faces stay flat. Without this, primitives read as CG boxes."""
    activate(ob)
    for p in ob.data.polygons: p.use_smooth = True
    b = ob.modifiers.new('Bevel', 'BEVEL'); b.width = bevel; b.segments = segments
    b.limit_method = 'ANGLE'; b.angle_limit = math.radians(angle_deg); b.harden_normals = False
    w = ob.modifiers.new('WN', 'WEIGHTED_NORMAL'); w.keep_sharp = True
    if apply: apply_modifiers(ob)
    return ob


def boolean(ob, cutter, op='DIFFERENCE', remove=True):
    activate(ob)
    m = ob.modifiers.new('Bool', 'BOOLEAN'); m.operation = op; m.object = cutter; m.solver = 'EXACT'
    bpy.ops.object.modifier_apply(modifier=m.name)
    if remove: bpy.data.objects.remove(cutter, do_unlink=True)
    return ob


def join(objs, name=None):
    activate(objs[0])
    for o in objs: o.select_set(True)
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    if name: ob.name = name; ob.data.name = name
    return ob


def skin_figure(name, joints, edges, root, subdiv=2, roughness=0.0, noise_scale=0.07):
    """Organic mesh from a stick figure. joints: {name: ((x, y, z), (rx, ry))}; edges: [(a, b)].
    Returns the object with modifiers applied. Good first pass for creatures, limbs, trees, cables."""
    names = list(joints)
    ob = new_object(name, [joints[n][0] for n in names], [(names.index(a), names.index(b)) for a, b in edges])
    ob.modifiers.new('skin', 'SKIN')
    for i, n in enumerate(names):
        sv = ob.data.skin_vertices[0].data[i]; sv.radius = joints[n][1]; sv.use_root = (n == root)
    ob.modifiers.new('sub', 'SUBSURF').levels = subdiv
    if roughness:
        tex = bpy.data.textures.new(name + '_rough', 'CLOUDS'); tex.noise_scale = noise_scale
        d = ob.modifiers.new('rough', 'DISPLACE'); d.texture = tex; d.strength = roughness; d.mid_level = 0.5
    apply_modifiers(ob)
    for p in ob.data.polygons: p.use_smooth = True
    return ob


def paint_vertices(ob, fn, layer='Color'):
    """fn(co: Vector, normal: Vector, index) -> (r, g, b) in sRGB 0..1. Corner-domain byte colours export as COLOR_0."""
    me = ob.data
    cols = [fn(v.co, v.normal, v.index) for v in me.vertices]
    ca = me.color_attributes.get(layer) or me.color_attributes.new(layer, 'BYTE_COLOR', 'CORNER')
    for l in me.loops:
        c = cols[l.vertex_index]; ca.data[l.index].color_srgb = (min(1, max(0, c[0])), min(1, max(0, c[1])), min(1, max(0, c[2])), 1.0)
    me.color_attributes.active_color = ca
    return ca


def vertex_color_material(ob, layer='Color', roughness=0.8, metallic=0.0, name=None):
    mat = bpy.data.materials.new(name or ob.name + '_mat'); mat.use_nodes = True
    nt = mat.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = layer
    nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = roughness; bsdf.inputs['Metallic'].default_value = metallic
    ob.data.materials.clear(); ob.data.materials.append(mat)
    return mat


def flat_material(name, color, roughness=0.6, metallic=0.0, emission=None):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1); bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1); bsdf.inputs['Emission Strength'].default_value = 2.0
    return mat


# ---- rigging and animation ----
def make_armature(name, bones):
    """bones: [(name, head, tail, parent_or_None)] in order (parents first). Returns the armature object."""
    arm = bpy.data.armatures.new(name); ao = bpy.data.objects.new(name, arm); bpy.context.scene.collection.objects.link(ao)
    activate(ao); bpy.ops.object.mode_set(mode='EDIT')
    for n, head, tail, parent in bones:
        eb = arm.edit_bones.new(n); eb.head = head; eb.tail = tail
        if parent: eb.parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in ao.pose.bones: pb.rotation_mode = 'QUATERNION'
    return ao


def bind(mesh_ob, arm_ob):
    """Automatic weights. Needs the mesh in a rest pose with limbs apart (A or T pose) or weights bleed between limbs."""
    bpy.ops.object.select_all(action='DESELECT'); mesh_ob.select_set(True); arm_ob.select_set(True)
    bpy.context.view_layer.objects.active = arm_ob
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')


def key_pose(arm_ob, frame, pose):
    """pose: {bone: 3x3 Matrix}, each a rotation about the ARMATURE's axes relative to the parent bone.
    This avoids guessing bone-local axes and rolls: Matrix.Rotation(a, 3, 'X') always pitches about world X."""
    for pb in arm_ob.pose.bones:
        R = pose.get(pb.name, Matrix.Identity(3)); M = pb.bone.matrix_local.to_3x3()
        pb.rotation_quaternion = (M.inverted() @ R @ M).to_quaternion(); pb.keyframe_insert('rotation_quaternion', frame=frame)


def make_clip(arm_ob, name, frames, pose_fn, step=2):
    """Bakes pose_fn(k in 0..1) into an action and parks it on its own NLA track, which is what the glTF
    exporter turns into a named animation. Frame 1 and the last frame should match for loops."""
    ad = arm_ob.animation_data or arm_ob.animation_data_create()
    act = bpy.data.actions.new(name); ad.action = act
    for f in range(0, frames + 1, step): key_pose(arm_ob, f + 1, pose_fn(f / frames))
    tr = ad.nla_tracks.new(); tr.name = name; tr.strips.new(name, 1, act); ad.action = None
    for pb in arm_ob.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0)
    return act


# ---- stats and export ----
def stats(objs=None):
    objs = objs or [o for o in bpy.context.scene.objects if o.type == 'MESH']
    dg = bpy.context.evaluated_depsgraph_get(); tris = verts = 0; lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in objs:
        me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); tris += len(me.loop_triangles); verts += len(me.vertices)
        for v in me.vertices:
            w = o.matrix_world @ v.co
            lo = Vector((min(lo[i], w[i]) for i in range(3))); hi = Vector((max(hi[i], w[i]) for i in range(3)))
    return {'objects': len(objs), 'verts': verts, 'tris': tris, 'size_m': [round(hi[i] - lo[i], 3) for i in range(3)], 'min_z': round(lo.z, 3)}


def export_glb(path, animations=True, embed_json=False, selected_only=False):
    """Writes .glb, or with embed_json=True a single .json glTF whose buffer is base64 (for hosts that refuse binary files)."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    common = dict(export_animations=animations, export_animation_mode='NLA_TRACKS', export_skins=True, export_yup=True,
                  export_vertex_color='ACTIVE', export_apply=True, use_selection=selected_only)
    if not embed_json:
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', **common)
    else:
        tmp = os.path.splitext(path)[0] + '.gltf'
        bpy.ops.export_scene.gltf(filepath=tmp, export_format='GLTF_SEPARATE', **common)
        d = json.load(open(tmp)); b = os.path.join(os.path.dirname(tmp), d['buffers'][0]['uri'])
        d['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(open(b, 'rb').read()).decode()
        json.dump(d, open(path, 'w'), separators=(',', ':')); os.remove(tmp); os.remove(b)
    s = stats(); s['file_kb'] = os.path.getsize(path) // 1024; s['path'] = path
    print('EXPORT', json.dumps(s)); return s
