---
name: consultas-financieras
description: |
  Consultar el estado financiero del usuario en financialclaw. Usar cuando: el usuario pregunte cuánto ha gastado, quiera ver sus gastos o ingresos, pida un resumen del mes o del año, o pregunte por su situación financiera general. NO usar para: registrar gastos o ingresos nuevos, configurar moneda.
metadata:
  {
    "openclaw": { "emoji": "📊" }
  }
---

# Consultas financieras

## Resumen general

Usa `get_financial_summary` para una vista consolidada del período: total gastos por categoría, total ingresos, balance y compromisos recurrentes activos.

Períodos: `this_month` (default), `last_month`, `last_30_days`, `this_year`.
Filtra por `currency` si el usuario maneja varias monedas.

Ejemplos:
- "¿Cómo van mis finanzas este mes?" → `get_financial_summary`
- "Resumen de gastos del mes pasado" → period: last_month
- "Balance del año" → period: this_year

## Listar gastos

Usa `list_expenses` para ver gastos individuales con filtros.

Filtros disponibles:
- `period`: `this_month`, `last_month`, `last_30_days`, `this_year`, `all`
- `status`: `PENDING`, `PAID`, `OVERDUE`
- `category`: nombre de la categoría
- `search`: búsqueda en descripción o comercio
- `source`: `manual` u `ocr`
- `limit` / `offset`: paginación (default 20, máx 50)

Ejemplos:
- "Muéstrame los gastos pendientes" → status: PENDING
- "¿Cuánto gasté en supermercado?" → category: SUPERMARKET
- "Gastos de transporte en los últimos 30 días" → period: last_30_days, category: TRANSPORT

Si hay más resultados de los mostrados, informa al usuario que puede pedir más con offset.

## Listar ingresos

Usa `list_incomes` para ver ingresos registrados.

Filtros: `recurring` (true/false), `search`, `currency`, `include_receipts` (muestra pagos recibidos por ingreso).

Ejemplos:
- "¿Qué ingresos tengo?" → `list_incomes`
- "Mis ingresos recurrentes" → recurring: true
- "Ingresos con detalle de pagos" → include_receipts: true
