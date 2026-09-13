#!/usr/bin/env python3
"""Render actual supplied GLB character thumbnails with Mesa EGL (no browser).

Requires Pillow, NumPy, trimesh, pyrender. Runs no code from the model files.
Tested with pyrender 0.1.45 and PyOpenGL 3.1.10; pyrender's older pinned
PyOpenGL 3.1.0 does not support Python 3.12 ctypes, so use the newer binding.
Skin matrices are applied explicitly because trimesh alone does not skin glTF.
PYOPENGL_PLATFORM=egl python webapp/scripts/render-tirana-player-previews.py
"""
import os
os.environ.setdefault("PYOPENGL_PLATFORM", "egl")

import argparse
import json
import struct
from pathlib import Path

import numpy as np
# pyrender 0.1.45 still uses this alias removed by NumPy 2.0.
if not hasattr(np, "infty"):
    np.infty = np.inf
import pyrender
import trimesh
from PIL import Image


def accessor(g, binary, index):
    a = g["accessors"][index]
    v = g["bufferViews"][a["bufferView"]]
    dtype = np.dtype({5120: "i1", 5121: "u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}[a["componentType"]])
    width = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[a["type"]]
    offset = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    values = np.ndarray((a["count"], width), dtype=dtype, buffer=binary,
                        offset=offset, strides=(v.get("byteStride", width * dtype.itemsize), dtype.itemsize)).copy()
    if a.get("normalized") and a["componentType"] != 5126:
        values = values.astype(float) / np.iinfo(dtype).max
    return values


def world_matrices(g):
    result = {}

    def visit(index, parent):
        n = g["nodes"][index]
        if "matrix" in n:
            local = np.array(n["matrix"]).reshape((4, 4), order="F")
        else:
            q = n.get("rotation", [0, 0, 0, 1])
            local = trimesh.transformations.quaternion_matrix([q[3], q[0], q[1], q[2]])
            local[:3, :3] *= np.array(n.get("scale", [1, 1, 1]))[None, :]
            local[:3, 3] = n.get("translation", [0, 0, 0])
        world = parent @ local
        result[index] = world
        for child in n.get("children", []):
            visit(child, world)

    for index in g["scenes"][g.get("scene", 0)]["nodes"]:
        visit(index, np.eye(4))
    return result


def skinned_meshes(path):
    raw = path.read_bytes()
    size = struct.unpack_from("<I", raw, 12)[0]
    g = json.loads(raw[20:20 + size])
    binary = raw[28 + size:]
    loaded = trimesh.load(path, force="scene", process=False)
    worlds = world_matrices(g)
    output = []
    for index, node in enumerate(g["nodes"]):
        if "mesh" not in node:
            continue
        definition = g["meshes"][node["mesh"]]
        assert len(definition["primitives"]) == 1
        primitive = definition["primitives"][0]
        positions = accessor(g, binary, primitive["attributes"]["POSITION"])
        p4 = np.c_[positions, np.ones(len(positions))]
        if "skin" in node:
            skin = g["skins"][node["skin"]]
            ibm = accessor(g, binary, skin["inverseBindMatrices"]).reshape((-1, 4, 4)).transpose(0, 2, 1)
            matrices = np.array([worlds[joint] @ ibm[i] for i, joint in enumerate(skin["joints"])])
            joints = accessor(g, binary, primitive["attributes"]["JOINTS_0"])
            weights = accessor(g, binary, primitive["attributes"]["WEIGHTS_0"])
            blended = np.sum(matrices[joints] * weights[:, :, None, None], axis=1)
            positions = np.einsum("nij,nj->ni", blended, p4)[:, :3]
        else:
            positions = (p4 @ worlds[index].T)[:, :3]
        mesh = loaded.geometry[definition["name"]].copy()
        assert len(mesh.vertices) == len(positions)
        mesh.vertices = positions
        output.append(mesh)
    return output


def look_at(eye, target):
    z = np.array(eye, dtype=float) - np.array(target, dtype=float)
    z /= np.linalg.norm(z)
    x = np.cross([0, 1, 0], z)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    pose = np.eye(4)
    pose[:3, :3] = np.column_stack([x, y, z])
    pose[:3, 3] = eye
    return pose


def render(path, output, width=600, height=800):
    meshes = skinned_meshes(path)
    bounds = np.array([m.bounds for m in meshes])
    lo, hi = bounds[:, 0].min(axis=0), bounds[:, 1].max(axis=0)
    scale = 1.8 / (hi[1] - lo[1])
    center = [(hi[0] + lo[0]) / 2, lo[1], (hi[2] + lo[2]) / 2]
    scene = pyrender.Scene(bg_color=[0.047, 0.071, 0.11, 1], ambient_light=[0.26, 0.28, 0.32])
    for mesh in meshes:
        mesh.vertices = (mesh.vertices - center) * scale
        scene.add(pyrender.Mesh.from_trimesh(mesh, smooth=True))
    floor = trimesh.creation.box(extents=[8, 0.05, 8])
    floor.apply_translation([0, -0.035, 0])
    floor.visual.face_colors = [31, 43, 61, 255]
    scene.add(pyrender.Mesh.from_trimesh(floor, smooth=False))
    pose = look_at([2.3, 1.25, 5.7], [0, 0.9, 0])
    scene.add(pyrender.PerspectiveCamera(yfov=np.deg2rad(22)), pose=pose)
    scene.add(pyrender.DirectionalLight(color=[1, 0.94, 0.88], intensity=3.2), pose=look_at([2, 5, 4], [0, 0.9, 0]))
    scene.add(pyrender.DirectionalLight(color=[0.68, 0.81, 1], intensity=2.0), pose=look_at([-3, 2, 2], [0, 0.9, 0]))
    scene.add(pyrender.DirectionalLight(color=[0.8, 0.86, 1], intensity=3.0), pose=look_at([0, 3, -4], [0, 0.9, 0]))
    renderer = pyrender.OffscreenRenderer(width, height)
    try:
        color, depth = renderer.render(scene, flags=pyrender.RenderFlags.SHADOWS_DIRECTIONAL)
        assert (depth > 0).any(), "Empty render"
        Image.fromarray(color).save(output, quality=94, subsampling=0)
    finally:
        renderer.delete()
    print(f"{path.name}: original bounds {lo.tolist()} — {hi.tolist()}, preview {output.name}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets", type=Path, default=Path(__file__).resolve().parents[1] / "public/assets/tirana-streets/players")
    args = parser.parse_args()
    for key in ["tactical", "polish", "agent-47"]:
        render(args.assets / f"{key}.glb", args.assets / f"{key}-preview.jpg")


if __name__ == "__main__":
    main()
