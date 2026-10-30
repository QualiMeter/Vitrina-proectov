#!/usr/bin/env python3
"""Static quality gates for the single Vitrina OpenAPI 3.1 contract.

Usage: python scripts/validate_openapi.py
Requires PyYAML and openapi-spec-validator (installed by workflow).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml
from openapi_spec_validator import validate


PATH = Path(__file__).resolve().parent.parent / "docs" / "api" / "openapi.yaml"
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}
MUTATIONS = {"post", "put", "patch", "delete"}


class StrictLoader(yaml.SafeLoader):
    """Do not let YAML silently overwrite duplicate mapping keys."""


def unique_mapping(loader: StrictLoader, node: yaml.MappingNode):
    mapping = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=True)
        if key in mapping:
            raise ValueError(f"Duplicate YAML key: {key!r}, line {key_node.start_mark.line + 1}")
        mapping[key] = loader.construct_object(value_node, deep=True)
    return mapping


StrictLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping
)


def main() -> None:
    doc = yaml.load(PATH.read_text(encoding="utf-8"), Loader=StrictLoader)
    assert isinstance(doc, dict), "OpenAPI root must be an object"

    # Official spec validator catches invalid OAS structure and JSON Schema use.
    validate(doc)

    paths = doc["paths"]
    components = doc.get("components", {})
    ids = {}
    count = 0
    for path, operations in paths.items():
        assert path.startswith("/api/v1/"), f"Incorrect API prefix: {path}"
        assert isinstance(operations, dict), f"Invalid path item: {path}"
        path_params = set(re.findall(r"\{([^{}]+)\}", path))
        for method, operation in operations.items():
            if method not in HTTP_METHODS:
                continue
            where = f"{method.upper()} {path}"
            count += 1
            operation_id = operation.get("operationId")
            assert operation_id, f"Missing operationId: {where}"
            assert operation_id not in ids, f"Duplicate operationId: {operation_id}"
            ids[operation_id] = where
            responses = operation.get("responses") or {}
            assert any(re.fullmatch(r"2\d\d", str(code)) for code in responses), (
                f"No success response: {where}"
            )
            assert "security" in operation, f"Missing explicit security: {where}"
            params = [*operations.get("parameters", []), *operation.get("parameters", [])]
            resolved = []
            for p in params:
                if "$ref" in p:
                    ref = p["$ref"]
                    assert ref.startswith("#/components/parameters/"), (
                        f"Invalid parameter reference {ref} in {where}"
                    )
                    key = ref.rsplit("/", 1)[-1]
                    assert key in components.get("parameters", {}), (
                        f"Unresolved parameter {key} in {where}"
                    )
                    resolved.append(components["parameters"][key])
                else:
                    resolved.append(p)
            actual_path_params = {
                p["name"] for p in resolved if p.get("in") == "path"
            }
            assert path_params == actual_path_params, (
                f"Path parameters mismatch in {where}: {path_params} vs {actual_path_params}"
            )
            if method in MUTATIONS:
                assert any(
                    p.get("in") == "header" and p.get("name") == "X-CSRF-Token"
                    for p in resolved
                ), f"Missing X-CSRF-Token header: {where}"

    assert count >= 94, f"Unexpectedly fewer operations: {count}"
    assert doc["info"]["version"] == "0.1.5-draft", "Unreviewed version bump"
    print(
        f"OpenAPI check passed: {count} operations, "
        f"{len(paths)} paths, {len(components.get('schemas', {}))} schemas"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"OpenAPI validation failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
