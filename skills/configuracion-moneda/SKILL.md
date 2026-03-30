---
name: configuracion-moneda
description: |
  Configurar la moneda en financialclaw. Usar cuando: el usuario quiera agregar una moneda, cambiar su moneda por defecto, ver las monedas configuradas, o cuando cualquier tool responda sugiriendo configurar la moneda (señal de que la moneda activa sigue siendo el placeholder XXX). NO usar para: registrar gastos o ingresos.
metadata:
  {
    "openclaw": { "emoji": "⚙️" }
  }
---

# Configuración de moneda

Usa `manage_currency` con la acción correspondiente.

## Agregar moneda

Acción: `add`
Parámetros: `code` (ISO 4217), `name`, `symbol`

Monedas frecuentes: COP / Peso colombiano / $, USD / Dólar estadounidense / $, EUR / Euro / €, MXN / Peso mexicano / $, ARS / Peso argentino / $

## Listar monedas

Acción: `list`
Muestra todas las monedas configuradas. La moneda por defecto aparece marcada.

## Cambiar moneda por defecto

Acción: `set_default`
Parámetro: `code`

## Flujo de primera configuración

Si la moneda activa es XXX (aún no configurada), guía al usuario así:

1. Informa que la moneda no está configurada y que los montos se mostrarán con el símbolo `¤`
2. Pregunta qué moneda usa principalmente
3. Usa `add` para registrarla con code, name y symbol correctos
4. Usa `set_default` para establecerla como default
5. Confirma el cambio mostrando el nombre y símbolo configurados
