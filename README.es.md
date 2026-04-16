# financialclaw — Documentación en español

[![CI](https://github.com/riclara/financialclaw/actions/workflows/ci.yml/badge.svg)](https://github.com/riclara/financialclaw/actions/workflows/ci.yml)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/riclara/financialclaw)

Plugin de OpenClaw para finanzas personales. Registra gastos, ingresos, pagos recurrentes y genera resúmenes. Compatible con cualquier canal soportado por OpenClaw (Telegram, WhatsApp, etc.). El OCR de recibos es agéntico: si tu canal permite enviar imágenes, podés fotografiar un recibo y el agente extrae los datos automáticamente. Base de datos SQLite embebida. Soporte multi-moneda.

## Estado del proyecto

El plugin registra 13 tools en OpenClaw. Los reminders y el sync diario corren mediante el sistema de cron integrado de OpenClaw — no se requiere configuración externa.

Si necesitas el detalle de avance por tarea, revisa [docs/hitos.md](docs/hitos.md).

## Capacidades principales

- Tools de OpenClaw para gastos, ingresos, reglas recurrentes y consultas.
- OCR de recibos agéntico: el agente OpenClaw extrae los datos y los pasa al tool `log_expense_from_receipt`.
- Persistencia en SQLite embebida.
- Resolución explícita de moneda con soporte multi-moneda y placeholder inicial `XXX`.

## Tools disponibles

| Tool | Descripción |
|---|---|
| `manage_currency` | Agregar monedas, listarlas y definir la predeterminada |
| `log_expense_from_receipt` | Registrar un gasto a partir de datos OCR estructurados |
| `log_expense_manual` | Registrar un gasto manualmente |
| `log_income` | Registrar un ingreso |
| `log_income_receipt` | Registrar un pago recibido asociado a un ingreso |
| `add_recurring_expense` | Crear una regla de gasto recurrente |
| `mark_expense_paid` | Marcar un gasto existente como pagado |
| `get_financial_summary` | Obtener un resumen financiero por período |
| `list_expenses` | Listar gastos con filtros |
| `list_incomes` | Listar ingresos con filtros |
| `run_daily_sync` | Ejecutar el sync diario: generar gastos recurrentes, marcar vencidos y devolver recordatorios |
| `manage_fund` | Crear, listar, depositar en, retirar o archivar fondos y cuentas |
| `plan_allocation` | Dado un ingreso, mostrar compromisos del mes y saldo disponible por moneda |

## Instalación

```bash
# Desde ClawHub (recomendado)
openclaw plugins install clawhub:financialclaw

# O desde npm
openclaw plugins install financialclaw
```

Luego ejecutar el setup y reiniciar:

```bash
npx financialclaw financialclaw-setup
openclaw gateway restart
```

### ¿Por qué es necesario `financialclaw-setup`?

`openclaw plugins install` registra el plugin pero no lo agrega a `plugins.allow`. Una vez que ese campo existe, OpenClaw lo usa como allowlist explícita — todo lo que no esté listado deja de funcionar, incluyendo canales activos como Telegram.

`financialclaw-setup` lee el config actual y aplica dos cambios requeridos:

1. **`plugins.allow`** — agrega `financialclaw` junto a todos los canales y plugins activos para que nada deje de funcionar.
2. **`tools.allow`** — agrega `"financialclaw"` como entrada explícita en el allowlist de tools.

> **Nota:** Si tu `tools.profile` está en algo distinto a `"full"` (ej. `"coding"`), los tools del plugin podrían no ser visibles para el agente. El script te avisará si es el caso — puedes cambiarlo manualmente si lo necesitas.

También configura `dbPath` para que la BD persista entre reinstalaciones (por defecto: `~/.openclaw/workspace/financialclaw.db`).

### Opciones

```bash
# Ruta personalizada para la BD
npx financialclaw financialclaw-setup --db-path /tu/ruta/financialclaw.db

# Si el config de OpenClaw está en una ubicación no estándar
npx financialclaw financialclaw-setup --config /ruta/openclaw.json
```

La guía completa está en [docs/setup.es.md](docs/setup.es.md).

## Requisitos

Se requiere Node.js 24+. El plugin usa `node:sqlite`, el módulo SQLite integrado disponible desde Node.js 24 — no requiere addons nativos ni compilación.

## Verificación mínima

Después de instalar dependencias:

```bash
npx tsc --noEmit
npm run test:unit
npm run test:integration
npm run build
```

## Blog

- [Construyendo financialclaw: un plugin de finanzas personales para OpenClaw](https://ricardolara.dev/es/blog/financialclaw-openclaw-finanzas-personales/)

## Documentación

- [docs/setup.es.md](docs/setup.es.md): instalación y troubleshooting — [English](docs/setup.md)
- [docs/hitos.md](docs/hitos.md): estado final de implementación
- [docs/testing.md](docs/testing.md): estrategia de pruebas
