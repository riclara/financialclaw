# TASK-03: Port de ocr-classification.ts

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Portar el clasificador OCR desde `sendafinanciera` para reutilizar la misma lógica de normalización de texto y detección heurística de comercio/categoría sin reinterpretar el algoritmo.

## Archivos a crear o tocar

- `src/ocr/ocr-classification.ts`
- `tests/unit/ocr-classification.test.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-01

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `/Users/riclara/workspace/sendafinanciera/backend/src/infrastructure/ocr/ocr-classification.ts`
- `AGENTS.md` — sección "Referencia: proyecto sendafinanciera"
- `docs/testing.md`

## Contrato obligatorio

- Exportar:
  - `ExpenseCategory`
  - `normalizeOcrText(value: string): string`
  - `inferMerchantAndCategoryFromText(text: string): { merchant: string | null; category: ExpenseCategory | null }`
- `ExpenseCategory` debe declararse localmente en este archivo como unión de:
  - `HOUSING`
  - `SERVICES`
  - `TRANSPORT`
  - `SUPERMARKET`
  - `HEALTH`
  - `EDUCATION`
  - `ENTERTAINMENT`
  - `RESTAURANT`
  - `OTHER`
- El único cambio permitido respecto al archivo fuente es reemplazar este import:
  - `import type { ExpenseCategory } from "../../domain/expense-types.js";`
  por la definición local anterior.

## Reglas / invariantes de negocio

- El port debe ser prácticamente verbatim.
- `normalizeOcrText()` debe aplicar:
  - normalización Unicode `NFD`
  - eliminación de diacríticos
  - conversión a minúsculas
- `inferMerchantAndCategoryFromText()` debe iterar un arreglo fijo `CATEGORY_RULES` y retornar el primer match por keyword.
- Las reglas deben conservar los merchants y keywords del fuente:
  - `TRANSPORT`
  - `SUPERMARKET`
  - `SERVICES`
  - `HEALTH`
  - `EDUCATION`
  - `ENTERTAINMENT`
  - `HOUSING`
  - `RESTAURANT`
- Si no hay match, este helper debe conservar la semántica del fuente. No forzar `OTHER` aquí si el port original retorna `null`; el fallback a `OTHER`, si se necesita, corresponde al consumidor.

## No asumir

- No refactorizar la heurística.
- No cambiar el orden de `CATEGORY_RULES`.
- No agregar categorías nuevas.
- No importar tipos del dominio de `sendafinanciera`.
- No cambiar la lógica de fallback sin verificar el comportamiento exacto del fuente.

## Casos borde

- Texto con tildes:
  - debe normalizarse correctamente
- Texto sin keywords conocidas:
  - conservar el fallback exacto del archivo fuente
- Texto con múltiples keywords:
  - gana la primera regla que haga match

## Lógica de implementación

1. Copiar el archivo fuente.
2. Sustituir el import de `ExpenseCategory` por una definición local.
3. Conservar constantes, interfaces internas y funciones tal como están en el fuente.
4. Agregar test unitario para normalización y match de categorías.

## Tests requeridos

- `normalizeOcrText("Cafe Ultimo")` => `cafe ultimo`
- keyword conocida:
  - `inferMerchantAndCategoryFromText("compra en exito laureles")`
- texto sin match:
  - verificar el fallback real del port

## Criterios de aceptación

- `npx tsc --noEmit` pasa.
- `inferMerchantAndCategoryFromText("compra en exito laureles")` retorna merchant y categoría correctos.
- `normalizeOcrText("Cafe Ultimo")` retorna `cafe ultimo`.
- El archivo preserva la lógica de `sendafinanciera` salvo por la definición local de `ExpenseCategory`.
