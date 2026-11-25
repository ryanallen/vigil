"""Drill 7 at Kirra Station as a 3D model, built from primitives in Blender.

    blender -b -P source/blender/kirra.py

Writes media/3d/kirra.glb: the shaft floor and walls, the drill rig (tower, gantry, motor housing, drill head and
the main bearing as its own object so the page can colour it by the job's state), work lights, and four robot
stand-ins at Bay 2 that the page walks to the drill. Units are metres, y up in the GLB. Object names are what the
page looks for: Bearing, Head, Rotor, Robot1..Robot4, Light1..Light4.
"""
import math
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'media' / '3d'
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def mat(name, color, metal=0.0, rough=0.6, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


ROCK = mat('Rock', (0.055, 0.058, 0.066), 0.35, 0.85)
STEEL = mat('Steel', (0.42, 0.44, 0.47), 1.0, 0.32)
DARK = mat('DarkSteel', (0.09, 0.1, 0.11), 0.9, 0.45)
HAZARD = mat('Hazard', (0.85, 0.55, 0.06), 0.2, 0.5)
WHITE = mat('Panel', (0.72, 0.72, 0.7), 0.1, 0.55)
BEAR = mat('BearingGlow', (0.3, 0.32, 0.35), 1.0, 0.25, (1.0, 0.25, 0.3), 3.0)
LAMP = mat('Lamp', (1, 0.85, 0.6), 0, 0.3, (1.0, 0.72, 0.4), 12.0)
BOT = mat('Robot', (0.8, 0.78, 0.72), 0.15, 0.5)
BOTY = mat('RobotYellow', (0.9, 0.62, 0.08), 0.2, 0.45)
EYE = mat('RobotLight', (1, 1, 1), 0, 0.2, (0.7, 0.9, 1.0), 8.0)


def put(obj, name, m):
    obj.name = name
    obj.data.materials.append(m)
    return obj


def cyl(name, m, r, depth, loc, rot=(0, 0, 0), verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    return put(bpy.context.object, name, m)


def box(name, m, size, loc, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return put(o, name, m)


def parent(child, par):
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()


# Blender is z up; the glTF exporter turns it to y up.
# The shaft: a floor and a ring of rough wall, open toward the camera.
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
put(bpy.context.object, 'Floor', ROCK)
bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=22, depth=26, location=(0, 0, 13), end_fill_type='NOTHING')
wall = put(bpy.context.object, 'Wall', ROCK)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.subdivide(number_cuts=6)
bpy.ops.mesh.flip_normals()
bpy.ops.object.mode_set(mode='OBJECT')
disp = wall.modifiers.new('rough', 'DISPLACE')
tex = bpy.data.textures.new('rockn', 'CLOUDS')
tex.noise_scale = 3.5
disp.texture = tex
disp.strength = 2.2
# cut away the front third so the camera sees in
cut = box('Cut', DARK, (60, 40, 40), (0, -18, 13))
bo = wall.modifiers.new('open', 'BOOLEAN')
bo.object = cut
bo.operation = 'DIFFERENCE'
dec = wall.modifiers.new('light', 'DECIMATE')
dec.ratio = 0.12
bpy.context.view_layer.objects.active = wall
for mod in list(wall.modifiers):
    bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cut)

# The rig: four legs, a gantry, a tower, the motor housing.
for i, (x, y) in enumerate([(-4, -4), (4, -4), (-4, 4), (4, 4)]):
    box(f'Leg{i}', STEEL, (0.6, 0.6, 14), (x, y, 7))
    box(f'Foot{i}', HAZARD, (1.6, 1.6, 0.4), (x, y, 0.2))
box('Gantry', DARK, (9.6, 9.6, 1.2), (0, 0, 14.4))
for z in (4.5, 9.5):
    for a, (sx, sy) in enumerate([(8.6, 0.3), (0.3, 8.6)]):
        for s in (-1, 1):
            box(f'Brace{z}{a}{s}', STEEL, (sx, sy, 0.3), (s * 4 * (a == 1), s * 4 * (a == 0), z))
box('Tower', STEEL, (2.2, 2.2, 8), (0, 0, 19))
box('Stripe', HAZARD, (2.3, 2.3, 0.5), (0, 0, 15.4))
cyl('Motor', WHITE, 2.6, 3.2, (0, 0, 12.2))

# The rotor that turns when the drill runs: shaft, bearing ring and head.
rotor = cyl('Rotor', DARK, 0.9, 10, (0, 0, 6))
bear = cyl('Bearing', BEAR, 2.0, 0.8, (0, 0, 10.2), verts=64)
bpy.ops.mesh.primitive_torus_add(major_radius=2.0, minor_radius=0.32, major_segments=48, minor_segments=8, location=(0, 0, 10.2))
race = put(bpy.context.object, 'Race', STEEL)
bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=3.2, radius2=1.0, depth=3, location=(0, 0, 1.6), rotation=(math.pi, 0, 0))
head = put(bpy.context.object, 'Head', DARK)
for k in range(16):
    a = k / 16 * math.tau
    for ring, (r, z) in enumerate([(2.6, 1.0), (1.8, 0.4)]):
        t = box(f'Tooth{k}_{ring}', STEEL, (0.35, 0.35, 0.7), (math.cos(a) * r, math.sin(a) * r, z), (0.5 * math.cos(a), 0.5 * math.sin(a), a))
        parent(t, head)
for o in (bear, race, head):
    parent(o, rotor)

# Work lights on the gantry corners.
for i, (x, y) in enumerate([(-4.6, -4.6), (4.6, -4.6), (-4.6, 4.6), (4.6, 4.6)]):
    box(f'LightHousing{i + 1}', DARK, (0.8, 0.8, 0.5), (x, y, 15.3))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.32, segments=12, ring_count=8, location=(x, y, 15.0))
    put(bpy.context.object, f'Light{i + 1}', LAMP)

# Bay 2: a hangar mouth in the wall, and four robots parked before it.
box('Bay2', DARK, (6, 3, 5), (-14, 12, 2.5), (0, 0, math.radians(-40)))
box('Bay2Stripe', HAZARD, (6.2, 3.1, 0.4), (-14, 12, 5.1), (0, 0, math.radians(-40)))
for i in range(4):
    x, y = -10 + i * 1.6, 8 - i * 1.3
    body = box(f'Robot{i + 1}', BOT, (1.2, 1.6, 0.7), (x, y, 1.2))
    for j, (lx, ly) in enumerate([(-0.5, -0.65), (0.5, -0.65), (-0.5, 0.65), (0.5, 0.65)]):
        leg = box(f'Robot{i + 1}Leg{j}', BOTY, (0.18, 0.18, 1.1), (x + lx, y + ly, 0.55))
        parent(leg, body)
    eye = box(f'Robot{i + 1}Eye', EYE, (0.9, 0.08, 0.12), (x, y - 0.82, 1.3))
    parent(eye, body)
    arm = box(f'Robot{i + 1}Arm', BOTY, (0.14, 0.9, 0.14), (x + 0.4, y - 1.0, 1.5), (math.radians(-30), 0, 0))
    parent(arm, body)

# Haul ramp curving up the wall behind.
for k in range(14):
    a = math.radians(40 + k * 7)
    box(f'Ramp{k}', DARK, (2.4, 4.2, 0.4), (math.cos(a) * 18, math.sin(a) * 18, 1 + k * 0.9), (0, 0, a))

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT / 'kirra.glb'), export_format='GLB', export_apply=True, export_yup=True)

# A preview render from three quarters, to check it.
bpy.ops.object.camera_add(location=(30, -46, 22), rotation=(math.radians(70), 0, math.radians(31)))
scene.camera = bpy.context.object
bpy.ops.object.light_add(type='SUN', location=(0, 0, 30), rotation=(math.radians(40), 0, math.radians(30)))
bpy.context.object.data.energy = 3
for i in range(4):
    bpy.ops.object.light_add(type='POINT', location=bpy.data.objects[f'Light{i + 1}'].location)
    bpy.context.object.data.energy = 3000
    bpy.context.object.data.color = (1, 0.75, 0.45)
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 1280, 720
scene.world = bpy.data.worlds.new('W')
scene.world.color = (0.01, 0.012, 0.02)
scene.render.filepath = str(ROOT / '.dev' / 'shots' / 'kirra-blender.png')
bpy.ops.render.render(write_still=True)
print('kirra.glb written')
