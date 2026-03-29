# TASK-17: Tool — list_incomes

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Permitir que el agente consulte ingresos definidos y, opcionalmente, sus últimos receipts, para responder preguntas del usuario y resolver IDs reutilizables en `log_income_receipt`.

## Archivos a crear o tocar

- `src/tools/list-incomes.ts`
- `tests/integration/list-incomes.test.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-02
- TASK-07

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `AGENTS.md` — secciones "Multi-moneda" y "Tools de OpenClaw"
- `docs/openclaw-sdk.md`
- `src/tools/helpers/currency-utils.ts`

## Contrato obligatorio

- Exportar:
  - `InputSchema`
  - `executeListIncomes(input, db = getDb()): string`
- Input esperado:
  - `recurring?`: `true` solo recurrentes, `false` solo no recurrentes, omitido = todos
  - `search?`
  - `currency?`
  - `limit?`: `1..50`, default `20`
  - `offset?`: `>= 0`, default `0`
  - `include_receipts?`: default `false`
- Side effects:
  - ninguno; solo lecturas
- La salida debe incluir:
  - lista de incomes
  - total real
  - IDs reutilizables
  - y, si `include_receipts = true`, los últimos 5 receipts por income

## Reglas / invariantes de negocio

- `search` debe buscar en `reason` con `LIKE`.
- El total debe calcularse con `COUNT(*)` usando los mismos filtros sin `LIMIT/OFFSET`.
- Sin filtros, debe listar todos los ingresos hasta `limit`.
- Si `include_receipts = true`, por cada income se deben traer como máximo 5 receipts ordenados por `received_on DESC`.
- El formato de salida debe seguir siendo legible cuando un income no es recurrente o no tiene próxima fecha esperada.
- Los montos deben conservar su moneda en la presentación.

## No asumir

- No ocultar ingresos no recurrentes por defecto.
- No mezclar receipts de un income con otro.
- No retornar string vacío si no hay resultados.
- No omitir los IDs útiles para el agente.
- No escribir en BD desde este tool.

## Casos borde

- sin resultados:
  - mensaje claro
- `include_receipts = true` con income sin receipts:
  - mostrar el income sin bloque vacío confuso
- `offset` mayor al total:
  - lista vacía con total correcto
- `search` sin matches:
  - mensaje legible

## Lógica de implementación

1. Validar input.
2. Construir query dinámica para `incomes`.
3. Aplicar filtros opcionales:
  - `recurring`
  - `currency`
  - `search`
4. Ejecutar query paginada.
5. Ejecutar `COUNT(*)`.
6. Si `include_receipts = true`, consultar hasta 5 receipts por income.
7. Formatear salida final.

### Query mínima esperada

```sql
SELECT id, reason, expected_amount, currency, recurring,
       frequency, interval_days, next_expected_receipt_date, created_at
FROM incomes
WHERE 1=1
ORDER BY created_at DESC
LIMIT ? OFFSET ?;
```

## Tests requeridos

- filtro por `recurring`
- filtro por moneda
- búsqueda por `reason`
- paginación
- `include_receipts = true`
- sin resultados => mensaje claro

## Criterios de aceptación

- Retorna lista filtrada correctamente por cada parámetro.
- `search` busca en `reason`.
- Sin filtros, retorna todos los ingresos hasta `limit`.
- `include_receipts = true` agrega los últimos 5 recibos de cada income.
- Sin datos, retorna un mensaje legible.
- `limit` y `offset` funcionan correctamente para paginación.
