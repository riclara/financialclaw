# TASK-24: Extender plan_allocation con fondos

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Extender el tool `plan_allocation` (implementado en TASK-22) para incluir los fondos del Hito 11 en la distribución del ingreso. Un fondo con contribución obligatoria se trata igual que un gasto comprometido: tiene fecha estimada y reduce el disponible. Los fondos opcionales con monto fijo se muestran como sugerencia. Los fondos variables aparecen al final para que el agente pueda preguntarle al usuario cuánto quiere apartar.

## Archivos a crear o tocar

- `src/tools/plan-allocation.ts` (extender `executePlanAllocation`)
- `tests/integration/plan-allocation.test.ts` (agregar casos de fondos)

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-02
- TASK-07
- TASK-23

## Referencias obligatorias

- `CLAUDE.md` — secciones: "Tools de OpenClaw", "Multi-moneda"
- `src/tools/plan-allocation.ts` — implementación base a extender
- `docs/tasks/task-23.md` — schema de `funds` y `fund_transactions`

## Contrato obligatorio

- El export `executePlanAllocation(input, db)` no cambia firma
- El `InputSchema` no cambia
- Side effects: **ninguno** — sigue siendo tool de solo lectura
- No modificar las queries 1–4 existentes (gastos pendientes, reglas no sincronizadas, pagados, otras monedas)

## Nuevas queries

### Query 5 — Contribuciones obligatorias no realizadas este mes

```sql
SELECT f.id, f.name, f.contribution_amount, f.contribution_frequency,
       f.contribution_starts_on, f.contribution_interval_days
FROM funds f
WHERE f.is_active = 1
  AND f.currency = :currency
  AND f.contribution_required = 1
  AND f.contribution_amount IS NOT NULL
  AND f.contribution_frequency IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM fund_transactions ft
    WHERE ft.fund_id = f.id
      AND ft.type = 'deposit'
      AND ft.date BETWEEN :month_start AND :month_end
  )
```

### Query 6 — Contribuciones obligatorias ya realizadas este mes (informativo)

```sql
SELECT f.name, f.contribution_amount, ft.date
FROM fund_transactions ft
JOIN funds f ON f.id = ft.fund_id
WHERE ft.type = 'deposit'
  AND ft.date BETWEEN :month_start AND :month_end
  AND f.currency = :currency
  AND f.is_active = 1
  AND f.contribution_required = 1
ORDER BY ft.date ASC
```

### Query 7 — Fondos con contribución opcional fija

```sql
SELECT f.id, f.name, f.contribution_amount, f.contribution_frequency,
       f.target_amount,
       f.initial_balance +
         COALESCE((SELECT SUM(ft.amount) FROM fund_transactions ft
                   WHERE ft.fund_id = f.id AND ft.type = 'deposit'), 0) -
         COALESCE((SELECT SUM(ft.amount) FROM fund_transactions ft
                   WHERE ft.fund_id = f.id AND ft.type = 'withdrawal'), 0) AS balance
FROM funds f
WHERE f.is_active = 1
  AND f.currency = :currency
  AND f.contribution_required = 0
  AND f.contribution_amount IS NOT NULL
```

### Query 8 — Fondos con contribución variable (sin monto fijo)

```sql
SELECT f.id, f.name, f.target_amount,
       f.initial_balance +
         COALESCE((SELECT SUM(ft.amount) FROM fund_transactions ft
                   WHERE ft.fund_id = f.id AND ft.type = 'deposit'), 0) -
         COALESCE((SELECT SUM(ft.amount) FROM fund_transactions ft
                   WHERE ft.fund_id = f.id AND ft.type = 'withdrawal'), 0) AS balance
FROM funds f
WHERE f.is_active = 1
  AND f.currency = :currency
  AND f.contribution_amount IS NULL
```

## Cálculo actualizado

```
total_pending   = SUM(query 1) + SUM(query 2) + SUM(query 5)
disponible      = amount - total_pending
```

Las queries 7 y 8 (fondos opcionales y variables) **no reducen el disponible**.

## Output actualizado

```
Received: $4.000.000 COP

Pending commitments this month:
  Arriendo          $1.500.000  due 2026-04-05  (recurring)
  Fondo emergencia    $500.000  due 2026-04-01  (savings — required)
  ──────────────────────────────────────
  Total committed: $2.000.000 (50.0%)

Already paid this month:
  Internet             $95.000  paid 2026-04-01  (recurring)
  ──────────────────────────────────────
  Total paid: $95.000

Already saved this month:
  Fondo vacaciones    $200.000  saved 2026-04-03  (required)
  ──────────────────────────────────────
  Total saved: $200.000

Available: $2.000.000

Suggested savings:
  Fondo viaje  $300.000 suggested — balance: $800.000 / target: $2.000.000 (40%)

Variable savings:
  Inversiones — balance: $5.000.000 — How much do you want to set aside?
```

## Reglas / invariantes de negocio

- La fecha estimada para contribuciones obligatorias (query 5) usa `estimateDueDate()` ya implementada — reusar la misma función interna
- Si un fondo obligatorio ya tiene depósito este mes (query 6), aparece en "Already saved this month", no en pendientes
- Fondos opcionales (query 7) aparecen en "Suggested savings" con saldo actual y progreso de meta si aplica
- Fondos variables (query 8) aparecen en "Variable savings" con saldo actual
- Si no hay fondos activos en la moneda del ingreso, omitir las secciones "Suggested savings" y "Variable savings"
- El label de los compromisos de fondo es `(savings — required)` o `(account — required)` según el `type`
- Fondos en otras monedas: ignorar (no agregar nota — ya existe la nota de gastos en otras monedas)

## No asumir

- No asumir que `manage_fund` ya corrió (puede no haber fondos)
- No asumir que las contribuciones obligatorias se realizaron — siempre verificar via NOT EXISTS
- No cambiar la firma de `executePlanAllocation` ni el `InputSchema`
- No modificar las queries 1–4 existentes

## Casos borde

- Sin fondos activos → output idéntico al de TASK-22 (sin secciones de fondos)
- Fondo obligatorio ya aportado este mes → aparece en "Already saved", no en pendientes
- Fondo con `contribution_required = true` y el depósito del mes ya cubre el monto → no duplicar
- Fondo variable sin transacciones → balance = initial_balance
- Saldo negativo en un fondo → mostrar balance negativo sin error

## Tests requeridos

Agregar al archivo existente `tests/integration/plan-allocation.test.ts`:

- fondo con contribución obligatoria pendiente → aparece en compromisos con fecha estimada
- fondo con contribución obligatoria ya aportada → aparece en "Already saved", no en pendientes
- fondo con contribución opcional fija → aparece en "Suggested savings" con saldo y progreso
- fondo variable → aparece en "Variable savings" con saldo
- sin fondos activos → output sin secciones de fondos (retrocompatibilidad)

## Criterios de aceptación

- `npx tsc --noEmit` pasa
- Todos los tests de integración pasan (incluyendo los existentes de TASK-22)
- Output incluye las nuevas secciones cuando hay fondos activos
- Sin fondos, el output es idéntico al de TASK-22
