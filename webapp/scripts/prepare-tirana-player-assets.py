#!/usr/bin/env python3
"""Prepare the three supplied character originals (Python 3, Pillow, NumPy).

python webapp/scripts/prepare-tirana-player-assets.py --input /path/to/uploads
Dependencies: Pillow >= 10, NumPy >= 1.26 (tested with 12.3.0 and 2.3.5).

Only embedded images are resized/re-encoded. Every geometry, skin, animation,
node, material and morph accessor is retained byte for byte. There is no mesh
simplification or skeleton retargeting. Source files are never modified.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
import struct
import zipfile
from pathlib import Path, PurePosixPath

import numpy as np
from PIL import Image

SOURCES = (
    ("tactical", "soldier_full_tactical_gear.glb"),
    ("polish", "polish_soldier.glb"),
    ("agent-47", "agent_47_riggedface_morphs.zip"),
)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_name(name: str) -> str:
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name:
        raise ValueError(f"Unsafe archive/resource path: {name!r}")
    return name


def read_source(path: Path):
    raw = path.read_bytes()
    files = {}
    license_text = None
    archive = []
    if path.suffix == ".zip":
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            for info in z.infolist():
                safe_name(info.filename)
                if ((info.external_attr >> 16) & 0o170000) == 0o120000:
                    raise ValueError("Archive symlinks are not supported")
                if info.file_size > 100_000_000:
                    raise ValueError("Unexpectedly large archive entry")
                archive.append({"path": info.filename, "bytes": info.file_size})
                if not info.is_dir():
                    files[info.filename] = z.read(info)
        g = json.loads(files["scene.gltf"])
        buffers = [files[safe_name(b["uri"])] for b in g["buffers"]]
        license_text = files.get("license.txt", b"").decode("utf-8")
    else:
        magic, version, total = struct.unpack_from("<III", raw)
        if (magic, version, total) != (0x46546C67, 2, len(raw)):
            raise ValueError("Invalid GLB header")
        json_size, json_type = struct.unpack_from("<II", raw, 12)
        if json_type != 0x4E4F534A:
            raise ValueError("GLB has no JSON chunk")
        g = json.loads(raw[20:20 + json_size])
        offset = 20 + json_size
        bin_size, bin_type = struct.unpack_from("<II", raw, offset)
        if bin_type != 0x004E4942:
            raise ValueError("GLB has no BIN chunk")
        buffers = [raw[offset + 8:offset + 8 + bin_size]]
    return g, buffers, files, license_text, archive, sha(raw)


def view_bytes(g, buffers, index):
    v = g["bufferViews"][index]
    offset = v.get("byteOffset", 0)
    return buffers[v.get("buffer", 0)][offset:offset + v["byteLength"]]


def texture_roles(g):
    roles = {}

    def walk(value, path):
        if not isinstance(value, dict):
            return
        for key, val in value.items():
            if key.endswith("Texture") and isinstance(val, dict) and "index" in val:
                texture = g["textures"][val["index"]]
                if "source" in texture:
                    roles.setdefault(texture["source"], []).append(path + "." + key)
            elif isinstance(val, dict):
                walk(val, path + "." + key)

    for material in g.get("materials", []):
        walk(material, material.get("name", "material"))
    return roles


def optimize_image(raw, roles, normal_edge=512):
    image = Image.open(io.BytesIO(raw))
    original_size = image.size
    # Mobile budget: 1K body color, 512px normals/data, and 2K face color.
    # This reduces decoded GPU memory as well as the initial download size.
    color = any("baseColorTexture" in role for role in roles)
    normal = any("normalTexture" in role for role in roles)
    face = color and any("head" in role.lower().split(".")[0] for role in roles)
    max_edge = 2048 if face else 1024 if color else normal_edge if normal else 512
    has_alpha = "A" in image.mode or "transparency" in image.info
    image = image.convert("RGBA" if has_alpha else "RGB")
    image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    if normal:
        # Re-normalize tangent-space vectors after filtering, preserving the
        # strength of the material normal maps at their reduced resolution.
        pixels = np.array(image)
        xyz = pixels[:, :, :3].astype(np.float32) / 127.5 - 1
        xyz /= np.maximum(np.linalg.norm(xyz, axis=2, keepdims=True), 1e-6)
        pixels[:, :, :3] = np.clip((xyz + 1) * 127.5, 0, 255).astype(np.uint8)
        image = Image.fromarray(pixels)
    if has_alpha and image.getchannel("A").getextrema() == (255, 255):
        image = image.convert("RGB")
        has_alpha = False
    output = io.BytesIO()
    if has_alpha:
        image.save(output, format="PNG", optimize=True)
        mime = "image/png"
    else:
        # 4:4:4 avoids chroma bleeding on masks/normals; high quality keeps the
        # original PBR maps usable with the standard glTF loader (no decoder).
        image.save(output, format="JPEG", quality=92 if normal else 91,
                   subsampling=0, optimize=True)
        mime = "image/jpeg"
    return output.getvalue(), mime, original_size, image.size


def skeleton_audit(g):
    parents = {child: index for index, node in enumerate(g["nodes"])
               for child in node.get("children", [])}
    return [{"name": skin.get("name"), "joints": [
        {"index": index, "parent": parents.get(index), **g["nodes"][index]}
        for index in skin["joints"]
    ]} for skin in g.get("skins", [])]


def geometry_summary(g):
    primitives = [p for m in g.get("meshes", []) for p in m["primitives"]]
    vertices = sum(g["accessors"][p["attributes"]["POSITION"]]["count"]
                   for p in primitives)
    triangles = sum(g["accessors"][p["indices"]]["count"] // 3
                    if "indices" in p else
                    g["accessors"][p["attributes"]["POSITION"]]["count"] // 3
                    for p in primitives if p.get("mode", 4) == 4)
    return {"vertices": vertices, "triangles": triangles,
            "meshes": len(g.get("meshes", [])), "primitives": len(primitives),
            "morphTargets": sum(len(p.get("targets", [])) for p in primitives),
            "skins": len(g.get("skins", [])),
            "joints": [len(s["joints"]) for s in g.get("skins", [])],
            "animations": [a.get("name") for a in g.get("animations", [])]}


def prepare(input_path: Path, output_path: Path):
    g, buffers, files, license_text, archive, source_sha = read_source(input_path)
    original = copy.deepcopy(g)
    roles = texture_roles(g)
    # The two soldiers have many detailed normal maps. A 512px normal budget
    # retains their color detail while fitting mobile downloads and publishing
    # limits. Agent 47 has no normal maps and retains its previous derivative.
    normal_edge = 512 if output_path.stem in ("tactical", "polish") else 1024
    image_views = {im["bufferView"] for im in g.get("images", []) if "bufferView" in im}
    # An image bufferView must not also contain geometry/accessor data.
    assert not image_views.intersection(a.get("bufferView") for a in g.get("accessors", []))
    replacements = {}
    images_audit = []
    for index, image in enumerate(g.get("images", [])):
        raw = (view_bytes(original, buffers, image["bufferView"])
               if "bufferView" in image else files[safe_name(image["uri"])])
        encoded, mime, before, after = optimize_image(raw, roles.get(index, []), normal_edge)
        images_audit.append({"index": index, "roles": roles.get(index, []),
                             "sourceDimensions": before, "dimensions": after,
                             "sourceBytes": len(raw), "bytes": len(encoded), "mimeType": mime})
        if "bufferView" not in image:
            image["bufferView"] = len(g["bufferViews"])
            g["bufferViews"].append({"buffer": 0, "byteLength": len(encoded)})
        replacements[image["bufferView"]] = encoded
        image.pop("uri", None)
        image["mimeType"] = mime
    binary = bytearray()
    preserved_views = 0
    for index, view in enumerate(g["bufferViews"]):
        binary.extend(b"\0" * ((-len(binary)) % 4))
        raw = replacements.get(index)
        if raw is None:
            raw = view_bytes(original, buffers, index)
            preserved_views += 1
        view["buffer"] = 0
        view["byteOffset"] = len(binary)
        view["byteLength"] = len(raw)
        binary.extend(raw)
    g["buffers"] = [{"byteLength": len(binary)}]
    original_generator = g["asset"].get("generator", "")
    g["asset"]["generator"] = original_generator + "; Tirana texture preparation v1"
    texture_note = (
        "Mobile texture derivatives: face color at most 2048px, body color at most "
        "1024px, normal and data maps at most 512px, JPEG/PNG compression; "
        if normal_edge == 512 else
        "Mobile texture derivatives: face color at most 2048px, body color and "
        "normal maps at most 1024px, data maps at most 512px, JPEG/PNG compression; "
    )
    g["asset"].setdefault("extras", {})["modifications"] = (
        texture_note + "geometry, node/skin hierarchy, animation "
        "and morph accessors preserved byte for byte."
    )
    encoded_json = json.dumps(g, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    encoded_json += b" " * ((-len(encoded_json)) % 4)
    binary.extend(b"\0" * ((-len(binary)) % 4))
    result = (struct.pack("<III", 0x46546C67, 2, 28 + len(encoded_json) + len(binary))
              + struct.pack("<II", len(encoded_json), 0x4E4F534A) + encoded_json
              + struct.pack("<II", len(binary), 0x004E4942) + binary)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(result)
    # Verify all non-image data bytes and semantic structures after packaging.
    check, check_buffers, *_ = read_source(output_path)
    for key in ["accessors", "nodes", "meshes", "skins", "animations", "materials", "textures", "scenes"]:
        assert check.get(key) == original.get(key), f"Changed {key}"
    for index in range(len(original["bufferViews"])):
        if index not in image_views:
            assert view_bytes(original, buffers, index) == view_bytes(check, check_buffers, index)
    if license_text:
        output_path.with_suffix(".license.txt").write_text(license_text)
    summary = {
        "id": output_path.stem, "sourceFile": input_path.name,
        "sourceBytes": input_path.stat().st_size, "bytes": len(result),
        "sourceSha256": source_sha, "sha256": sha(result),
        "attribution": original["asset"].get("extras", {}),
        "geometry": geometry_summary(original),
        "preservedNonImageBufferViews": preserved_views,
        "unchanged": ["geometry accessors", "skin weights", "inverse bind matrices",
                      "node transforms", "materials", "animation accessors", "morph targets"],
        "textures": images_audit, "skeletons": skeleton_audit(original),
        "imageBytes": sum(image["bytes"] for image in images_audit),
        "nonImageBytes": len(result) - sum(image["bytes"] for image in images_audit),
        "decodedTextureRgbaBytesWithMipmapsEstimate": round(sum(
            image["dimensions"][0] * image["dimensions"][1] * 4 * 4 / 3
            for image in images_audit)),
        "sceneRoots": [{"index": i, **original["nodes"][i]} for scene in original.get("scenes", []) for i in scene["nodes"]],
        "archiveContents": archive,
    }
    print(f"{output_path.name}: {summary['sourceBytes']:,} -> {len(result):,} bytes; "
          f"{summary['geometry']['triangles']:,} triangles; geometry/rig preserved", flush=True)
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "public/assets/tirana-streets/players")
    args = parser.parse_args()
    audit = {"schemaVersion": 1, "processor": "prepare-tirana-player-assets.py", "assets": []}
    for key, filename in SOURCES:
        audit["assets"].append(prepare(args.input / filename, args.output / f"{key}.glb"))
    (args.output / "asset-audit.json").write_text(json.dumps(audit, indent=2) + "\n")


if __name__ == "__main__":
    main()
