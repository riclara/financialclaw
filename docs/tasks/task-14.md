# TASK-14: Tool — get_financial_summary

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Implementar un tool de solo lectura que resuma la situación financiera del usuario por período, agrupando por moneda y categoría, sin modificar datos. Debe servir como respuesta compacta y confiable para preguntas como "¿cómo voy este mes?".

## Archivos a crear o tocar

- `src/tools/get-financial-summary.ts`
- `tests/integration/get-financial-summary.test.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-02
- TASK-07

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `AGENTS.md` — secciones "Tools de OpenClaw" y "Multi-moneda"
- `docs/openclaw-sdk.md`
- `src/tools/helpers/date-utils.ts`
- `src/tools/helpers/currency-utils.ts`

## Contrato obligatorio

- Exportar:
  - `InputSchema`
  - `executeGetFinancialSummary(input, db = getDb()): string`
- No exportar el objeto tool; el registro se hace en `src/index.ts`.
- Input soportado:
  - `period?`: `this_month | last_month | last_30_days | this_year`
  - `currency?`: código ISO 4217 para filtrar
- Output:
  - texto en español
  - resumen legible incluso cuando no hay datos
  - si no se filtra por moneda, agrupar por moneda

## Reglas / invariantes de negocio

- El período por defecto es `this_month`.
- El resumen debe incluir como mínimo:
  - ingresos recibidos
  - gastos totales
  - gastos pendientes
  - balance recibido
  - desglose por categoría
  - reglas recurrentes activas / compromisos fijos
- Las reglas recurrentes activas se listan independientemente del período consultado.
- Si llega `currency`, el resumen se restringe a esa moneda.
- Si no llega `currency`, no mezclar monedas en una sola suma opaca; mostrar agrupación por moneda.
- Los montos deben formatearse con separador de miles legible para usuario hispanohablante.

## No asumir

- No modificar datos; este tool es estrictamente de lectura.
- No asumir una sola moneda global si la consulta no filtra por moneda.
- No omitir reglas activas solo porque no generaron movimientos en el período.
- No devolver string vacío cuando no hay datos.
- No acoplar el cálculo de período a fechas hardcodeadas.

## Casos borde

- Sin datos en el período:
  - mostrar ceros y secciones vacías legibles
  - no lanzar error
- Si una moneda no tiene ingresos pero sí gastos, igual debe aparecer en su sección.
- Si `currency` no existe, el helper de moneda debe fallar de forma descriptiva.
- Para compromisos fijos mensuales equivalentes:
  - `MONTHLY` = `amount`
  - `WEEKLY` = `amount * 4.33`
  - `BIWEEKLY` = `amount * 2.17`
  - `INTERVAL_DAYS` = `amount * (30 / interval_days)`

## Lógica de implementación

1. Validar input con TypeBox.
2. Resolver rango del período:
   - `this_month`
   - `last_month`
   - `last_30_days`
   - `this_year`
3. Ejecutar queries agregadas:
   - total de gastos por moneda y categoría
   - gastos pendientes por moneda
   - ingresos recibidos por moneda
   - reglas recurrentes activas
4. Calcular balance recibido por moneda.
5. Calcular compromisos fijos mensuales equivalentes.
6. Formatear salida final por moneda, con sección de categorías y reglas activas.

### Queries mínimas esperadas

```sql
SELECT currency, category, SUM(amount) AS total
FROM expenses
WHERE due_date BETWEEN ? AND ? AND is_active = 1
GROUP BY currency, category;

SELECT currency, SUM(amount) AS total
FROM expenses
WHERE status = 'PENDING' AND due_date BETWEEN ? AND ? AND is_active = 1
GROUP BY currency;

SELECT currency, SUM(received_amount) AS total
FROM income_receipts
WHERE received_on BETWEEN ? AND ?
GROUP BY currency;

SELECT description, amount, currency, frequency, interval_days
FROM recurring_expense_rules
WHERE is_active = 1;
```

### Formato de salida esperado

```text
Período: marzo 2026

COP
Ingresos recibidos:  $4.000.000 COP
Gastos totales:      $1.820.000 COP
Gastos pendientes:   $1.500.000 COP
Balance recibido:    $2.180.000 COP

Por categoría:
- SUPERMERCADO  $450.000 COP
- RESTAURANTE   $380.000 COP

Compromisos fijos activos: 3 ($2.300.000 COP/mes)
- Arriendo   $1.500.000 COP (MONTHLY)
- Netflix    $45.900 COP (MONTHLY)
```

## Tests requeridos

- caso feliz con datos cargados en varias categorías
- caso sin datos en el período
- caso con filtro por moneda
- caso con múltiples monedas sin filtro
- caso con reglas recurrentes activas

## Criterios de aceptación

- Tests de integración pasan.
- Con datos, las sumas son correctas por categoría y moneda.
- Sin datos, el resumen sigue siendo legible.
- Las reglas activas aparecen aunque no haya movimientos en el período.
- `npx tsc --noEmit` pasa cuando el resto del proyecto exista.
