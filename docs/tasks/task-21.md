# TASK-21: Refactorización a OCR Agéntico

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Eliminar el pipeline local de Python (PaddleOCR) y la lógica de clasificación de Typescript. Modificar la herramienta de OCR para que reciba directamente los campos extraídos por las capacidades de visión nativas del agente OpenClaw. La capa de persistencia (tablas `ocr_extractions` y `expenses`) debe mantenerse intacta para asegurar compatibilidad histórica.

## Archivos a crear o tocar

- `src/tools/log-expense-from-receipt.ts` (Renombrado/Refactorizado desde `log-expense-from-image.ts`)
- `tests/integration/log-expense-from-receipt.test.ts`
- `src/index.ts`
- `tests/integration/plugin-entry.test.ts`
- Archivos **A ELIMINAR**: 
  - `paddle_ocr_cli.py`
  - `requirements.txt`
  - `src/ocr/ocr-classification.ts`
  - `src/ocr/receipt-parser.ts`
  - `src/ocr/paddle-ocr-subprocess.ts`
  - `tests/unit/ocr-classification.test.ts`
  - `tests/unit/receipt-parser.test.ts`
  - `tests/integration/log-expense-from-image.test.ts`

## Dependencias

- TASK-02
- TASK-07

## Referencias obligatorias

- `AGENTS.md` — secciones: "Tools de OpenClaw", "Multi-moneda"
- `docs/plan-refactor-ocr.md` (Documento de diseño de la refactorización)

## Contrato obligatorio

- Export esperado en `src/tools/log-expense-from-receipt.ts`:
  - `export const InputSchema = ...`
  - `export function executeLogExpenseFromReceipt(input, db = getDb()): string`
- Input:
  - `amount`: requerido, number, monto detectado
  - `date`: requerido, string, ISO date `YYYY-MM-DD` del recibo
  - `merchant`: opcional, string
  - `category`: requerido, string, categoría detectada (default `OTHER`)
  - `currency`: opcional, string, ISO 4217
  - `raw_text`: opcional, string, todo el texto crudo visto en el recibo
- Output:
  - texto en español confirmando el registro de `ocr_extractions` y `expenses`
  - monto formateado con símbolo correcto
- Side effects:
  - INSERT en `ocr_extractions` con status `COMPLETED` y provider `openclaw_agent`
  - INSERT en `expenses` con source `OCR` vinculado al `ocr_extraction_id`
  - no registrar tool en este archivo; eso ocurre en `src/index.ts`
- Modificaciones a `src/index.ts`:
  - Eliminar registro de `log_expense_from_image`
  - Agregar registro de `log_expense_from_receipt`
  - Eliminar la inyección de `configurePythonCmd`

## Reglas / invariantes de negocio

- La inserción en `ocr_extractions` asume origen `openclaw_agent` pasados por API en vez de invocar un subprocess local.
- Si `currency` no llega, usar `resolveCurrency()`
- Nunca hardcodear códigos de moneda
- Si la moneda default sigue siendo `XXX`, agregar sugerencia para `manage_currency`
- Las validaciones de fechas deben reutilizar lógicas existentes para evitar inconsistencias.

## No asumir

- No borrar ni recrear con migraciones la tabla `ocr_extractions`. Su existencia sigue siendo válida.
- No asumir que `paddle_ocr_cli.py` será necesario bajo ningún contexto analítico.

## Casos borde

- Parámetros faltantes del agente => deben ser rechazados según el `InputSchema`.
- Archivos huérfanos de tests no deben quedar en la base de código.

## Lógica de implementación

1. Eliminar los archivos Python y del directorio `src/ocr/`.
2. Refactorizar el actual `log-expense-from-image.ts` para crear `log-expense-from-receipt.ts` tomando los parámetros estructurados.
3. Actualizar los llamados correspondientes en `src/index.ts` y tests.
4. Validar test de integración donde se inserta el `expense` y su correspondiente entrada en `ocr_extractions`.

## Tests requeridos

- caso feliz (agente envía cantidad, fecha, comercio, categoría y texto crudo).
- caso borde: falla por inputs inválidos del agente.
- archivo de test esperado: `tests/integration/log-expense-from-receipt.test.ts`.

## Criterios de aceptación

- `npm run test:unit` y `npm run test:integration` sin errores, ni referencias a mocks del OCR.
- `npx tsc --noEmit` pasa exitosamente con 9 herramientas puras instaladas y testeadas en el punto de entrada.
- El build refleja fielmente la desaparición de dependencias Python.
