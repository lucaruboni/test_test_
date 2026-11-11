---
name: blender-modeling
description: Create, improve, rig, animate and export 3D models with Blender driven from Python (headless bpy), working the way a senior Blender artist does - reference and proportions first, blockout, then primary/secondary/tertiary forms, bevels and clean shading, then a rendered preview that is actually looked at before anything ships. Use this skill whenever a task needs a 3D asset or a better-looking one - game characters, creatures, weapons, props, vehicles, environment pieces, rigged or animated models, glTF/GLB for three.js or any web/mobile game - and whenever someone says a model looks blocky, cheap, low-poly, "like placeholder art", or asks to sculpt, model, remodel, rig, animate, bake, retopologise, optimise or convert a mesh, even if they never say "Blender". Also use it before writing procedural geometry by hand in three.js or similar, because Blender output is almost always better.
---

# Blender modelling, headless

You drive Blender through its Python module and never see a viewport, so two habits decide the quality of the result: **model the way a professional does** (form before detail) and **render and look at your work** (you cannot judge a mesh from its vertex count).

## Setup

```bash
SK=<this skill's folder>
export PYTHONPATH="$(bash $SK/scripts/ensure_bpy.sh)"   # installs bpy (~430 MB) on first use
python3 your_model.py                                   # a plain Python script that imports bpy
```

`scripts/bl_helpers.py` holds the building blocks used below (scene reset, primitives without `bpy.ops` context problems, bevel + weighted normals, booleans, skin-modifier figures, vertex painting, armatures, pose keying, clips, stats, export). Import it instead of rewriting them:

```python
import sys; sys.path.insert(0, f'{SK}/scripts'); from bl_helpers import *
```

Write each asset as its own generator script and keep it in the project (for example `tools/make_<asset>.py`). The script is the source file: it makes the model reproducible and lets the next change be a small edit rather than a restart.

## The workflow

Work in passes and render between them. Resist adding detail to a shape whose proportions are wrong: no amount of bevels rescues a bad silhouette.

1. **Brief and reference.** Write down, in a comment at the top of the script, what the object is, its real-world dimensions in metres, the 3 to 5 features that make it recognisable, the style (realistic, stylised, low-poly) and the budget (triangles, texture size, file size). If you do not know the real proportions, look them up or reason from known parts (a hand is about 19 cm, a door 2 m, a rifle about 1 m). Use real scale: 1 Blender unit = 1 metre.
2. **Blockout.** Rough the whole object in a handful of primitives. Render. Judge only silhouette and proportion, ideally with `--clay`. Fix here, where fixes are cheap.
3. **Primary forms.** Replace blocks with the real big shapes: tapers, curves, the main cuts. Most of the perceived quality lives in this step.
4. **Secondary forms.** Medium details that explain how the thing is built or works: panels, seams, grips, joints, folds, muscles groups, straps, the magazine, the hinge.
5. **Tertiary detail.** Small stuff, sparingly and grouped: screws, scratches, stitches, pores. Leave resting areas plain. Detail everywhere reads as noise; detail clustered where the eye should go reads as craft.
6. **Surface.** Bevel hard edges, fix shading, assign materials or paint. Break up uniformity: no real surface is one flat colour.
7. **Rig and animate** if needed. See `references/characters.md`.
8. **Export, measure, preview the exported file.** Always preview the file you will ship, not the scene that produced it.

### Principles that separate good models from placeholder art

- **Silhouette first.** Fill the object black in your mind. If it is not recognisable, add or exaggerate the defining shapes before anything else.
- **Nothing in the real world has a perfectly sharp edge.** A bevel catches a highlight and that highlight is what makes an object look solid. `hard_surface_finish()` adds a small bevel plus weighted normals; use it on every hard-surface part. Edge width follows material: 1 to 2 mm machined metal, 3 to 6 mm cast or moulded parts, more for worn wood and stone.
- **Big, medium, small.** Aim for a mix of large calm areas, medium structures and a few small accents, roughly 70/25/5. Equal-sized detail everywhere looks artificial.
- **Break symmetry and perfection.** Model symmetric, then offset: a tilted strap, a dent, one sleeve torn, slight rotation on stacked parts, noise displacement of a millimetre or two on organic surfaces.
- **Things have thickness and joins.** Plates have edges, clothes sit on top of bodies, parts overlap or have a visible gap. Intersecting two primitives without a seam, fillet or gap is the most common tell of generated geometry.
- **Taper and curve.** Limbs, barrels, handles, legs of furniture almost never have constant cross-section. A 5 to 15 percent taper costs nothing.
- **Gesture for living things.** Give a character a line of action: weight on one leg, spine curve, head offset. A character modelled standing straight looks like a mannequin even when the anatomy is right.
- **Topology serves deformation.** Anything that bends needs edge loops around the bend (three at elbows and knees). Static props can be triangles and n-gons as long as shading is clean.
- **Colour carries form.** Darken crevices and undersides, lighten raised and worn edges, vary hue slightly across large areas. With vertex colours this is a few lines and it replaces an ambient-occlusion bake.

## Look at your work

```bash
python3 $SK/scripts/preview.py model.glb /path/preview.png [--clay] [--size 512] [--samples 24] [--clip walk --frame 7]
```

This renders a six-view contact sheet (front, three-quarter, side, back, top, upper detail) with Cycles on the CPU in a few seconds, and prints triangle count, bounding size and the lowest point. Then **open the PNG with the Read tool and critique it** as an art director would. Ask, in this order:

1. Is the silhouette recognisable from each view? Are proportions right against the reference numbers?
2. Do the big forms have taper, curve and weight, or are they extruded boxes and tubes?
3. Is there a clear big/medium/small hierarchy? Where does the eye land?
4. Shading: any faceting, dark smears, pinching, inverted faces (black patches), gaps or floating parts?
5. Does it sit on the ground (`min_z` near 0), face the right way, and measure what it should in metres?
6. For animated models: render two or three frames per clip and check poses from the side as well as the front. A wrong rotation axis is invisible from the front.

Write down the two or three worst problems and fix those, then render again. Expect three to five rounds for a good asset. Stop when the remaining issues would not be noticed at the size the model is seen in use. Do not report a model as finished, or describe how it looks, from statistics alone.

## Choosing a technique

| Subject | Start with | Read |
|---|---|---|
| Weapons, tools, machines, vehicles, furniture, architecture | primitives, booleans, bevel + weighted normals | `references/hard-surface.md` |
| People, creatures, limbs, plants, cloth, rocks | skin-modifier figure or metaballs, subdivision, displacement, vertex paint | `references/characters.md` |
| Anything going into a game or web page | budgets, glTF export, embedded JSON, three.js loading | `references/export-web.md` |

Read the reference for the kind of asset you are making before writing the generator. They contain the specific recipes and the pitfalls already paid for.

## Things that bite in headless Blender

- `bpy.ops.wm.read_factory_settings(use_empty=True)` first (`reset()`), otherwise the default cube ends up in the export.
- Many `bpy.ops` need an active, selected object and the right mode. Use `activate(ob)` before modifier or mode operators, or use `bmesh`/data APIs that need no context.
- Apply modifiers before reading final geometry, painting vertices or binding to a rig; the base mesh is not what you see.
- The Python module ships without Draco and meshopt: the exporter logs errors about them and still exports correctly. Do not enable compression.
- Blender is Z-up and models face -Y. glTF export converts to Y-up with the front on +Z. Build in Blender's convention and let the exporter convert.
- EEVEE needs a GPU. Use Cycles on the CPU with low samples for previews; it is fast enough.
- Blender's API moves between versions. When an operator rejects a keyword, print `bpy.app.version_string`, check the operator's properties (`bpy.ops.export_scene.gltf.get_rna_type().properties.keys()`), adapt, and prefer data-API calls that are stable.

## Reporting

Tell the person what was built and what it still is not, in plain terms: what you verified by looking at renders, the triangle count and file size, and the honest gap to hand-made art (for example no fingers, no facial features, vertex colours instead of textures). Attach or show the preview sheet when you can.
