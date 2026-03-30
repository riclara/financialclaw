# financialclaw — Hitos de implementación y estado de tareas

Este archivo es la **vista operativa** sobre el estado de la implementación. Funciona como mecanismo de sincronización entre agentes: antes de empezar una tarea, el agente debe leer este archivo para saber qué está disponible.

La metadata estructurada de las TASKs vive en `docs/tasks/tasks.yaml`. Este archivo sigue siendo la fuente de verdad para estados visibles (`TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`) y notas de seguimiento humano.

---

## Protocolo para agentes

### Antes de tomar una tarea

1. **Leer este archivo completo** para conocer el estado actual.
2. **Verificar dependencias**: solo tomar una tarea si todas sus dependencias están en estado `DONE`.
3. **Verificar que no esté tomada**: si el estado es `IN_PROGRESS`, otro agente ya la tiene.
4. **Marcar como `IN_PROGRESS`**: cambiar el estado **antes** de empezar a implementar. Incluir timestamp.

### Al completar una tarea

1. **Verificar criterios de aceptación** (definidos en el archivo de detalle de cada TASK en `docs/tasks/task-XX.md`).
2. **Ejecutar verificación**: `npx tsc --noEmit` + tests correspondientes.
3. **Marcar como `DONE`**: cambiar el estado e incluir timestamp y notas breves si hubo desvíos.
4. **Actualizar bitácora**: agregar entrada en `docs/bitacora.md` si hubo algo relevante.
5. **Revisar si desbloqueó tareas**: mirar las tareas que dependían de esta y actualizar su campo "Desbloquea".

### Si una tarea falla o se bloquea

1. Marcar como `BLOCKED` con motivo.
2. No dejar una tarea en `IN_PROGRESS` si no se va a continuar — devolverla a `TODO`.

### Estados posibles

| Estado | Significado |
|---|---|
| `TODO` | Disponible para tomar (si sus dependencias están en `DONE`) |
| `IN_PROGRESS` | Un agente la está implementando |
| `DONE` | Completada y verificada |
| `BLOCKED` | No se puede avanzar (incluir motivo) |

---

## Vista general

```
Hito 1: Fundación           [DONE]     TASK-01
Hito 2: Persistencia        [DONE]     TASK-02
Hito 3: Pipeline OCR        [DONE]     TASK-03, TASK-04, TASK-05, TASK-06
Hito 4: Helpers compartidos [DONE]     TASK-07
Hito 5: Tools core          [DONE]     TASK-08 → TASK-15
Hito 6: Tools de consulta   [DONE]     TASK-16, TASK-17
Hito 7: Automatización      [DONE]     TASK-18, TASK-19
Hito 8: Integración final   [DONE]     TASK-20
Hito 9: OCR Agéntico        [DONE]     TASK-21
```

---

## Hito 1: Fundación

> Inicializar el proyecto con toda la configuración base. Sin esto, nada compila.

### TASK-01 — Inicializar proyecto — [ver detalle](tasks/task-01.md)
- **Estado**: `DONE`
- **Archivo(s)**: `package.json`, `tsconfig.json`, `openclaw.plugin.json`, `requirements.txt`, `.gitignore`
- **Dependencias**: ninguna
- **Desbloquea**: todas las demás tareas
- **Descripción**: Crear los archivos de configuración del proyecto. Instalar dependencias Node (`npm install`). Verificar que `npx tsc --noEmit` no lance errores de configuración.
- **Criterio de aceptación**: `npm install` exitoso, `npx tsc --noEmit` pasa (puede tener errores de módulos aún no creados, pero la config en sí debe ser válida).
- **Timestamp inicio**: `2026-03-28T00:00:00-05:00`
- **Timestamp fin**: `2026-03-28T17:08:00-05:00`
- **Notas**: `npm install` verificado con éxito tras actualizar `better-sqlite3` a `^12.8.0` y `@types/better-sqlite3` a `^7.6.13`. `npx tsc --noEmit` sigue no aplicando todavía porque no existen archivos `src/**/*.ts` o `tests/**/*.ts`, lo que coincide con el caso borde documentado en la TASK.

---

## Hito 2: Persistencia

> Base de datos SQLite y helper de test. Fundamento de todos los tools.

### TASK-02 — Base de datos SQLite (schema + database) — [ver detalle](tasks/task-02.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/db/schema.ts`, `src/db/database.ts`, `tests/helpers/test-db.ts`
- **Dependencias**: TASK-01
- **Desbloquea**: TASK-07, TASK-08, TASK-09, TASK-10, TASK-11, TASK-12, TASK-13, TASK-14, TASK-15, TASK-16, TASK-17, TASK-18
- **Descripción**: Crear el schema con todas las tablas (currencies, expenses, incomes, income_receipts, recurring_expense_rules, ocr_extractions, reminders). Implementar `getDb()` como singleton lazy con `configureDb()`. Seed con moneda XXX. Crear `createTestDb()` para tests.
- **Criterio de aceptación**: `createTestDb()` crea BD en memoria con 7 tablas. `getDb()` es named export (no default). Seed inserta moneda XXX. Migraciones son idempotentes.
- **Timestamp inicio**: `2026-03-28T17:08:07-05:00`
- **Timestamp fin**: `2026-03-28T17:18:30-05:00`
- **Notas**: `Schema SQLite idempotente, singleton lazy y helper de tests quedan verificados. Además, package.json ahora ejecuta npm rebuild better-sqlite3 en postinstall para que npm install recomponga el binario nativo con el Node activo antes de correr npx tsx --test tests/integration/database.test.ts. Corrección contractual 2026-03-28T17:59:19-0500: expenses ahora soporta updated_at mediante migración idempotente y backfill para bases legacy. Corrección contractual 2026-03-28T18:30:00-0500: ocr_extractions ahora soporta status y failure_code mediante migraciones idempotentes, con tests que verifican tanto instalaciones nuevas como bases legacy (sin perder datos preexistentes).`

---

## Hito 3: Pipeline OCR

> Desde imagen hasta texto estructurado. 4 tareas con dependencias internas, pero paralelizables en dos ramas.

```
Rama A: TASK-03 → TASK-04       (TypeScript: clasificación → parser)
Rama B: TASK-05 → TASK-06       (Python CLI → subprocess TS)
Ambas ramas pueden correr en paralelo entre sí.
TASK-04 depende de TASK-03. TASK-06 depende de TASK-05.
```

### TASK-03 — [OBSOLETO] Port de ocr-classification.ts — [ver detalle](tasks/task-03.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/ocr/ocr-classification.ts`, `tests/unit/ocr-classification.test.ts`
- **Dependencias**: TASK-01
- **Desbloquea**: TASK-04, TASK-15
- **Descripción**: Portar desde `sendafinanciera/backend/src/infrastructure/ocr/ocr-classification.ts`. Definir `ExpenseCategory` como enum local. No modificar lógica, solo ajustar imports.
- **Criterio de aceptación**: Tests unitarios pasan. Categorías correctas para keywords conocidos. `OTHER` como fallback.
- **Timestamp inicio**: `2026-03-28T17:00:00-05:00`
- **Timestamp fin**: `2026-03-28T17:05:00-05:00`
- **Notas**: Port verbatim de sendafinanciera con ExpenseCategory como enum local. 15 tests unitarios pasando, cubriendo normalización Unicode y todas las categorías disponibles.

### TASK-04 — [OBSOLETO] Port de receipt-parser.ts — [ver detalle](tasks/task-04.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/ocr/receipt-parser.ts`, `tests/unit/receipt-parser.test.ts`
- **Dependencias**: TASK-01, TASK-03
- **Desbloquea**: TASK-15
- **Descripción**: Portar desde `sendafinanciera/backend/src/infrastructure/ocr/receipt-parser.ts`. Funciones: `parseAmountFromReceiptText`, `parseDateFromReceiptText`, `parseMerchantFromReceiptText`. Ajustar imports para usar el `ocr-classification.ts` local.
- **Criterio de aceptación**: Tests unitarios pasan. Parsea montos con separadores de miles (`.` y `,`), fechas en múltiples formatos, merchant desde primera línea.
- **Timestamp inicio**: `2026-03-28T23:30:00-05:00`
- **Timestamp fin**: `2026-03-28T23:45:00-05:00`
- **Notas**: Port verbatim desde sendafinanciera con ajuste de import a `./ocr-classification.js`. 27 tests unitarios pasan cubriendo monto, fecha y merchant parsing. Desbloquea TASK-15 (log_expense_from_image).

### TASK-05 — [OBSOLETO] CLI Python para PaddleOCR — [ver detalle](tasks/task-05.md)
- **Estado**: `DONE`
- **Timestamp inicio**: `2026-03-28T18:00:00-05:00`
- **Timestamp fin**: `2026-03-29T01:24:58Z`
- **Archivo(s)**: `paddle_ocr_cli.py`
- **Dependencias**: TASK-01 (solo por `requirements.txt`)
- **Desbloquea**: TASK-06
- **Descripción**: Crear script CLI que recibe path de imagen por argumento, ejecuta PaddleOCR, imprime JSON en stdout. Portar `_create_paddle_ocr_engine` y `_extract_lines` desde `sendafinanciera/paddle-ocr/app.py`. Soportar PaddleOCR 2.x y 3.x. Resize a max_side=1600px. Flag `--warmup` para precargar modelos.
- **Criterio de aceptación**: `./.venv/bin/python3 paddle_ocr_cli.py --warmup` no falla en el entorno OCR configurado. Output es JSON válido con campos `rawText`, `lines`, `averageConfidence`. Exit code 0 en éxito, 1 en error.
- **Notas**: CLI creado con funciones portadas del fuente. Verificación exitosa usando el entorno virtual: `./.venv/bin/python3 paddle_ocr_cli.py --warmup` pasó con exit code 0 y output JSON válido. La TASK y `docs/setup.md` quedan alineadas sobre el intérprete operativo real del pipeline OCR.

### TASK-06 — [OBSOLETO] Subprocess TypeScript para PaddleOCR — [ver detalle](tasks/task-06.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/ocr/paddle-ocr-subprocess.ts`
- **Dependencias**: TASK-01, TASK-05
- **Desbloquea**: TASK-15
- **Descripción**: Implementar `runPaddleOcr(imagePath)` que invoca `paddle_ocr_cli.py` via `spawnSync`. Implementar `configurePythonCmd(cmd)` para recibir ruta del intérprete desde config. Timeout 60s. Parsear stdout como JSON.
- **Criterio de aceptación**: TypeScript compila. `configurePythonCmd` cambia el intérprete usado. Error descriptivo si el subprocess falla.
- **Timestamp inicio**: `2026-03-29T01:30:00-05:00`
- **Timestamp fin**: `2026-03-29T01:45:00-05:00`
- **Notas**: Implementado correctamente con manejo de errores descriptivos, configuración flexible del intérprete Python y resolución correcta de la ruta al CLI.

---

## Hito 4: Helpers compartidos

> Funciones utilitarias que usan casi todos los tools. Puente entre la BD y la lógica de negocio.

### TASK-07 — Helpers (date-utils + currency-utils) — [ver detalle](tasks/task-07.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/tools/helpers/date-utils.ts`, `src/tools/helpers/currency-utils.ts`, `tests/unit/date-utils.test.ts`, `tests/unit/currency-utils.test.ts`
- **Dependencias**: TASK-01, TASK-02
- **Desbloquea**: TASK-08, TASK-09, TASK-11, TASK-12, TASK-13, TASK-14, TASK-15, TASK-16, TASK-17, TASK-18
- **Descripción**: `date-utils`: resolver períodos (`this_month`, `last_month`, `last_30_days`, `this_year`) a `{start, end}`. `currency-utils`: `resolveCurrency(code?, db)`, `formatAmount(amount, currency, db)`, `isPlaceholderCurrency(db)`, constante `PLACEHOLDER_CURRENCY = "XXX"`.
- **Criterio de aceptación**: Tests unitarios pasan. `resolveCurrency()` sin argumento retorna moneda default. `isPlaceholderCurrency()` retorna true con seed fresco. `formatAmount` formatea con símbolo correcto.
- **Timestamp inicio**: `2026-03-28T17:32:53-05:00`
- **Timestamp fin**: `2026-03-28T17:46:25-05:00`
- **Notas**: `Se implementan helpers compartidos de fechas y moneda con cobertura unitaria. Además del contrato base de TASK-07, queda expuesto resolvePeriodRange() para cubrir los presets this_month, last_month, last_30_days y this_year que usarán los tools de consulta.`

---

## Hito 5: Tools core

> Los 8 tools principales de escritura/gestión. Todos paralelizables entre sí una vez que TASK-02 y TASK-07 están listos.

```
Paralelizables (todos dependen de TASK-02 + TASK-07):
  TASK-08  manage_currency
  TASK-09  log_expense_manual
  TASK-10  mark_expense_paid        (solo depende de TASK-02)
  TASK-11  log_income
  TASK-12  log_income_receipt
  TASK-13  add_recurring_expense
  TASK-14  get_financial_summary

Secuencial (depende también de TASK-03, TASK-04, TASK-06):
  TASK-15  log_expense_from_image
```

### TASK-08 — Tool: manage_currency — [ver detalle](tasks/task-08.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/tools/manage-currency.ts`, `tests/integration/manage-currency.test.ts`
- **Dependencias**: TASK-02, TASK-07
- **Desbloquea**: TASK-20
- **Descripción**: Acciones `add`, `list`, `set_default`. Agregar moneda (code, name, symbol), listar todas, cambiar la default. Error si se agrega duplicada.
- **Criterio de aceptación**: Tests de integración pasan. Agregar moneda persiste en BD. `set_default` cambia `is_default`. Duplicada lanza error.
- **Timestamp inicio**: `2026-03-28T17:51:33-0500`
- **Timestamp fin**: `2026-03-28T17:52:39-0500`
- **Notas**: `Tool implementado sin registrar todavía en src/index.ts, con cobertura de integración para add, duplicados, listado con XXX placeholder y cambio consistente de moneda default.`

### TASK-09 — Tool: log_expense_manual — [ver detalle](tasks/task-09.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/tools/log-expense-manual.ts`, `tests/integration/log-expense-manual.test.ts`
- **Dependencias**: TASK-02, TASK-07
- **Desbloquea**: TASK-20
- **Descripción**: Registrar gasto manualmente. Params: amount, description, category?, currency?, merchant?, due_date. Si `due_date <= hoy`: status PAID. Si no: status PENDING. Si moneda es placeholder XXX: incluir sugerencia en respuesta.
- **Criterio de aceptación**: Tests de integración pasan. Gasto con `due_date` hoy → PAID. Gasto futuro → PENDING. Sin currency → usa default. Respuesta incluye monto formateado.
- **Timestamp inicio**: `2026-03-28T20:00:00-05:00`
- **Timestamp fin**: `2026-03-28T20:10:00-05:00`
- **Notas**: `Tool implementado con 8 tests de integración. status inicial determinado por comparación léxica due_date vs todayISO(). payment_date se fija al due_date cuando el estado es PAID. Sugerencia de manage_currency incluida cuando la moneda default sigue siendo XXX.`

### TASK-10 — Tool: mark_expense_paid — [ver detalle](tasks/task-10.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/tools/mark-expense-paid.ts`, `tests/integration/mark-expense-paid.test.ts`
- **Dependencias**: TASK-02
- **Desbloquea**: TASK-20
- **Descripción**: Marcar un gasto existente como PAID por su ID. Error si el ID no existe.
- **Criterio de aceptación**: Tests de integración pasan. Gasto existente cambia a PAID. ID inexistente lanza error descriptivo.
- **Timestamp inicio**: `2026-03-28T18:06:44-0500`
- **Timestamp fin**: `2026-03-28T18:07:55-0500`
- **Notas**: `Tool implementado en src/tools/mark-expense-paid.ts con InputSchema TypeBox, búsqueda estricta por expenses.id y update explícito de status, payment_date y updated_at sin depender del default legacy del schema. Cobertura de integración verifica PENDING, OVERDUE, ID inexistente, already PAID sin mutación y default de payment_date a hoy.`

### TASK-11 — Tool: log_income — [ver detalle](tasks/task-11.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/tools/log-income.ts`, `tests/integration/log-income.test.ts`
- **Dependencias**: TASK-02, TASK-07
- **Desbloquea**: TASK-12, TASK-20
- **Descripción**: Registrar un ingreso. Params: amount, description, date, currency?, frequency? (WEEKLY, BIWEEKLY, MONTHLY, INTERVAL_DAYS), is_recurring?.
- **Criterio de aceptación**: Tests de integración pasan. Ingreso persiste en BD. Sin currency → usa default. Respuesta formateada.
- **Timestamp inicio**: `2026-03-28T22:00:00-05:00`
- **Timestamp fin**: `2026-03-28T22:15:00-05:00`
- **Notas**: Sin contradicciones de schema. Input `recurring` mapea a columna `is_recurring`. `income_receipts` usa columnas `amount`/`date` (no `received_amount`/`received_on` que son alias semánticos del task doc). Transacción SQLite garantiza atomicidad. 7/7 tests pasan, suite completa 30/30.

### TASK-12 — Tool: log_income_receipt — [ver detalle](tasks/task-12.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/tools/log-income-receipt.ts`, `tests/integration/log-income-receipt.test.ts`
- **Dependencias**: TASK-02, TASK-07, TASK-11
- **Desbloquea**: TASK-20
- **Descripción**: Registrar un pago recibido vinculado a un ingreso. Params: income_id, amount, date, notes?. Error si income_id no existe.
- **Criterio de aceptación**: Tests de integración pasan. Receipt vinculado a income correcto. income_id inexistente lanza error.
- **Timestamp inicio**: `2026-03-28T23:00:00-05:00`
- **Timestamp fin**: `2026-03-28T23:20:00-05:00`
- **Notas**: Deriva confirmada y documentada: campos `received_amount`/`received_on`/`note` del contrato de TASK-12 se mapean a columnas reales `amount`/`date`/`notes` en `income_receipts`. Currency del income (no la global default) se usa cuando el usuario no provee currency. 9/9 tests de integración pasan, suite completa 41/41.

### TASK-13 — Tool: add_recurring_expense — [ver detalle](tasks/task-13.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/tools/add-recurring-expense.ts`, `tests/integration/add-recurring-expense.test.ts`
- **Dependencias**: TASK-02, TASK-07
- **Desbloquea**: TASK-18, TASK-20
- **Descripción**: Crear regla de gasto recurrente. Params: description, amount, category?, currency?, merchant?, frequency (WEEKLY, BIWEEKLY, MONTHLY, INTERVAL_DAYS), interval_days?, starts_on, ends_on?, reminder_days_before?. Validar: `interval_days` requerido si INTERVAL_DAYS. Para MONTHLY, el día queda anclado al día de `starts_on`; sin `day_of_month` en el input.
- **Criterio de aceptación**: Tests de integración pasan. Regla persiste. Validaciones de frequency-specific params.
- **Timestamp inicio**: `2026-03-28T23:45:00-05:00`
- **Timestamp fin**: `2026-03-29T00:00:00-05:00`
- **Notas**: Contrato cerrado en preflight: `description` → `recurring_expense_rules.name` y `expenses.description`; `day_of_month` queda NULL; idempotencia de re-ejecución eliminada del contrato. Test del índice único simula INSERT directo sobre regla existente. 13/13 tests pasan (incluye validación de starts_on > ends_on y ausencia de Próxima fecha fuera de ventana), suite completa 56/56.

### TASK-14 — Tool: get_financial_summary — [ver detalle](tasks/task-14.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/tools/get-financial-summary.ts`, `tests/integration/get-financial-summary.test.ts`
- **Dependencias**: TASK-02, TASK-07
- **Desbloquea**: TASK-20
- **Descripción**: Resumen financiero del período. Params: period? (this_month, last_month, last_30_days, this_year, default: this_month). Retorna: total gastos por categoría, total ingresos, reglas recurrentes activas, todo agrupado por moneda.
- **Criterio de aceptación**: Tests de integración pasan. Con datos: sumas correctas agrupadas por categoría y moneda. Sin datos: resumen vacío legible.
- **Timestamp inicio**: `2026-03-29T00:15:00-05:00`
- **Timestamp fin**: `2026-03-29T01:00:00-05:00`
- **Notas**: Alias confirmados en preflight: `income_receipts.amount`/`income_receipts.date` (no `received_amount`/`received_on`), `recurring_expense_rules.name` (no `description`). Patrón `(? IS NULL OR currency = ?)` para filtro opcional sin duplicar queries. Secciones por moneda ordenadas alfabéticamente. `monthlyEquivalent()` local para sumar reglas recurrentes. 13/13 tests pasan, suite completa 69/69.

### TASK-15 — [OBSOLETO] Tool: log_expense_from_image — [ver detalle](tasks/task-15.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/tools/log-expense-from-image.ts`, `tests/integration/log-expense-from-image.test.ts`
- **Dependencias**: TASK-02, TASK-03, TASK-04, TASK-06, TASK-07
- **Desbloquea**: TASK-20
- **Descripción**: Registrar gasto a partir de foto de recibo. Params: image_path, description?, category?, currency?, date?. Flujo: resolve path → runPaddleOcr → parse (amount, date, merchant) → classify → INSERT expense + INSERT ocr_extraction. Error si amount no se pudo extraer.
- **Criterio de aceptación**: Tests de integración con mock de OCR pasan. Gasto y extracción OCR persisten. Error claro si no se detecta monto. `image_path` relativo se resuelve correctamente.
- **Timestamp inicio**: 2026-03-28T19:00:00-05:00
- **Timestamp fin**: 2026-03-29T01:30:00-05:00
- **Notas**: Implementación con inyección de dependencia para `runPaddleOcr` (parámetro opcional `ocrImpl`), permitiendo tests con mocks sin problemas de ESM. 9 tests de integración pasan cubriendo: caso feliz, monto no detectable (EMPTY_CONTENT), fallo de provider (PROVIDER_ERROR), path relativo, descripción/due_date provistos, fallback de description, sugerencia manage_currency cuando XXX, archivo inexistente.

---

## Hito 6: Tools de consulta

> Búsqueda y listado con filtros. Complementan los tools de escritura.

### TASK-16 — Tool: list_expenses — [ver detalle](tasks/task-16.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/tools/list-expenses.ts`, `tests/integration/list-expenses.test.ts`
- **Dependencias**: TASK-02, TASK-07
- **Desbloquea**: TASK-20
- **Descripción**: Listar gastos con filtros. Params: period?, category?, status?, search? (LIKE en description/merchant), currency?, source? (manual/ocr), limit? (default 20), offset?. Retorna lista formateada + conteo total para paginación.
- **Criterio de aceptación**: Tests de integración pasan. Filtros combinados funcionan. Sin resultados → mensaje claro. Paginación reporta total.
- **Timestamp inicio**: 2026-03-28T19:00:00-05:00
- **Timestamp fin**: 2026-03-28T20:00:00-05:00
- **Notas**: Contrato cerrado en preflight: se agregó 'all' a SupportedPeriod en date-utils.ts retornando null para permitir "sin filtro de fecha". 21 tests de integración pasando, suite completa 110/110.

### TASK-17 — Tool: list_incomes — [ver detalle](tasks/task-17.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/tools/list-incomes.ts`, `tests/integration/list-incomes.test.ts`
- **Dependencias**: TASK-02, TASK-07
- **Desbloquea**: TASK-20
- **Descripción**: Listar ingresos con filtros. Params: recurring?, search?, currency?, limit?, offset?, include_receipts? (default false). Si `include_receipts=true`, incluir receipts asociados.
- **Criterio de aceptación**: Tests de integración pasan. Filtros funcionan. `include_receipts` agrega datos de pagos recibidos. Sin resultados → mensaje claro.
- **Timestamp inicio**: 2026-03-29T02:00:00-05:00
- **Timestamp fin**: 2026-03-29T02:30:00-05:00
- **Notas**: 21 tests de integración pasando, suite completa 132/132. Sin filtro de período (diferente de list_expenses por diseño). `log_income` siempre crea receipt inicial, por lo que "income sin receipts" no es alcanzable. Test multi-income corregido para verificar 5 receipts por income con bloques separados.

---

## Hito 7: Automatización

> Generación automática de gastos recurrentes, transiciones de estado, y reminders.

### TASK-18 — Daily sync helper — [ver detalle](tasks/task-18.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/services/daily-sync.ts`, `tests/integration/daily-sync.test.ts`
- **Dependencias**: TASK-02, TASK-07, TASK-13
- **Desbloquea**: TASK-19
- **Descripción**: Función `dailySync(db, today)` que: (1) genera expenses desde reglas recurrentes activas para la fecha, (2) marca expenses PENDING → OVERDUE si `due_date < today`, (3) recolecta reminders pendientes (sent=0). Retorna `DailySyncResult` con conteos y lista de reminders.
- **Criterio de aceptación**: Tests de integración pasan. Generación de recurrentes es idempotente (no duplica si ya existe). PENDING → OVERDUE funciona. Respeta `ends_on` y `is_active`. Soporta gaps (si no corrió varios días, genera los faltantes).
- **Timestamp inicio**: 2026-03-28T19:41:51-0500
- **Timestamp fin**: 2026-03-28T19:44:43-0500
- **Notas**: Implementado `dailySync()` con generación catch-up de recurrentes, transición `PENDING -> OVERDUE` y recolección de reminders pendientes sin marcar `sent`.

### TASK-19 — Runner externo de reminders — [ver detalle](tasks/task-19.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/services/daily-reminder-runner.ts`, `src/bin/daily-reminder-runner.ts`, `tests/integration/daily-reminder-runner.test.ts`
- **Dependencias**: TASK-18
- **Desbloquea**: nada
- **Descripción**: Runner one-shot externo al plugin que ejecuta `dailySync()`, procesa `remindersDue` y entrega cada reminder mediante la interfaz pública `openclaw message send`. Usa `target` explícito por CLI/env, marca `sent=1` y `sent_at` solo tras envío exitoso, y deja el scheduler fuera del repo (cron/systemd/launchd).
- **Criterio de aceptación**: Tests con mock del sender pasan. El runner usa `openclaw message send` como interfaz pública de entrega. Marca reminders solo en éxito, continúa ante fallos parciales y deja la automatización lista para programarse externamente.
- **Timestamp inicio**: `2026-03-29T08:34:00-0500`
- **Timestamp fin**: `2026-03-29T09:14:00-0500`
- **Notas**: Contrato documental corregido el `2026-03-29T09:02:00-0500`: la CLI pública actual usa `--account`, y el input interno `accountId` queda documentado como mapping a ese flag. Runner one-shot verificado con `npx tsc --noEmit`, `npx tsx --test tests/integration/daily-reminder-runner.test.ts` y `npm run test:integration`. El sender por defecto usa `openclaw message send` y mapea `accountId` a `--account`.

---

## Hito 8: Integración final

> Ensamblar todo en el entry point del plugin. Última tarea.

### TASK-20 — Entry point tools-only (src/index.ts) — [ver detalle](tasks/task-20.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/index.ts`, `tests/integration/plugin-entry.test.ts`
- **Dependencias**: TASK-08, TASK-09, TASK-10, TASK-11, TASK-12, TASK-13, TASK-14, TASK-15, TASK-16, TASK-17
- **Desbloquea**: nada (es la tarea final)
- **Descripción**: `definePluginEntry` que lee `api.pluginConfig`, llama `configureDb()`, y registra los 10 tools con `api.registerTool()` usando `wrapExecute()`. No registra services; la automatización de reminders vive fuera del plugin. (Nota: `configurePythonCmd()` fue eliminado en TASK-21 al retirar el pipeline PaddleOCR.)
- **Criterio de aceptación**: `npx tsc --noEmit` pasa sin errores. Todos los tests (unit + integration) pasan. Los 10 tools están registrados y `src/index.ts` no llama `api.registerService()`.
- **Timestamp inicio**: `2026-03-29T00:41:45-0500`
- **Timestamp fin**: `2026-03-29T00:41:45-0500`
- **Notas**: `Se corrige el wiring incompleto: se elimina el registro duplicado de manage_currency, se registra list_expenses y el entry point queda blindado con tests de integración/smoke que verifican exactamente 10 tools, ausencia de duplicados, ausencia de registerService(), aplicación de configureDb() y adaptación a ToolResult. Verificación final: npx tsc --noEmit, npx tsx --test tests/integration/plugin-entry.test.ts y npm run test:integration en verde. (configurePythonCmd() fue eliminado posteriormente en TASK-21.)`

---

## Hito 9: OCR Agéntico

> Adaptación a la nueva arquitectura basada en el agente OpenClaw.

### TASK-21 — Refactorización a OCR Agéntico — [ver detalle](tasks/task-21.md)
- **Estado**: `DONE`
- **Archivo(s)**: `src/tools/log-expense-from-receipt.ts`, `tests/integration/log-expense-from-receipt.test.ts`, `src/index.ts`, `tests/integration/plugin-entry.test.ts`
- **Dependencias**: TASK-02, TASK-07
- **Desbloquea**: nada
- **Descripción**: Refactorizar persistencia OCR para basarse en OpenClaw e insertar nativamente.
- **Criterio de aceptación**: tests de integración pasan, dependencias eliminadas.
- **Timestamp inicio**: `2026-03-29T10:30:00-05:00`
- **Timestamp fin**: `2026-03-29T11:00:00-05:00`

---

## Resumen de paralelismo

Una vez que las dependencias están satisfechas, estas tareas pueden ejecutarse **en paralelo** por distintos agentes:

| Fase | Tareas paralelas | Requiere completado |
|---|---|---|
| 1 | TASK-01 (sola) | — |
| 2 | TASK-02, TASK-03, TASK-05 | TASK-01 |
| 3 | TASK-04, TASK-06, TASK-07 | TASK-02 (para 07), TASK-03 (para 04), TASK-05 (para 06) |
| 4 | TASK-08, TASK-09, TASK-10, TASK-11, TASK-13, TASK-14, TASK-16, TASK-17 | TASK-02 + TASK-07 |
| 5 | TASK-12, TASK-15, TASK-18 | Fase 4 parcial + Hito 3 completo (para 15) |
| 6 | TASK-19, TASK-20 | TASK-18 (para 19), TASK-08 → TASK-17 (para 20) |
| 7 | TASK-21 | TASK-02, TASK-07 |

**Máximo paralelismo teórico**: hasta 8 agentes simultáneos en Fase 4.

---

## Log de cambios de este archivo

| Fecha | Cambio |
|---|---|
| 2026-03-28 | Creación inicial con 20 tareas en 8 hitos |
| 2026-03-28 | Agregados links a archivos de detalle individuales (`docs/tasks/task-XX.md`) |
| 2026-03-28 | `docs/implementacion.md` reducido a índice; dependencias y referencias alineadas con `docs/tasks/task-XX.md`, `AGENTS.md` y `CLAUDE.md` |
| 2026-03-28 | `docs/tasks/tasks.yaml` agregado como manifiesto canónico de metadata de TASKs; `docs/hitos.md` queda como vista operativa sincronizada |
