# Feature: plan_allocation — Plan de aprovisionamiento financiero

## Problema

financialclaw registra gastos, ingresos y compromisos recurrentes. Pero cuando el usuario cobra, no sabe cuánto de ese dinero ya está comprometido y cuánto es realmente libre. `get_financial_summary` responde "¿qué pasó?", pero nadie responde "¿qué hago con esta plata?".

## Propuesta

Un tool de solo lectura (`plan_allocation`) que, dado un monto de ingreso, calcula:

1. Compromisos recurrentes pendientes del mes en curso
2. Gastos manuales pendientes (PENDING) no vinculados a reglas
3. Total comprometido
4. Disponible = ingreso - comprometido

## Ejemplo de interacción

```
Usuario: "Cobré $4.000.000 de salario"

→ Agente llama log_income(amount: 4000000, ...)
→ Agente llama plan_allocation(amount: 4000000, currency: "COP")

Respuesta:

Recibiste $4.000.000 COP.

Compromisos pendientes este mes:
  Arriendo           $1.500.000   vence 2026-04-05   (recurrente)
  Gimnasio             $120.000   vence 2026-04-15   (recurrente)
  Netflix               $45.900   vence 2026-04-22   (recurrente)
  Cita médica           $80.000   vence 2026-04-18   (manual)
  ─────────────────────────────────
  Total comprometido $1.745.900   (43.6%)

Ya pagado este mes:
  Internet              $95.000   pagado 2026-04-01   (recurrente)
  ─────────────────────────────────
  Total pagado          $95.000

Disponible:          $2.254.100
```

## Diferencia con get_financial_summary

| Aspecto | get_financial_summary | plan_allocation |
|---|---|---|
| Dirección temporal | Retrospectivo | Prospectivo |
| Input principal | Período (this_month, etc.) | Monto de ingreso |
| Qué muestra | Todo lo que pasó | Lo que falta por pagar |
| Cuándo se usa | "¿Cómo voy?" | "¿Qué hago con esta plata?" |
| Gastos ya pagados | Los suma como gasto | Los muestra aparte como "cubiertos" |

## Fuentes de datos (existentes)

| Dato | Tabla | Columnas clave |
|---|---|---|
| Reglas recurrentes activas | `recurring_expense_rules` | amount, currency, frequency, is_active |
| Gastos generados del mes | `expenses` | status, due_date, recurring_rule_id, currency |
| Gastos manuales pendientes | `expenses` | status=PENDING, source=manual, due_date en mes actual |
| Moneda | `currencies` | code, symbol, is_default |

## Contrato del tool

### Input

```typescript
{
  amount: number;              // monto del ingreso a distribuir
  currency?: string;           // ISO 4217, default: moneda con is_default=1
}
```

### Output

String formateado con:
1. Línea de monto recibido
2. Sección "Compromisos pendientes" — gastos con status PENDING/OVERDUE en el mes actual, ordenados por due_date
3. Sección "Ya pagado este mes" — gastos PAID del mes actual (informativo)
4. Línea de "Disponible" con porcentaje

### Parámetros en TypeBox

```typescript
const InputSchema = Type.Object({
  amount: Type.Number({ minimum: 1 }),
  currency: Type.Optional(Type.String()),
}, { additionalProperties: false });
```

## Lógica de queries

### 1. Compromisos pendientes del mes

```sql
SELECT id, description, amount, currency, due_date, source, recurring_rule_id
FROM expenses
WHERE status IN ('PENDING', 'OVERDUE')
  AND due_date BETWEEN :month_start AND :month_end
  AND is_active = 1
  AND currency = :currency
ORDER BY due_date ASC
```

### 2. Reglas recurrentes sin gasto generado este mes

Puede haber reglas activas cuyo gasto de este mes aún no fue generado por daily-sync (porque el sync no corrió hoy, o la fecha de vencimiento es futura).

```sql
SELECT r.id, r.name, r.amount, r.currency, r.frequency
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

Para estas reglas, calcular la fecha esperada dentro del mes según frequency y day_of_month.

### 3. Ya pagado este mes (informativo)

```sql
SELECT description, amount, payment_date, recurring_rule_id
FROM expenses
WHERE status = 'PAID'
  AND due_date BETWEEN :month_start AND :month_end
  AND is_active = 1
  AND currency = :currency
ORDER BY payment_date ASC
```

### 4. Cálculo final

```
total_pendiente  = SUM(query 1) + SUM(query 2)
total_pagado     = SUM(query 3)
disponible       = amount - total_pendiente
porcentaje       = (total_pendiente / amount) * 100
```

## Casos borde

### Sin reglas recurrentes ni gastos pendientes
→ "Todo disponible". Respuesta breve: "No tenés compromisos pendientes este mes. Los $4.000.000 están completamente disponibles."

### Moneda placeholder XXX
→ Incluir sugerencia de configurar moneda real con `manage_currency`, igual que los demás tools.

### Compromisos superan el ingreso
→ Mostrar disponible negativo con advertencia:
"Tus compromisos ($5.200.000) superan el ingreso. Déficit: -$1.200.000."

### Múltiples monedas
→ Solo mostrar compromisos en la moneda del ingreso. Si existen compromisos en otras monedas, agregar nota informativa: "También tenés compromisos pendientes en USD (no incluidos en este cálculo)."

### Daily-sync no corrió aún
→ Query 2 detecta reglas sin gasto generado. El tool calcula la fecha esperada y las incluye como "pendiente (estimado)".

### Gastos OVERDUE de meses anteriores
→ NO incluir. Solo compromisos del mes en curso. Los overdue de meses pasados son deuda histórica, no allocation del ingreso actual.

## Qué NO es este tool

- No es un presupuesto (no hay límites por categoría)
- No mueve dinero ni crea registros — es pura consulta
- No proyecta más allá del mes actual (eso sería cashflow projection, feature separada)
- No sugiere ahorro (eso vendrá con la feature de metas de ahorro)

## Integración futura

Cuando exista la feature de **metas de ahorro**, el allocation puede agregar una línea:

```
Meta "Vacaciones": sugerido apartar $200.000 (progreso: 65%)
```

Pero eso es v2. El tool se diseña para que agregar esa sección sea trivial (solo extender el output, no la query).

## Impacto en el sistema

- **Schema**: sin cambios
- **Tools existentes**: sin cambios
- **index.ts**: agregar registro del tool (11 → 12 tools)
- **Tests**: plugin-entry.test.ts actualizar conteo de tools
- **Archivos nuevos**: `src/tools/plan-allocation.ts`, `tests/integration/plan-allocation.test.ts`
