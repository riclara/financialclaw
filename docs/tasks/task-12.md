# TASK-12: Tool — log_income_receipt

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Registrar una recepción adicional de un ingreso ya existente, actualizando la próxima fecha esperada cuando el income sea recurrente y mostrando la diferencia contra el monto esperado.

## Archivos a crear o tocar

- `src/tools/log-income-receipt.ts`
- `tests/integration/log-income-receipt.test.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-02
- TASK-07
- TASK-11

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `AGENTS.md` — secciones "Multi-moneda" y "Tools de OpenClaw"
- `docs/openclaw-sdk.md`
- `src/tools/helpers/date-utils.ts`
- `src/tools/helpers/currency-utils.ts`

## Contrato obligatorio

- Exportar:
  - `InputSchema`
  - `executeLogIncomeReceipt(input, db = getDb()): string`
- Input esperado:
  - `income_id`: requerido
  - `received_amount`: requerido, `minimum: 0`
  - `currency?`
  - `received_on`: requerido, `YYYY-MM-DD`
  - `note?`
- Side effects:
  - `INSERT` en `income_receipts`
  - si el income es recurrente, `UPDATE` de `next_expected_receipt_date` en `incomes`

## Reglas / invariantes de negocio

- El `income_id` debe existir; si no, lanzar `Error`.
- Si `currency` no llega, usar la moneda del `income` asociado.
- Si llega `currency`, validarla con `resolveCurrency(...)`.
- Si el income es recurrente, recalcular `next_expected_receipt_date` usando `computeNextDate(received_on, frequency, interval_days)`.
- El mensaje final debe incluir diferencia si `received_amount != expected_amount`.
- Si la moneda efectiva termina siendo `XXX`, la respuesta debe sugerir configurar moneda real.
- La operación de insertar receipt y actualizar el income, si aplica, debe ser atómica.

## No asumir

- No usar la moneda default global si el `income` ya tiene moneda persistida y el usuario no envió otra.
- No registrar receipt si el income no existe.
- No actualizar `next_expected_receipt_date` en incomes no recurrentes.
- No omitir la diferencia contra `expected_amount` cuando aplique.
- No registrar el tool desde este archivo.

## Casos borde

- `income_id` inexistente:
  - error descriptivo
- income no recurrente:
  - solo insertar receipt
- receipt con monto distinto al esperado:
  - informar diferencia positiva o negativa
- currency explícita no registrada:
  - error descriptivo

## Lógica de implementación

1. Validar input.
2. Buscar el `income` por `income_id`.
3. Resolver moneda efectiva:
  - `input.currency` si llega
  - de lo contrario `income.currency`
4. Abrir transacción.
5. Insertar `income_receipt`.
6. Si el income es recurrente, actualizar `next_expected_receipt_date`.
7. Calcular diferencia vs `expected_amount`.
8. Formatear la respuesta con monto, diferencia y recomendación de moneda si aplica.

## Tests requeridos

- receipt exitoso para income existente
- error por `income_id` inexistente
- income recurrente actualiza próxima fecha
- income no recurrente no la actualiza
- diferencia positiva/negativa en la respuesta
- currency omitida => usa la del income

## Criterios de aceptación

- `INSERT` correcto en `income_receipts`.
- `next_expected_receipt_date` se actualiza si el income es recurrente.
- El mensaje incluye diferencia si `received_amount` difiere de `expected_amount`.
- `income_id` inexistente lanza `Error`.
