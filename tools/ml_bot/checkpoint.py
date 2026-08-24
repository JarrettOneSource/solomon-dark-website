"""Strict compact checkpoint-v7 codec shared with the TypeScript runtime."""

from __future__ import annotations

import json
import os
from pathlib import Path
import struct
import subprocess
import tempfile
from typing import Any, Mapping

import numpy as np

from .spec import POLICY_SPEC, TENSOR_SHAPES
from .spec import REPOSITORY_ROOT

MAGIC = b"SDMLV7\x00\x01"
PREFIX_BYTES = len(MAGIC) + 4


def encode_checkpoint(
    metadata: Mapping[str, Any],
    tensors: Mapping[str, np.ndarray],
) -> bytes:
    normalized = validate_tensors(tensors)
    POLICY_SPEC.validate_metadata(metadata)
    canonical_metadata = canonical_json_value(dict(metadata))
    descriptors: list[dict[str, Any]] = []
    payloads: list[bytes] = []
    byte_offset = 0
    for name in sorted(TENSOR_SHAPES):
        payload = normalized[name].astype("<f4", copy=False).tobytes(order="C")
        descriptors.append(
            {
                "byteLength": len(payload),
                "byteOffset": byte_offset,
                "name": name,
                "shape": list(TENSOR_SHAPES[name]),
            }
        )
        payloads.append(payload)
        byte_offset += len(payload)
    header = json.dumps(
        {"metadata": canonical_metadata, "tensors": descriptors},
        ensure_ascii=False,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    return MAGIC + struct.pack("<I", len(header)) + header + b"".join(payloads)


def canonical_json_value(value: Any) -> Any:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, Mapping):
        return {str(key): canonical_json_value(entry) for key, entry in value.items()}
    if isinstance(value, (list, tuple)):
        return [canonical_json_value(entry) for entry in value]
    return value


def decode_checkpoint(source: bytes | bytearray | memoryview) -> tuple[dict[str, Any], dict[str, np.ndarray]]:
    encoded = bytes(source)
    if len(encoded) < PREFIX_BYTES or encoded[: len(MAGIC)] != MAGIC:
        raise ValueError("checkpoint magic is invalid")
    header_length = struct.unpack_from("<I", encoded, len(MAGIC))[0]
    payload_start = PREFIX_BYTES + header_length
    if payload_start > len(encoded):
        raise ValueError("checkpoint header is truncated")
    try:
        header = json.loads(encoded[PREFIX_BYTES:payload_start].decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("checkpoint header is invalid JSON") from error
    if not isinstance(header, dict) or not isinstance(header.get("metadata"), dict):
        raise ValueError("checkpoint header metadata is missing")
    descriptors = header.get("tensors")
    if not isinstance(descriptors, list):
        raise ValueError("checkpoint tensor descriptors are missing")
    tensors: dict[str, np.ndarray] = {}
    occupied: list[tuple[int, int]] = []
    for descriptor in descriptors:
        if not isinstance(descriptor, dict):
            raise ValueError("checkpoint tensor descriptor must be an object")
        name = descriptor.get("name")
        if not isinstance(name, str) or name not in TENSOR_SHAPES or name in tensors:
            raise ValueError(f"checkpoint tensor {name!r} is unknown or duplicated")
        shape = descriptor.get("shape")
        if shape != list(TENSOR_SHAPES[name]):
            raise ValueError(f"checkpoint tensor {name} shape is invalid")
        byte_offset = descriptor.get("byteOffset")
        byte_length = descriptor.get("byteLength")
        expected_length = int(np.prod(TENSOR_SHAPES[name], dtype=np.int64)) * 4
        if (
            not isinstance(byte_offset, int)
            or isinstance(byte_offset, bool)
            or byte_offset < 0
            or byte_length != expected_length
        ):
            raise ValueError(f"checkpoint tensor {name} descriptor is invalid")
        start = payload_start + byte_offset
        end = start + expected_length
        if end > len(encoded) or any(start < right and end > left for left, right in occupied):
            raise ValueError(f"checkpoint tensor {name} payload is invalid")
        occupied.append((start, end))
        tensors[name] = np.frombuffer(encoded, dtype="<f4", count=expected_length // 4, offset=start).copy().reshape(
            TENSOR_SHAPES[name]
        )
    if set(tensors) != set(TENSOR_SHAPES):
        raise ValueError("checkpoint tensor names do not match schema v7")
    if not occupied or max(end for _, end in occupied) != len(encoded):
        raise ValueError("checkpoint contains trailing or missing payload data")
    metadata = dict(header["metadata"])
    POLICY_SPEC.validate_metadata(metadata)
    validate_tensors(tensors)
    return metadata, tensors


def validate_tensors(tensors: Mapping[str, np.ndarray]) -> dict[str, np.ndarray]:
    if set(tensors) != set(TENSOR_SHAPES):
        raise ValueError("checkpoint tensor names do not match schema v7")
    normalized: dict[str, np.ndarray] = {}
    for name, shape in TENSOR_SHAPES.items():
        value = np.asarray(tensors[name], dtype=np.float32)
        if value.shape != shape:
            raise ValueError(f"checkpoint tensor {name} has shape {value.shape}, expected {shape}")
        if not np.all(np.isfinite(value)):
            raise ValueError(f"checkpoint tensor {name} contains non-finite values")
        normalized[name] = np.ascontiguousarray(value)
    return normalized


def load_checkpoint(path: Path) -> tuple[dict[str, Any], dict[str, np.ndarray]]:
    return decode_checkpoint(path.read_bytes())


def save_checkpoint(
    path: Path,
    metadata: Mapping[str, Any],
    tensors: Mapping[str, np.ndarray],
) -> None:
    atomic_write(path, encode_checkpoint(metadata, tensors))


def atomic_write(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def typescript_checkpoint_report(path: Path, *, node: str = "node") -> Mapping[str, Any]:
    completed = subprocess.run(
        [
            node,
            "--experimental-strip-types",
            "frontend/tools/inspect-ml-bot-checkpoint.mjs",
            str(path.resolve()),
        ],
        cwd=REPOSITORY_ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    try:
        value = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise ValueError("TypeScript checkpoint inspector returned invalid JSON") from error
    if not isinstance(value, dict) or value.get("status") != "ok":
        raise ValueError("TypeScript checkpoint inspector rejected the checkpoint")
    return value
