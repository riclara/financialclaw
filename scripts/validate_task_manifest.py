#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "docs/tasks/tasks.yaml"
HITOS_PATH = ROOT / "docs/hitos.md"


def load_manifest() -> list[dict]:
    raw = MANIFEST_PATH.read_text()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Manifest inválido: {exc}")

    if not isinstance(data, dict) or "tasks" not in data or not isinstance(data["tasks"], list):
        raise SystemExit("Manifest inválido: se esperaba un objeto con la clave 'tasks'.")

    return data["tasks"]


def parse_hitos() -> dict[str, dict]:
    text = HITOS_PATH.read_text()
    sections = re.split(r"(?m)^### ", text)
    tasks: dict[str, dict] = {}

    for section in sections:
        heading = re.match(r"TASK-(\d+) — (.*?) — \[ver detalle\]\((.*?)\)", section)
        if not heading:
            continue

        task_id = f"TASK-{heading.group(1)}"
        title = heading.group(2).strip()
        detail_rel = heading.group(3).strip()

        state_match = re.search(r"- \*\*Estado\*\*: `(.*?)`", section)
        deps_match = re.search(r"- \*\*Dependencias\*\*: (.*)", section)
        files_match = re.search(r"- \*\*Archivo\(s\)\*\*: (.*)", section)

        if not state_match or not deps_match or not files_match:
            raise SystemExit(f"docs/hitos.md: bloque incompleto para {task_id}")

        tasks[task_id] = {
            "title": title,
            "detail_doc": f"docs/{detail_rel}",
            "status": state_match.group(1).strip(),
            "deps": normalize_deps(deps_match.group(1)),
            "deps_note": extract_dep_note(deps_match.group(1)),
            "files": parse_backtick_list(files_match.group(1)),
        }

    return tasks


def parse_task_doc(path: Path) -> dict:
    text = path.read_text()

    heading_match = re.search(r"^# (TASK-\d+):", text, re.M)
    if not heading_match:
        raise SystemExit(f"{path}: no se encontró el heading '# TASK-XX:'")

    deps_raw = "ninguna"
    deps_match = re.search(r"^\*\*Depende de\*\*: (.*)$", text, re.M)
    if deps_match:
        deps_raw = deps_match.group(1).strip()
    else:
        section_match = re.search(
            r"(?ms)^## Dependencias\s+(.*?)(?=^## |\Z)",
            text,
        )
        if section_match:
            lines = []
            for raw_line in section_match.group(1).splitlines():
                line = raw_line.strip()
                if not line or line.startswith("Estas dependencias deben coincidir"):
                    continue
                if line.startswith("- "):
                    lines.append(line[2:].strip())
            deps_raw = ", ".join(lines) if lines else "ninguna"

    return {
        "id": heading_match.group(1),
        "deps": normalize_deps(deps_raw),
        "deps_note": extract_dep_note(deps_raw),
    }


def normalize_deps(raw: str) -> list[str]:
    if raw.strip() in {"ninguna", "nada", "—", "-"}:
        return []
    return re.findall(r"TASK-\d+", raw)


def extract_dep_note(raw: str) -> str | None:
    match = re.search(r"TASK-\d+\s*\((.*)\)", raw)
    return match.group(1).strip() if match else None


def parse_backtick_list(raw: str) -> list[str]:
    return re.findall(r"`([^`]+)`", raw)


def validate() -> list[str]:
    manifest_tasks = load_manifest()
    hitos_tasks = parse_hitos()
    errors: list[str] = []

    manifest_by_id: dict[str, dict] = {}
    for task in manifest_tasks:
        task_id = task.get("id")
        if not task_id:
            errors.append("Manifest: una entrada no tiene 'id'.")
            continue
        if task_id in manifest_by_id:
            errors.append(f"Manifest: id duplicado {task_id}.")
            continue
        manifest_by_id[task_id] = task

    if len(manifest_by_id) != len(hitos_tasks):
        errors.append(
            f"Cantidad de tasks inconsistente: manifest={len(manifest_by_id)} hitos={len(hitos_tasks)}."
        )

    for task_id, manifest in manifest_by_id.items():
        hitos = hitos_tasks.get(task_id)
        if not hitos:
            errors.append(f"{task_id}: no existe en docs/hitos.md.")
            continue

        detail_doc = ROOT / manifest["detail_doc"]
        if not detail_doc.exists():
            errors.append(f"{task_id}: no existe detail_doc {manifest['detail_doc']}.")
            continue

        task_doc = parse_task_doc(detail_doc)

        if manifest["title"] != hitos["title"]:
            errors.append(
                f"{task_id}: title difiere entre manifest ('{manifest['title']}') y hitos ('{hitos['title']}')."
            )

        if manifest["detail_doc"] != hitos["detail_doc"]:
            errors.append(
                f"{task_id}: detail_doc difiere entre manifest ('{manifest['detail_doc']}') y hitos ('{hitos['detail_doc']}')."
            )

        if manifest.get("deps", []) != hitos["deps"]:
            errors.append(
                f"{task_id}: dependencias difieren entre manifest ({manifest.get('deps', [])}) y hitos ({hitos['deps']})."
            )

        if manifest.get("deps_note") != hitos["deps_note"]:
            errors.append(
                f"{task_id}: nota de dependencia difiere entre manifest ({manifest.get('deps_note')!r}) y hitos ({hitos['deps_note']!r})."
            )

        if manifest.get("files", []) != hitos["files"]:
            errors.append(
                f"{task_id}: archivos difieren entre manifest ({manifest.get('files', [])}) y hitos ({hitos['files']})."
            )

        if task_doc["id"] != task_id:
            errors.append(f"{task_id}: el detail_doc reporta id {task_doc['id']}.")

        if task_doc["deps"] != manifest.get("deps", []):
            errors.append(
                f"{task_id}: dependencias difieren entre manifest ({manifest.get('deps', [])}) y detail_doc ({task_doc['deps']})."
            )

        if task_doc["deps_note"] != manifest.get("deps_note"):
            errors.append(
                f"{task_id}: nota de dependencia difiere entre manifest ({manifest.get('deps_note')!r}) y detail_doc ({task_doc['deps_note']!r})."
            )

    for task_id in sorted(set(hitos_tasks) - set(manifest_by_id)):
        errors.append(f"{task_id}: existe en docs/hitos.md pero no en el manifest.")

    return errors


def main() -> int:
    errors = validate()
    if errors:
        print("Se encontraron inconsistencias entre docs/tasks/tasks.yaml, docs/hitos.md y los task docs:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Manifest de tasks consistente con docs/hitos.md y docs/tasks/task-XX.md.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
