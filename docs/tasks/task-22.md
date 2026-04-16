# TASK-22: Tool: plan_allocation

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Crear el tool `plan_allocation` que, dado un monto de ingreso, muestra cuánto está comprometido en obligaciones del mes en curso y cuánto queda disponible. Es el primer tool **prospectivo** del plugin: no reporta qué pasó, sino qué hacer con el dinero que acaba de entrar.

## Archivos a crear o tocar

- `src/tools/plan-allocation.ts`
- `tests/integration/plan-allocation.test.ts`
- `src/index.ts` (registrar el tool — 11 → 12 tools)
- `tests/integration/plugin-entry.test.ts` (actualizar conteo de tools)

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-02
- TASK-07

## Referencias obligatorias

- `CLAUDE.md` — secciones: "Tools de OpenClaw", "Multi-moneda"
- `docs/feature/plan-allocation/design.md` — diseño completo de la feature
- `src/tools/get-financial-summary.ts` — referencia para patrón de queries multi-moneda y `monthlyEquivalent()`

## Contrato obligatorio

- Export esperado:
  - `export const InputSchema = Type.Object({ ... })`
  - `export function executePlanAllocation(input, db = getDb()): string`
- Input:
  - `amount`: requerido, `Type.Number({ minimum: 1 })`
  - `currency`: opcional, `Type.Optional(Type.String())` — ISO 4217, default: moneda con `is_default = 1`
- Output:
  - texto formateado con secciones: monto recibido, compromisos pendientes, ya pagado, disponible
  - montos formateados con `formatAmount()`
  - porcentaje de comprometido vs ingreso
- Side effects:
  - **Ninguno** — tool de solo lectura, no inserta ni modifica registros
  - No registrar tool en este archivo; eso ocurre en `src/index.ts`

## Reglas / invariantes de negocio

- Si `currency` no llega, usar `resolveCurrency()`
- Nunca hardcodear código de moneda
- Si la moneda default sigue siendo `XXX`, agregar sugerencia para `manage_currency`
- Solo considerar compromisos del **mes en curso** (no arrastrar deuda de meses anteriores)
- Compromisos pendientes = gastos con `status IN ('PENDING', 'OVERDUE')` del mes actual + reglas recurrentes activas cuyo gasto aún no fue generado
- Ya pagado = gastos con `status = 'PAID'` del mes actual (sección informativa)
- Si compromisos > ingreso, mostrar déficit con advertencia clara
- Solo mostrar compromisos en la moneda del ingreso; si hay compromisos en otra moneda, agregar nota informativa
- Ordenar compromisos por `due_date ASC`

## No asumir

- No asumir que `daily-sync` ya corrió hoy — hay que detectar reglas recurrentes sin gasto generado
- No asumir que el usuario configuró moneda real
- No asumir que hay reglas recurrentes — con cero compromisos, responder "todo disponible"
- No incluir gastos OVERDUE de meses anteriores en la distribución

## Casos borde

- Sin reglas recurrentes ni gastos pendientes → mensaje breve: todo disponible
- Compromisos superan ingreso → disponible negativo con advertencia
- Moneda placeholder `XXX` → incluir sugerencia `manage_currency`
- Múltiples monedas → solo distribuir en la moneda del ingreso, nota sobre compromisos en otras monedas
- Regla recurrente activa pero `daily-sync` no generó el gasto → incluir como "pendiente (estimado)" calculando la fecha esperada en el mes
- Regla con `ends_on` antes del mes actual → no incluir
- Regla con `starts_on` después del mes actual → no incluir

## Lógica de implementación

### Query 1 — Gastos pendientes del mes actual

```sql
SELECT id, description, amount, currency, due_date, source, recurring_rule_id
FROM expenses
WHERE status IN ('PENDING', 'OVERDUE')
  AND due_date BETWEEN :month_start AND :month_end
  AND is_active = 1
  AND currency = :currency
ORDER BY due_date ASC
```

### Query 2 — Reglas recurrentes sin gasto generado este mes

```sql
SELECT r.id, r.name, r.amount, r.currency, r.frequency, r.starts_on, r.day_of_month
FROM recurring_expense_rules r
WHERE r.is_active = 1
  AND r.currency = :currency
  AND r.starts_on <= :month_end
  AND (r.ends_on IS NULL OR r.ends_on >= :month_start)
  AND NOT EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.recurring_rule_id = r.id
      AND e.due_date BETWEEN :month_start AND :month_end
  )
```

Para estas reglas, calcular la fecha esperada dentro del mes según `frequency` y `day_of_month` / `starts_on`.

### Query 3 — Ya pagado este mes (informativo)

```sql
SELECT description, amount, payment_date, recurring_rule_id
FROM expenses
WHERE status = 'PAID'
  AND due_date BETWEEN :month_start AND :month_end
  AND is_active = 1
  AND currency = :currency
ORDER BY payment_date ASC
```

### Query 4 — Compromisos en otras monedas (nota informativa)

```sql
SELECT currency, COUNT(*) as count, SUM(amount) as total
FROM expenses
WHERE status IN ('PENDING', 'OVERDUE')
  AND due_date BETWEEN :month_start AND :month_end
  AND is_active = 1
  AND currency != :currency
GROUP BY currency
```

### Cálculo final

```
total_pendiente = SUM(query 1) + SUM(query 2)
total_pagado    = SUM(query 3)
disponible      = amount - total_pendiente
porcentaje      = (total_pendiente / amount) * 100
```

## Tests requeridos

- caso feliz: ingreso con reglas recurrentes pendientes → distribución correcta
- sin compromisos: cero reglas, cero gastos pendientes → "todo disponible"
- compromisos > ingreso: disponible negativo con advertencia
- moneda XXX: sugerencia de `manage_currency`
- regla recurrente sin gasto generado (daily-sync no corrió) → aparece como estimado
- gasto ya pagado → aparece en sección informativa, no en pendientes
- múltiples monedas: solo muestra compromisos en la moneda del ingreso + nota
- archivo de test esperado: `tests/integration/plan-allocation.test.ts`

## Criterios de aceptación

- `npx tsc --noEmit` pasa
- tests de integración pasan
- tool registrado en `src/index.ts` (12 tools total)
- `plugin-entry.test.ts` actualizado y pasando
- output es legible y formateado con `formatAmount()`
