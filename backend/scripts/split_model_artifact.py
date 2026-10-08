"""Additive, bounded artifact splitting; never alters the original checkpoint."""
import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


PART_BYTES = 40 * 1024 * 1024
CHUNK_BYTES = 64 * 1024
MAX_BYTES = 100 * 1024 * 1024


def split_artifact(source: Path, output: Path, expected_hash: str) -> dict[str, Any]:
    """Split into ordered parts and verify saved bytes match the trusted hash."""
    if output.exists():
        raise ValueError('Output exists; choose a new directory')
    if not source.is_file() or not 0 < source.stat().st_size <= MAX_BYTES:
        raise ValueError('Source must be a nonempty artifact no larger than 100 MiB')
    with source.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != expected_hash:
            raise ValueError('Source hash mismatch')
    source_size = source.stat().st_size
    output.mkdir(parents=True)
    parts = []
    total_hash = hashlib.sha256()
    with source.open('rb') as stream:
        while stream.tell() < source_size:
            name = f'{source.name}.part{len(parts) + 1:03d}'
            part_hash = hashlib.sha256()
            size = 0
            with (output / name).open('xb') as target:
                while size < PART_BYTES:
                    chunk = stream.read(min(CHUNK_BYTES, PART_BYTES - size, source_size - stream.tell()))
                    if not chunk:
                        break
                    target.write(chunk)
                    size += len(chunk)
                    part_hash.update(chunk)
                    total_hash.update(chunk)
            parts.append(dict(file=name, bytes=size, sha256=part_hash.hexdigest()))
    if total_hash.hexdigest() != expected_hash:
        raise ValueError('Source changed during splitting; do not upload these parts')
    with source.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != expected_hash:
            raise ValueError('Original source changed; do not upload these parts')
    # Verify actual saved bytes in order, without allocating the whole model.
    saved_hash = hashlib.sha256()
    for part in parts:
        with (output / part['file']).open('rb') as stream:
            while chunk := stream.read(CHUNK_BYTES):
                saved_hash.update(chunk)
    if saved_hash.hexdigest() != expected_hash:
        raise ValueError('Saved part verification failed')
    manifest = dict(source=source.name, sha256=expected_hash, parts=parts,
                    reassembled_sha256=saved_hash.hexdigest())
    with (output / 'parts-manifest.json').open('x', encoding='utf-8') as stream:
        json.dump(manifest, stream, indent=2)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    args = parser.parse_args()
    print(json.dumps(split_artifact(args.source.resolve(), args.output.resolve(), args.sha256), indent=2))


if __name__ == '__main__':
    main()
