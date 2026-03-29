# TASK-09: Tool — log_expense_manual

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Registrar un gasto manual sin OCR, con la menor fricción posible, respetando multi-moneda y determinando el estado inicial del gasto a partir de su fecha.

## Archivos a crear o tocar

- `src/tools/log-expense-manual.ts`
- `tests/integration/log-expense-manual.test.ts`

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
  - `executeLogExpenseManual(input, db = getDb()): string`
- Input esperado:
  - `amount`: requerido
  - `description`: requerido
  - `due_date`: requerido
  - `category?`
  - `currency?`
  - `merchant?`
- Side effects:
  - insertar fila en `expenses`
  - `source = 'MANUAL'`

## Reglas / invariantes de negocio

- Si `currency` no llega, resolver con la moneda default usando `resolveCurrency()`.
- Si `category` no llega, usar `OTHER`.
- El estado inicial depende de la fecha:
  - si `due_date <= hoy` => `PAID`
  - si `due_date > hoy` => `PENDING`
- `payment_date` se llena solo cuando el estado inicial es `PAID`.
- Si la moneda default sigue siendo `XXX`, la respuesta debe sugerir usar `manage_currency`.
- La respuesta final debe incluir monto formateado.

## No asumir

- No usar un flag `is_paid` como fuente principal de verdad; el criterio es la fecha.
- No hardcodear `COP`.
- No registrar gasto sin moneda resuelta.
- No omitir la sugerencia de configuración si la moneda sigue en placeholder.
- No exportar un objeto tool desde este archivo.

## Casos borde

- `currency = 'USD'` sin USD registrada:
  - error descriptivo
- `due_date` igual a hoy:
  - gasto `PAID`
- `due_date` futura:
  - gasto `PENDING`
- `merchant` ausente:
  - la respuesta sigue siendo legible

## Lógica de implementación

1. Validar input con TypeBox.
2. Resolver moneda.
3. Determinar `category`.
4. Comparar `due_date` contra `todayISO()` para decidir `status` y `payment_date`.
5. Insertar en `expenses` con:
   - `source = 'MANUAL'`
   - `is_active = 1`
   - timestamps
6. Formatear respuesta con `formatAmount(...)`.
7. Si la moneda es placeholder, agregar recomendación de `manage_currency`.

## Tests requeridos

- gasto con fecha de hoy => `PAID`
- gasto con fecha futura => `PENDING`
- sin currency => usa moneda default
- error por currency inexistente
- respuesta incluye monto formateado
- respuesta sugiere configurar moneda cuando sigue en `XXX`

## Criterios de aceptación

- Tests de integración pasan.
- Gasto con `due_date` hoy queda `PAID`.
- Gasto con `due_date` futura queda `PENDING`.
- Sin `currency`, usa la moneda default.
- La respuesta incluye monto formateado y, si aplica, la sugerencia por placeholder.
