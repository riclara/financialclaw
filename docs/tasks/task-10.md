# TASK-10: Tool — mark_expense_paid

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Permitir que el agente marque como pagado un gasto existente usando su ID, especialmente para gastos recurrentes o pendientes ya registrados en la base.

## Archivos a crear o tocar

- `src/tools/mark-expense-paid.ts`
- `tests/integration/mark-expense-paid.test.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-02

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `docs/openclaw-sdk.md`
- `src/db/database.ts`
- `docs/hitos.md`

## Contrato obligatorio

- Exportar:
  - `InputSchema`
  - `executeMarkExpensePaid(input, db = getDb()): string`
- Input esperado:
  - `expense_id`: requerido
  - `payment_date?`: `YYYY-MM-DD`, default hoy
- Side effects:
  - actualizar la fila de `expenses`
  - cambiar `status` a `PAID`
  - persistir `payment_date`
  - actualizar `updated_at`
- No registrar el tool aquí; eso ocurre en `src/index.ts`.

## Reglas / invariantes de negocio

- El gasto debe buscarse por `expense_id`.
- Si el gasto no existe, lanzar `Error`.
- Si el gasto ya está `PAID`, retornar un mensaje informativo y no volver a mutarlo.
- Si estaba `PENDING` u `OVERDUE`, debe pasar a `PAID`.
- `payment_date` default debe ser `new Date().toISOString().slice(0, 10)`.
- Esta TASK no cambia moneda ni resuelve currency; el gasto ya tiene su moneda persistida.

## No asumir

- No crear un gasto nuevo si el ID no existe.
- No tocar otros campos del gasto aparte de estado, fecha de pago y timestamp.
- No convertir el caso `already PAID` en error.
- No mezclar esta lógica con búsquedas por texto; la resolución del ID le corresponde a `list_expenses`.

## Casos borde

- `expense_id` inexistente:
  - error descriptivo
- gasto ya `PAID`:
  - mensaje informativo sin update redundante
- `payment_date` omitida:
  - usar hoy
- gasto `OVERDUE`:
  - debe poder pasar a `PAID`

## Lógica de implementación

1. Validar `expense_id` y `payment_date` con TypeBox.
2. Consultar el gasto por ID.
3. Si no existe, lanzar `Error`.
4. Si ya está `PAID`, retornar mensaje legible.
5. Resolver `payment_date`.
6. Ejecutar `UPDATE expenses SET status = 'PAID', payment_date = ?, updated_at = ? WHERE id = ? AND status != 'PAID'`.
7. Retornar confirmación en español.

## Tests requeridos

- gasto `PENDING` pasa a `PAID`
- gasto `OVERDUE` pasa a `PAID`
- `expense_id` inexistente => error
- gasto ya `PAID` => mensaje informativo
- `payment_date` omitida => usa hoy

## Criterios de aceptación

- `status` pasa de `PENDING`/`OVERDUE` a `PAID`.
- `payment_date` y `updated_at` quedan actualizados.
- Si el gasto ya estaba `PAID`, retorna mensaje informativo sin error.
- Si el `expense_id` no existe, lanza `Error` descriptivo.
