# TASK-02: Base de datos SQLite (schema + database)

> Volver al [indice de hitos](../hitos.md)

## Objetivo

Dejar creada la capa de persistencia base del proyecto: schema SQLite idempotente, acceso singleton para produccion y helper de BD en memoria para tests. Sin esta TASK, el resto de tools no tiene donde persistir ni como probarse.

## Archivos a crear o tocar

- `src/db/schema.ts`
- `src/db/database.ts`
- `tests/helpers/test-db.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-01

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `AGENTS.md` — secciones "Base de datos — Reglas de migración" y "Multi-moneda"
- `docs/testing.md`
- `docs/hitos.md`

## Contrato obligatorio

- `src/db/schema.ts` exporta constantes SQL por tabla y las colecciones:
  - `ALL_MIGRATIONS`
  - `ALL_SEEDS`
- `src/db/database.ts` exporta:
  - `configureDb(dbPath: string): void`
  - `getDb(): Database.Database`
- `tests/helpers/test-db.ts` exporta:
  - `createTestDb(): Database.Database`
- No usar default export en `database.ts`.
- `getDb()` debe ser lazy singleton.
- `createTestDb()` debe crear una SQLite `:memory:` con schema completo y seed aplicado.

## Reglas / invariantes de negocio

- La BD debe contener exactamente estas 7 tablas base:
  - `currencies`
  - `ocr_extractions`
  - `recurring_expense_rules`
  - `expenses`
  - `incomes`
  - `income_receipts`
  - `reminders`
- La tabla `currencies` debe sembrarse con `XXX / Sin configurar / ¤` como default.
- El orden de `ALL_MIGRATIONS` importa:
  - `currencies` antes que cualquier tabla que la referencie
  - `ocr_extractions` antes de `expenses`
  - `recurring_expense_rules` antes de `expenses`
- `expenses` debe tener índice único por `(recurring_rule_id, due_date)` cuando `recurring_rule_id IS NOT NULL` para soportar idempotencia de recurrentes.
- `reminders` debe tener índice único por `(expense_id, scheduled_date, days_before)`.
- Al inicializar la BD de producción:
  - `journal_mode = WAL`
  - `foreign_keys = ON`

## No asumir

- No usar `DROP TABLE`, `DROP COLUMN` ni borrar datos del usuario.
- No inicializar la BD al importar el módulo; debe ocurrir solo en la primera llamada a `getDb()`.
- No crear archivos `.db` desde los tests por accidente.
- No sembrar una moneda real; el seed correcto es `XXX`.
- No cambiar la firma pública de `configureDb()` y `getDb()`.

## Casos borde

- Si `configureDb()` se llama después de que `getDb()` ya creó el singleton, debe lanzar error descriptivo.
- Re-ejecutar migraciones y seeds no debe duplicar tablas, índices ni moneda default.
- Si el proyecto se ejecuta sin `configureDb()`, debe usar `FINANCIALCLAW_DB_PATH` o `./financialclaw.db`.
- Si una tabla futura agrega columnas, la estrategia debe seguir siendo idempotente.
- Las columnas agregadas mediante migraciones ADD COLUMN deben ser idempotentes y no causar errores al reaplicarse.

## Lógica de implementación

1. Definir en `schema.ts` una constante por bloque SQL, no un string gigante opaco.
2. Agrupar en `ALL_MIGRATIONS` respetando dependencias FK.
3. Agrupar seeds en `ALL_SEEDS`.
4. En `database.ts`, mantener `_db` y `_dbPath` a nivel de módulo.
5. `configureDb()` solo cambia la ruta antes de la primera inicialización.
6. `getDb()`:
   - crea el singleton
   - configura pragmas
   - ejecuta migraciones y seeds dentro de una transacción
   - retorna la instancia
7. En `tests/helpers/test-db.ts`, reutilizar `ALL_MIGRATIONS` y `ALL_SEEDS` para no duplicar schema.

### Schema minimo requerido

- `currencies`:
  - PK `code`
  - `name`, `symbol`, `is_default`, `created_at`
- `ocr_extractions`:
  - sugeridos de OCR, confidence, provider, failure metadata
  - `status` (COMPLETED|FAILED), `failure_code`
- `expenses`:
  - monto, moneda, categoria, merchant, descripcion
  - `due_date`, `payment_date`, `status`
  - `source`, `ocr_extraction_id`, `recurring_rule_id`
  - flags de `generated_from_rule`, `is_active`
  - timestamps `created_at`, `updated_at`
- `incomes`:
  - `reason`, `expected_amount`, `currency`
  - recurrencia y `next_expected_receipt_date`
- `income_receipts`:
  - FK a `incomes`, monto recibido, moneda, fecha
- `recurring_expense_rules`:
  - frecuencia, intervalo, vigencia, recordatorios
- `reminders`:
  - FK a `expenses`, fecha programada, días antes, `sent`

## Tests requeridos

- `tests/helpers/test-db.ts` debe permitir que cada test cree su propia BD aislada.
- Verificar al menos:
  - caso feliz: schema completo creado
  - caso de compatibilidad: una base legacy de `expenses` sin `updated_at` recibe la columna sin perder datos
  - caso borde: seed `XXX` presente
  - caso de contrato: `configureDb()` falla si se llama demasiado tarde

## Criterios de aceptación

- `createTestDb()` crea BD en memoria con las 7 tablas esperadas.
- `getDb()` es named export, no default export.
- `SELECT * FROM currencies` incluye `XXX` con `is_default = 1`.
- `expenses.updated_at` existe tanto en bases nuevas como en bases ya creadas antes de esta corrección contractual.
- El archivo SQLite de producción se crea en la ruta configurada.
- `npx tsc --noEmit` pasa cuando el resto del proyecto exista.
