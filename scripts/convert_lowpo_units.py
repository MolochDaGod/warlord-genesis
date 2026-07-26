import bpy, sys, os
from pathlib import Path

def convert(fbx, glb, height=1.65):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(fbx), automatic_bone_orientation=True)
    # scale to height
    import mathutils
    objs = [o for o in bpy.context.scene.objects if o.type in ("MESH","ARMATURE")]
    if not objs:
        print("EMPTY", fbx); return False
    # join meshes for export root
    bpy.ops.object.select_all(action="SELECT")
    # compute bbox of meshes
    minv = mathutils.Vector((1e9,1e9,1e9)); maxv = mathutils.Vector((-1e9,-1e9,-1e9))
    for o in bpy.context.scene.objects:
        if o.type != "MESH": continue
        for corner in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(corner)
            minv = mathutils.Vector((min(minv.x,w.x), min(minv.y,w.y), min(minv.z,w.z)))
            maxv = mathutils.Vector((max(maxv.x,w.x), max(maxv.y,w.y), max(maxv.z,w.z)))
    size = maxv - minv
    h = max(size.z, 1e-4)  # FBX often Z-up after import with axes
    # blender fbx often Y-up; use max dimension as height proxy
    h = max(size.x, size.y, size.z)
    s = height / h if h > 0 else 1.0
    for o in bpy.context.scene.objects:
        if o.parent is None:
            o.scale *= s
            o.location *= s
    bpy.context.view_layer.update()
    # re-ground
    minv = mathutils.Vector((1e9,1e9,1e9)); maxv = mathutils.Vector((-1e9,-1e9,-1e9))
    for o in bpy.context.scene.objects:
        if o.type != "MESH": continue
        for corner in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(corner)
            minv = mathutils.Vector((min(minv.x,w.x), min(minv.y,w.y), min(minv.z,w.z)))
            maxv = mathutils.Vector((max(maxv.x,w.x), max(maxv.y,w.y), max(maxv.z,w.z)))
    for o in bpy.context.scene.objects:
        if o.parent is None:
            o.location.z -= minv.z
    Path(glb).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format="GLB", export_apply=True, export_animations=True, export_skins=True, export_yup=True)
    print("OK", glb, "size", Path(glb).stat().st_size)
    return True

jobs = []
army = Path(r"D:\Games\Models\Army_Free\Army_Free\FBX")
elf = Path(r"D:\Games\Models\_extract\Elf_Free\Elf_Free\FBX")
out = Path(r"F:\GitHub\warlord-genesis\models\units\lowpo")
# Crusade (free army) blue = ally default, red = enemy palette twin
for name, sub, role in [
    ("Army_Footman_Blue.fbx", "crusade", "footman"),
    ("Army_Footman_Red.fbx", "crusade", "footman_enemy"),
    ("Army_Knight_Blue.fbx", "crusade", "knight"),
    ("Army_Knight_Red.fbx", "crusade", "knight_enemy"),
    ("Army_Captain_Blue.fbx", "crusade", "captain"),
    ("Army_Captain_Red.fbx", "crusade", "captain_enemy"),
]:
    jobs.append((army / "Characters" / name, out / sub / f"{role}.glb"))
for name, role in [
    ("Army_Sword.fbx", "sword"),
    ("Army_Shield.fbx", "shield"),
    ("Army_Big_Shield.fbx", "big_shield"),
    ("Army_Spear.fbx", "spear"),
    ("Army_Bow_Blue.fbx", "bow"),
    ("Army_Arrow_Blue.fbx", "arrow"),
]:
    jobs.append((army / "Weapons" / name, out / "weapons" / f"{role}.glb"))
for name, role in [
    ("Elf.fbx", "elf"),
    ("Fire_Elf.fbx", "fire_elf"),
    ("Ice_Elf.fbx", "ice_elf"),
]:
    jobs.append((elf / "Characters" / name, out / "fabled" / f"{role}.glb"))
for name, role in [
    ("Sword_Elf.fbx", "sword"),
    ("Crystal_Spear_Elf.fbx", "crystal_spear"),
    ("Magma_Staff_Elf.fbx", "magma_staff"),
]:
    p = elf / "Weapons" / name
    # exact names may differ
    jobs.append((p, out / "fabled" / f"weapon_{role}.glb"))

for src, dst in jobs:
    if not src.exists():
        # try glob
        cands = list(src.parent.glob(src.name.replace(".fbx", "*.fbx"))) if src.parent.exists() else []
        if not cands:
            print("MISS", src); continue
        src = cands[0]
    try:
        convert(src, dst, 1.7 if "weapon" not in str(dst) else 0.9)
    except Exception as e:
        print("ERR", src, e)
print("DONE")
