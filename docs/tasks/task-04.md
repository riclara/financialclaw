# TASK-04: Port de receipt-parser.ts

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Portar el parser de recibos desde `sendafinanciera` para conservar la heurística ya probada de extracción de monto, fecha y comercio a partir del texto OCR.

## Archivos a crear o tocar

- `src/ocr/receipt-parser.ts`
- `tests/unit/receipt-parser.test.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-01
- TASK-03

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `/Users/riclara/workspace/sendafinanciera/backend/src/infrastructure/ocr/receipt-parser.ts`
- `src/ocr/ocr-classification.ts`
- `AGENTS.md` — sección "Referencia: proyecto sendafinanciera"
- `docs/testing.md`

## Contrato obligatorio

- Exportar:
  - `normalizeReceiptText(text: string): string`
  - `parseAmountFromReceiptText(text: string): number | null`
  - `parseDateFromReceiptText(text: string): string | null`
  - `parseMerchantFromReceiptText(text: string): string | null`
- Mantener el import:
  - `import { normalizeOcrText } from "./ocr-classification.js";`
- El port debe copiar el archivo fuente completo; no resumir ni reescribir la heurística.

## Reglas / invariantes de negocio

- `parseAmountFromReceiptText()` debe conservar la prioridad de etiquetas:
  - PRIMARY: `total a pagar`, `valor total`, `gran total`, `total`
  - SECONDARY: `a pagar`, `valor`, `pago`, `vlr`, `importe`, `neto`, `efectivo`
  - SUBTOTAL
- Si no hay etiqueta, debe buscar:
  - el mayor número con `$` mayor o igual a 1000
  - y luego el mayor número genérico mayor o igual a 1000
- Debe excluir líneas con ruido como:
  - `propina`
  - `iva`
  - `impuesto`
  - `descuento`
  - `cambio`
  - `nit`
  - `fecha`
- `parseDateFromReceiptText()` debe soportar:
  - ISO
  - formatos LatAm con `/` y `-`
  - fechas en texto en español
- `parseMerchantFromReceiptText()` debe mirar las primeras 5 líneas no vacías y retornar la primera línea válida en title case.
- `parseCopNumber()` interna debe seguir soportando números con separadores de miles colombianos.

## No asumir

- No simplificar regexes ni reglas del parser.
- No reducir el número de formatos de fecha soportados.
- No cambiar el criterio de exclusión de líneas ruidosas.
- No inferir merchant desde líneas posteriores si las primeras 5 no lo permiten.
- No modificar el comportamiento del port salvo ajustes de import si fueran estrictamente necesarios.

## Casos borde

- Monto con puntos:
  - `"54.900"` => `54900`
- Fecha `16/03/2026`:
  - debe normalizarse a `2026-03-16`
- Merchant con ruido en líneas siguientes:
  - debe quedarse con la primera línea válida
- Texto sin monto o fecha parseables:
  - retornar `null`, no inventar valores

## Lógica de implementación

1. Copiar el archivo fuente completo de `sendafinanciera`.
2. Mantener el import local a `./ocr-classification.js`.
3. No tocar helpers internos ni el orden de las heurísticas.
4. Agregar tests unitarios mínimos para monto, fecha y merchant.

## Tests requeridos

- `parseAmountFromReceiptText("TOTAL $54.900")` => `54900`
- `parseDateFromReceiptText("16/03/2026")` => `2026-03-16`
- `parseMerchantFromReceiptText("EXITO LAURELES\\nNIT ...\\nFECHA ...")` => `Exito Laureles`
- caso sin match:
  - retorna `null`

## Criterios de aceptación

- `npx tsc --noEmit` pasa.
- `parseAmountFromReceiptText("TOTAL $54.900")` retorna `54900`.
- `parseDateFromReceiptText("16/03/2026")` retorna `2026-03-16`.
- `parseMerchantFromReceiptText("EXITO LAURELES\nNIT 890.900.123\nFECHA 16/03/2026")` retorna `Exito Laureles`.
