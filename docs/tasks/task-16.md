# TASK-16: Tool — list_expenses

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Permitir que el agente consulte y filtre gastos ya registrados, tanto para responder preguntas de historial como para resolver IDs que luego se usan en tools como `mark_expense_paid`.

## Archivos a crear o tocar

- `src/tools/list-expenses.ts`
- `tests/integration/list-expenses.test.ts`

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
  - `executeListExpenses(input, db = getDb()): string`
- Input esperado:
  - `period?`: `this_month | last_month | last_30_days | this_year | all`
  - `start_date?`
  - `end_date?`
  - `category?`
  - `status?`: `PENDING | PAID | OVERDUE`
  - `search?`
  - `currency?`
  - `source?`: `MANUAL | OCR`
  - `limit?`: `1..50`, default `20`
  - `offset?`: `>= 0`, default `0`
- Side effects:
  - ninguno; solo lecturas
- La salida debe incluir:
  - filas legibles
  - total real sin `LIMIT`
  - IDs utilizables por el agente

## Reglas / invariantes de negocio

- Si `start_date` y `end_date` llegan, usar ese rango exacto.
- Si no llegan, resolver rango desde `period` usando `getDateRange()`.
- Si `period = 'all'`, no aplicar filtro de fecha.
- Siempre filtrar `expenses.is_active = 1`.
- `search` debe buscar en `description` y `merchant` con `LIKE`.
- El conteo total debe salir de un `COUNT(*)` con los mismos filtros, pero sin `LIMIT/OFFSET`.
- Si se truncan IDs en la tabla, debe existir una manera explícita de exponer el ID completo para que el agente lo reuse.
- Los montos deben mostrarse con formato legible y conservar su moneda.

## No asumir

- No devolver gastos inactivos.
- No aplicar rango de fechas implícito cuando `period = 'all'`.
- No retornar string vacío si no hay resultados.
- No perder el total real al paginar.
- No mezclar escritura o cambios de estado dentro de este tool.

## Casos borde

- `start_date` sin `end_date`:
  - error descriptivo
- `end_date` sin `start_date`:
  - error descriptivo
- `start_date > end_date`:
  - error descriptivo
- sin resultados:
  - mensaje claro
- `offset` fuera del total:
  - retornar lista vacía con total correcto

## Lógica de implementación

1. Validar input.
2. Resolver rango temporal.
3. Construir query dinámica con `WHERE 1=1`.
4. Aplicar filtros opcionales:
  - fechas
  - categoría
  - estado
  - moneda
  - source
  - search
5. Ejecutar query paginada.
6. Ejecutar `COUNT(*)` con los mismos filtros.
7. Formatear tabla/resumen textual.

### Query mínima esperada

```sql
SELECT id, amount, currency, category, merchant, description,
       due_date, payment_date, status, source, created_at
FROM expenses
WHERE is_active = 1
ORDER BY due_date DESC
LIMIT ? OFFSET ?;
```

## Tests requeridos

- filtro por categoría
- filtro por estado
- filtro por moneda
- filtro por source
- búsqueda por `description` y `merchant`
- paginación con `limit` y `offset`
- error por fechas incompletas
- mensaje claro sin resultados

## Criterios de aceptación

- Retorna lista filtrada correctamente por cada parámetro.
- `search` busca en `description` y `merchant`.
- Sin filtros, retorna los últimos 20 gastos del mes actual.
- Sin datos, retorna un mensaje legible.
- `limit` y `offset` funcionan correctamente para paginación.
- El total mostrado refleja el conteo real sin `LIMIT`.
