"""可愛いプリンキャラクターを生成する Blender スクリプト。

使い方 (2通り):

1. 単体で実行 (ヘッドレスでモデル生成→レンダリング→.blend保存まで行う):
     blender --background --python pudding_character.py

2. Claude Code から blender-mcp 経由で実行:
     起動中の Blender に対して execute_blender_code ツールでこのファイルの
     中身をそのまま渡してください。既に開いている .blend への保存はしないので、
     最後の render.render() / save_as_mainfile() の呼び出しはコメントアウトしても
     構いません (render_viewport ツールで別途レンダリングできます)。
"""

import math
import random

import bpy


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def make_material(name, color, roughness=0.4, subsurface=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    if "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = subsurface
    elif "Subsurface" in bsdf.inputs:
        bsdf.inputs["Subsurface"].default_value = subsurface
    return mat


def add_smooth(obj, bevel=0.0, subsurf_levels=2):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()
    if bevel > 0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 4
    if subsurf_levels > 0:
        mod = obj.modifiers.new("Subsurf", "SUBSURF")
        mod.levels = subsurf_levels
        mod.render_levels = subsurf_levels


clear_scene()

RADIUS_BOTTOM = 0.65
RADIUS_TOP = 0.95
DEPTH = 1.1


def radius_at(z):
    t = max(0.0, min(1.0, z / DEPTH))
    return RADIUS_BOTTOM + t * (RADIUS_TOP - RADIUS_BOTTOM)


# --- 皿 -----------------------------------------------------------------
bpy.ops.mesh.primitive_cylinder_add(radius=1.6, depth=0.12, location=(0, 0, 0.06))
plate = bpy.context.active_object
plate.name = "Plate"
add_smooth(plate, bevel=0.02, subsurf_levels=1)
plate.data.materials.append(make_material("PlateMat", (0.97, 0.95, 0.93, 1), roughness=0.25))

# --- プリン本体 -----------------------------------------------------------
BASE_Z = 0.1  # 皿の上面に合わせたオフセット
bpy.ops.mesh.primitive_cone_add(
    radius1=RADIUS_BOTTOM, radius2=RADIUS_TOP, depth=DEPTH, location=(0, 0, DEPTH / 2 + BASE_Z)
)
pudding = bpy.context.active_object
pudding.name = "Pudding"
add_smooth(pudding, bevel=0.05, subsurf_levels=2)
pudding.data.materials.append(
    make_material("PuddingMat", (0.98, 0.88, 0.55, 1), roughness=0.15, subsurface=0.3)
)

# --- カラメルソース(天面) --------------------------------------------------
top_z = BASE_Z + DEPTH
bpy.ops.mesh.primitive_uv_sphere_add(radius=RADIUS_TOP * 1.02, location=(0, 0, top_z - 0.08))
caramel_top = bpy.context.active_object
caramel_top.name = "CaramelTop"
caramel_top.scale = (1.0, 1.0, 0.16)
add_smooth(caramel_top, bevel=0.0, subsurf_levels=2)
caramel_mat = make_material("CaramelMat", (0.24, 0.11, 0.03, 1), roughness=0.12, subsurface=0.1)
caramel_top.data.materials.append(caramel_mat)

# --- カラメルの垂れ ---------------------------------------------------------
random.seed(7)
for i in range(5):
    angle = (i / 5) * 2 * math.pi + random.uniform(-0.15, 0.15)
    r = RADIUS_TOP * 0.97
    x, y = r * math.cos(angle), r * math.sin(angle)
    length = random.uniform(0.18, 0.34)
    bpy.ops.mesh.primitive_cone_add(
        radius1=0.05, radius2=0.015, depth=length, location=(x, y, top_z - 0.1 - length / 2)
    )
    drip = bpy.context.active_object
    drip.name = f"CaramelDrip_{i}"
    add_smooth(drip, subsurf_levels=1)
    drip.data.materials.append(caramel_mat)

# --- 顔: 目 ---------------------------------------------------------------
eye_z = BASE_Z + 0.75
eye_r = radius_at(eye_z - BASE_Z)
eye_mat = make_material("EyeMat", (0.02, 0.02, 0.02, 1), roughness=0.1)
for side in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.075, location=(side * 0.26, -(eye_r + 0.03), eye_z)
    )
    eye = bpy.context.active_object
    eye.name = f"Eye_{'L' if side < 0 else 'R'}"
    eye.scale = (0.8, 0.8, 1.0)
    add_smooth(eye, subsurf_levels=1)
    eye.data.materials.append(eye_mat)

# --- 顔: ほっぺ(チーク) -----------------------------------------------------
cheek_z = BASE_Z + 0.6
cheek_r = radius_at(cheek_z - BASE_Z)
cheek_mat = make_material("CheekMat", (0.98, 0.55, 0.6, 1), roughness=0.6)
for side in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.12, location=(side * 0.46, -(cheek_r + 0.02), cheek_z)
    )
    cheek = bpy.context.active_object
    cheek.name = f"Cheek_{'L' if side < 0 else 'R'}"
    cheek.scale = (1.0, 0.35, 0.75)
    add_smooth(cheek, subsurf_levels=1)
    cheek.data.materials.append(cheek_mat)

# --- 顔: 口 (ベジェ曲線でスマイルライン) -------------------------------------
mouth_z = BASE_Z + 0.48
mouth_r = radius_at(mouth_z - BASE_Z)
curve_data = bpy.data.curves.new("Smile", type="CURVE")
curve_data.dimensions = "3D"
curve_data.bevel_depth = 0.014
curve_data.bevel_resolution = 2
spline = curve_data.splines.new("BEZIER")
spline.bezier_points.add(2)
for bp, (px, pz) in zip(spline.bezier_points, [(-0.13, 0.02), (0, -0.045), (0.13, 0.02)]):
    bp.co = (px, 0, pz)
    bp.handle_left_type = "AUTO"
    bp.handle_right_type = "AUTO"
mouth = bpy.data.objects.new("Mouth", curve_data)
bpy.context.collection.objects.link(mouth)
mouth.location = (0, -(mouth_r + 0.03), mouth_z)
mouth.data.materials.append(eye_mat)

# --- 手 (ちょこんと横に生えた手) --------------------------------------------
arm_z = BASE_Z + 0.55
arm_r = radius_at(arm_z - BASE_Z)
arm_mat = make_material("ArmMat", (0.98, 0.9, 0.6, 1), roughness=0.2)
for side in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.14, location=(side * (arm_r + 0.1), 0, arm_z))
    arm = bpy.context.active_object
    arm.name = f"Arm_{'L' if side < 0 else 'R'}"
    arm.scale = (1.2, 0.9, 0.7)
    arm.rotation_euler = (0, 0, side * 0.35)
    add_smooth(arm, subsurf_levels=1)
    arm.data.materials.append(arm_mat)

# --- カメラ ----------------------------------------------------------------
target = bpy.data.objects.new("Target", None)
target.location = (0, 0, top_z * 0.55)
bpy.context.collection.objects.link(target)

bpy.ops.object.camera_add(location=(0, -4.3, 1.9))
camera = bpy.context.active_object
camera.name = "Camera"
constraint = camera.constraints.new(type="TRACK_TO")
constraint.target = target
constraint.track_axis = "TRACK_NEGATIVE_Z"
constraint.up_axis = "UP_Y"
camera.data.lens = 60
bpy.context.scene.camera = camera

# --- ライト ----------------------------------------------------------------
bpy.ops.object.light_add(type="AREA", location=(2.5, -3.0, 4.0))
key_light = bpy.context.active_object
key_light.data.energy = 900
key_light.data.size = 3

bpy.ops.object.light_add(type="AREA", location=(-3.0, -1.5, 2.0))
fill_light = bpy.context.active_object
fill_light.data.energy = 250
fill_light.data.size = 3

# --- ワールド背景 ------------------------------------------------------------
world = bpy.context.scene.world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.97, 0.93, 0.9, 1)
bg.inputs["Strength"].default_value = 1.2

# --- レンダー設定 & 保存 -----------------------------------------------------
# Blender を単体 (headless) で実行しているときだけ必要な処理。
# execute_blender_code で既に開いている Blender に流し込む場合は、
# 上のジオメトリ生成部分だけで十分です (このブロックは削除・コメントアウトしてOK)。
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 128
scene.cycles.use_denoising = True
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.filepath = "//pudding_render.png"

bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath="//pudding.blend")

print("DONE")
