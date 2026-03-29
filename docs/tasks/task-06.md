# TASK-06: Subprocess TypeScript para PaddleOCR

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Crear el wrapper TypeScript que invoca `paddle_ocr_cli.py` vía subprocess y normaliza su salida JSON para que el resto del plugin consuma OCR desde Node.js sin hablar directamente con Python.

## Archivos a crear o tocar

- `src/ocr/paddle-ocr-subprocess.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-01
- TASK-05

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `paddle_ocr_cli.py`
- `docs/setup.md`
- `src/index.ts` como consumidor futuro

## Contrato obligatorio

- Exportar:
  - `interface OcrLine { text: string; confidence: number }`
  - `interface OcrResult { rawText: string; lines: OcrLine[]; averageConfidence: number }`
  - `configurePythonCmd(cmd: string): void`
  - `runPaddleOcr(imagePath: string): OcrResult`
- `runPaddleOcr()` debe:
  - ejecutar `spawnSync(_pythonCmd, [CLI_SCRIPT, imagePath], ...)`
  - usar `encoding = "utf8"`
  - usar `timeout = 60_000`
  - usar `maxBuffer = 10 * 1024 * 1024`
- `CLI_SCRIPT` debe resolverse desde el archivo actual hacia `../../paddle_ocr_cli.py`.
- El comando Python por defecto debe ser:
  - `process.env.FINANCIALCLAW_PYTHON_CMD ?? "python3"`

## Reglas / invariantes de negocio

- `configurePythonCmd()` debe permitir sobreescribir el intérprete antes de la primera llamada real.
- `runPaddleOcr()` debe bloquear hasta que termine el proceso Python.
- Si `spawnSync` devuelve `error`, lanzar un `Error` descriptivo.
- Si `status !== 0`, lanzar un `Error` con el exit code y el `stderr`.
- Si `stdout` queda vacío, lanzar `Error`.
- La salida exitosa debe parsearse como JSON y tiparse como `OcrResult`.

## No asumir

- No resolver `paddle_ocr_cli.py` relativo al `cwd`.
- No convertir este helper en API async.
- No silenciar `stderr` del proceso fallido.
- No acortar el timeout sin evidencia.
- No acoplar este módulo al registro de tools o al SDK de OpenClaw.

## Casos borde

- Python inexistente:
  - error descriptivo desde `result.error`
- CLI con exit code distinto de 0:
  - propagar detalle de `stderr`
- `stdout` vacío:
  - error explícito
- JSON inválido:
  - dejar que el parse falle visiblemente

## Lógica de implementación

1. Definir `OcrLine` y `OcrResult`.
2. Resolver `CLI_SCRIPT` desde `import.meta.url`.
3. Implementar `configurePythonCmd()`.
4. Implementar `runPaddleOcr()` con `spawnSync`.
5. Validar errores de proceso y parsear JSON.

## Tests requeridos

- No hay archivo de test dedicado en esta TASK según `docs/tasks/tasks.yaml`.
- Verificación mínima:
  - `npx tsc --noEmit`
  - confirmación manual de la ruta resuelta a `paddle_ocr_cli.py`
  - uso posterior desde `TASK-15`

## Criterios de aceptación

- `npx tsc --noEmit` pasa.
- Resuelve correctamente la ruta a `paddle_ocr_cli.py` en la raíz del proyecto.
- `configurePythonCmd()` cambia el intérprete usado por `runPaddleOcr()`.
- Timeout de 60 segundos cubre cold start + inferencia.
