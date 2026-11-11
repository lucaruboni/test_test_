"""Builds the game's guns, perk vending machines and set-dressing props with Blender.

    python3 tools/make_assets.py assets/models [preview_dir]

Brief
- Guns: 15 first-person weapons, each its own node in guns/guns.json. Built in view-model units
  (roughly metres), barrel toward +Y in Blender (so -Z after glTF export), origin at the rear of the receiver.
- Vending machines: five Asian street-food machines (noodle cups, bento, onigiri, steamed buns, canned tea),
  1.1 x 0.85 x 2.3 m, front on -Y. Original design, no real brands. The "accent" material is tinted per perk in game;
  materials whose name starts with "glow" are drawn unlit so the lit window reads in the dark.
- Props: barrels, bench, crate stack, luggage pile, luggage trolley. Each fits inside one 2.5 m map cell.
Budgets: guns under 4k triangles, machines under 9k, props under 4k.
"""
import sys, os, math, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.claude', 'skills', 'blender-modeling', 'scripts'))
from bl_helpers import *
import bmesh

args = [a for a in sys.argv[1:] if not a.startswith('-')]
OUT = args[0]; PREVIEW = args[1] if len(args) > 1 else None
random.seed(11)
MATS = {}
def M(name, color=(0.5, 0.5, 0.5), rough=0.6, metal=0.0):
    if name not in MATS: MATS[name] = flat_material(name, color, rough, metal)
    return MATS[name]


class Kit:
    """Collects parts, then joins and bevels them into one object with a few materials."""
    def __init__(self): self.parts = []
    def _add(self, ob, mat, rot=None):
        ob.data.materials.append(mat)
        if rot: ob.rotation_euler = rot
        self.parts.append(ob); return ob
    def box(self, size, loc, mat, rot=None, taper=None):
        ob = box('p', size, loc)
        if taper:  # (axis index, +1/-1 end, scale x, scale z) : shrink one end of the box
            ax, end, s1, s2 = taper
            others = [i for i in range(3) if i != ax]
            for v in ob.data.vertices:
                if v.co[ax] * end > 0: v.co[others[0]] *= s1; v.co[others[1]] *= s2
        return self._add(ob, mat, rot)
    def cyl(self, r, depth, loc, mat, axis='Z', seg=20, r2=None, rot=None):
        ob = cylinder('p', r, depth, loc, axis, seg, r2)
        if rot: ob.rotation_euler = rot
        ob.data.materials.append(mat); self.parts.append(ob); return ob
    def sphere(self, r, loc, mat, scale=(1, 1, 1), seg=14):
        me = bpy.data.meshes.new('p'); bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg // 2), radius=r)
        bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new('p', me); ob.location = loc; ob.scale = scale
        bpy.context.scene.collection.objects.link(ob); return self._add(ob, mat)
    def cut(self, target, size, loc):
        c = box('cut', size, loc); boolean(target, c)
    def finish(self, name, bevel=0.004, segments=2):
        ob = join(self.parts, name)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        hard_surface_finish(ob, bevel=bevel, segments=segments)
        return ob


# =====================================================================================================
# GUNS. Spec values follow src/models.js (len, receiver, height, width, barrel radius, parts).
# =====================================================================================================
G = {
    'vesper':   dict(len=0.25, rec=0.20, h=0.055, w=0.038, br=0.011, grip='wood', sight=1, pistol=1),
    'tercet':   dict(len=0.24, rec=0.20, h=0.060, w=0.042, br=0.011, grip='poly', sight=1, pistol=1, mag=('grip', 0.2, 0.04)),
    'magnate':  dict(len=0.30, rec=0.10, h=0.07, w=0.045, br=0.014, drum=0.032, grip='wood', sight=1, pistol=1),
    'warden':   dict(len=0.80, rec=0.26, h=0.075, w=0.05, br=0.012, stock='wood', guard=('wood', 0.3), mag=('straight', 0.09, 0.05), sight=1),
    'sawtooth': dict(len=0.66, rec=0.16, h=0.07, w=0.06, br=0.015, double=1, stock='wood', guard=('wood', 0.2)),
    'hornet':   dict(len=0.46, rec=0.24, h=0.085, w=0.05, br=0.012, stock='poly', guard=('poly', 0.16), mag=('curved', 0.2, 0.035), grip='poly', sight=1),
    'kestrel':  dict(len=0.72, rec=0.26, h=0.08, w=0.05, br=0.012, stock='wood', guard=('wood', 0.2), mag=('curved', 0.24, 0.06), grip='wood', gas=1, sight=1),
    'bulldog':  dict(len=0.78, rec=0.22, h=0.075, w=0.05, br=0.016, stock='wood', tube=1, pump=1, sight=1),
    'viper':    dict(len=0.34, rec=0.26, h=0.09, w=0.055, br=0.012, stock='fold', mag=('grip', 0.24, 0.04), grip='poly', sight=1),
    'trident':  dict(len=0.82, rec=0.28, h=0.08, w=0.05, br=0.012, stock='poly', guard=('poly', 0.24), mag=('straight', 0.16, 0.06), grip='poly', carry=1, sight=1),
    'anvil':    dict(len=0.86, rec=0.34, h=0.11, w=0.07, br=0.016, stock='poly', guard=('steel', 0.26), mag=('box', 0.12, 0.12), grip='poly', bipod=1, sight=1),
    'longbow':  dict(len=1.05, rec=0.36, h=0.10, w=0.06, br=0.017, stock='poly', guard=('steel', 0.2), mag=('straight', 0.12, 0.1), grip='poly', scope=1, bipod=1, brake=1),
    'reaper':   dict(len=0.62, rec=0.38, h=0.12, w=0.075, br=0.02, stock='poly', mag=('drum', 0.08, 0.1), grip='poly', carry=1),
    'talon':    dict(len=0.50, rec=0.26, h=0.09, w=0.055, br=0.012, stock='fold', guard=('poly', 0.16), mag=('curved', 0.2, 0.055), grip='poly', carry=1),
    'arc':      dict(len=0.50, rec=0.30, h=0.13, w=0.10, br=0.03, stock='poly', grip='poly', glow=1),
}

def build_gun(gid, s):
    k = Kit()
    mat = {'steel': M('gun_steel', (0.055, 0.058, 0.065), 0.42, 1.0), 'poly': M('gun_poly', (0.022, 0.023, 0.026), 0.7), 'wood': M('gun_wood', (0.22, 0.105, 0.04), 0.5),
           'worn': M('gun_worn', (0.16, 0.165, 0.175), 0.35, 1.0), 'brass': M('gun_brass', (0.55, 0.38, 0.12), 0.4, 1.0), 'glow': M('glow_arc', (0.2, 0.85, 1.0)), 'lens': M('glow_lens', (0.05, 0.16, 0.3))}
    # helpers in the game's convention: x right, y up, z back. Blender: (x, -z, y), box size (w, l, h).
    def B(w, h, l, m, x, y, z, rx=0.0, taper=None): return k.box((w, l, h), (x, -z, y), mat[m], rot=(rx, 0, 0) if rx else None, taper=taper)
    def C(r, l, m, x, y, z, r2=None, seg=16): return k.cyl(r, l, (x, -z, y), mat[m], 'Y', seg, r2)
    L, rec, h, w, br = s['len'], s['rec'], s['h'], s['w'], s['br']; bl = L - rec; by = h * 0.18
    pistol = s.get('pistol')
    # receiver: lower body and a slightly narrower upper, so the side has a step line
    body = B(w, h * 0.62, rec, 'steel', 0, -h * 0.19, -rec / 2)
    B(w * 0.9, h * 0.42, rec * (1.0 if pistol else 0.96), 'worn' if pistol else 'steel', 0, h * 0.29, -rec / 2 - (0.0 if pistol else rec * 0.02))
    if not pistol:
        B(w * 0.5, h * 0.1, rec * 0.86, 'poly', 0, h / 2 + h * 0.04, -rec / 2)                 # top rail
        for i in range(int(rec * 0.86 / 0.02)): B(w * 0.62, h * 0.05, 0.008, 'poly', 0, h / 2 + h * 0.1, -rec * 0.08 - i * 0.02)
    B(w * 0.2, h * 0.2, rec * 0.22, 'poly', w * 0.46, h * 0.22, -rec * 0.55)                    # ejection port
    B(w * 0.3, h * 0.12, 0.03, 'worn', w * 0.56, h * 0.26, -rec * 0.32)                         # charging handle / slide stop
    # barrel(s)
    if s.get('double'):
        for sx in (-1, 1): C(br, bl, 'steel', sx * br, by, -rec - bl / 2); C(br * 0.7, 0.004, 'poly', sx * br, by, -L - 0.001)
        B(br * 0.5, br * 0.6, bl * 0.9, 'steel', 0, by + br * 0.9, -rec - bl * 0.5)
    else:
        C(br, bl, 'steel', 0, by, -rec - bl / 2); C(br * 1.25, 0.02, 'steel', 0, by, -L + 0.012); C(br * 0.6, 0.004, 'poly', 0, by, -L - 0.001)
    if pistol and not s.get('drum'): B(w * 0.86, h * 0.42, bl + 0.01, 'worn', 0, h * 0.29, -rec - bl / 2 + 0.005)   # slide runs to the muzzle
    if s.get('tube'): C(br * 0.85, bl * 0.8, 'steel', 0, by - br * 2.1, -rec - bl * 0.4); C(br * 0.95, 0.015, 'worn', 0, by - br * 2.1, -rec - bl * 0.8)
    if s.get('gas'): C(br * 0.8, bl * 0.55, 'steel', 0, by + br * 2.1, -rec - bl * 0.3); B(br * 1.6, br * 3.4, 0.02, 'steel', 0, by + br, -rec - bl * 0.58)
    if s.get('pump'):
        C(br * 2.0, bl * 0.3, 'wood', 0, by - br * 1.6, -rec - bl * 0.4, seg=12)
        for i in range(5): C(br * 2.12, 0.006, 'wood', 0, by - br * 1.6, -rec - bl * 0.3 - i * bl * 0.05, seg=12)
    if s.get('guard'):
        m, gl = s['guard']; B(w * 0.95, h * 0.78, gl, m, 0, by - h * 0.12, -rec - gl / 2, taper=(1, 1, 0.82, 0.82))
        if m != 'wood':
            for i in range(4):
                for sx in (-1, 1): B(w * 0.06, h * 0.16, gl * 0.13, 'poly', sx * w * 0.47, by, -rec - gl * (0.2 + i * 0.2))  # vent slots
    if s.get('brake'): B(br * 3.6, br * 2.6, 0.075, 'steel', 0, by, -L - 0.02); B(br * 3.7, br * 1.0, 0.016, 'poly', 0, by, -L - 0.005); B(br * 3.7, br * 1.0, 0.016, 'poly', 0, by, -L - 0.035)
    if s.get('drum'):
        C(s['drum'], 0.07, 'worn', 0, by - 0.005, -rec * 0.5, seg=12)
        for i in range(6):
            a = i * math.pi / 3; C(0.006, 0.072, 'poly', math.cos(a) * s['drum'] * 0.95, by - 0.005 + math.sin(a) * s['drum'] * 0.95, -rec * 0.5, seg=6)
        B(0.012, 0.03, 0.02, 'steel', 0, h * 0.52, 0.0, 0.5)                                    # hammer
    if s.get('sight'):
        B(0.007, 0.026, 0.01, 'steel', 0, by + br + 0.014, -L + 0.03)
        for sx in (-1, 1): B(0.008, 0.018, 0.012, 'steel', sx * 0.011, h / 2 + h * 0.18, -0.035)
    if s.get('carry'):
        B(0.016, 0.028, rec * 0.66, 'poly', 0, h / 2 + 0.052, -rec * 0.5)
        for z in (0.2, 0.8): B(0.016, 0.045, 0.022, 'poly', 0, h / 2 + 0.024, -rec * z)
    if s.get('scope'):
        sl, sr, sy, sz = 0.3, 0.024, h / 2 + 0.05, -rec * 0.45
        C(sr, sl * 0.5, 'poly', 0, sy, sz); C(sr * 1.4, sl * 0.22, 'poly', 0, sy, sz - sl * 0.36, r2=sr); C(sr * 1.25, sl * 0.2, 'poly', 0, sy, sz + sl * 0.35)
        C(sr * 1.25, 0.004, 'lens', 0, sy, sz - sl * 0.475); B(0.014, 0.03, 0.03, 'steel', 0, sy - sr - 0.01, sz - 0.05); B(0.014, 0.03, 0.03, 'steel', 0, sy - sr - 0.01, sz + 0.05)
        C(0.012, 0.02, 'poly', 0.0, sy + sr + 0.006, sz, seg=8).rotation_euler = (0, 0, 0)
    if s.get('bipod'):
        for sx in (-1, 1): B(0.009, 0.009, 0.22, 'steel', sx * 0.022, by - br - 0.014, -rec - bl * 0.5); B(0.014, 0.014, 0.02, 'poly', sx * 0.022, by - br - 0.014, -rec - bl * 0.5 - 0.11)
    # trigger group
    if not s.get('stock') == 'wood' or s.get('grip'):
        pass
    tg = -0.075 if not pistol else -0.07
    B(w * 0.35, 0.008, 0.07, 'steel', 0, -h / 2 - 0.036, tg); B(w * 0.35, 0.036, 0.008, 'steel', 0, -h / 2 - 0.018, tg - 0.035)
    B(w * 0.2, 0.026, 0.008, 'worn', 0, -h / 2 - 0.016, tg + 0.008, -0.25)
    if s.get('grip'):
        gm = s['grip']; B(w * 0.78, 0.125, 0.055, gm, 0, -h / 2 - 0.055, -0.03, 0.3, taper=(2, -1, 0.9, 0.85))
        if gm == 'wood':
            for sx in (-1, 1): B(w * 0.08, 0.085, 0.04, 'steel', sx * w * 0.4, -h / 2 - 0.055, -0.03, 0.3)
    st = s.get('stock')
    if st == 'wood':
        B(w * 0.86, h * 0.9, 0.17, 'wood', 0, -h * 0.25, 0.075, -0.22, taper=(1, -1, 0.9, 1.0)); B(w * 0.86, h * 1.3, 0.2, 'wood', 0, -h * 0.52, 0.245, -0.1, taper=(1, 1, 1.0, 0.8))
        B(w * 0.9, h * 1.36, 0.012, 'poly', 0, -h * 0.57, 0.35, -0.1)
    elif st == 'poly':
        B(w * 0.8, h * 0.6, 0.15, 'poly', 0, 0, 0.07); B(w * 0.8, h * 1.3, 0.14, 'poly', 0, -h * 0.25, 0.2, taper=(1, 1, 1.0, 0.75)); B(w * 0.84, h * 1.34, 0.012, 'steel', 0, -h * 0.25, 0.275)
    elif st == 'fold':
        for sx in (-1, 1): B(0.01, 0.012, 0.26, 'steel', sx * w * 0.4, h * 0.15, 0.13)
        B(w, h * 0.9, 0.016, 'poly', 0, -h * 0.1, 0.262)
    if s.get('mag'):
        t, ml, md = s['mag']; mz = -rec * 0.55
        if t == 'straight': B(w * 0.6, ml, md, 'steel', 0, -h / 2 - ml / 2, mz, 0.08); B(w * 0.66, 0.012, md * 1.05, 'poly', 0, -h / 2 - ml, mz + 0.004, 0.08)
        elif t == 'curved':
            n = 4
            for i in range(n):  # segments along an arc
                a = 0.1 + i * 0.13; B(w * 0.6, ml / n * 1.25, md, 'steel', 0, -h / 2 - ml * (i + 0.5) / n, mz - md * 0.9 * (i / n) ** 2 * 1.6, a)
            B(w * 0.66, 0.012, md * 1.05, 'poly', 0, -h / 2 - ml * 1.0, mz - md * 1.45, 0.55)
        elif t == 'grip': B(w * 0.55, ml, md, 'steel', 0, -h / 2 - ml / 2, -0.04, 0.3)
        elif t == 'box':
            B(w * 1.1, ml, md, 'poly', -w * 0.75, -h * 0.3, mz); B(w * 1.14, 0.014, md * 1.04, 'steel', -w * 0.75, -h * 0.3 + ml / 2, mz)
            for i in range(5): C(0.006, 0.03, 'brass', -w * 0.25 + i * 0.012, h * 0.24, mz, seg=6)
        elif t == 'drum':
            d = k.cyl(md, ml, (0, -mz, -h / 2 - md * 0.8), mat['poly'], 'X', 18); d2 = k.cyl(md * 0.45, ml * 1.06, (0, -mz, -h / 2 - md * 0.8), mat['steel'], 'X', 12)
    if s.get('glow'):
        B(w * 1.08, h * 0.45, 0.1, 'glow', 0, 0, -rec); C(br * 0.6, bl, 'glow', 0, by, -rec - bl / 2)
        for i in range(4): C(br * 1.5, 0.014, 'steel', 0, by, -rec - bl * (0.15 + i * 0.25))
        for sx in (-1, 1): B(0.008, h * 0.5, rec * 0.6, 'glow', sx * w * 0.5, -h * 0.05, -rec * 0.5)
    return k.finish(gid, bevel=0.0028, segments=1)


# =====================================================================================================
# VENDING MACHINES
# =====================================================================================================
FOOD = {
    'wind':  ('cup',     [(0.95, 0.25, 0.15), (0.98, 0.8, 0.2), (0.2, 0.55, 0.9), (0.95, 0.95, 0.9)]),
    'hide':  ('bento',   [(0.75, 0.12, 0.1), (0.1, 0.1, 0.1), (0.9, 0.75, 0.3), (0.3, 0.6, 0.25)]),
    'hands': ('onigiri', [(0.96, 0.96, 0.92), (0.2, 0.7, 0.4), (0.95, 0.5, 0.45), (0.9, 0.85, 0.5)]),
    'twin':  ('bao',     [(0.97, 0.93, 0.85), (0.95, 0.75, 0.6), (0.85, 0.9, 0.7), (0.98, 0.85, 0.5)]),
    'pack':  ('can',     [(0.25, 0.7, 0.35), (0.9, 0.2, 0.25), (0.95, 0.8, 0.2), (0.3, 0.45, 0.85), (0.9, 0.9, 0.9)]),
}

def build_vending(pid):
    kind, palette = FOOD[pid]; k = Kit()
    body, accent, dark, steel = M('vm_body', (0.78, 0.76, 0.7), 0.45), M('accent', (0.8, 0.8, 0.8), 0.4), M('vm_dark', (0.03, 0.03, 0.035), 0.5), M('vm_steel', (0.45, 0.46, 0.48), 0.3, 1.0)
    roof, gold, glowp, nori = M('vm_roof', (0.32, 0.04, 0.035), 0.55), M('vm_gold', (0.75, 0.55, 0.15), 0.35, 1.0), M('glow_panel', (1.0, 0.93, 0.78)), M('vm_nori', (0.03, 0.06, 0.04), 0.8)
    lantern, screen = M('glow_lantern', (1.0, 0.25, 0.1)), M('glow_screen', (0.3, 1.0, 0.6))
    items = [M('glow_item_%s_%d' % (kind, i), c) for i, c in enumerate(palette)]
    W, D, H = 1.1, 0.85, 1.9; fy = -D / 2
    k.box((W + 0.04, D + 0.04, 0.1), (0, 0, 0.05), dark)
    cab = k.box((W, D, H), (0, 0, 0.1 + H / 2), body)
    k.cut(cab, (0.68, 0.2, 1.12), (-0.16, fy, 1.32))                                        # display window
    k.cut(cab, (0.68, 0.16, 0.2), (-0.16, fy, 0.42))                                        # delivery bin
    k.box((0.66, 0.01, 1.1), (-0.16, fy + 0.095, 1.32), glowp)                              # lit back panel
    k.box((0.7, 0.03, 0.03), (-0.16, fy + 0.005, 1.89), steel); k.box((0.7, 0.03, 0.03), (-0.16, fy + 0.005, 0.75), steel)
    for sx in (-0.51, 0.19): k.box((0.03, 0.03, 1.17), (sx, fy + 0.005, 1.32), steel)
    k.box((0.64, 0.012, 0.16), (-0.16, fy + 0.02, 0.44), dark, rot=(0.25, 0, 0))            # flap
    # shelves and food
    for row in range(4):
        z = 0.84 + row * 0.27
        k.box((0.66, 0.08, 0.012), (-0.16, fy + 0.05, z), steel)
        for col in range(5):
            x = -0.16 - 0.26 + col * 0.13; m = items[(row * 2 + col) % len(items)]; y = fy + 0.05; zz = z + 0.006
            if kind == 'cup':
                k.cyl(0.036, 0.085, (x, y, zz + 0.043), m, 'Z', 10, r2=0.048); k.cyl(0.05, 0.008, (x, y, zz + 0.09), glowp, 'Z', 10)
            elif kind == 'bento':
                k.box((0.1, 0.06, 0.035), (x, y, zz + 0.018), items[1]); k.box((0.085, 0.045, 0.012), (x - 0.0, y, zz + 0.04), m)
                k.box((0.1, 0.06, 0.035), (x, y, zz + 0.058), items[0]); k.box((0.04, 0.045, 0.012), (x - 0.022, y, zz + 0.08), items[(col + 2) % 4]); k.box((0.036, 0.045, 0.012), (x + 0.024, y, zz + 0.08), glowp)
            elif kind == 'onigiri':
                k.cyl(0.058, 0.04, (x, y, zz + 0.045), m, 'Y', 3).rotation_euler = (math.pi / 2, math.pi / 6 * 0 + math.pi, 0)
                k.box((0.05, 0.046, 0.04), (x, y, zz + 0.022), nori)
            elif kind == 'bao':
                k.sphere(0.048, (x, y, zz + 0.03), m, (1, 0.8, 0.62), 10); k.sphere(0.012, (x, y, zz + 0.06), m, (1, 1, 0.7), 6)
                k.cyl(0.055, 0.006, (x, y, zz + 0.003), M('vm_wood', (0.5, 0.33, 0.15), 0.7), 'Z', 10)
            else:
                k.cyl(0.03, 0.105, (x, y, zz + 0.053), m, 'Z', 10); k.cyl(0.026, 0.006, (x, y, zz + 0.108), steel, 'Z', 10); k.box((0.062, 0.062, 0.03), (x, y, zz + 0.05), glowp)
    # control column: screen, keypad, coin slot, note slot, return cup
    cx = 0.37
    k.box((0.24, 0.012, 1.14), (cx, fy - 0.006, 1.32), dark)
    k.box((0.17, 0.008, 0.1), (cx, fy - 0.014, 1.72), screen)
    for r in range(4):
        for c in range(3): k.box((0.034, 0.012, 0.034), (cx - 0.05 + c * 0.05, fy - 0.014, 1.52 - r * 0.05), glowp if (r + c) % 4 else accent)
    k.box((0.012, 0.014, 0.06), (cx - 0.05, fy - 0.014, 1.24), steel); k.box((0.09, 0.014, 0.014), (cx + 0.03, fy - 0.014, 1.24), steel)
    k.cyl(0.045, 0.03, (cx, fy - 0.01, 1.05), steel, 'Y', 14); k.cyl(0.032, 0.034, (cx, fy - 0.012, 1.05), dark, 'Y', 12)
    k.box((0.16, 0.014, 0.07), (cx, fy - 0.014, 0.9), accent)
    # accent bands, side stripes and a kick plate
    k.box((W + 0.006, D + 0.006, 0.09), (0, 0, 0.62), accent); k.box((W + 0.006, D + 0.006, 0.05), (0, 0, 1.955), accent)
    for sx in (-1, 1):
        k.box((0.008, D * 0.7, 0.9), (sx * (W / 2 + 0.002), 0.02, 1.3), accent)
        for i in range(3): k.box((0.01, D * 0.5, 0.03), (sx * (W / 2 + 0.004), 0.02, 0.98 + i * 0.3), glowp)
    k.box((W * 0.9, 0.01, 0.12), (0, fy - 0.004, 0.24), steel)
    for i in range(9): k.box((0.02, 0.014, 0.1), (-0.4 + i * 0.1, fy - 0.006, 0.24), dark)   # grille
    # tiled eave roof with upturned corners
    rz = 0.1 + H
    k.box((W + 0.1, D + 0.1, 0.04), (0, 0, rz + 0.02), dark)
    for sy, tilt in ((-1, 0.42), (1, -0.42)):
        k.box((W + 0.34, 0.6, 0.035), (0, sy * 0.25, rz + 0.17), roof, rot=(tilt, 0, 0))
        for i in range(9): k.cyl(0.028, 0.62, (-0.62 + i * 0.155, sy * 0.25, rz + 0.195), roof, 'Y', 6, rot=(math.pi / 2 + tilt, 0, 0))
        for sx in (-1, 1): k.box((0.14, 0.12, 0.03), (sx * (W / 2 + 0.2), sy * 0.5, rz + 0.1), roof, rot=(tilt * 0.3, sx * -0.55, 0))
    k.cyl(0.04, W + 0.4, (0, 0, rz + 0.3), gold, 'X', 10)
    for sx in (-1, 1): k.sphere(0.055, (sx * (W / 2 + 0.2), 0, rz + 0.3), gold, (1, 1, 1), 10)
    # noren (fabric strips) under the eave
    for i in range(5): k.box((0.2, 0.008, 0.22 if i % 2 else 0.26), (-0.44 + i * 0.22, fy - 0.05, rz - 0.1 + (0.02 if i % 2 else 0)), accent if i % 2 == 0 else body)
    k.cyl(0.012, W + 0.06, (0, fy - 0.05, rz + 0.03), dark, 'X', 8)
    # paper lantern on a bracket
    lx = -W / 2 - 0.2
    k.box((0.26, 0.02, 0.02), (lx + 0.07, fy + 0.1, rz - 0.06), dark); k.cyl(0.004, 0.12, (lx, fy + 0.1, rz - 0.12), dark, 'Z', 6)
    k.sphere(0.11, (lx, fy + 0.1, rz - 0.3), lantern, (1, 1, 1.15), 14)
    for dz in (-0.42, -0.18): k.cyl(0.05, 0.03, (lx, fy + 0.1, rz + dz), dark, 'Z', 10)
    for i in range(6):
        a = i * math.pi / 3; k.cyl(0.004, 0.24, (lx + math.cos(a) * 0.108, fy + 0.1 + math.sin(a) * 0.108, rz - 0.3), dark, 'Z', 4)
    return k.finish('vending_' + pid, bevel=0.006, segments=1)


# =====================================================================================================
# PROPS
# =====================================================================================================
def prop_barrels():
    k = Kit(); steel = M('pr_steel', (0.3, 0.31, 0.33), 0.4, 1.0)
    def drum(x, y, col, lying=False):
        m = M('pr_drum_%d' % len(MATS), col, 0.55, 0.6); rot = (0, math.pi / 2, 0.4) if lying else None
        z = 0.3 if lying else 0.45
        k.cyl(0.29, 0.88, (x, y, z), m, 'Z', 24, rot=rot)
        for dz in (-0.15, 0.15, -0.43, 0.43):
            off = (dz * math.cos(0.4), dz * math.sin(0.4), 0) if lying else (0, 0, dz)
            k.cyl(0.302, 0.03, (x + off[0], y + off[1], z + off[2]), m if abs(dz) < 0.4 else steel, 'Z', 24, rot=rot)
        if not lying: k.cyl(0.035, 0.02, (x + 0.15, y, 0.9), steel, 'Z', 10); k.cyl(0.02, 0.02, (x - 0.12, y + 0.1, 0.9), steel, 'Z', 8)
    drum(-0.35, 0.3, (0.1, 0.22, 0.38)); drum(0.3, 0.42, (0.42, 0.1, 0.07)); drum(0.1, -0.4, (0.25, 0.3, 0.12), lying=True)
    return k.finish('prop_barrels', bevel=0.008, segments=1)

def crate(k, size, loc, rz, wood, dark):
    sx, sy, sz = size; r = (0, 0, rz); c, s_ = math.cos(rz), math.sin(rz)
    def at(dx, dy, dz): return (loc[0] + dx * c - dy * s_, loc[1] + dx * s_ + dy * c, loc[2] + dz)
    k.box((sx, sy, sz), loc, wood, rot=r)
    t = 0.035
    for dz in (-sz / 2 + t / 2, sz / 2 - t / 2):
        for dy in (-sy / 2, sy / 2): k.box((sx + 0.02, t * 0.6, t * 2), at(0, dy, dz), dark, rot=r)
        for dx in (-sx / 2, sx / 2): k.box((t * 0.6, sy + 0.02, t * 2), at(dx, 0, dz), dark, rot=r)
    for dx in (-sx / 2, sx / 2):
        for dy in (-sy / 2, sy / 2): k.box((t * 1.6, t * 1.6, sz), at(dx * 0.985, dy * 0.985, 0), dark, rot=r)
    for i in range(1, 3): k.box((sx + 0.006, sy + 0.006, 0.006), at(0, 0, -sz / 2 + sz * i / 3), dark, rot=r)

def prop_crates():
    k = Kit(); wood, dark = M('pr_wood', (0.36, 0.24, 0.12), 0.75), M('pr_wood_dark', (0.16, 0.1, 0.05), 0.8)
    crate(k, (0.9, 0.7, 0.6), (-0.3, 0.2, 0.3), 0.1, wood, dark); crate(k, (0.7, 0.6, 0.5), (0.55, -0.2, 0.25), -0.3, wood, dark)
    crate(k, (0.6, 0.5, 0.45), (-0.25, 0.15, 0.825), 0.45, wood, dark)
    return k.finish('prop_crates', bevel=0.006, segments=1)

def prop_bench():
    k = Kit(); wood, iron = M('pr_slat', (0.3, 0.17, 0.07), 0.6), M('pr_iron', (0.04, 0.045, 0.05), 0.5, 1.0)
    for sx in (-0.8, 0.8):
        k.box((0.05, 0.5, 0.05), (sx, 0, 0.42), iron); k.box((0.05, 0.05, 0.42), (sx, -0.22, 0.21), iron); k.box((0.05, 0.05, 0.9), (sx, 0.24, 0.45), iron, rot=(-0.12, 0, 0))
        k.box((0.05, 0.42, 0.04), (sx, -0.02, 0.62), iron, rot=(0.0, 0, 0)); k.box((0.07, 0.56, 0.03), (sx, 0, 0.015), iron)
    for i in range(5): k.box((1.8, 0.085, 0.03), (0, -0.2 + i * 0.1, 0.46), wood)
    for i in range(4): k.box((1.8, 0.03, 0.085), (0, 0.27 + i * 0.012, 0.56 + i * 0.1), wood, rot=(-0.12, 0, 0))
    k.box((1.6, 0.03, 0.03), (0, -0.22, 0.2), iron)
    return k.finish('prop_bench', bevel=0.005)

def suitcase(k, size, loc, rz, col, lying=False):
    m = M('pr_case_%d' % len(MATS), col, 0.6); trim, brass = M('pr_trim', (0.1, 0.06, 0.03), 0.6), M('pr_brass', (0.6, 0.45, 0.15), 0.35, 1.0)
    sx, sy, sz = size; r = (0, 0, rz); c, s_ = math.cos(rz), math.sin(rz)
    def at(dx, dy, dz): return (loc[0] + dx * c - dy * s_, loc[1] + dx * s_ + dy * c, loc[2] + dz)
    k.box(size, loc, m, rot=r); k.box((sx + 0.008, sy + 0.008, 0.012), at(0, 0, sz * 0.18), trim, rot=r)
    for dx in (-sx * 0.28, sx * 0.28): k.box((0.045, sy + 0.012, sz + 0.012), at(dx, 0, 0), trim, rot=r); k.box((0.05, 0.02, 0.04), at(dx, -sy / 2 - 0.008, sz * 0.18), brass, rot=r)
    for dx in (-sx / 2, sx / 2):
        for dy in (-sy / 2, sy / 2):
            for dz in (-sz / 2, sz / 2): k.box((0.05, 0.05, 0.05), at(dx * 0.97, dy * 0.97, dz * 0.97), brass, rot=r)
    if lying: k.box((0.16, 0.025, 0.03), at(0, -sy / 2 - 0.03, 0), trim, rot=r)
    else: k.box((0.16, 0.03, 0.025), at(0, 0, sz / 2 + 0.03), trim, rot=r)

def prop_luggage():
    k = Kit()
    suitcase(k, (1.0, 0.6, 0.5), (-0.1, 0.25, 0.25), 0.15, (0.2, 0.11, 0.05), lying=True)
    suitcase(k, (0.7, 0.45, 0.25), (-0.15, 0.22, 0.625), -0.2, (0.35, 0.08, 0.06), lying=True)
    suitcase(k, (0.6, 0.2, 0.44), (0.5, -0.4, 0.22), 0.5, (0.12, 0.2, 0.16)); suitcase(k, (0.42, 0.16, 0.3), (-0.55, -0.42, 0.15), -0.35, (0.4, 0.3, 0.14))
    return k.finish('prop_luggage', bevel=0.007, segments=1)

def prop_trolley():
    k = Kit(); iron, wood, rub = M('pr_iron', (0.04, 0.045, 0.05), 0.5, 1.0), M('pr_slat', (0.3, 0.17, 0.07), 0.6), M('pr_rubber', (0.02, 0.02, 0.02), 0.9)
    k.box((1.5, 0.8, 0.04), (0, 0, 0.3), iron)
    for i in range(6): k.box((1.46, 0.11, 0.025), (0, -0.32 + i * 0.128, 0.33), wood)
    for sx in (-0.6, 0.6):
        for sy in (-0.34, 0.34): k.cyl(0.13, 0.05, (sx, sy, 0.13), rub, 'Y', 16); k.cyl(0.06, 0.06, (sx, sy, 0.13), iron, 'Y', 10); k.box((0.04, 0.04, 0.18), (sx, sy * 0.86, 0.2), iron)
    for sy in (-0.36, 0.36): k.cyl(0.018, 0.95, (0.72, sy, 0.78), iron, 'Z', 10)
    k.cyl(0.02, 0.76, (0.72, 0, 1.25), iron, 'Y', 10); k.cyl(0.014, 0.72, (0.72, 0, 0.8), iron, 'Y', 8)
    suitcase(k, (0.8, 0.5, 0.36), (-0.2, 0.05, 0.525), 0.1, (0.22, 0.12, 0.06), lying=True); suitcase(k, (0.55, 0.38, 0.22), (-0.25, 0.0, 0.815), -0.25, (0.14, 0.2, 0.3), lying=True)
    return k.finish('prop_trolley', bevel=0.006, segments=1)


def write(name, objs, spread=None):
    """Exports the given objects as one file. Everything else in the scene is removed first."""
    for o in list(bpy.context.scene.objects):
        if o not in objs: bpy.data.objects.remove(o, do_unlink=True)
    export_glb(os.path.join(OUT, name, name + '.json'), animations=False, embed_json=True)
    if PREVIEW and spread:
        for i, o in enumerate(objs): o.location.x = (i % spread[0]) * spread[1]; o.location.y = (i // spread[0]) * spread[2]
        export_glb(os.path.join(PREVIEW, name + '_lineup.glb'), animations=False)

which = [a[2:] for a in sys.argv if a.startswith('--')] or ['guns', 'vending', 'props']
if 'guns' in which:
    reset(); MATS.clear(); write('guns', [build_gun(g, s) for g, s in G.items()], spread=(5, 0.45, 1.6))
if 'vending' in which:
    reset(); MATS.clear(); write('vending', [build_vending(p) for p in FOOD], spread=(5, 1.9, 0))
if 'props' in which:
    reset(); MATS.clear(); write('props', [prop_barrels(), prop_crates(), prop_bench(), prop_luggage(), prop_trolley()], spread=(5, 2.4, 0))
