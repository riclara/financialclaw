---
name: registro-gastos
description: |
  Registrar gastos en financialclaw. Usar cuando: el usuario mencione haber gastado dinero, comprado algo, pagado una cuenta, o envíe una foto de un recibo o ticket. También cuando quiera marcar un gasto existente como pagado, o crear un gasto recurrente (servicios, suscripciones, cuotas fijas). NO usar para: ingresos, consultas de gastos previos, configuración de moneda.
metadata:
  {
    "openclaw": { "emoji": "💸" }
  }
---

# Registro de gastos

## Gasto manual

Usa `log_expense_manual` cuando el usuario describa un gasto con palabras (sin foto).

Parámetros requeridos: `amount`, `description`.
Parámetros opcionales: `category`, `currency`, `merchant`, `due_date`.

Si falta el monto, pregunta antes de registrar. Si falta la fecha, usa hoy por defecto (el tool lo hace automáticamente).

Categorías disponibles: `HOUSING`, `SERVICES`, `TRANSPORT`, `SUPERMARKET`, `HEALTH`, `EDUCATION`, `ENTERTAINMENT`, `RESTAURANT`, `OTHER`.

Ejemplos:
- "Gasté $50.000 en el super" → `log_expense_manual` con category: SUPERMARKET
- "Pagué el arriendo" → pregunta el monto si no lo dio
- "Almuerzo por $18.000 en Crepes & Waffles" → agrega merchant

## Gasto desde foto de recibo

Usa `log_expense_from_receipt` cuando el usuario envíe una foto de un recibo, ticket o factura.

Flujo obligatorio — no saltear ningún paso:

1. Extrae del recibo usando tus capacidades de visión:
   - `amount`: el total del recibo (número, sin símbolos ni puntos de miles)
   - `date`: fecha en formato YYYY-MM-DD
   - `merchant`: nombre del establecimiento
   - `category`: infiere según tipo de negocio
   - `raw_text`: todo el texto visible del recibo

2. Antes de invocar el tool, muestra los datos extraídos al usuario y pide confirmación:
   > "Encontré esto en el recibo — ¿es correcto?
   > • Monto: [amount]
   > • Fecha: [date]
   > • Comercio: [merchant]
   > • Categoría: [category]
   > Responde 'sí' para guardar o corrígeme si algo está mal."

3. Solo llama a `log_expense_from_receipt` después de que el usuario confirme o corrija los datos.

## Marcar gasto como pagado

Usa `mark_expense_paid` cuando el usuario confirme que pagó un gasto pendiente.

Necesitas el `expense_id`. Si el usuario no lo tiene a mano, usa `list_expenses` con `status: "PENDING"` para mostrárselos y que elija.

## Gasto recurrente

Usa `add_recurring_expense` para servicios fijos, suscripciones o cuotas.

Parámetro `frequency`: `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `INTERVAL_DAYS`.
Para `INTERVAL_DAYS`, `interval_days` es obligatorio.

Ejemplo: "Quiero registrar que pago Netflix cada mes por $45.000" → `add_recurring_expense` con frequency: MONTHLY.

## Moneda sin configurar

Si la respuesta del tool incluye sugerencia de configurar moneda, informa al usuario que su moneda por defecto no está configurada y ofrécele hacerlo ahora con `manage_currency`.
