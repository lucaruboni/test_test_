# Hard-surface modelling (weapons, tools, machines, props, architecture)

## Recipe

1. Dimension table first. List each major part with real sizes in metres and where it attaches. For a firearm: overall length, barrel length and diameter, receiver height and width, stock length and drop, grip angle (usually 15 to 20 degrees back), magazine size and angle, sight height. Get these from reference, not from feel.
2. Block each part with `box()` / `cylinder()` from `bl_helpers`. One object per real part: receiver, barrel, handguard, stock, grip, magazine, sights, bolt, trigger guard. Real objects are assemblies, and separate parts give free seams.
3. Shape the primary forms:
   - Taper with a simple scale of one end's vertices (bmesh) or `radius2` on cylinders.
   - Cut with `boolean(ob, cutter)`: ejection ports, vents, lightening slots, trigger guard opening, magazine well. Cuts are what make a block read as manufactured.
   - Curved parts (magazine, stock comb, handles): build a straight part with several segments along its length and bend with a Simple Deform modifier (`BEND`), or sweep a profile along a curve object.
4. Secondary forms: rails (a row of small boxes via Array modifier), ribs and grooves (Array + boolean), panel steps (inset then extrude a few millimetres), pins and screws (short cylinders, slightly sunk), sling loops, charging handle, selector lever.
5. `hard_surface_finish(ob, bevel=...)` on every part. Choose the width per material (see SKILL.md). If a bevel explodes, the mesh has overlapping or zero-area faces: merge by distance (`bmesh.ops.remove_doubles`) first, or lower the width.
6. Materials: three or four at most (steel, polymer, wood, accent). Use `flat_material()` with sensible roughness (blued steel 0.35 to 0.5, polymer 0.6 to 0.8, oiled wood 0.5) and metallic 1.0 only for bare metal. For game use, vertex-colour wear is cheap: lighten vertices whose normal differs a lot from their neighbours (edges), darken those facing down or inside cuts.
7. `join()` parts that never move; keep moving parts (magazine, bolt, slide) separate and named, so the game can animate them.

## Checks specific to hard surface

- Parallel things are parallel, concentric things concentric. Bore, barrel and sights share an axis.
- No part floats or z-fights: either overlap by a millimetre or leave a visible 1 to 2 mm gap.
- Cylinders have enough segments for their size on screen: 12 for small pins, 24 to 32 for barrels seen in first person.
- First-person weapons are seen from behind and above at close range. Put the detail budget on the rear half, top and right side; the muzzle end can be simpler.
- Shade smooth plus weighted normals should give flat faces with crisp, lit edges. Grey gradients across a flat face mean missing bevels or normals not weighted.

## Useful modifier stack order

Mirror, Array, Boolean, Solidify, Bevel, Weighted Normal. Bevel after booleans, weighted normal last.
