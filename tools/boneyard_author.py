#!/usr/bin/env python3
"""Lossless parser and authoring encoder for Solomon Dark .boneyard files."""

from __future__ import annotations

import argparse
import base64
import json
import math
import struct
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


TYPE_NAMES = {
    2001: "Tree",
    2009: "Monument",
    2029: "Gravestone",
    2040: "Building",
    2061: "Goodie",
    3004: "Road",
    3005: "Fence",
    3006: "Fencepost",
    3007: "FenceGrate",
    3009: "Terrain",
    6001: "MonsterRecipe",
    6002: "UIDGroup",
    6003: "ItemRecipe",
    6004: "NPCRecipe",
    6005: "ItemSet",
    6006: "TimeLine",
    6007: "TimeLineEvent",
}

KNOWN_PLACEABLES = frozenset({2001, 2009, 2029, 2040, 2061})
MAX_FILE_BYTES = 256 * 1024 * 1024
MAX_CHUNKS = 1_000_000
MAX_DEPTH = 512
STATIC_SPRITE_ATLAS_BASE = 114


class FormatError(ValueError):
    pass


@dataclass
class Chunk:
    payload: bytes
    children: list["Chunk"]


@dataclass
class NamedBuffer:
    name: bytes
    root: Chunk
    named: list["NamedBuffer"]


@dataclass
class Buffer:
    root: Chunk
    named: list[NamedBuffer]


class Reader:
    def __init__(self, data: bytes, label: str = "<memory>") -> None:
        if len(data) > MAX_FILE_BYTES:
            raise FormatError(f"{label}: file exceeds 256 MiB")
        self.data = data
        self.label = label
        self.offset = 0
        self.chunk_count = 0

    def read(self, size: int) -> bytes:
        end = self.offset + size
        if size < 0 or end > len(self.data):
            raise FormatError(f"{self.label}: truncated at byte {self.offset}")
        result = self.data[self.offset:end]
        self.offset = end
        return result

    def u32(self) -> int:
        return struct.unpack("<I", self.read(4))[0]

    def chunk(self, depth: int = 0) -> Chunk:
        if depth > MAX_DEPTH:
            raise FormatError(f"{self.label}: chunk nesting exceeds {MAX_DEPTH}")
        self.chunk_count += 1
        if self.chunk_count > MAX_CHUNKS:
            raise FormatError(f"{self.label}: more than {MAX_CHUNKS} chunks")
        payload = self.read(self.u32())
        child_count = self.u32()
        if child_count > MAX_CHUNKS - self.chunk_count + 1:
            raise FormatError(f"{self.label}: invalid child count at byte {self.offset - 4}")
        return Chunk(payload, [self.chunk(depth + 1) for _ in range(child_count)])

    def buffer(self, depth: int = 0) -> Buffer:
        root = self.chunk(depth)
        named_count = self.u32()
        if named_count > 65_536:
            raise FormatError(f"{self.label}: invalid named-buffer count")
        named: list[NamedBuffer] = []
        for _ in range(named_count):
            size = self.u32()
            name = self.read(size)
            if not name or name[-1] != 0 or b"\0" in name[:-1]:
                raise FormatError(f"{self.label}: invalid named-buffer name")
            child = self.buffer(depth + 1)
            named.append(NamedBuffer(name[:-1], child.root, child.named))
        return Buffer(root, named)


def encode_chunk(chunk: Chunk) -> bytes:
    return (
        struct.pack("<I", len(chunk.payload))
        + chunk.payload
        + struct.pack("<I", len(chunk.children))
        + b"".join(encode_chunk(child) for child in chunk.children)
    )


def encode_buffer(buffer: Buffer) -> bytes:
    parts = [encode_chunk(buffer.root), struct.pack("<I", len(buffer.named))]
    for item in buffer.named:
        parts.extend(
            (
                struct.pack("<I", len(item.name) + 1),
                item.name + b"\0",
                encode_buffer(Buffer(item.root, item.named)),
            )
        )
    return b"".join(parts)


def parse_buffer(data: bytes, label: str = "<memory>") -> Buffer:
    reader = Reader(data, label)
    result = reader.buffer()
    if reader.offset != len(data):
        raise FormatError(f"{label}: trailing data at byte {reader.offset}")
    validate_envelope(result.root, label)
    return result


def parse_chunks(data: bytes, expected: int | None = None) -> list[Chunk]:
    reader = Reader(data, "raw entity")
    result: list[Chunk] = []
    while reader.offset < len(data):
        result.append(reader.chunk())
    if expected is not None and len(result) != expected:
        raise FormatError(f"raw entity has {len(result)} chunks, expected {expected}")
    return result


def validate_envelope(root: Chunk, label: str) -> None:
    if root.payload or len(root.children) != 1:
        raise FormatError(f"{label}: root must contain one Arena chunk")
    arena = root.children[0]
    if arena.payload or len(arena.children) != 13:
        raise FormatError(f"{label}: Arena must contain 13 sections")
    region = arena.children[12]
    if region.payload or len(region.children) != 1:
        raise FormatError(f"{label}: Arena Region section is invalid")
    layout = region.children[0]
    if layout.payload or len(layout.children) != 14:
        raise FormatError(f"{label}: RegionLayout must contain 14 sections")


def arena_and_layout(buffer: Buffer) -> tuple[Chunk, Chunk]:
    arena = buffer.root.children[0]
    return arena, arena.children[12].children[0]


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def unb64(value: str) -> bytes:
    try:
        return base64.b64decode(value, validate=True)
    except (ValueError, TypeError) as exc:
        raise FormatError("invalid base64 raw field") from exc


def raw_chunks(chunks: Iterable[Chunk]) -> str:
    return b64(b"".join(encode_chunk(chunk) for chunk in chunks))


def native_string(data: bytes, offset: int = 0) -> tuple[str, int]:
    if offset + 4 > len(data):
        raise FormatError("truncated native String")
    size = struct.unpack_from("<I", data, offset)[0]
    start = offset + 4
    end = start + size
    if size == 0 or end > len(data) or data[end - 1] != 0:
        raise FormatError("invalid native String")
    value = data[start : end - 1].decode("utf-8", "surrogateescape")
    return value, end


def encode_native_string(value: str) -> bytes:
    encoded = value.encode("utf-8", "surrogateescape") + b"\0"
    return struct.pack("<I", len(encoded)) + encoded


def vec2(x: float, y: float) -> dict[str, float]:
    return {"x": x, "y": y}


def rect(values: tuple[float, float, float, float]) -> dict[str, float]:
    left, top, right, bottom = values
    return {
        "left": left,
        "top": top,
        "right": right,
        "bottom": bottom,
        "x": left,
        "y": top,
        "w": right - left,
        "h": bottom - top,
    }


def rect_values(value: dict[str, Any], original: dict[str, Any] | None = None) -> tuple[float, float, float, float]:
    if original is not None and all(key in value for key in ("x", "y", "w", "h")):
        aliases_changed = any(float(value[key]) != float(original[key]) for key in ("x", "y", "w", "h"))
        edges_changed = any(
            float(value.get(key, original[key])) != float(original[key])
            for key in ("left", "top", "right", "bottom")
        )
        if aliases_changed and not edges_changed:
            x, y, w, h = (float(value[key]) for key in ("x", "y", "w", "h"))
            return x, y, x + w, y + h
    if all(key in value for key in ("left", "top", "right", "bottom")):
        return tuple(float(value[key]) for key in ("left", "top", "right", "bottom"))  # type: ignore[return-value]
    x, y, w, h = (float(value[key]) for key in ("x", "y", "w", "h"))
    return x, y, x + w, y + h


def manager(section: Chunk) -> tuple[list[int], list[Chunk]]:
    if len(section.payload) < 4:
        raise FormatError("truncated polymorphic manager")
    count = struct.unpack_from("<I", section.payload)[0]
    if len(section.payload) != 4 + count * 4:
        raise FormatError("invalid polymorphic manager payload")
    ids = list(struct.unpack_from(f"<{count}I", section.payload, 4)) if count else []
    return ids, section.children


def set_manager(section: Chunk, ids: list[int], children: list[Chunk]) -> None:
    section.payload = struct.pack("<I", len(ids)) + (struct.pack(f"<{len(ids)}I", *ids) if ids else b"")
    section.children = children


def parse_header(payload: bytes) -> tuple[dict[str, Any], int]:
    name, end = native_string(payload)
    if end + 535 > len(payload):
        raise FormatError("Arena header is too short")
    flags = list(payload[end : end + 6])
    compatibility = payload[end + 6 : end + 518]
    layout_byte = payload[end + 518]
    bounds = struct.unpack_from("<4f", payload, end + 519)
    trailing = payload[end + 535 :]
    return {
        "name": name,
        "bounds": rect(bounds),
        "header": {
            "flags": flags,
            "arenaRuleMode": flags[2],
            "sessionFlag": flags[5],
            "compatibilityFlags": b64(compatibility),
            "environmentMode": layout_byte,
            "trailing": b64(trailing),
        },
    }, end


def encode_header(payload: bytes, meta: dict[str, Any]) -> bytes:
    old, old_end = parse_header(payload)
    tail = bytearray(payload[old_end:])
    header = meta.get("header", {})
    if "flags" in header:
        values = bytes(int(value) & 0xFF for value in header["flags"])
        if len(values) != 6:
            raise FormatError("meta.header.flags must contain six bytes")
        tail[0:6] = values
    old_header = old["header"]
    if "arenaRuleMode" in header:
        flags_changed = tail[2] != old_header["flags"][2]
        alias_changed = int(header["arenaRuleMode"]) != old_header["arenaRuleMode"]
        if alias_changed or not flags_changed:
            tail[2] = int(header["arenaRuleMode"]) & 0xFF
    if "sessionFlag" in header:
        flags_changed = tail[5] != old_header["flags"][5]
        alias_changed = int(header["sessionFlag"]) != old_header["sessionFlag"]
        if alias_changed or not flags_changed:
            tail[5] = int(header["sessionFlag"]) & 0xFF
    if "compatibilityFlags" in header:
        compatibility = unb64(header["compatibilityFlags"])
        if len(compatibility) != 512:
            raise FormatError("compatibilityFlags must decode to 512 bytes")
        tail[6:518] = compatibility
    if "environmentMode" in header:
        tail[518] = int(header["environmentMode"]) & 0xFF
    bounds = rect_values(meta["bounds"], old["bounds"])
    struct.pack_into("<4f", tail, 519, *bounds)
    return encode_native_string(str(meta["name"])) + tail


def decode_object(type_id: int, chunks: list[Chunk], index: int) -> dict[str, Any]:
    item: dict[str, Any] = {
        "eid": f"object-{index}",
        "typeId": type_id,
        "typeName": TYPE_NAMES.get(type_id),
        "raw": raw_chunks(chunks),
    }
    if type_id not in KNOWN_PLACEABLES or len(chunks) != 3:
        return item
    common, _visual, subtype = chunks
    if len(common.payload) != 41:
        return item
    x, y = struct.unpack_from("<2f", common.payload)
    item["pos"] = vec2(x, y)
    data = subtype.payload
    if type_id == 2001 and len(data) == 5:
        primary, secondary, visible = struct.unpack("<HHB", data)
        item.update(
            variant=primary,
            secondaryVariant=secondary,
            secondaryVisible=bool(visible),
            secondaryVisibleByte=visible,
            atlasEntry=264 + primary,
            secondaryAtlasEntry=243 + secondary,
        )
    elif type_id == 2009 and len(data) == 2:
        (variant,) = struct.unpack("<H", data)
        item.update(variant=variant, atlasEntry=156 + variant)
    elif type_id == 2029 and len(data) == 20:
        primary, overlay = struct.unpack_from("<HH", data)
        tint = struct.unpack_from("<4f", data, 4)
        item.update(
            variant=primary,
            overlayVariant=overlay,
            atlasEntry=97 + primary,
            overlayAtlasEntry=88 + overlay,
            tint={"r": tint[0], "g": tint[1], "b": tint[2], "a": tint[3]},
        )
    elif type_id == 2040 and len(data) == 2:
        (variant,) = struct.unpack("<H", data)
        item.update(variant=variant, atlasEntries=[148 + variant, 152 + variant])
    elif type_id == 2061 and len(data) == 12:
        subtype, phase, active, timer, reward_seed = struct.unpack("<HBBII", data)
        visual = subtype * 2 + phase
        item.update(
            variant=visual,
            subtype=subtype,
            phase=phase,
            active=bool(active),
            activeByte=active,
            timer=timer,
            rewardSeed=reward_seed,
            atlasEntry=145 + visual,
        )
    return item


def default_common(type_id: int, position: dict[str, Any]) -> tuple[Chunk, Chunk]:
    radius = {2001: 8.0, 2009: 1.0, 2029: 0.01, 2040: 1.0, 2061: 20.0}[type_id]
    category = 8196 if type_id == 2061 else 4
    draw_bias = -50.0 if type_id == 2040 else 0.0
    first = struct.pack(
        "<7fIBII",
        float(position["x"]),
        float(position["y"]),
        0.0,
        0.0,
        90000.0,
        0.0,
        radius,
        0,
        0,
        0,
        16,
    )
    second = bytearray()
    second += struct.pack("<BHI", 0, 0, category)
    second += struct.pack("<B6f", 0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0)
    second += struct.pack("<4f", 1.0, 1.0, 1.0, 1.0)
    second += struct.pack("<BffBBBBIf", 0, draw_bias, 1.0, 1, 0, 0, 1, 1000, 1.0)
    second += struct.pack("<4fIIII", 1.0, 1.0, 1.0, 1.0, 0, 0, 0, 0)
    if len(first) != 41 or len(second) != 101:
        raise AssertionError("invalid canonical Puppet payload")
    return Chunk(first, []), Chunk(bytes(second), [])


def encode_object(item: dict[str, Any]) -> list[Chunk]:
    type_id = int(item["typeId"])
    if "raw" in item:
        expected = 3 if type_id in KNOWN_PLACEABLES else None
        chunks = parse_chunks(unb64(item["raw"]), expected)
    elif type_id in KNOWN_PLACEABLES:
        if "pos" not in item:
            raise FormatError("new placeable requires pos")
        first, second = default_common(type_id, item["pos"])
        chunks = [first, second, Chunk(b"", [])]
    else:
        raise FormatError(f"new unknown placeable type {type_id} requires raw")
    if type_id not in KNOWN_PLACEABLES:
        return chunks
    pos = item.get("pos")
    if pos is not None:
        data = bytearray(chunks[0].payload)
        if len(data) != 41:
            raise FormatError("known placeable has invalid common payload")
        struct.pack_into("<2f", data, 0, float(pos["x"]), float(pos["y"]))
        chunks[0].payload = bytes(data)
    subtype = chunks[2]
    if type_id == 2001:
        if "raw" in item and not any(
            key in item for key in ("variant", "secondaryVariant", "secondaryVisible", "secondaryVisibleByte")
        ):
            return chunks
        visible_byte = int(item.get("secondaryVisibleByte", int(bool(item.get("secondaryVisible", True)))))
        if bool(visible_byte) != bool(item.get("secondaryVisible", True)):
            visible_byte = int(bool(item.get("secondaryVisible", True)))
        subtype.payload = struct.pack(
            "<HHB",
            int(item.get("variant", 0)),
            int(item.get("secondaryVariant", 0)),
            visible_byte,
        )
    elif type_id in (2009, 2040):
        if "raw" in item and "variant" not in item:
            return chunks
        subtype.payload = struct.pack("<H", int(item.get("variant", 0)))
    elif type_id == 2029:
        if "raw" in item and not any(key in item for key in ("variant", "overlayVariant", "tint")):
            return chunks
        tint = item.get("tint", {"r": 1, "g": 1, "b": 1, "a": 1})
        subtype.payload = struct.pack(
            "<HH4f",
            int(item.get("variant", 0)),
            int(item.get("overlayVariant", 0)),
            float(tint["r"]),
            float(tint["g"]),
            float(tint["b"]),
            float(tint["a"]),
        )
    elif type_id == 2061:
        if "raw" in item and not any(
            key in item for key in ("variant", "subtype", "phase", "active", "timer", "rewardSeed")
        ):
            return chunks
        visual = int(item.get("variant", 0))
        goodie_subtype = int(item.get("subtype", visual // 2))
        phase = int(item.get("phase", visual % 2))
        if "raw" in item and len(subtype.payload) == 12:
            old_subtype, old_phase = struct.unpack_from("<HB", subtype.payload)
            old_visual = old_subtype * 2 + old_phase
            if visual != old_visual and goodie_subtype == old_subtype and phase == old_phase:
                goodie_subtype, phase = divmod(visual, 2)
        active_byte = int(item.get("activeByte", int(bool(item.get("active", False)))))
        if bool(active_byte) != bool(item.get("active", False)):
            active_byte = int(bool(item.get("active", False)))
        subtype.payload = struct.pack(
            "<HBBII",
            goodie_subtype,
            phase,
            active_byte,
            int(item.get("timer", 0)),
            int(item.get("rewardSeed", 0)),
        )
    return chunks


def decode_road(chunk: Chunk, index: int) -> dict[str, Any]:
    item: dict[str, Any] = {"eid": f"road-{index}", "typeId": 3004, "raw": raw_chunks([chunk])}
    if len(chunk.payload) != 69:
        return item
    values = struct.unpack("<4f3I8fB2f", chunk.payload)
    item.update(
        points=[vec2(values[0], values[1]), vec2(values[2], values[3])],
        uid=values[4],
        previousUid=values[5],
        nextUid=values[6],
        quad=[vec2(values[i], values[i + 1]) for i in range(7, 15, 2)],
        style=values[15],
        startWidthScale=values[16],
        endWidthScale=values[17],
    )
    return item


def road_quad(points: list[dict[str, Any]], start_scale: float, end_scale: float) -> list[dict[str, float]]:
    ax, ay = float(points[0]["x"]), float(points[0]["y"])
    bx, by = float(points[1]["x"]), float(points[1]["y"])
    dx, dy = bx - ax, by - ay
    length = math.hypot(dx, dy)
    nx, ny = ((-dy / length, dx / length) if length else (0.0, 1.0))
    return [
        vec2(ax + nx * 55.0 * start_scale, ay + ny * 55.0 * start_scale),
        vec2(ax - nx * 55.0 * start_scale, ay - ny * 55.0 * start_scale),
        vec2(bx + nx * 55.0 * end_scale, by + ny * 55.0 * end_scale),
        vec2(bx - nx * 55.0 * end_scale, by - ny * 55.0 * end_scale),
    ]


def encode_road(item: dict[str, Any], allocate_uid: "UidAllocator") -> Chunk:
    old: tuple[Any, ...] | None = None
    if "raw" in item:
        chunk = parse_chunks(unb64(item["raw"]), 1)[0]
        if len(chunk.payload) == 69:
            old = struct.unpack("<4f3I8fB2f", chunk.payload)
    else:
        chunk = Chunk(b"", [])
    if "points" not in item:
        if "raw" in item:
            return chunk
        raise FormatError("new Road requires two points")
    points = item["points"]
    start_scale = float(item.get("startWidthScale", 1.0))
    end_scale = float(item.get("endWidthScale", 1.0))
    quad = item.get("quad")
    if old is not None:
        old_points = [(old[0], old[1]), (old[2], old[3])]
        changed = any(
            (float(points[i]["x"]), float(points[i]["y"])) != old_points[i]
            for i in range(2)
        ) or start_scale != old[16] or end_scale != old[17]
        old_quad = [vec2(old[i], old[i + 1]) for i in range(7, 15, 2)]
        if changed and quad == old_quad:
            quad = None
    if quad is None:
        quad = road_quad(points, start_scale, end_scale)
    flat_quad = [float(value) for point in quad for value in (point["x"], point["y"])]
    chunk.payload = struct.pack(
        "<4f3I8fB2f",
        float(points[0]["x"]),
        float(points[0]["y"]),
        float(points[1]["x"]),
        float(points[1]["y"]),
        int(item["uid"]) if "uid" in item else allocate_uid.next(),
        int(item.get("previousUid", 0xFFFFFFFF)),
        int(item.get("nextUid", 0xFFFFFFFF)),
        *flat_quad,
        int(item.get("style", 0)),
        start_scale,
        end_scale,
    )
    return chunk


def decode_fence(chunk: Chunk, index: int) -> dict[str, Any]:
    item: dict[str, Any] = {"eid": f"fence-{index}", "typeId": 3005, "raw": raw_chunks([chunk])}
    if len(chunk.payload) != 29:
        return item
    values = struct.unpack("<4f3IB", chunk.payload)
    item.update(
        points=[vec2(values[0], values[1]), vec2(values[2], values[3])],
        uid=values[4],
        startPostVariant=values[5],
        endPostVariant=values[6],
        segmentCode=values[7],
        style=values[7],
    )
    return item


def encode_fence(item: dict[str, Any], allocate_uid: "UidAllocator") -> Chunk:
    chunk = parse_chunks(unb64(item["raw"]), 1)[0] if "raw" in item else Chunk(b"", [])
    if "points" not in item:
        if "raw" in item:
            return chunk
        raise FormatError("new Fence requires two points")
    points = item["points"]
    old_segment = chunk.payload[28] if len(chunk.payload) == 29 else 0
    segment_code = int(item.get("segmentCode", item.get("style", old_segment)))
    style_alias = int(item.get("style", old_segment))
    if segment_code == old_segment and style_alias != old_segment:
        segment_code = style_alias
    chunk.payload = struct.pack(
        "<4f3IB",
        float(points[0]["x"]),
        float(points[0]["y"]),
        float(points[1]["x"]),
        float(points[1]["y"]),
        int(item["uid"]) if "uid" in item else allocate_uid.next(),
        int(item.get("startPostVariant", 0xFFFFFFFF)),
        int(item.get("endPostVariant", 0xFFFFFFFF)),
        segment_code,
    )
    return chunk


def decode_terrain(chunk: Chunk, index: int) -> dict[str, Any]:
    item: dict[str, Any] = {"eid": f"terrain-{index}", "typeId": 3009, "raw": raw_chunks([chunk])}
    data = chunk.payload
    try:
        offset = 0
        style, reserved, count = struct.unpack_from("<III", data, offset)
        offset += 12
        points = [vec2(*struct.unpack_from("<2f", data, offset + i * 8)) for i in range(count)]
        offset += count * 8
        uid, profile_count = struct.unpack_from("<II", data, offset)
        offset += 8
        profile = list(struct.unpack_from(f"<{profile_count}f", data, offset)) if profile_count else []
        offset += profile_count * 4
        (side_sign,) = struct.unpack_from("<f", data, offset)
        offset += 4
        if offset != len(data):
            raise FormatError("trailing Terrain bytes")
    except (struct.error, FormatError):
        return item
    item.update(
        points=points,
        pos=points[0] if points else vec2(0.0, 0.0),
        style=style,
        entry=style,
        reserved=reserved,
        uid=uid,
        profileSamples=profile,
        sideSign=side_sign,
    )
    return item


def encode_terrain(item: dict[str, Any], allocate_uid: "UidAllocator") -> Chunk:
    chunk = parse_chunks(unb64(item["raw"]), 1)[0] if "raw" in item else Chunk(b"", [])
    points = item.get("points")
    if points is None:
        if "pos" not in item and "raw" in item:
            return chunk
        points = [item["pos"]]
    profile = [float(value) for value in item.get("profileSamples", [])]
    result = bytearray(
        struct.pack(
            "<III",
            int(item.get("style", item.get("entry", 0))),
            int(item.get("reserved", 0xCDCDCDCD)),
            len(points),
        )
    )
    for point in points:
        result += struct.pack("<2f", float(point["x"]), float(point["y"]))
    uid = int(item["uid"]) if "uid" in item else allocate_uid.next()
    result += struct.pack("<II", uid, len(profile))
    if profile:
        result += struct.pack(f"<{len(profile)}f", *profile)
    result += struct.pack("<f", float(item.get("sideSign", 1.0)))
    chunk.payload = bytes(result)
    return chunk


def decode_sprite(data: bytes, offset: int, index: int) -> dict[str, Any]:
    atlas, x, y, rotation, scale, alpha, flags = struct.unpack_from("<I5fB", data, offset)
    raw = data[offset : offset + 25]
    return {
        "eid": f"sprite-{index}",
        "atlasEntry": atlas,
        "deadHawgEntry": STATIC_SPRITE_ATLAS_BASE + atlas,
        "pos": vec2(x, y),
        "rotationDeg": rotation,
        "scale": scale,
        "alpha": alpha,
        "s0": rotation,
        "s1": scale,
        "s2": alpha,
        "flags": flags,
        "raw": b64(raw),
    }


def encode_sprite(item: dict[str, Any]) -> bytes:
    rotation = float(item.get("rotationDeg", item.get("s0", 0.0)))
    scale = float(item.get("scale", item.get("s1", 1.0)))
    alpha = float(item.get("alpha", item.get("s2", 1.0)))
    if "raw" in item and len(unb64(item["raw"])) == 25:
        old = struct.unpack("<I5fB", unb64(item["raw"]))
        if float(item.get("s0", old[3])) != old[3] and rotation == old[3]:
            rotation = float(item["s0"])
        if float(item.get("s1", old[4])) != old[4] and scale == old[4]:
            scale = float(item["s1"])
        if float(item.get("s2", old[5])) != old[5] and alpha == old[5]:
            alpha = float(item["s2"])
    return struct.pack(
        "<I5fB",
        int(item["atlasEntry"]),
        float(item["pos"]["x"]),
        float(item["pos"]["y"]),
        rotation,
        scale,
        alpha,
        int(item.get("flags", 0)),
    )


class PayloadCursor:
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.offset = 0

    def u8(self) -> int:
        value = self.data[self.offset]
        self.offset += 1
        return value

    def u32(self) -> int:
        value = struct.unpack_from("<I", self.data, self.offset)[0]
        self.offset += 4
        return value

    def f32(self) -> float:
        value = struct.unpack_from("<f", self.data, self.offset)[0]
        self.offset += 4
        return value

    def string(self) -> str:
        value, self.offset = native_string(self.data, self.offset)
        return value

    def rect(self) -> dict[str, float]:
        value = rect(struct.unpack_from("<4f", self.data, self.offset))
        self.offset += 16
        return value


def decode_monster(chunk: Chunk, index: int) -> dict[str, Any]:
    item: dict[str, Any] = {
        "typeId": 6001,
        "typeName": TYPE_NAMES[6001],
        "raw": raw_chunks([chunk]),
        "index": index,
    }
    try:
        p = PayloadCursor(chunk.payload)
        item.update(
            enemyType=p.u32(),
            name=p.string(),
            uid=p.u32(),
            maxHp=p.f32(),
            primaryDamage=p.f32(),
            chaseSpeed=p.f32(),
            moveSpeedScale=p.f32(),
            variantMode=p.u32(),
            projectileMode=p.u32(),
            auraMode=p.u32(),
            headgearMode=p.u8(),
            unknown81=p.u8(),
            unknown82=p.u8(),
            randomVariant=p.u8(),
            archetype=p.string(),
            hasLinkedUid=bool(linked_uid_byte := p.u8()),
            hasLinkedUidByte=linked_uid_byte,
            linkedUid=p.u32(),
            behaviorCount=p.u32(),
            behaviorMin=p.u32(),
            behaviorMax=p.u32(),
            flanking=bool(flanking_byte := p.u8()),
            flankingByte=flanking_byte,
            pathfindingMode=p.u8(),
            dropOrbs=p.u8(),
            dropPowerups=p.u8(),
            dropItems=p.u8(),
            dropSpecificItems=p.u8(),
            dropGold=p.u8(),
            dropPotions=p.u8(),
            specialSpawnMode=p.u8(),
            attackSpeed=p.f32(),
            xpBonus=p.f32(),
            secondaryDamage=p.f32(),
            shield=bool(shield_byte := p.u8()),
            shieldByte=shield_byte,
            shieldOthers=bool(shield_others_byte := p.u8()),
            shieldOthersByte=shield_others_byte,
            unknown96=bool(unknown96_byte := p.u8()),
            unknown96Byte=unknown96_byte,
            burning=bool(burning_byte := p.u8()),
            burningByte=burning_byte,
            tertiaryDamage=p.f32(),
            extraDamage=p.f32(),
            behaviorTimer=p.u32(),
            rect98=p.rect(),
            rectA8=p.rect(),
            castMode=p.u8(),
        )
        if p.offset != len(chunk.payload):
            raise FormatError("trailing MonsterRecipe bytes")
    except (IndexError, struct.error, FormatError):
        return {
            "typeId": 6001,
            "typeName": TYPE_NAMES[6001],
            "raw": raw_chunks([chunk]),
            "index": index,
        }
    return item


def encode_monster(item: dict[str, Any], allocate_uid: "UidAllocator") -> Chunk:
    chunk = parse_chunks(unb64(item["raw"]), 1)[0] if "raw" in item else Chunk(b"", [])
    if "raw" in item and "enemyType" not in item:
        return chunk
    rect98 = rect_values(item.get("rect98", {"x": 0, "y": 0, "w": 0, "h": 0}))
    rect_a8 = rect_values(item.get("rectA8", {"x": 0, "y": 0, "w": 0, "h": 0}))
    linked_uid_byte = int(item.get("hasLinkedUidByte", int(bool(item.get("hasLinkedUid", False)))))
    if bool(linked_uid_byte) != bool(item.get("hasLinkedUid", False)):
        linked_uid_byte = int(bool(item.get("hasLinkedUid", False)))

    def preserved_bool_byte(field: str, raw_field: str, default: bool = False) -> int:
        value = int(item.get(raw_field, int(bool(item.get(field, default)))))
        if bool(value) != bool(item.get(field, default)):
            return int(bool(item.get(field, default)))
        return value
    parts = [
        struct.pack("<I", int(item.get("enemyType", 0))),
        encode_native_string(str(item.get("name", "Monster"))),
        struct.pack(
            "<I4f3I4B",
            int(item["uid"]) if "uid" in item else allocate_uid.next(),
            float(item.get("maxHp", 1.0)),
            float(item.get("primaryDamage", 0.0)),
            float(item.get("chaseSpeed", 0.0)),
            float(item.get("moveSpeedScale", 1.0)),
            int(item.get("variantMode", 0)),
            int(item.get("projectileMode", 0)),
            int(item.get("auraMode", 0)),
            int(item.get("headgearMode", 0)),
            int(item.get("unknown81", 0)),
            int(item.get("unknown82", 0)),
            int(item.get("randomVariant", 0)),
        ),
        encode_native_string(str(item.get("archetype", ""))),
        struct.pack(
            "<BI3I9B3f4B2fI4f4fB",
            linked_uid_byte,
            int(item.get("linkedUid", 0)),
            int(item.get("behaviorCount", 0)),
            int(item.get("behaviorMin", 0)),
            int(item.get("behaviorMax", 0)),
            preserved_bool_byte("flanking", "flankingByte"),
            int(item.get("pathfindingMode", 0)),
            int(item.get("dropOrbs", 0)),
            int(item.get("dropPowerups", 0)),
            int(item.get("dropItems", 0)),
            int(item.get("dropSpecificItems", 0)),
            int(item.get("dropGold", 0)),
            int(item.get("dropPotions", 0)),
            int(item.get("specialSpawnMode", 0)),
            float(item.get("attackSpeed", 0.0)),
            float(item.get("xpBonus", 0.0)),
            float(item.get("secondaryDamage", 0.0)),
            preserved_bool_byte("shield", "shieldByte"),
            preserved_bool_byte("shieldOthers", "shieldOthersByte"),
            preserved_bool_byte("unknown96", "unknown96Byte"),
            preserved_bool_byte("burning", "burningByte"),
            float(item.get("tertiaryDamage", 0.0)),
            float(item.get("extraDamage", 0.0)),
            int(item.get("behaviorTimer", 0)),
            *rect98,
            *rect_a8,
            int(item.get("castMode", 0)),
        ),
    ]
    chunk.payload = b"".join(parts)
    return chunk


def decode_uid_group(chunk: Chunk, index: int) -> dict[str, Any]:
    item: dict[str, Any] = {
        "typeId": 6002,
        "typeName": TYPE_NAMES[6002],
        "raw": raw_chunks([chunk]),
        "index": index,
    }
    try:
        p = PayloadCursor(chunk.payload)
        name, uid, count = p.string(), p.u32(), p.u32()
        members = [p.u32() for _ in range(count)]
        tail = [p.u32() for _ in range(4)]
        if p.offset != len(chunk.payload):
            raise FormatError("trailing UIDGroup bytes")
        item.update(name=name, uid=uid, memberUids=members, fields58=tail[:3], field34=tail[3])
    except (IndexError, struct.error, FormatError):
        pass
    return item


def encode_uid_group(item: dict[str, Any], allocate_uid: "UidAllocator") -> Chunk:
    chunk = parse_chunks(unb64(item["raw"]), 1)[0] if "raw" in item else Chunk(b"", [])
    if "raw" in item and "memberUids" not in item:
        return chunk
    members = [int(value) for value in item.get("memberUids", [])]
    fields58 = [int(value) for value in item.get("fields58", [0, 0, 0])]
    if len(fields58) != 3:
        raise FormatError("UIDGroup fields58 must contain three u32 values")
    chunk.payload = (
        encode_native_string(str(item.get("name", "UID Group")))
        + struct.pack(
            "<II",
            int(item["uid"]) if "uid" in item else allocate_uid.next(),
            len(members),
        )
        + (struct.pack(f"<{len(members)}I", *members) if members else b"")
        + struct.pack("<4I", *fields58, int(item.get("field34", 0)))
    )
    return chunk


def decode_opaque(type_id: int, chunk: Chunk, index: int) -> dict[str, Any]:
    return {"typeId": type_id, "typeName": TYPE_NAMES.get(type_id), "index": index, "raw": raw_chunks([chunk])}


def timeline_metadata(chunk: Chunk, index: int) -> dict[str, Any]:
    item: dict[str, Any] = {"typeId": 6006, "index": index, "raw": raw_chunks([chunk])}
    try:
        p = PayloadCursor(chunk.payload)
        name, uid, enabled, count = p.string(), p.u32(), p.u8(), p.u32()
        event_types = [p.u32() for _ in range(count)]
        event_uids = [struct.unpack_from("<I", child.payload)[0] for child in chunk.children[:count] if len(child.payload) >= 4]
        item.update(
            name=name,
            uid=uid,
            enabled=bool(enabled),
            eventCount=count,
            eventTypeIds=event_types,
            reservedUids=[uid, *event_uids],
        )
    except (IndexError, struct.error, FormatError):
        pass
    return item


def decode_manager_records(section: Chunk, decoder: Any) -> list[dict[str, Any]]:
    ids, children = manager(section)
    if len(children) != len(ids):
        raise FormatError("manager child count does not match object count")
    return [decoder(type_id, child, index) for index, (type_id, child) in enumerate(zip(ids, children, strict=True))]


def parse_document(data: bytes, label: str = "<memory>") -> dict[str, Any]:
    buffer = parse_buffer(data, label)
    arena, layout = arena_and_layout(buffer)
    header, _ = parse_header(arena.children[0].payload)
    header["raw"] = {
        "file": b64(data),
        "arenaSections": [b64(encode_chunk(section)) for section in arena.children],
    }

    object_ids, object_children = manager(layout.children[0])
    objects: list[dict[str, Any]] = []
    child_index = 0
    for index, type_id in enumerate(object_ids):
        take = 3 if type_id in KNOWN_PLACEABLES else 1
        if child_index + take > len(object_children):
            raise FormatError("world-object record is missing chunks")
        chunks = object_children[child_index : child_index + take]
        objects.append(decode_object(type_id, chunks, index))
        child_index += take
    if child_index != len(object_children):
        raise FormatError("unclaimed world-object chunks")

    road_ids, road_children = manager(layout.children[5])
    if road_ids != [3004] * len(road_ids) or len(road_children) != len(road_ids):
        raise FormatError("unsupported Road manager shape")
    fence_ids, fence_children = manager(layout.children[6])
    if fence_ids != [3005] * len(fence_ids) or len(fence_children) != len(fence_ids):
        raise FormatError("unsupported Fence manager shape")
    terrain_ids, terrain_children = manager(layout.children[12])
    if terrain_ids != [3009] * len(terrain_ids) or len(terrain_children) != len(terrain_ids):
        raise FormatError("unsupported Terrain manager shape")

    sprite_payload = layout.children[11].payload
    if len(sprite_payload) < 4:
        raise FormatError("truncated static-sprite list")
    sprite_count = struct.unpack_from("<I", sprite_payload)[0]
    if len(sprite_payload) != 4 + sprite_count * 25:
        raise FormatError("invalid static-sprite list")

    monster_ids, monster_children = manager(layout.children[3])
    uid_ids, uid_children = manager(layout.children[4])
    item_records = decode_manager_records(layout.children[7], decode_opaque)
    item_set_records = decode_manager_records(layout.children[8], decode_opaque)
    npc_ids, npc_children = manager(layout.children[9])
    timeline_ids, timeline_children = manager(layout.children[13])

    monsters = [decode_monster(child, i) if type_id == 6001 else decode_opaque(type_id, child, i) for i, (type_id, child) in enumerate(zip(monster_ids, monster_children, strict=True))]
    uid_groups = [decode_uid_group(child, i) if type_id == 6002 else decode_opaque(type_id, child, i) for i, (type_id, child) in enumerate(zip(uid_ids, uid_children, strict=True))]
    npcs = [decode_opaque(type_id, child, i) for i, (type_id, child) in enumerate(zip(npc_ids, npc_children, strict=True))]
    timelines = [timeline_metadata(child, i) if type_id == 6006 else decode_opaque(type_id, child, i) for i, (type_id, child) in enumerate(zip(timeline_ids, timeline_children, strict=True))]

    spawn_payload = layout.children[2].payload
    geometry: dict[str, Any] = {
        "triggerControlRaw": b64(encode_chunk(layout.children[1])),
        "regionGeometryRaw": b64(encode_chunk(layout.children[2])),
        "layoutFlagRaw": b64(layout.children[10].payload),
        "rawSections": [b64(encode_chunk(section)) for section in layout.children],
    }
    if len(spawn_payload) == 12:
        x, y, facing = struct.unpack("<3f", spawn_payload)
        geometry.update(playerSpawn=vec2(x, y), playerSpawnFacingDeg=facing)
    if len(layout.children[10].payload) == 1:
        geometry["layoutFlag"] = layout.children[10].payload[0]

    opaque: list[dict[str, Any]] = []
    for record in monsters:
        opaque.append({"kind": "monsterRecipe", "label": record.get("name"), "raw": record["raw"]})
    for record in item_records:
        opaque.append({"kind": "itemRecipe", "raw": record["raw"]})
    for record in npcs:
        opaque.append({"kind": "npcRecipe", "label": record.get("name"), "raw": record["raw"]})
    for record in item_set_records:
        opaque.append({"kind": "itemSet", "raw": record["raw"]})
    for record in uid_groups:
        opaque.append({"kind": "uidGroup", "label": record.get("name"), "raw": record["raw"]})
    for record in timelines:
        opaque.append({"kind": "timeline", "label": record.get("name"), "raw": record["raw"]})

    return {
        "format": "solomon-dark-boneyard",
        "version": 1,
        "meta": header,
        "objects": objects,
        "roads": [decode_road(child, i) for i, child in enumerate(road_children)],
        "fences": [decode_fence(child, i) for i, child in enumerate(fence_children)],
        "terrain": [decode_terrain(child, i) for i, child in enumerate(terrain_children)],
        "sprites": [decode_sprite(sprite_payload, 4 + i * 25, i) for i in range(sprite_count)],
        "recipes": {
            "monsters": monsters,
            "items": item_records,
            "npcs": npcs,
            "itemSets": item_set_records,
            "uidGroups": uid_groups,
        },
        "timeline": {"records": timelines, "defaultTransplantSafe": False},
        "geometry": geometry,
        "opaque": opaque,
        "hasTimeline": bool(timelines),
    }


class UidAllocator:
    def __init__(self, document: dict[str, Any]) -> None:
        values = [50_000]
        for collection in (document.get("roads", []), document.get("fences", []), document.get("terrain", [])):
            values.extend(int(item["uid"]) for item in collection if "uid" in item)
        for key in ("monsters", "npcs", "uidGroups"):
            values.extend(int(item["uid"]) for item in document.get("recipes", {}).get(key, []) if "uid" in item)
        for timeline in document.get("timeline", {}).get("records", []):
            values.extend(int(value) for value in timeline.get("reservedUids", []))
        self.value = max(values) + 1

    def next(self) -> int:
        result = self.value
        self.value += 1
        return result


def raw_record(item: dict[str, Any]) -> Chunk:
    if "raw" not in item:
        raise FormatError(f"type {item.get('typeId')} is preserve-only and requires raw")
    return parse_chunks(unb64(item["raw"]), 1)[0]


def timeline_raw_record(item: dict[str, Any]) -> Chunk:
    chunk = raw_record(item)
    if int(item["typeId"]) != 6006:
        return chunk
    original = timeline_metadata(chunk, int(item.get("index", 0)))
    for key in ("name", "uid", "enabled", "eventCount", "eventTypeIds", "reservedUids"):
        if key in item and item[key] != original.get(key):
            raise FormatError(f"TimeLine is preserve-only; {key} does not match raw")
    return chunk


def set_record_manager(section: Chunk, records: list[dict[str, Any]], encoder: Any) -> None:
    ids: list[int] = []
    children: list[Chunk] = []
    for item in records:
        ids.append(int(item["typeId"]))
        children.append(encoder(item))
    set_manager(section, ids, children)


def build_document(document: dict[str, Any]) -> bytes:
    try:
        raw_file = document["meta"]["raw"]["file"]
    except (KeyError, TypeError) as exc:
        raise FormatError("build requires meta.raw.file from parse or new") from exc
    buffer = parse_buffer(unb64(raw_file), "meta.raw.file")
    arena, layout = arena_and_layout(buffer)
    arena.children[0].payload = encode_header(arena.children[0].payload, document["meta"])
    allocator = UidAllocator(document)

    object_ids: list[int] = []
    object_children: list[Chunk] = []
    for item in document.get("objects", []):
        object_ids.append(int(item["typeId"]))
        object_children.extend(encode_object(item))
    set_manager(layout.children[0], object_ids, object_children)

    set_manager(
        layout.children[5],
        [3004] * len(document.get("roads", [])),
        [encode_road(item, allocator) for item in document.get("roads", [])],
    )
    set_manager(
        layout.children[6],
        [3005] * len(document.get("fences", [])),
        [encode_fence(item, allocator) for item in document.get("fences", [])],
    )
    set_manager(
        layout.children[12],
        [3009] * len(document.get("terrain", [])),
        [encode_terrain(item, allocator) for item in document.get("terrain", [])],
    )

    sprites = document.get("sprites", [])
    layout.children[11].payload = struct.pack("<I", len(sprites)) + b"".join(encode_sprite(item) for item in sprites)

    recipes = document.get("recipes", {})
    set_record_manager(
        layout.children[3],
        recipes.get("monsters", []),
        lambda item: encode_monster(item, allocator) if int(item["typeId"]) == 6001 else raw_record(item),
    )
    set_record_manager(
        layout.children[4],
        recipes.get("uidGroups", []),
        lambda item: encode_uid_group(item, allocator) if int(item["typeId"]) == 6002 else raw_record(item),
    )
    set_record_manager(layout.children[7], recipes.get("items", []), raw_record)
    set_record_manager(layout.children[8], recipes.get("itemSets", []), raw_record)
    set_record_manager(layout.children[9], recipes.get("npcs", []), raw_record)
    set_record_manager(
        layout.children[13],
        document.get("timeline", {}).get("records", []),
        timeline_raw_record,
    )

    geometry = document.get("geometry", {})
    if "playerSpawn" in geometry:
        position = geometry["playerSpawn"]
        layout.children[2].payload = struct.pack(
            "<3f",
            float(position["x"]),
            float(position["y"]),
            float(geometry.get("playerSpawnFacingDeg", 0.0)),
        )
    if "layoutFlag" in geometry:
        layout.children[10].payload = bytes((int(geometry["layoutFlag"]) & 0xFF,))
    return encode_buffer(buffer)


def workspace_root() -> Path:
    return Path(__file__).resolve().parents[3]


def default_fixture() -> Path:
    return workspace_root() / "Solomon Dark/Mod Loader/tests/fixtures/boneyards/flat_multiplayer_test.boneyard"


def default_corpus() -> list[Path]:
    root = workspace_root() / "Solomon Dark"
    result = [
        root / "SolomonDarkAbandonware/data/levels/story0.boneyard",
        root / "SolomonDarkAbandonware/data/levels/story1.boneyard",
        root / "SolomonDarkAbandonware/data/levels/survival.boneyard",
        root / "SolomonDarkAbandonware/data/levels/tutorial.boneyard",
        root / "SolomonDarkAbandonware/sandbox/play.boneyard",
        root / "Mod Loader/tests/fixtures/boneyards/flat_multiplayer_test.boneyard",
    ]
    captures = root / "SolomonDarkAbandonware/sandbox/DarkCloud/mylevels"
    if captures.is_dir():
        result.extend(sorted(captures.glob("*.boneyard")))
    return result


def write_json(document: dict[str, Any], output: Path | None) -> None:
    rendered = json.dumps(document, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    if output is None:
        sys.stdout.write(rendered)
    else:
        output.write_text(rendered, encoding="utf-8")


def command_parse(args: argparse.Namespace) -> int:
    write_json(parse_document(args.file.read_bytes(), str(args.file)), args.output)
    return 0


def command_build(args: argparse.Namespace) -> int:
    document = json.loads(args.input.read_text(encoding="utf-8"))
    args.output.write_bytes(build_document(document))
    return 0


def command_roundtrip(args: argparse.Namespace) -> int:
    paths = args.files or default_corpus()
    failed = False
    print(f"{'FILE':<46} {'BYTES':>10}  RESULT")
    for path in paths:
        try:
            source = path.read_bytes()
            document = parse_document(source, str(path))
            document = json.loads(json.dumps(document, allow_nan=False))
            rebuilt = build_document(document)
            ok = rebuilt == source
            detail = "byte-identical" if ok else f"DIFF rebuilt={len(rebuilt)}"
            failed |= not ok
            print(f"{path.name:<46} {len(source):>10}  {detail}")
        except (OSError, ValueError, KeyError) as exc:
            failed = True
            print(f"{path.name:<46} {'-':>10}  ERROR {exc}")
    return 1 if failed else 0


def command_new(args: argparse.Namespace) -> int:
    fixture = args.fixture or default_fixture()
    document = parse_document(fixture.read_bytes(), str(fixture))
    document["meta"]["name"] = args.name
    document["objects"] = []
    document["roads"] = []
    document["fences"] = []
    document["terrain"] = []
    document["sprites"] = []
    document["recipes"] = {"monsters": [], "items": [], "npcs": [], "itemSets": [], "uidGroups": []}
    document["opaque"] = [item for item in document["opaque"] if item["kind"] == "timeline"]
    document["timeline"]["defaultTransplantSafe"] = True
    result = build_document(document)
    parse_buffer(result, str(args.output))
    args.output.write_bytes(result)
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    commands = result.add_subparsers(dest="command", required=True)

    parse = commands.add_parser("parse", help="write semantic lossless JSON")
    parse.add_argument("file", type=Path)
    parse.add_argument("-o", "--output", type=Path)
    parse.set_defaults(run=command_parse)

    build = commands.add_parser("build", help="build a Boneyard from semantic JSON")
    build.add_argument("input", type=Path)
    build.add_argument("-o", "--output", type=Path, required=True)
    build.set_defaults(run=command_build)

    roundtrip = commands.add_parser("roundtrip", help="verify byte-identical parse/build")
    roundtrip.add_argument("files", type=Path, nargs="*")
    roundtrip.set_defaults(run=command_roundtrip)

    new = commands.add_parser("new", help="create a minimal authored Boneyard")
    new.add_argument("--name", required=True)
    new.add_argument("-o", "--output", type=Path, required=True)
    new.add_argument("--fixture", type=Path)
    new.set_defaults(run=command_new)
    return result


def main() -> int:
    args = parser().parse_args()
    try:
        return int(args.run(args))
    except (OSError, FormatError, json.JSONDecodeError, KeyError, TypeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
