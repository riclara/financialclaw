# TASK-13: Tool — add_recurring_expense

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Crear una regla de gasto recurrente, generar de inmediato el primer gasto asociado y dejar listo el reminder inicial cuando corresponda.

## Archivos a crear o tocar

- `src/tools/add-recurring-expense.ts`
- `tests/integration/add-recurring-expense.test.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-02
- TASK-07

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `AGENTS.md` — secciones "Multi-moneda" y "Tools de OpenClaw"
- `docs/openclaw-sdk.md`
- `src/tools/helpers/date-utils.ts`
- `src/tools/helpers/currency-utils.ts`

## Contrato obligatorio

- Exportar:
  - `InputSchema`
  - `executeAddRecurringExpense(input, db = getDb()): string`
- Input esperado:
  - `description`: requerido — en persistencia se mapea a `recurring_expense_rules.name` y a `expenses.description`
  - `amount`: requerido, `minimum: 0`
  - `currency?`
  - `category?`
  - `merchant?`
  - `frequency`: `WEEKLY | BIWEEKLY | MONTHLY | INTERVAL_DAYS`
  - `interval_days?`: entero `>= 1`
  - `starts_on`: requerido, `YYYY-MM-DD`
  - `ends_on?`
  - `reminder_days_before?`: entero `>= 1`
- Side effects:
  - `INSERT` en `recurring_expense_rules` (campo `name` recibe el valor de `description`)
  - `INSERT` del primer `expense` (campo `description` recibe el mismo valor)
  - `INSERT` opcional del primer `reminder`
  - todo dentro de una sola transacción

## Reglas / invariantes de negocio

- Si `currency` no llega, resolver con `resolveCurrency()`.
- Si la moneda efectiva sigue en `XXX`, la respuesta debe sugerir configurar moneda real.
- Si `category` no llega, usar `OTHER`.
- Si `frequency = 'INTERVAL_DAYS'`, `interval_days` es obligatorio.
- Para `MONTHLY`, el día mensual queda anclado al día de `starts_on`. La columna `recurring_expense_rules.day_of_month` no se usa en esta TASK y debe quedar `NULL`.
- El primer gasto debe crearse con:
  - `status = 'PENDING'`
  - `due_date = starts_on`
  - `recurring_rule_id = id de la regla`
  - `generated_from_rule = 1`
  - `source = 'MANUAL'`
  - `created_at` y `updated_at` seteados explícitamente (no depender del DEFAULT para bases migradas)
- Si `reminder_days_before` existe:
  - calcular `scheduled_date = starts_on - reminder_days_before`
  - crear `reminder` asociado al primer expense
- El índice único `(recurring_rule_id, due_date)` previene que el `dailySync` o cualquier otra operación genere un expense duplicado para la misma regla y la misma fecha. Esta protección **no aplica** a dos ejecuciones distintas del tool de creación: cada llamada crea una regla nueva con un UUID nuevo, por lo que no hay colisión entre ellas.

## No asumir

- No hardcodear `COP`.
- No crear la regla sin generar el primer gasto.
- No omitir la transacción.
- No usar `day_of_month` como campo de input ni como valor en el INSERT; debe quedar `NULL` en la regla.
- No usar `status = 'PAID'` para el primer gasto.
- No prometer que re-ejecutar el tool dos veces con los mismos params produzca un solo registro. Cada ejecución crea una regla nueva.
- No omitir `updated_at` explícito al insertar en `expenses`.

## Casos borde

- `frequency = 'INTERVAL_DAYS'` sin `interval_days`:
  - error descriptivo
- `reminder_days_before = 3` y `starts_on = 2026-04-05`:
  - `scheduled_date = 2026-04-02`
- moneda placeholder `XXX`:
  - persistir igual, pero sugerir configuración real
- INSERT de expense duplicado para la misma `recurring_rule_id` y `due_date` (ej. desde `dailySync`):
  - el índice único `idx_expenses_recurring_rule_due_date` lanza un error de unicidad; el caller debe manejarlo con `INSERT OR IGNORE` o try/catch según el contexto

## Lógica de implementación

1. Validar input.
2. Resolver moneda y categoría.
3. Validar `frequency` e `interval_days`.
4. Abrir `db.transaction()`.
5. Insertar en `recurring_expense_rules`.
6. Insertar el primer `expense`.
7. Si aplica, insertar el primer `reminder`.
8. Calcular próxima fecha con `computeNextDate(...)` para el mensaje.
9. Formatear respuesta final y sugerencia de moneda si corresponde.

## Tests requeridos

- inserción exitosa de regla
- generación del primer gasto (`generated_from_rule = 1`, `status = 'PENDING'`, `recurring_rule_id` correcto)
- creación de reminder cuando `reminder_days_before` está presente
- error por `INTERVAL_DAYS` sin `interval_days`
- moneda default usada cuando `currency` se omite
- respuesta sugiere `manage_currency` cuando la moneda sigue en `XXX`
- validación de fecha inválida en `starts_on` (formato correcto pero fecha imposible)
- validación de `description` con solo espacios
- el índice único previene un segundo INSERT de expense con la misma `recurring_rule_id` y `due_date` (simular directamente, no llamando al tool dos veces)

## Criterios de aceptación

- `INSERT` en `recurring_expense_rules` correcto; `name` recibe el valor de `description`; `day_of_month` queda `NULL`.
- Primer `expense` generado con `generated_from_rule = 1`, `status = 'PENDING'`, `recurring_rule_id` correcto, `description` correcto, `updated_at` no nulo.
- Si `reminder_days_before = 3` y `starts_on = '2026-04-05'`, el reminder queda con `scheduled_date = '2026-04-02'`.
- Dos ejecuciones del tool con los mismos params crean dos reglas distintas (no hay idempotencia de tool-level).
