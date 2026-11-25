"""Make 3D models of Steer's machines from Codex's object sheets, in Blender (the Mani temple's way).

    blender -b -P source/blender/sheets.py [-- name ...]

Each sheet in .dev/assets is a front view on #00FF00, its depth map and a top view. The model's outline is the
painting's, the green keyed out; its front is Codex's depth map, its back the same depth mirrored and flattened a
little, so the machine has a body seen from any side the camera reaches. The painting is projected on from the front
(its colours spread over the green so the outline never shows green), embedded at 1024 px as JPEG, decimated, and
exported as media/3d/<name>.glb with a preview render in .dev/shots/<name>-preview.png. Sizes are in metres: the
painting's width is WIDTH[name].
"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'media' / '3d'
OUT.mkdir(parents=True, exist_ok=True)
SHOTS = ROOT / '.dev' / 'shots'

# how deep the front stands, as a share of the painting's width, and the back's share of that
DEPTH = {'maint-robot': (0.5, 0.8), 'haul-truck': (0.55, 0.9), 'bearing': (0.18, 1.0), 'drill-head': (0.5, 0.9)}
WIDTH = {'maint-robot': 2.4, 'haul-truck': 6.0, 'bearing': 4.4, 'drill-head': 6.4}
ROUND = {}
STEP = 8  # grid spacing in painting pixels


def load(path):
    im = bpy.data.images.load(str(path))
    w, h = im.size
    a = np.empty(w * h * 4, np.float32)
    im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    return a.reshape(h, w, 4)[::-1]  # rows from the top


def runs_depth(mask):
    """Per pixel: sqrt(a^2 - rho^2), a the half length of its row's run, rho its distance from the run's middle."""
    h, w = mask.shape
    z = np.zeros(mask.shape, np.float32)
    for y in range(h):
        row = mask[y]
        if not row.any():
            continue
        d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
        starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
        for s, e in zip(starts, ends):
            a = (e - s) / 2
            x = np.arange(s, e) + 0.5 - (s + e) / 2
            z[y, s:e] = np.sqrt(np.maximum(a * a - x * x, 0))
    return z


def blur(z, r):
    k = np.exp(-np.arange(-2 * r, 2 * r + 1) ** 2 / (2 * r * r)); k /= k.sum()
    z = np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 0, z)
    return np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 1, z)


def build(name, colour, depth=None, front_scale=None):
    img = load(colour)
    h, w = img.shape[:2]
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    mask = ~((g > 0.5) & (g > r * 1.6) & (g > b * 1.6))
    # keep only the object (drop specks): rows and columns of the grid
    gy, gx = np.arange(0, h, STEP), np.arange(0, w, STEP)
    m = mask[np.ix_(gy, gx)]
    z = runs_depth(mask) / w  # in painting widths
    z = blur(z, 2)[np.ix_(gy, gx)] * ROUND.get(name, 1)
    d = load(depth)[..., 0]
    fs, bs = DEPTH[name]
    # the body: each row's run of the object turned round (the temple's way), flattened by fs;
    # Codex's depth map adds only the relief (its depth less its own broad shape)
    front = z * fs + (blur(d, 1.5) - blur(d, 12))[np.ix_(gy, gx)] * 0.05
    back = -z * fs * bs
    # the outline at depth 0 on both sides, so front and back meet there with no crack
    inner = m.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        inner &= np.roll(m, (dy, dx), (0, 1))
    front = np.where(inner, front, 0); back = np.where(inner, back, 0)
    ny, nx = m.shape
    cut = None
    X = (gx / w - 0.5)[None, :].repeat(ny, 0)
    Y = ((h - gy) / w)[:, None].repeat(nx, 1)
    U = (gx / w)[None, :].repeat(ny, 0)
    V = (1 - gy / h)[:, None].repeat(nx, 1)
    verts, uvs, faces = [], [], []
    for side, Z in ((0, front), (1, back)):
        idx = -np.ones((ny, nx), np.int64)
        for j in range(ny):
            for i in range(nx):
                if m[j, i]:
                    idx[j, i] = len(verts)
                    verts.append((X[j, i], -Z[j, i], Y[j, i]))  # Blender is z-up, the viewer at -y
                    uvs.append((U[j, i], V[j, i]))
        for j in range(ny - 1):
            for i in range(nx - 1):
                a, b2, c, d2 = idx[j, i], idx[j, i + 1], idx[j + 1, i + 1], idx[j + 1, i]
                tri = [(a, d2, c), (a, c, b2)] if side == 0 else [(a, c, d2), (a, b2, c)]
                for t in tri:
                    if min(t) >= 0:
                        if cut is not None and side == 0:
                            zs = [-verts[k][1] for k in t]
                            if max(zs) - min(zs) > cut * 1.2:
                                continue
                        faces.append(t)
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    uv = me.uv_layers.new(name='UV')
    loop_uv = np.array([uvs[v] for poly in me.polygons for v in poly.vertices], np.float32)
    uv.data.foreach_set('uv', loop_uv.ravel())
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=1e-5)  # the front and back meet at the outline
    if cut is not None:  # the cuts leave a few tiny loose islands, shards seen from the side: delete them
        import bmesh
        bm = bmesh.from_edit_mesh(ob.data); bm.faces.ensure_lookup_table(); seen, gone = set(), []
        for f0 in bm.faces:
            if f0 in seen:
                continue
            isl, stack = [], [f0]; seen.add(f0)
            while stack:
                f1 = stack.pop(); isl.append(f1)
                for e in f1.edges:
                    for f2 in e.link_faces:
                        if f2 not in seen:
                            seen.add(f2); stack.append(f2)
            if len(isl) < 200:
                gone += isl
        bmesh.ops.delete(bm, geom=gone, context='FACES')
        bmesh.update_edit_mesh(ob.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    dec = ob.modifiers.new('decimate', 'DECIMATE')
    dec.ratio = min(1, 7000 / len(ob.data.vertices))  # small enough to stream
    bpy.ops.object.modifier_apply(modifier='decimate')
    bpy.ops.object.shade_smooth()
    ob.scale = (WIDTH[name],) * 3
    bpy.ops.object.transform_apply(scale=True)
    return ob, colour


def padded(colour):
    """The painting with the object's colours spread out over the green, so the outline never samples green."""
    a = load(colour)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    key = (g > 0.5) & (g > r * 1.6) & (g > b * 1.6)
    c = a[..., :3].copy(); have = ~key
    for _ in range(12):
        acc = np.zeros_like(c); n = np.zeros(have.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            hs = np.roll(have, (dy, dx), (0, 1)); acc += np.roll(c, (dy, dx), (0, 1)) * hs[..., None]; n += hs
        fill = ~have & (n > 0)
        c[fill] = acc[fill] / n[fill][:, None]; have |= fill
    h, w = key.shape
    im = bpy.data.images.new('padded', w, h)
    out = np.concatenate([c, np.ones((h, w, 1), np.float32)], 2)[::-1].ravel()
    im.pixels.foreach_set(out)
    return im


def paint(ob, colour):
    """The painting as the model's colour, at 1024 px."""
    mat = bpy.data.materials.new(ob.name); mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.55; bsdf.inputs['Metallic'].default_value = 0.35
    im = padded(colour); im.scale(1024, 1024); im.name = ob.name
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = im
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    ob.data.materials.append(mat)


def preview(ob, colour):
    """A three-quarter render, to check the model."""
    sc = bpy.context.scene
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
    top = max(v.co.z for v in ob.data.vertices); k = WIDTH[ob.name]
    cam.location = (1.5 * k, -1.9 * k, top * 0.5 + 0.55 * k)
    aim = bpy.data.objects.new('aim', None); aim.location = (0, 0, top * 0.45); sc.collection.objects.link(aim)
    tr = cam.constraints.new('TRACK_TO'); tr.target = aim; tr.track_axis = 'TRACK_NEGATIVE_Z'; tr.up_axis = 'UP_Y'
    cam.data.lens = 70
    sc.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3
    sun.rotation_euler = (0.9, 0.3, 0.6); sc.collection.objects.link(sun)
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x = sc.render.resolution_y = 512
    sc.world = sc.world or bpy.data.worlds.new('w'); sc.world.use_nodes = True
    sc.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.08, 0.08, 0.09, 1)
    sc.render.filepath = str(SHOTS / f'{ob.name}-preview.png')
    bpy.ops.render.render(write_still=True)
    for o in (cam, sun, aim):
        bpy.data.objects.remove(o)


def export(ob):
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / f'{ob.name}.glb'), export_format='GLB', use_selection=True,
                              export_normals=True, export_texcoords=True, export_materials='EXPORT',
                              export_image_format='JPEG', export_jpeg_quality=80, export_yup=True)


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)


names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(DEPTH)
for n in names:
    clear()
    ob, col = build(n, ROOT / '.dev/assets' / f'{n}.png', ROOT / '.dev/assets' / f'{n}-depth.png')
    paint(ob, col)
    export(ob)
    preview(ob, col)
    print('made', n, len(ob.data.vertices), 'vertices', len(ob.data.polygons), 'faces')
