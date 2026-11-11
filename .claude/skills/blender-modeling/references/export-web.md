# Exporting for games and the web (glTF, three.js)

## Budgets (mobile browser, adjust up for desktop)

| Asset | Triangles | Notes |
|---|---|---|
| Crowd character (20+ on screen) | 3k to 8k | one skinned mesh, one material |
| Hero character or first-person weapon | 10k to 25k | detail where the camera is |
| Small prop | 300 to 3k | |
| Large environment piece | 2k to 10k | |

Draw calls matter more than triangles: join static parts and share materials. One skinned mesh with vertex colours is one draw call; a character made of 13 separate parts is 13. Keep bones under about 60 and at most 4 weights per vertex (the exporter truncates and warns, which is fine).

Reduce with a Decimate modifier (`COLLAPSE`, ratio 0.3 to 0.6) only after the look is right, and re-render: decimation ruins bevel highlights first.

## Export

```python
export_glb('assets/models/thing/thing.glb')                       # normal case
export_glb('assets/models/thing/thing.json', embed_json=True)     # hosts that refuse binary files
```

`export_glb` prints triangles, bounding size and file size. It exports NLA tracks as named clips, skins, and the active vertex-colour layer as `COLOR_0`. The messages about Draco and MeshOptimizer libraries missing are harmless.

Then run `preview.py` on the exported file. It catches the failures that only appear after export: missing colours, wrong up-axis, unapplied scale, lost animations.

## Loading in three.js

- `GLTFLoader` for `.glb`. For the embedded `.json` variant, fetch the JSON, decode `buffers[0].uri` from base64, wrap JSON and binary into a GLB `ArrayBuffer`, and call `loader.parse(buffer, basePath, onLoad)`. This avoids `fetch()` of `data:` URIs, which strict content-security policies block.
- Vertex colours: `new THREE.MeshLambertMaterial({ vertexColors: true })` (or Standard). The exporter writes linear colours, which is what three.js expects.
- Skinned meshes: clone with `SkeletonUtils.clone(scene)`, never `scene.clone()`, or every copy shares one skeleton. Set `frustumCulled = false` on skinned meshes or they vanish when the rest-pose bounds leave the view.
- Animation: one `AnimationMixer` per clone, `mixer.clipAction(clip)`; blend clips with `setEffectiveWeight` and match playback speed to movement speed with `timeScale`.
- To hide a body part of a single skinned mesh (a destroyed limb, a headshot), scale its bone to 0.01.
- Imported PBR materials look black without an environment map. Either add one or convert to Lambert on load, keeping `map` and `normalMap`.
- Orientation: after export the model faces +Z and stands on Y=0. A first-person view model usually needs `rotation.y = Math.PI` or `Math.PI / 2` depending on how the source was built; decide once and write it down next to the loader.

## Textures instead of vertex colours

When a model needs sharper surface detail than its vertices allow, unwrap (`bpy.ops.uv.smart_project`) and bake with Cycles to an image (`bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})` into an active Image Texture node), save as JPEG at 512 or 1024, and reference it from the material's Base Color. Baking adds minutes; use it for hero assets, not crowds.
