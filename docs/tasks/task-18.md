# TASK-18: Daily sync helper

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Implementar la rutina diaria de mantenimiento financiero: generar gastos recurrentes faltantes, mover gastos vencidos a `OVERDUE` y recopilar reminders listos para enviarse. Esta TASK concentra la lógica batch; una capa de entrega externa solo la invoca y entrega mensajes.

## Archivos a crear o tocar

- `src/services/daily-sync.ts`
- `tests/integration/daily-sync.test.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-02
- TASK-07
- TASK-13

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `src/tools/helpers/date-utils.ts`
- `src/db/database.ts`
- `docs/hitos.md`
- `AGENTS.md`

## Contrato obligatorio

- Exportar:
  - `interface DailySyncResult`
  - `dailySync(db = getDb(), today = todayISO()): DailySyncResult`
- `DailySyncResult` debe incluir al menos:
  - `expensesGenerated`
  - `expensesMarkedOverdue`
  - `remindersDue`
- `dailySync()` debe ser invocable con DI de:
  - BD
  - fecha fija
- El helper no envía mensajes ni marca reminders como enviados.

### Shape esperado de `remindersDue`

```typescript
Array<{
  expense_id: string;
  reminder_id: string;
  description: string;
  amount: number;
  currency: string;
  due_date: string;
  days_before: number;
}>
```

## Reglas / invariantes de negocio

- Para cada regla activa en `recurring_expense_rules`, generar gastos faltantes hasta `today`.
- La generación debe respetar:
  - `is_active = 1`
  - `ends_on`
  - frecuencia e `interval_days`
- Si no se ejecutó por varios días o meses, debe ponerse al día generando todos los faltantes.
- Los gastos generados por reglas deben crearse como:
  - `status = 'PENDING'`
  - `generated_from_rule = 1`
  - `recurring_rule_id = rule.id`
- Después de la generación, todo gasto con:
  - `status = 'PENDING'`
  - `due_date < today`
  - `is_active = 1`
  debe pasar a `OVERDUE`.
- Los reminders pendientes se seleccionan por:
  - `scheduled_date <= today`
  - `sent = 0`
- `dailySync()` solo recopila reminders. Marcar `sent = 1` le corresponde al service después del envío exitoso.

## No asumir

- No enviar mensajes desde este helper.
- No marcar reminders como enviados dentro de `dailySync()`.
- No depender de tiempo real del sistema en tests; permitir fecha inyectada.
- No duplicar gastos recurrentes si el helper se ejecuta más de una vez el mismo día.
- No tocar gastos `PAID` ni `OVERDUE` al hacer la transición de vencidos.

## Casos borde

- Regla con gap largo:
  - si el último gasto fue hace meses, generar todos los faltantes hasta `today`
- Regla con `ends_on`:
  - no generar gastos posteriores a esa fecha
- Regla inactiva:
  - ignorarla completamente
- Reminder vencido no enviado:
  - debe seguir apareciendo en `remindersDue`
- Ejecución repetida el mismo día:
  - no debe duplicar gastos ni reminders por las restricciones únicas del schema

## Lógica de implementación

1. Abrir transacción para pasos mutantes.
2. Paso 1: recorrer reglas recurrentes activas.
3. Para cada regla:
   - buscar `MAX(due_date)` generado para esa regla
   - calcular la siguiente fecha con `computeNextDate(...)`
   - mientras la próxima fecha sea `<= today` y respete `ends_on`:
     - insertar expense `PENDING`
     - insertar reminder si la regla lo requiere
     - avanzar a la siguiente fecha
4. Paso 2: actualizar `PENDING -> OVERDUE`.
5. Fuera de la transacción, consultar reminders pendientes.
6. Retornar conteos y lista de reminders.

### Queries mínimas esperadas

```sql
SELECT MAX(due_date) AS last_date
FROM expenses
WHERE recurring_rule_id = ? AND generated_from_rule = 1;

UPDATE expenses
SET status = 'OVERDUE', updated_at = ?
WHERE status = 'PENDING' AND due_date < ? AND is_active = 1;

SELECT r.id AS reminder_id, r.expense_id, r.days_before,
       e.description, e.amount, e.currency, e.due_date
FROM reminders r
JOIN expenses e ON e.id = r.expense_id
WHERE r.scheduled_date <= ? AND r.sent = 0
ORDER BY e.due_date ASC;
```

## Tests requeridos

- generación normal de recurrentes
- generación con gap de varios períodos
- respeto de `ends_on`
- regla inactiva
- idempotencia
- transición a `OVERDUE`
- reminders pendientes

## Criterios de aceptación

- Con una regla `MONTHLY` creada el `2026-03-05` y `today = '2026-05-10'`, genera gastos para abril y mayo.
- No genera duplicados si se ejecuta dos veces el mismo día.
- Gastos con `due_date < today` pasan de `PENDING` a `OVERDUE`.
- No toca gastos que ya estén `PAID` o `OVERDUE`.
- Reminders con `scheduled_date <= today` y `sent = 0` aparecen en `remindersDue`.
- Respeta `ends_on` e `is_active`.
