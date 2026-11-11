"""Downloads CC0 models from Poly Haven and prepares them for the game.

    python3 tools/fetch_polyhaven.py assets/models name=asset_id [name=asset_id ...] [--tris 6000] [--tex 512]

For each asset: fetch the 1k glTF, import it into Blender, drop the metal/roughness maps, decimate to the triangle
budget, shrink textures, join into one object named <name>, and write <out>/<name>/<name>.json (glTF with the buffer
embedded) plus JPEG textures.
"""
import sys, os, json, base64, shutil, tempfile, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.claude', 'skills', 'blender-modeling', 'scripts'))
from bl_helpers import *

a = sys.argv[1:]
opt = lambda k, d: int(a[a.index(k) + 1]) if k in a else d
TRIS, TEX = opt('--tris', 6000), opt('--tex', 512)
OUT = a[0]; items = [x.split('=') for x in a[1:] if '=' in x]
UA = {'User-Agent': 'asset-fetch/1.0'}
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120).read()

for name, asset in items:
    tmp = tempfile.mkdtemp()
    g = json.loads(get('https://api.polyhaven.com/files/' + asset))['gltf']['1k']['gltf']
    open(os.path.join(tmp, asset + '.gltf'), 'wb').write(get(g['url']))
    for rel, f in g['include'].items():
        p = os.path.join(tmp, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'wb').write(get(f['url']))
    reset(); bpy.ops.import_scene.gltf(filepath=os.path.join(tmp, asset + '.gltf'))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.visible_get()]
    for o in list(bpy.context.scene.objects):
        if o not in meshes and o.type != 'EMPTY': bpy.data.objects.remove(o, do_unlink=True)
    ob = join(meshes, name)
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.context.scene.objects):
        if o is not ob: bpy.data.objects.remove(o, do_unlink=True)
    # keep base colour and normal only: constant roughness, no metal map
    for m in ob.data.materials:
        if not m or not m.node_tree: continue
        bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf: continue
        for inp in ('Metallic', 'Roughness'):
            for l in list(bsdf.inputs[inp].links): m.node_tree.links.remove(l)
        bsdf.inputs['Metallic'].default_value = 0.0; bsdf.inputs['Roughness'].default_value = 0.7
    ob.data.calc_loop_triangles(); n = len(ob.data.loop_triangles)
    if n > TRIS:
        d = ob.modifiers.new('dec', 'DECIMATE'); d.ratio = TRIS / n; apply_modifiers(ob)
    for img in bpy.data.images:
        if img.size[0] > TEX: img.scale(TEX, TEX)
    # stand on the floor, centred
    xs = [v.co for v in ob.data.vertices]; lo = min(v.z for v in xs); cx = (min(v.x for v in xs) + max(v.x for v in xs)) / 2; cy = (min(v.y for v in xs) + max(v.y for v in xs)) / 2
    for v in ob.data.vertices: v.co.x -= cx; v.co.y -= cy; v.co.z -= lo
    d = os.path.join(OUT, name); shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    path = os.path.join(d, name + '.gltf')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLTF_SEPARATE', export_animations=False, export_yup=True, export_apply=True,
                              export_image_format='JPEG', export_jpeg_quality=82, export_texture_dir='textures')
    j = json.load(open(path)); b = os.path.join(d, j['buffers'][0]['uri'])
    j['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(open(b, 'rb').read()).decode()
    json.dump(j, open(os.path.join(d, name + '.json'), 'w'), separators=(',', ':')); os.remove(path); os.remove(b)
    s = stats([ob]); kb = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(d) for f in fs) // 1024
    print('FETCHED', name, asset, 'tris', n, '->', s['tris'], 'size', s['size_m'], 'kb', kb)
    shutil.rmtree(tmp, ignore_errors=True)
