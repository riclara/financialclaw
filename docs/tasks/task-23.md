# TASK-23: Tool: manage_fund

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Crear el concepto de "contenedor financiero" en el plugin. Un fondo agrupa dinero con nombre, moneda y saldo calculado. Puede ser un fondo de ahorro (`savings`) o una cuenta bancaria (`account`) — la mecánica es idéntica, solo cambia el tipo. Opcionalmente tiene contribución recurrente (fija o variable) y meta de monto/fecha.

## Archivos a crear o tocar

- `src/db/schema.ts` (agregar migraciones de `funds` y `fund_transactions`)
- `src/tools/manage-fund.ts`
- `tests/integration/manage-fund.test.ts`
- `src/index.ts` (registrar el tool — 12 → 13 tools)
- `tests/integration/plugin-entry.test.ts` (actualizar conteo)

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-02
- TASK-07

## Referencias obligatorias

- `CLAUDE.md` — secciones: "Tools de OpenClaw", "Multi-moneda", "Base de datos — Reglas de migración"
- `src/tools/manage-currency.ts` — referencia de patrón con acciones múltiples en un solo tool

## Schema

### Tabla `funds`

```sql
CREATE TABLE IF NOT EXISTS funds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('savings', 'account')),
  currency TEXT NOT NULL,
  initial_balance INTEGER NOT NULL DEFAULT 0,
  contribution_amount INTEGER,               -- NULL = sin contribución fija (variable)
  contribution_frequency TEXT,               -- WEEKLY | BIWEEKLY | MONTHLY | INTERVAL_DAYS | NULL
  contribution_interval_days INTEGER,        -- solo si INTERVAL_DAYS
  contribution_required INTEGER NOT NULL DEFAULT 0 CHECK (contribution_required IN (0, 1)),
  contribution_starts_on TEXT,               -- YYYY-MM-DD; requerido si hay contribution_amount
  target_amount INTEGER,                     -- NULL = sin meta
  target_date TEXT,                          -- YYYY-MM-DD; solo si target_amount != NULL
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (currency) REFERENCES currencies (code)
);
```

### Tabla `fund_transactions`

```sql
CREATE TABLE IF NOT EXISTS fund_transactions (
  id TEXT PRIMARY KEY,
  fund_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (fund_id) REFERENCES funds (id)
);
```

**Saldo calculado** (nunca almacenado):
```
balance = initial_balance + SUM(deposits) - SUM(withdrawals)
```

## Contrato obligatorio

- Export esperado:
  - `export const InputSchema = Type.Object({ ... })`
  - `export function executeManageFund(input, db = getDb()): string`
- Input — acciones y parámetros:

| Param | Tipo | Requerido en | Descripción |
|---|---|---|---|
| `action` | `"create" \| "list" \| "deposit" \| "withdraw" \| "archive"` | siempre | Acción a ejecutar |
| `name` | `string` | `create` | Nombre del fondo |
| `type` | `"savings" \| "account"` | `create` | Tipo de contenedor |
| `currency` | `string` | `create` | ISO 4217 |
| `initial_balance` | `number` | no (default 0) | Saldo ya existente al crear |
| `contribution_amount` | `number` | no | Monto de contribución fija; NULL = variable |
| `contribution_frequency` | `string` | si hay `contribution_amount` | Frecuencia de la contribución |
| `contribution_interval_days` | `number` | si `INTERVAL_DAYS` | Intervalo en días |
| `contribution_required` | `boolean` | no (default `false`) | Si la contribución es obligatoria |
| `contribution_starts_on` | `string` | si hay `contribution_amount` | Fecha de inicio de la contribución (YYYY-MM-DD) |
| `target_amount` | `number` | no | Meta de ahorro |
| `target_date` | `string` | no | Fecha objetivo (YYYY-MM-DD) |
| `fund` | `string` | `deposit`, `withdraw`, `archive` | Nombre o ID del fondo |
| `amount` | `number` | `deposit`, `withdraw` | Monto del movimiento (siempre positivo) |
| `date` | `string` | no en `deposit`/`withdraw` | Fecha del movimiento (default: hoy) |
| `notes` | `string` | no | Nota del movimiento |

- Output: texto formateado confirmando la acción o listando los fondos
- Side effects:
  - `create`: INSERT en `funds`
  - `deposit` / `withdraw`: INSERT en `fund_transactions`
  - `archive`: UPDATE `funds SET is_active = 0`
  - `list`: solo lectura
  - No registrar el tool en este archivo; eso ocurre en `src/index.ts`

## Reglas / invariantes de negocio

- El saldo nunca se guarda — siempre se calcula desde las transacciones
- `contribution_required = true` solo tiene sentido si hay `contribution_amount` y `contribution_frequency`; si no, lanzar error descriptivo
- `contribution_starts_on` es obligatorio si se provee `contribution_amount`
- `target_amount` y `target_date` son opcionales e independientes entre sí
- Resolver fondo por `fund` param: intentar primero como ID exacto; si no existe, buscar por nombre (case-insensitive); si no hay match único, lanzar error descriptivo
- `deposit` y `withdraw` sin `date` usan `todayISO()`
- No se puede depositar o retirar de un fondo inactivo
- `archive` no borra datos — solo desactiva el fondo
- Si la moneda del fondo es `XXX`, incluir sugerencia de `manage_currency` en la respuesta

## No asumir

- No asumir que el fondo existe — validar en cada acción que requiere `fund`
- No asumir que `contribution_required = true` implica que el monto fue aportado
- No calcular ni mostrar fechas de vencimiento de contribuciones — eso le corresponde a `plan_allocation`
- No eliminar registros de `fund_transactions` bajo ninguna circunstancia

## Casos borde

- `fund` ambiguo (nombre coincide con más de un fondo activo) → error: "Nombre ambiguo, usá el ID"
- `fund` inexistente → error descriptivo
- `withdraw` con monto mayor al saldo actual → permitir (saldo negativo es posible — no bloquear)
- `archive` sobre fondo ya inactivo → mensaje informativo, sin error
- `create` con nombre duplicado → permitir (los fondos se distinguen por ID, no por nombre)
- `list` sin fondos → mensaje claro: "No hay fondos registrados"

## Output del `list`

Por cada fondo activo:

```
Fondo emergencia (savings) — COP
  Saldo: $3.700.000
  Contribución: $500.000 mensual (obligatorio) desde 2026-01-01
  Meta: $10.000.000 antes de 2026-12-31 (37%)

Bancolombia (account) — COP
  Saldo: $1.200.000
  Contribución: variable
```

Formato:
- Saldo = `initial_balance + deposits - withdrawals`, formateado con `formatAmount()`
- Progreso = `(saldo / target_amount) * 100`, redondeado a entero, solo si `target_amount != NULL`
- Fondos inactivos no aparecen en `list` (a menos que sea una acción futura `list_archived`)

## Tests requeridos

- `create`: fondo sin contribución — persiste con saldo inicial correcto
- `create`: fondo con contribución fija obligatoria — persiste todos los campos
- `create`: `contribution_required = true` sin `contribution_amount` → error
- `list`: muestra saldo calculado correctamente (initial + deposits - withdrawals)
- `list`: sin fondos → mensaje claro
- `deposit`: persiste transacción, saldo calculado actualiza
- `withdraw`: persiste transacción
- `withdraw`: fondo inactivo → error
- `archive`: desactiva fondo, no lo borra
- `fund` por nombre: resolución case-insensitive
- `fund` inexistente: error descriptivo
- Archivo de test: `tests/integration/manage-fund.test.ts`

## Criterios de aceptación

- `npx tsc --noEmit` pasa
- Tests de integración pasan
- Tool registrado en `src/index.ts` (13 tools total)
- `plugin-entry.test.ts` actualizado y pasando
- Las dos tablas se crean idempotentemente (safe to re-run migrations)
