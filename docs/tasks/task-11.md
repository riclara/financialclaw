# TASK-11: Tool — log_income

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Registrar una fuente de ingreso y su primera recepción real en una sola operación, dejando calculada la próxima fecha esperada cuando el ingreso sea recurrente.

## Archivos a crear o tocar

- `src/tools/log-income.ts`
- `tests/integration/log-income.test.ts`

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
  - `executeLogIncome(input, db = getDb()): string`
- Input esperado:
  - `reason`: requerido
  - `expected_amount`: requerido, `minimum: 0`
  - `currency?`
  - `date`: requerido, `YYYY-MM-DD`
  - `recurring?`: default `false`
  - `frequency?`: `WEEKLY | BIWEEKLY | MONTHLY | INTERVAL_DAYS`
  - `interval_days?`: entero `>= 1`
- Side effects:
  - `INSERT` en `incomes`
  - `INSERT` en `income_receipts`
  - ambos inserts deben quedar en una sola transacción

## Reglas / invariantes de negocio

- Si `currency` no llega, resolver con `resolveCurrency(input.currency)`.
- Si la moneda default sigue en `XXX`, la respuesta debe sugerir configurar moneda real con `manage_currency`.
- Para ingresos no recurrentes:
  - `recurring = 0`
  - `next_expected_receipt_date = null`
- Para ingresos recurrentes:
  - `frequency` es obligatoria
  - `next_expected_receipt_date` se calcula desde `date` con `computeNextDate(...)`
- Si `frequency = 'INTERVAL_DAYS'`, `interval_days` es obligatorio.
- El primer `income_receipt` debe registrarse con:
  - `received_amount = expected_amount`
  - `currency = moneda resuelta`
  - `received_on = date`
- La respuesta debe usar `formatAmount(...)` y mencionar la próxima fecha si aplica.

## No asumir

- No separar esta operación en dos tools.
- No registrar un `income` sin crear su primer `income_receipt`.
- No hardcodear `COP`.
- No permitir ingreso recurrente sin `frequency`.
- No omitir transacción entre ambos inserts.

## Casos borde

- `recurring = true` sin `frequency`:
  - error descriptivo
- `frequency = 'INTERVAL_DAYS'` sin `interval_days`:
  - error descriptivo
- `recurring = false` con `frequency` omitida:
  - válido
- Moneda placeholder `XXX`:
  - la operación persiste, pero la respuesta debe sugerir configurar moneda real

## Lógica de implementación

1. Validar input con TypeBox.
2. Resolver moneda con `resolveCurrency(...)`.
3. Validar combinación `recurring` / `frequency` / `interval_days`.
4. Calcular `next_expected_receipt_date`.
5. Abrir `db.transaction()`.
6. Insertar en `incomes`.
7. Insertar en `income_receipts`.
8. Formatear mensaje final con monto y, si aplica, próxima fecha.
9. Si la moneda es placeholder, agregar la sugerencia correspondiente.

## Tests requeridos

- ingreso no recurrente
- ingreso recurrente semanal
- ingreso recurrente mensual
- error por `recurring = true` sin `frequency`
- error por `INTERVAL_DAYS` sin `interval_days`
- sin `currency` => usa default
- respuesta con sugerencia cuando la moneda sigue en `XXX`

## Criterios de aceptación

- `INSERT` en `incomes` e `income_receipts` ocurre en una sola transacción.
- `next_expected_receipt_date` se calcula correctamente.
- Para ingreso no recurrente, `next_expected_receipt_date = null`.
- Sin `currency`, usa la moneda default.
- La respuesta queda formateada y, si aplica, incluye la próxima fecha esperada.
