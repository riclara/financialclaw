# TASK-05: CLI Python para PaddleOCR

> Volver al [indice de hitos](../hitos.md)

## Objetivo

Crear un CLI Python invocable desde Node.js que ejecute PaddleOCR sobre una imagen y devuelva un JSON estable para el subprocess TypeScript. Esta TASK encapsula toda la complejidad de PaddleOCR 2.x/3.x fuera del runtime principal del plugin.

## Archivos a crear o tocar

- `paddle_ocr_cli.py`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-01 (solo por `requirements.txt`)

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `/Users/riclara/workspace/sendafinanciera/paddle-ocr/app.py`
  - `_create_paddle_ocr_engine`
  - `_extract_lines_from_paddle_result`
  - `_execute_paddle_ocr`
  - `_compute_average_confidence`
  - `_prepare_image_for_ocr`
- `requirements.txt`

## Contrato obligatorio

- Archivo ejecutable: `paddle_ocr_cli.py`
- Usos soportados:
  - `python3 paddle_ocr_cli.py <ruta_imagen>`
  - `python3 paddle_ocr_cli.py --warmup`
- `stdout`:
  - solo JSON válido cuando el proceso termina bien
- `stderr`:
  - logs de diagnóstico
- exit codes:
  - `0` éxito
  - `1` error
- JSON esperado para OCR exitoso:

```json
{
  "rawText": "SUPERMERCADO EXITO\nTOTAL $54.900",
  "lines": [
    { "text": "SUPERMERCADO EXITO", "confidence": 0.95 }
  ],
  "averageConfidence": 0.93
}
```

## Reglas / invariantes de negocio

- Debe soportar PaddleOCR 3.x y caer a 2.x si la API nueva no aplica.
- Debe correr en CPU; no asumir GPU.
- Debe hacer resize de entrada:
  - `max_side = 1600`
  - `portrait max_side = 2200`
- `rawText` se construye uniendo `lines[].text` con saltos de línea.
- `averageConfidence` se calcula como promedio de las líneas extraídas.
- La extracción de líneas debe normalizar formatos de salida de PaddleOCR 2.x y 3.x a:
  - `{ text: string, confidence: number }`
- El warmup debe forzar descarga/carga de modelos sin requerir imagen real.

## No asumir

- No cambiar la lógica del port de `sendafinanciera` salvo adaptaciones mínimas de CLI.
- No escribir logs en `stdout`.
- No depender del gateway ni de OpenClaw.
- No asumir que `predict()` siempre existe; puede existir solo `ocr()`.
- No asumir que el resultado de PaddleOCR viene siempre como dict plano.

## Casos borde

- `--warmup` debe responder con JSON de éxito si la inicialización funciona.
- Si la carga del engine falla, el proceso debe terminar con exit code `1`.
- Si una línea viene sin confidence parseable, usar `0.0`.
- Si una línea viene vacía, debe omitirse del resultado final.
- Si `predict()` falla por firma incompatible, intentar fallback compatible antes de abortar.

## Lógica de implementación

1. Definir constantes de modelos y límites de imagen.
2. Implementar `_log()` que escriba JSON a `stderr`.
3. Implementar `_create_engine()`:
   - intentar API 3.x
   - caer a API 2.x ante `TypeError`
4. Implementar `_extract_lines()` como normalizador robusto del resultado.
5. Implementar `_execute_ocr()`:
   - usar `.predict()` si existe
   - fallback a `.ocr()` si hace falta
6. Implementar `_compute_average_confidence()`.
7. Implementar `_prepare_image()` con resize por orientación.
8. Implementar `run_ocr(image_path)`:
   - abrir imagen
   - convertir a RGB
   - preparar imagen
   - ejecutar OCR
   - construir `rawText`, `lines`, `averageConfidence`
9. Implementar `warmup()`.
10. En `__main__`, resolver modo OCR o warmup y mapear excepciones a exit code `1`.

### Funciones esperadas

- `_log(message: str, **kwargs) -> None`
- `_create_engine()`
- `_extract_lines(result) -> list[dict]`
- `_execute_ocr(engine, img_array)`
- `_compute_average_confidence(lines: list[dict]) -> float`
- `_prepare_image(img)`
- `run_ocr(image_path: str) -> dict`
- `warmup() -> None`

## Tests requeridos

- Verificación manual mínima:
  - usar el intérprete configurado para OCR (en setup local: `./.venv/bin/python3`)
  - `./.venv/bin/python3 paddle_ocr_cli.py --warmup`
  - `./.venv/bin/python3 paddle_ocr_cli.py <ruta_imagen>`
- Tests e2e automatizados son opcionales en esta etapa porque requieren entorno Python con PaddleOCR real.

## Criterios de aceptación

- `./.venv/bin/python3 paddle_ocr_cli.py --warmup` no falla en el entorno OCR configurado.
- El output exitoso es JSON válido con `rawText`, `lines` y `averageConfidence`.
- Los logs de diagnóstico salen por `stderr`, no por `stdout`.
- Exit code `0` en éxito y `1` en error.
