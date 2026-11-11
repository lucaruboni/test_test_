# Characters, creatures and other organic forms

## Building the body

`skin_figure()` grows a continuous mesh from a stick figure of joints with radii, then subdivides it. It is the fastest way to a clean, riggable humanoid or creature, and a bad way to get a face or hands. Use it for the base and add detail on top.

Proportions matter more than anything else here. Adult human, in head heights (head is about 0.23 m): total 7.5 heads; crotch at half height; knees at a quarter; shoulders 2 heads wide for a man, 1.6 for a woman; elbows at the waist, wrists at the crotch, fingertips mid-thigh; neck one third of a head. Stylise by changing these ratios on purpose (bigger head and hands reads younger or cartoon; long arms and small head reads monstrous), never by accident.

Give radii as (x, y) pairs so the torso is wider than deep (about 1.6 to 1), limbs taper toward wrists and ankles, and calves and forearms bulge slightly before tapering: add an extra joint mid-limb with a larger radius. Add joints for the things a tube lacks: a chin and brow joint off the head, a heel behind the ankle, shoulder caps, chest and shoulder blades, glutes.

Build in an A-pose (arms about 45 degrees down, legs slightly apart). Automatic weights bleed between touching limbs.

Details the skin modifier cannot give, added as extra geometry then joined:
- Head: start from a UV sphere scaled to a skull (longer front to back than wide), add a jaw block, brow ridge, nose wedge, ear discs. Sunken eye sockets by pushing vertices in; eyes as separate spheres.
- Hands: a flattened palm box, four tapered finger cylinders with two joints each, a thumb rotated out. Even a mitten with a separate thumb reads far better than a ball.
- Clothing: duplicate the body region, `Solidify` outward 5 to 10 mm, cut the hem with a boolean or by deleting faces, add a collar, cuffs and a belt as torus or tube shapes. Clothes with thickness and edges are the cheapest large jump in quality.
- Hair, straps, pouches, tools: separate objects parented to the nearest bone.

Then roughen: a Displace modifier with a clouds texture at 1 to 2 cm for flesh and cloth, more for rock and bark. Remove obvious symmetry: shift one shoulder, tilt the head, lengthen a stride.

## Colour

`paint_vertices(ob, fn)` calls `fn(position, normal, index)` per vertex. Layer it the way a texture painter does:
1. Base colour by region (skin, each garment, shoes).
2. Large value variation with low-frequency noise (`mathutils.noise.noise(co * 3)`), 10 to 20 percent.
3. Fake ambient occlusion: darken where normals face down, in armpits, between legs, under the chin and in eye sockets.
4. Warm and cool shifts: redder at joints, nose, ears, knuckles; cooler and greyer for dead or sick skin.
5. Accents last: stains, blood, dirt at hems and knees, a few lighter worn patches. Keep them in clusters.
Vertex colour resolution is the mesh resolution; if a detail needs to be sharp (eyes, logos), make it geometry with its own material.

## Rigging

`make_armature(name, [(bone, head, tail, parent), ...])` then `bind(mesh, armature)`. A serviceable humanoid has: hips, spine, chest, neck, head, and per side upperarm, forearm, hand, thigh, shin, foot. Put joints exactly where the mesh bends. After binding, pose a few extreme positions and render them: collapsing elbows or stretched shoulders mean the joint is misplaced or the mesh lacks loops there.

## Animation

`key_pose(arm, frame, {bone: Matrix})` takes rotations about the armature's own X, Y, Z axes relative to the parent bone, so you never guess bone rolls. With the character facing -Y: `Rx(+a)` pitches an upright bone forward and swings a hanging limb backward; `Rz` yaws; `Ry` rolls. Arms in A-pose reach forward with `Rz(-1.35)` on the left (+X) side and `Rz(+1.35)` on the right, then `Rx(negative)` to lift.

`make_clip(arm, 'walk', 24, pose_fn)` bakes `pose_fn(k)` for k in 0..1 and stores it on an NLA track, which the exporter turns into a named clip. Make loops match at k=0 and k=1.

What makes motion read as alive:
- Offset everything. Hips lead, chest follows a few frames later, head later still. Use phase shifts in the sine terms.
- Weight: the body drops slightly on each foot contact and rises on the passing pose. Add a small vertical hip key if the rig has location keys.
- Arcs and asymmetry: arms swing opposite the legs, one side larger than the other.
- Anticipation and follow-through on actions: wind up before a strike, overshoot after it, settle.
- Characterise: a zombie drags a foot and hangs its head; a soldier is upright and quick. Decide the adjectives first and exaggerate them.

Render side and three-quarter views of several frames per clip with `preview.py --clip NAME --frame N`. Check feet do not sink below `min_z` 0 or slide badly.
