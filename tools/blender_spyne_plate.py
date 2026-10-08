#!/usr/bin/env python3
"""Cycles CPU studio plate in the Spyne / myloan.ca turntable style.

Empty set only: light-grey cyclorama, one large glossy turntable with a
single visible circle, soft overhead light. Several camera heights so a
composite can match the photo. Not wired into the live app.

Run:
  blender -b -P tools/blender_spyne_plate.py -- --out /tmp/gm-spyne
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector


def srgb_to_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin_rgb(r, g, b):
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def arg_after(flag, default):
    if flag in sys.argv:
        return sys.argv[sys.argv.index(flag) + 1]
    return default


OUT = arg_after("--out", "/tmp/gm-spyne")
PREVIEW = "--preview" in sys.argv
os.makedirs(OUT, exist_ok=True)

# Disc radius in metres. The circle has to read at listing size.
DISC_R = 5.15
RING_R = 5.20


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_material(name, rgba, rough, spec=0.5, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = rough
    # Blender 4 renamed Specular. Either socket is accepted.
    for key in ("Specular IOR Level", "Specular"):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = spec
            break
    if "Coat Weight" in bsdf.inputs and coat:
        bsdf.inputs["Coat Weight"].default_value = coat
        if "Coat Roughness" in bsdf.inputs:
            bsdf.inputs["Coat Roughness"].default_value = 0.18
    return mat


def build_cyclorama():
    """Floor that sweeps up into a seamless wall. Symmetric around Z."""
    import bmesh

    # (radius, height). The cove starts well outside the turntable.
    # Long cove so the wall/floor join is a gradient, not a horizon line.
    profile = [
        (0.40, 0.0),
        (3.0, 0.0),
        (6.0, 0.0),
        (8.0, 0.0),
        (9.2, 0.02),
        (10.2, 0.12),
        (11.0, 0.40),
        (11.6, 0.95),
        (12.0, 1.80),
        (12.25, 2.90),
        (12.40, 4.40),
        (12.45, 8.0),
        (12.45, 14.0),
    ]
    segs = 96 if not PREVIEW else 64
    bm = bmesh.new()
    rings = []
    for i in range(segs):
        ang = math.tau * i / segs
        ca, sa = math.cos(ang), math.sin(ang)
        rings.append([bm.verts.new((x * ca, x * sa, z)) for x, z in profile])
    for i in range(segs):
        nxt = (i + 1) % segs
        for j in range(len(profile) - 1):
            bm.faces.new((rings[i][j], rings[nxt][j], rings[nxt][j + 1], rings[i][j + 1]))
    centre = bm.verts.new((0.0, 0.0, 0.0))
    for i in range(segs):
        nxt = (i + 1) % segs
        bm.faces.new((centre, rings[nxt][0], rings[i][0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("cyclorama")
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new("cyclorama", mesh)
    bpy.context.collection.objects.link(obj)
    # Matte wall and floor. The turntable is a separate glossier disc.
    # Wall/floor target on screen: about sRGB 228, a hair cooler than white.
    obj.data.materials.append(cove_material())
    return obj


def cove_material():
    """Floor stays a lit shader. The wall fades to a flat high-key grey so the
    cove does not fall off into a dark horizon the way a pure light setup did."""
    mat = bpy.data.materials.new("cove")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    out = nt.nodes["Material Output"]
    bsdf.inputs["Base Color"].default_value = lin_rgb(208, 210, 212)
    bsdf.inputs["Roughness"].default_value = 0.62
    for key in ("Specular IOR Level", "Specular"):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = 0.3
            break
    # The camera looks slightly down, so the "wall" in frame is the far cove.
    # Emit a flat light grey out there. Lights alone left it a stop too dark.
    geom = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geom.outputs["Position"], sep.inputs["Vector"])
    xy = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(sep.outputs["X"], xy.inputs["X"])
    nt.links.new(sep.outputs["Y"], xy.inputs["Y"])
    length = nt.nodes.new("ShaderNodeVectorMath")
    length.operation = "LENGTH"
    nt.links.new(xy.outputs["Vector"], length.inputs[0])
    ramp = nt.nodes.new("ShaderNodeMapRange")
    # Start the flat wall colour just outside the disc so the cove curve
    # does not draw a second, darker horizon behind the turntable.
    ramp.inputs["From Min"].default_value = 5.35
    ramp.inputs["From Max"].default_value = 7.6
    ramp.clamp = True
    nt.links.new(length.outputs["Value"], ramp.inputs["Value"])
    wall = nt.nodes.new("ShaderNodeEmission")
    wall.inputs["Color"].default_value = lin_rgb(230, 232, 234)
    wall.inputs["Strength"].default_value = 1.0
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(ramp.outputs["Result"], mix.inputs["Fac"])
    nt.links.new(bsdf.outputs["BSDF"], mix.inputs[1])
    nt.links.new(wall.outputs["Emission"], mix.inputs[2])
    # Drop the default link onto the mix.
    for link in list(nt.links):
        if link.to_node == out:
            nt.links.remove(link)
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return mat


def build_turntable():
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=160 if not PREVIEW else 96,
        radius=DISC_R,
        depth=0.028,
        location=(0.0, 0.0, 0.016),
    )
    disc = bpy.context.active_object
    disc.name = "turntable"
    for poly in disc.data.polygons:
        poly.use_smooth = True
    # Slightly deeper grey than the cove so the circle reads, still light.
    disc.data.materials.append(
        make_material("disc", lin_rgb(188, 191, 194), rough=0.24, spec=0.45, coat=0.15)
    )

    # A constant-width circle is drawn in the composite. A physical tube
    # becomes a thick bar on the near edge and vanishes on the far edge.
    return disc


def add_light(name, loc, rot, size, power, color=(1.0, 1.0, 1.0)):
    light = bpy.data.lights.new(name, "AREA")
    light.shape = "RECTANGLE"
    light.size = size[0]
    light.size_y = size[1]
    light.energy = power
    light.color = color
    obj = bpy.data.objects.new(name, light)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    return obj


def build_lights():
    # Large overhead softbox, biased toward the camera so the disc picks up
    # a broad highlight and the wall stays even.
    # Watts are modest on purpose. The first pass at several thousand watts
    # clipped the whole plate to 255 and hid the turntable.
    add_light("key", (0.0, -1.6, 6.2), (math.radians(12), 0, 0), (7.5, 5.5), 170)
    add_light("fill_l", (-4.5, -3.0, 3.2), (math.radians(70), 0, math.radians(-35)), (3.5, 2.4), 90)
    add_light("fill_r", (4.5, -3.0, 3.2), (math.radians(70), 0, math.radians(35)), (3.5, 2.4), 90)
    add_light("wall", (0.0, 4.5, 3.4), (math.radians(100), 0, 0), (8.0, 3.0), 40)
    add_light("bounce", (0.0, -5.5, 1.6), (math.radians(80), 0, 0), (4.0, 1.2), 70)


CAMERAS = {
    # Low phone height, close. Front and rear three-quarter shots.
    # Low and close, wide lens, so the disc is a tall ellipse filling the frame.
    "h070": dict(dist=6.4, height=0.62, look_y=-0.35, look_z=0.08, lens=24),
    "h100": dict(dist=7.2, height=0.92, look_y=-0.20, look_z=0.12, lens=28),
    "h140": dict(dist=9.0, height=1.28, look_y=-0.05, look_z=0.16, lens=34),
}


def aim_camera(spec):
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = spec["lens"]
    cam_data.sensor_width = 36.0
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    cam.location = (0.0, -spec["dist"], spec["height"])
    target = Vector((0.0, spec["look_y"], spec["look_z"]))
    direction = target - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
    return cam


def project_circle(scene, cam, radius, z, steps=64):
    from bpy_extras.object_utils import world_to_camera_view

    w = scene.render.resolution_x
    h = scene.render.resolution_y
    pts = []
    for i in range(steps):
        ang = math.tau * i / steps
        co = Vector((radius * math.cos(ang), radius * math.sin(ang), z))
        v = world_to_camera_view(scene, cam, co)
        if v.z <= 0:
            continue
        pts.append([v.x * w, (1.0 - v.y) * h, v.z])
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]

    def ground(y_world):
        v = world_to_camera_view(scene, cam, Vector((0.0, y_world, 0.02)))
        return [v.x * w, (1.0 - v.y) * h]

    return {
        "ellipse": {
            "cx": 0.5 * (min(xs) + max(xs)),
            "cy": 0.5 * (min(ys) + max(ys)),
            "rx": 0.5 * (max(xs) - min(xs)),
            "ry": 0.5 * (max(ys) - min(ys)),
        },
        "ground": {
            "near": ground(-2.2),
            "axle": ground(-1.3),
            "centre": ground(0.0),
            "far": ground(1.6),
        },
    }


def main():
    clear_scene()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    # Ubuntu's Blender 4.0.2 is built without OpenImageDenoise. 160 samples
    # (adaptive sampling off) plus a standalone OIDN pass in spyne_composite
    # is what flattens the floor. Do not turn use_denoising on here.
    scene.cycles.samples = 16 if PREVIEW else 160
    scene.cycles.use_denoising = False
    scene.cycles.use_adaptive_sampling = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.render.resolution_x = 960 if PREVIEW else 2000
    scene.render.resolution_y = 640 if PREVIEW else 1334
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False

    build_cyclorama()
    build_turntable()
    build_lights()

    names = ["h100"] if PREVIEW else list(CAMERAS)
    meta = {"disc_radius_m": DISC_R, "plates": {}}
    for name in names:
        cam = aim_camera(CAMERAS[name])
        info = project_circle(scene, cam, DISC_R, 0.03)
        path = os.path.join(OUT, f"plate-{name}.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        info["file"] = path
        info["camera"] = CAMERAS[name]
        info["size"] = [scene.render.resolution_x, scene.render.resolution_y]
        meta["plates"][name] = info
        print("rendered", path)
        # Drop the camera so the next one is the only scene camera.
        bpy.data.objects.remove(cam, do_unlink=True)
    with open(os.path.join(OUT, "plates.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print("wrote", os.path.join(OUT, "plates.json"))


if __name__ == "__main__":
    main()
