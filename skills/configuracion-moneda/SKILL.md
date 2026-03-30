---
name: configuracion-moneda
description: |
  Configure currency in financialclaw. Use when: the user wants to add a currency, change their default currency, view configured currencies, or when any tool responds suggesting currency configuration (signal that the active currency is still the XXX placeholder). NOT for: logging expenses or income.
metadata:
  {
    "openclaw": { "emoji": "⚙️" }
  }
---

# Currency configuration

Use `manage_currency` with the appropriate action.

## Add currency

Action: `add`
Params: `code` (ISO 4217), `name`, `symbol`

Common currencies: COP / Colombian peso / $, USD / US dollar / $, EUR / Euro / €, MXN / Mexican peso / $, ARS / Argentine peso / $

## List currencies

Action: `list`
Shows all configured currencies. The default currency is marked.

## Set default currency

Action: `set_default`
Param: `code`

## First-time setup flow

If the active currency is XXX (not yet configured), guide the user as follows:

1. Inform them that the currency is not configured and amounts will show with the `¤` symbol
2. Ask which currency they primarily use
3. Use `add` to register it with the correct code, name, and symbol
4. Use `set_default` to set it as the default
5. Confirm the change by showing the configured currency name and symbol
