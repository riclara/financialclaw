---
name: registro-ingresos
description: |
  Registrar ingresos en financialclaw. Usar cuando: el usuario mencione haber recibido dinero, cobrado un sueldo, recibido un pago de cliente, o quiera registrar una fuente de ingreso nueva. También cuando registre el cobro de una cuota o pago parcial sobre un ingreso ya existente. NO usar para: gastos, consultas de ingresos previos.
metadata:
  {
    "openclaw": { "emoji": "💰" }
  }
---

# Registro de ingresos

## Ingreso nuevo

Usa `log_income` para fuentes de ingreso nuevas o pagos únicos.

Parámetros requeridos: `amount`, `description`, `date`.
Parámetros opcionales: `currency`, `is_recurring`, `frequency`, `interval_days`.

Si el ingreso es recurrente (sueldo mensual, cliente fijo), activa `is_recurring: true` y especifica `frequency`.

Frecuencias: `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `INTERVAL_DAYS`.
Para `INTERVAL_DAYS`, `interval_days` es obligatorio.

Ejemplos:
- "Recibí mi sueldo de $3.000.000" → `log_income` con is_recurring: true, frequency: MONTHLY
- "Me pagaron un proyecto por $500 USD" → `log_income` con currency: USD
- "Ingreso de freelance, $200 cada dos semanas" → frequency: BIWEEKLY

## Pago recibido sobre ingreso existente

Usa `log_income_receipt` cuando el usuario informe el cobro de una cuota o pago sobre un ingreso ya registrado (no uno nuevo).

Requiere `income_id`. Si el usuario no lo tiene, usa `list_incomes` para mostrárselos primero.

Parámetros requeridos: `income_id`, `amount`, `date`.
Parámetro opcional: `notes`.

Ejemplo: "Recibí el pago de marzo del cliente X" → busca el income_id con `list_incomes` y luego usa `log_income_receipt`.
