#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "docs/tasks/tasks.yaml"
TASKS_DIR = ROOT / "docs/tasks"

CANONICAL_HEADINGS = [
    "Objetivo",
    "Archivos a crear o tocar",
    "Dependencias",
    "Referencias obligatorias",
    "Contrato obligatorio",
    "Reglas / invariantes de negocio",
    "No asumir",
    "Casos borde",
    "Lógica de implementación",
    "Tests requeridos",
    "Criterios de aceptación",
]

LEGACY_MARKERS = [
    r"\*\*Archivo a crear\*\*:",
    r"\*\*Archivos a crear\*\*:",
    r"\*\*Depende de\*\*:",
]

ANTI_PATTERNS = {
    "codigo_completo": r"(?m)^##\s+C[oó]digo completo$",
    "codigo_header": r"(?m)^##\s+C[oó]digo$",
    "contenido_referencia_completo": r"(?m)^##\s+Contenido de referencia \(completo\)$",
    "reference_file_dump": r"(?m)^##\s+Estructura del script$",
}


def load_manifest() -> list[dict]:
    data = json.loads(MANIFEST_PATH.read_text())
    return data["tasks"]


def extract_headings(text: str) -> set[str]:
    return set(re.findall(r"(?m)^##\s+(.*)$", text))


def score_line_count(line_count: int) -> int:
    if line_count >= 220:
        return 5
    if line_count >= 160:
        return 4
    if line_count >= 110:
        return 3
    if line_count >= 70:
        return 2
    if line_count >= 40:
        return 1
    return 0


def audit_task(task: dict) -> dict:
    path = ROOT / task["detail_doc"]
    text = path.read_text()
    headings = extract_headings(text)
    line_count = len(text.splitlines())

    missing_headings = [heading for heading in CANONICAL_HEADINGS if heading not in headings]
    legacy_markers = [marker for marker in LEGACY_MARKERS if re.search(marker, text)]
    anti_patterns = [name for name, pattern in ANTI_PATTERNS.items() if re.search(pattern, text)]

    tests_expected = any("tests/" in file_path for file_path in task.get("files", []))
    tests_section_missing = "Tests requeridos" in missing_headings and tests_expected

    score = 0
    score += len(missing_headings) * 2
    score += len(legacy_markers)
    score += len(anti_patterns) * 3
    score += score_line_count(line_count)

    if task.get("hito", 0) >= 5:
        score += 1
    if len(task.get("deps", [])) >= 4:
        score += 1
    if len(task.get("files", [])) >= 3:
        score += 1
    if tests_section_missing:
        score += 1

    if score >= 29:
        band = "alta"
    elif score >= 27:
        band = "media"
    else:
        band = "baja"

    return {
        "id": task["id"],
        "title": task["title"],
        "detail_doc": task["detail_doc"],
        "line_count": line_count,
        "missing_headings": missing_headings,
        "legacy_markers": legacy_markers,
        "anti_patterns": anti_patterns,
        "score": score,
        "band": band,
    }


def print_report(results: list[dict]) -> None:
    print("Auditoría de plantilla de TASKs")
    print()
    print(f"- TASKs auditadas: {len(results)}")
    print(f"- Cumplimiento exacto de plantilla: {sum(1 for item in results if not item['missing_headings'] and not item['legacy_markers'] and not item['anti_patterns'])}")
    print(f"- Migración alta prioridad: {sum(1 for item in results if item['band'] == 'alta')}")
    print(f"- Migración media prioridad: {sum(1 for item in results if item['band'] == 'media')}")
    print(f"- Migración baja prioridad: {sum(1 for item in results if item['band'] == 'baja')}")
    print()
    print("Primera ola recomendada")
    for item in results[:5]:
        reasons: list[str] = []
        if item["anti_patterns"]:
            reasons.append("anti-patterns=" + ",".join(item["anti_patterns"]))
        if item["missing_headings"]:
            reasons.append(f"faltan={len(item['missing_headings'])} secciones")
        reasons.append(f"lineas={item['line_count']}")
        print(f"- {item['id']} ({item['band']}, score={item['score']}): {item['title']} | " + " | ".join(reasons))

    print()
    print("Detalle por TASK")
    for item in results:
        print(f"- {item['id']} | prioridad={item['band']} | score={item['score']} | lineas={item['line_count']} | doc={item['detail_doc']}")
        if item["anti_patterns"]:
            print(f"  anti-patterns: {', '.join(item['anti_patterns'])}")
        if item["legacy_markers"]:
            print(f"  legacy markers: {len(item['legacy_markers'])}")
        if item["missing_headings"]:
            print(f"  faltan secciones: {', '.join(item['missing_headings'])}")


def main() -> int:
    manifest = load_manifest()
    results = [audit_task(task) for task in manifest]
    results.sort(key=lambda item: (-item["score"], -item["line_count"], item["id"]))
    print_report(results)
    return 0


if __name__ == "__main__":
    sys.exit(main())
