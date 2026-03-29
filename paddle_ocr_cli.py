#!/usr/bin/env python3
"""
PaddleOCR CLI para financialclaw.

Usage:
    python3 paddle_ocr_cli.py <image_path>
    python3 paddle_ocr_cli.py --warmup
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

INPUT_IMAGE_MAX_SIDE = 1600
PORTRAIT_INPUT_IMAGE_MAX_SIDE = 2200

_log_level_name = os.environ.get("LOG_LEVEL", "INFO").strip().upper()
_log_level = getattr(logging, _log_level_name, logging.INFO)

logging.basicConfig(level=_log_level, format="%(message)s")
logger = logging.getLogger(__name__)

_ocr_engine = None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _log(level: str, message: str, **context) -> None:
    payload = {
        "timestamp": _utc_now_iso(),
        "level": level,
        "message": message,
    }
    clean_context = {key: value for key, value in context.items() if value is not None}
    if clean_context:
        payload["context"] = clean_context

    line = json.dumps(payload, ensure_ascii=True)
    if level == "error":
        logger.error(line)
    elif level == "warn":
        logger.warning(line)
    else:
        logger.info(line)


def _create_paddle_ocr_engine(PaddleOCR, request_id: str, trigger: str):
    """
    Construye el engine intentando primero la API 3.x y luego la 2.x.
    """
    try:
        return PaddleOCR(
            lang="es",
            device="cpu",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
    except TypeError as exc:
        _log(
            "warn",
            "ocr_engine_constructor_fallback_legacy_api",
            requestId=request_id,
            trigger=trigger,
            errorType=exc.__class__.__name__,
            error=str(exc),
        )
        return PaddleOCR(use_angle_cls=True, lang="es", use_gpu=False, show_log=False)


def _extract_lines_from_paddle_result(result) -> list[dict]:
    """
    Normaliza salidas de PaddleOCR 2.x y 3.x a [{text, confidence}].
    """
    lines: list[dict] = []

    def append_line(text, confidence) -> None:
        clean_text = str(text).strip() if text is not None else ""
        if not clean_text:
            return
        try:
            score = round(float(confidence), 4)
        except (TypeError, ValueError):
            score = 0.0
        lines.append({"text": clean_text, "confidence": score})

    def walk(node) -> None:
        if node is None:
            return

        if isinstance(node, dict):
            rec_texts = node.get("rec_texts")
            if isinstance(rec_texts, list):
                rec_scores = node.get("rec_scores")
                if not isinstance(rec_scores, list):
                    rec_scores = [0.0] * len(rec_texts)
                for index, text in enumerate(rec_texts):
                    score = rec_scores[index] if index < len(rec_scores) else 0.0
                    append_line(text, score)
                return

            if "text" in node:
                append_line(node.get("text"), node.get("confidence", node.get("score", 0.0)))
                return

            for value in node.values():
                walk(value)
            return

        if hasattr(node, "res"):
            walk(getattr(node, "res"))
            return

        if hasattr(node, "to_dict") and callable(getattr(node, "to_dict")):
            try:
                walk(node.to_dict())
                return
            except Exception:
                pass

        if isinstance(node, (list, tuple)):
            if (
                len(node) >= 2
                and isinstance(node[1], (list, tuple))
                and len(node[1]) >= 2
                and isinstance(node[1][0], str)
            ):
                append_line(node[1][0], node[1][1])
                return
            for item in node:
                walk(item)
            return

    walk(result)
    return lines


def _execute_paddle_ocr(engine, img_array):
    """
    Ejecuta OCR soportando API legacy (.ocr) y API nueva (.predict).
    """
    if hasattr(engine, "predict") and callable(getattr(engine, "predict")):
        try:
            return list(engine.predict(img_array))
        except TypeError:
            return list(engine.predict(input=img_array))

    if hasattr(engine, "ocr") and callable(getattr(engine, "ocr")):
        return engine.ocr(img_array, cls=True)

    raise RuntimeError("El engine PaddleOCR no expone un método soportado de inferencia")


def _compute_average_confidence(lines: list[dict]) -> float:
    if not lines:
        return 0.0
    return round(sum(float(line.get("confidence", 0.0)) for line in lines) / len(lines), 4)


def _prepare_image_for_ocr(img, request_id: str, variant: str):
    from PIL import Image

    original_width = img.width
    original_height = img.height
    target_input_image_max_side = (
        PORTRAIT_INPUT_IMAGE_MAX_SIDE
        if img.height > img.width and PORTRAIT_INPUT_IMAGE_MAX_SIDE > 0
        else INPUT_IMAGE_MAX_SIDE
    )

    if target_input_image_max_side > 0:
        longest_side = max(img.width, img.height)
        if longest_side > target_input_image_max_side:
            scale = target_input_image_max_side / float(longest_side)
            resized_width = max(1, int(round(img.width * scale)))
            resized_height = max(1, int(round(img.height * scale)))
            resampling = getattr(Image, "Resampling", Image).LANCZOS
            img = img.resize((resized_width, resized_height), resampling)
            _log(
                "info",
                "ocr_image_resized_for_cpu",
                requestId=request_id,
                variant=variant,
                originalWidth=original_width,
                originalHeight=original_height,
                resizedWidth=resized_width,
                resizedHeight=resized_height,
                inputImageMaxSide=target_input_image_max_side,
                portraitInputImageMaxSide=PORTRAIT_INPUT_IMAGE_MAX_SIDE,
            )

    return img


def run_ocr(image_path: str) -> dict:
    """
    Ejecuta OCR sobre una imagen y retorna el resultado en formato JSON.
    """
    global _ocr_engine
    request_id = f"cli_{int(time.time() * 1000)}"

    _log("info", "ocr_cli_started", requestId=request_id, imagePath=image_path)

    from PIL import Image
    import numpy as np

    try:
        original_image = Image.open(image_path)
        img = original_image.convert("RGB")
    except Exception as exc:
        _log("error", "ocr_image_open_failed", requestId=request_id, error=str(exc))
        raise RuntimeError(f"No se pudo abrir la imagen: {exc}")

    _log(
        "info",
        "ocr_image_loaded",
        requestId=request_id,
        width=img.width,
        height=img.height,
    )

    if _ocr_engine is None:
        _log("info", "ocr_engine_init_started", requestId=request_id)
        import_started_at = time.time()
        from paddleocr import PaddleOCR

        _log("info", "ocr_engine_import_completed", requestId=request_id)
        _ocr_engine = _create_paddle_ocr_engine(PaddleOCR, request_id, "cli")
        _log(
            "info",
            "ocr_engine_init_completed",
            requestId=request_id,
            latencyMs=round((time.time() - import_started_at) * 1000),
        )

    prepared_img = _prepare_image_for_ocr(img, request_id, "primary")
    img_array = np.array(prepared_img)

    inference_started_at = time.time()
    _log(
        "info",
        "ocr_inference_started",
        requestId=request_id,
        width=prepared_img.width,
        height=prepared_img.height,
    )

    result = _execute_paddle_ocr(_ocr_engine, img_array)

    _log(
        "info",
        "ocr_inference_completed",
        requestId=request_id,
        latencyMs=round((time.time() - inference_started_at) * 1000),
    )

    lines = _extract_lines_from_paddle_result(result)

    raw_text = "\n".join(line["text"] for line in lines)
    average_confidence = _compute_average_confidence(lines)

    _log(
        "info",
        "ocr_cli_completed",
        requestId=request_id,
        lineCount=len(lines),
        rawTextLength=len(raw_text),
        averageConfidence=average_confidence,
    )

    return {
        "rawText": raw_text,
        "lines": lines,
        "averageConfidence": average_confidence,
    }


def warmup() -> None:
    """
    Inicializa el engine PaddleOCR para precargar modelos.
    """
    global _ocr_engine
    request_id = f"warmup_{int(time.time() * 1000)}"

    _log("info", "warmup_started", requestId=request_id)

    try:
        import_started_at = time.time()
        from paddleocr import PaddleOCR

        _log("info", "paddleocr_import_completed", requestId=request_id)
        _ocr_engine = _create_paddle_ocr_engine(PaddleOCR, request_id, "warmup")
        _log(
            "info",
            "warmup_completed",
            requestId=request_id,
            latencyMs=round((time.time() - import_started_at) * 1000),
        )
    except Exception as exc:
        _log("error", "warmup_failed", requestId=request_id, error=str(exc))
        raise RuntimeError(f"Warmup falló: {exc}")


def main():
    parser = argparse.ArgumentParser(
        description="PaddleOCR CLI para financialclaw"
    )
    parser.add_argument(
        "image_path",
        nargs="?",
        help="Ruta a la imagen a procesar",
    )
    parser.add_argument(
        "--warmup",
        action="store_true",
        help="Precargar modelos PaddleOCR sin procesar imagen",
    )

    args = parser.parse_args()

    if args.warmup:
        try:
            warmup()
            result = {
                "rawText": "",
                "lines": [],
                "averageConfidence": 0.0,
                "warmup": True,
            }
            print(json.dumps(result, ensure_ascii=True))
            sys.exit(0)
        except Exception as exc:
            _log("error", "warmup_error", error=str(exc))
            print(json.dumps({"error": str(exc)}), file=sys.stderr)
            sys.exit(1)

    if not args.image_path:
        parser.print_help()
        sys.exit(1)

    image_path = Path(args.image_path)
    if not image_path.exists():
        _log("error", "image_not_found", imagePath=str(image_path))
        print(json.dumps({"error": f"Archivo no encontrado: {image_path}"}), file=sys.stderr)
        sys.exit(1)

    try:
        result = run_ocr(str(image_path))
        print(json.dumps(result, ensure_ascii=True))
        sys.exit(0)
    except Exception as exc:
        _log("error", "ocr_error", error=str(exc))
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
