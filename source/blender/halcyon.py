"""Halcyon Station, the ring in Earth orbit, built from primitives in Blender.

    blender -b -P source/blender/halcyon.py

Writes media/3d/halcyon.glb: the habitat ring with its window band, six spokes, the hub with its docking port, the
solar wings, and a tug docked at the hub. Object names the page looks for: Ring (turns), Windows, Tug.
"""
import math
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'media' / '3d'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, metal=0.0, rough=0.5, emit=None, strength=0.0):
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


HULL = mat('Hull', (0.78, 0.8, 0.82), 0.3, 0.4)
DARK = mat('Dark', (0.12, 0.13, 0.15), 0.8, 0.4)
GLOW = mat('Windows', (0.9, 0.8, 0.6), 0, 0.3, (1.0, 0.78, 0.5), 6.0)
SOLAR = mat('Solar', (0.08, 0.12, 0.3), 0.6, 0.2, (0.05, 0.12, 0.35), 0.4)
GOLD = mat('Gold', (0.9, 0.65, 0.25), 1.0, 0.3)
NAV = mat('Nav', (1, 0.2, 0.2), 0, 0.3, (1, 0.2, 0.2), 10.0)


def put(o, name, m):
    o.name = name
    o.data.materials.append(m)
    return o


def parent(c, p):
    c.parent = p
    c.matrix_parent_inverse = p.matrix_world.inverted()


bpy.ops.mesh.primitive_torus_add(major_radius=10, minor_radius=1.1, major_segments=64, minor_segments=10)
ring = put(bpy.context.object, 'Ring', HULL)
bpy.ops.mesh.primitive_torus_add(major_radius=10, minor_radius=1.12, major_segments=64, minor_segments=10)
win = put(bpy.context.object, 'Windows', GLOW)
win.scale = (1, 1, 0.16)
bpy.ops.object.transform_apply(scale=True)
parent(win, ring)
for k in range(6):
    a = k / 6 * math.tau
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.35, depth=9, location=(math.cos(a) * 4.8, math.sin(a) * 4.8, 0), rotation=(0, math.pi / 2, a))
    parent(put(bpy.context.object, f'Spoke{k}', DARK), ring)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(a) * 10, math.sin(a) * 10, 0))
    m = put(bpy.context.object, f'Module{k}', DARK)
    m.scale = (2.6, 2.6, 2.9)
    m.rotation_euler = (0, 0, a)
    parent(m, ring)
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=1.8, depth=6)
hub = put(bpy.context.object, 'Hub', HULL)
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.9, depth=1.2, location=(0, 0, 3.6))
put(bpy.context.object, 'Port', GOLD)
# Solar wings along the axis, below the ring.
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.25, depth=16, location=(0, 0, -9))
put(bpy.context.object, 'Mast', DARK)
for s in (-1, 1):
    for z in (-6, -10, -14):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(s * 6.2, 0, z))
        w = put(bpy.context.object, f'Wing{s}{z}', SOLAR)
        w.scale = (11, 3.2, 0.08)
        w.rotation_euler = (math.radians(90), 0, 0)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.25, segments=8, ring_count=6, location=(0, 0, -17.2))
put(bpy.context.object, 'NavLight', NAV)
# A tug docked at the port.
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.7, depth=3, location=(0, 0, 5.8))
tug = put(bpy.context.object, 'Tug', HULL)
bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.7, radius2=0.25, depth=1, location=(0, 0, 7.8))
parent(put(bpy.context.object, 'TugNose', DARK), tug)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT / 'halcyon.glb'), export_format='GLB', export_apply=True, export_yup=True)

scene = bpy.context.scene
bpy.ops.object.camera_add(location=(30, -26, 14), rotation=(math.radians(72), 0, math.radians(49)))
scene.camera = bpy.context.object
bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), math.radians(20), math.radians(-30)))
bpy.context.object.data.energy = 4
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 1280, 720
scene.world = bpy.data.worlds.new('W')
scene.world.color = (0.005, 0.007, 0.012)
scene.render.filepath = str(ROOT / '.dev' / 'shots' / 'halcyon-blender.png')
bpy.ops.render.render(write_still=True)
print('halcyon.glb written')
