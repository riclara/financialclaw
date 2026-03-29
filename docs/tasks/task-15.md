# TASK-15: Tool — log_expense_from_image

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Registrar un gasto a partir de una imagen de recibo usando el pipeline OCR ya portado al proyecto. El tool debe persistir tanto el intento de OCR como el gasto final, y degradar con mensajes claros cuando no se puede detectar el monto.

## Archivos a crear o tocar

- `src/tools/log-expense-from-image.ts`
- `tests/integration/log-expense-from-image.test.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-02
- TASK-03
- TASK-04
- TASK-06
- TASK-07

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `src/ocr/paddle-ocr-subprocess.ts`
- `src/ocr/receipt-parser.ts`
- `src/ocr/ocr-classification.ts`
- `src/tools/helpers/date-utils.ts`
- `src/tools/helpers/currency-utils.ts`
- `AGENTS.md` — secciones "Multi-moneda" y "Tools de OpenClaw"

## Contrato obligatorio

- Exportar:
  - `InputSchema`
  - `executeLogExpenseFromImage(input, db = getDb()): string`
- Input mínimo:
  - `image_path`: requerido
  - `description?`
  - `due_date?`
  - `currency?`
- Side effects:
  - siempre registrar un row en `ocr_extractions` cuando se alcance a invocar OCR
  - crear row en `expenses` solo si se detecta monto
- El gasto creado por OCR se registra como:
  - `source = 'OCR'`
  - `status = 'PAID'`
  - `payment_date = due_date`

## Reglas / invariantes de negocio

- Si `currency` no llega, resolverla con `resolveCurrency()`.
- La ruta de imagen puede llegar absoluta o relativa; el tool debe resolver ambas.
- Si OCR falla por provider:
  - insertar `ocr_extractions` con `status = 'FAILED'`
  - `failure_code = 'PROVIDER_ERROR'`
  - retornar error legible
- Si OCR funciona pero no se detecta monto:
  - insertar `ocr_extractions` con `status = 'FAILED'`
  - `failure_code = 'EMPTY_CONTENT'`
  - no crear `expenses`
- Si OCR detecta monto:
  - guardar `status = 'COMPLETED'` en `ocr_extractions`
  - persistir sugeridos: amount, date, merchant, category, confidence
- Valores finales:
  - `amount = suggestedAmount`
  - `due_date = input.due_date ?? suggestedDate ?? todayISO()`
  - `merchant = positional merchant ?? keyword merchant ?? null`
  - `category = keyword category ?? 'OTHER'`
  - `description = input.description ?? "Gasto en ${merchant}" ?? "Gasto por OCR"`

## No asumir

- No asumir que PaddleOCR siempre devuelve texto útil.
- No asumir que la primera línea es siempre el merchant correcto; combinar heurística posicional y por keywords.
- No crear gasto si no hay monto detectado.
- No omitir el registro de la extracción OCR cuando hubo intento y terminó en error.
- No depender de rutas relativas sin normalizarlas contra el workspace actual.

## Casos borde

- `image_path` inexistente:
  - error descriptivo antes de invocar OCR
- OCR provider falla:
  - extracción fallida con `PROVIDER_ERROR`
  - sin fila en `expenses`
- OCR devuelve texto pero no monto:
  - extracción fallida con `EMPTY_CONTENT`
  - sin fila en `expenses`
- OCR devuelve fecha nula:
  - usar `input.due_date` si existe
  - si no, usar `todayISO()`
- OCR devuelve merchant ambiguo:
  - usar fallback de descripción genérica

## Lógica de implementación

1. Resolver moneda con `resolveCurrency(input.currency, db)`.
2. Resolver `image_path` con `resolve(...)` y validar existencia con `existsSync(...)`.
3. Ejecutar `runPaddleOcr(resolvedPath)`.
4. Extraer:
   - `rawText`
   - `averageConfidence`
   - `suggestedAmount`
   - `suggestedDate`
   - merchant por parser
   - merchant y category por clasificación
5. Abrir transacción para:
   - insertar `ocr_extractions`
   - insertar `expenses` si corresponde
6. Retornar confirmación legible con monto formateado y datos inferidos.

### Imports esperados

```typescript
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { runPaddleOcr } from "../ocr/paddle-ocr-subprocess.js";
import { parseAmountFromReceiptText, parseDateFromReceiptText, parseMerchantFromReceiptText } from "../ocr/receipt-parser.js";
import { normalizeOcrText, inferMerchantAndCategoryFromText } from "../ocr/ocr-classification.js";
import { todayISO } from "./helpers/date-utils.js";
import { resolveCurrency, formatAmount, isPlaceholderCurrency } from "./helpers/currency-utils.js";
import { getDb } from "../db/database.js";
```

## Tests requeridos

- caso feliz con recibo legible
- caso sin texto útil / sin monto
- caso de fallo del subprocess OCR
- caso de `image_path` relativo
- caso con `description` y `due_date` provistos por el usuario

## Criterios de aceptación

- Para una imagen con `TOTAL $54.900` y fecha válida, persisten `ocr_extractions` y `expenses` enlazados.
- Para una imagen sin monto detectable, se crea extracción fallida y no se crea gasto.
- Si `paddle_ocr_cli.py` falla, se registra `PROVIDER_ERROR` y se retorna error descriptivo.
- `image_path` relativo se resuelve correctamente.
