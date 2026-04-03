# financialclaw — Documentación en español

[![CI](https://github.com/riclara/financialclaw/actions/workflows/ci.yml/badge.svg)](https://github.com/riclara/financialclaw/actions/workflows/ci.yml)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/riclara/financialclaw)

Plugin de OpenClaw para finanzas personales. Registra gastos, ingresos, pagos recurrentes y genera resúmenes. Compatible con cualquier canal soportado por OpenClaw (Telegram, WhatsApp, etc.). El OCR de recibos es agéntico: si tu canal permite enviar imágenes, podés fotografiar un recibo y el agente extrae los datos automáticamente. Base de datos SQLite embebida. Soporte multi-moneda.

## Estado del proyecto

El plugin registra 11 tools en OpenClaw. Los reminders y el sync diario corren mediante el sistema de cron integrado de OpenClaw — no se requiere configuración externa.

Si necesitas el detalle de avance por tarea, revisa [docs/hitos.md](docs/hitos.md).

## Capacidades principales

- Tools de OpenClaw para gastos, ingresos, reglas recurrentes y consultas.
- OCR de recibos agéntico: el agente OpenClaw extrae los datos y los pasa al tool `log_expense_from_receipt`.
- Persistencia en SQLite embebida.
- Resolución explícita de moneda con soporte multi-moneda y placeholder inicial `XXX`.

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

`financialclaw-setup` lee el config actual y aplica tres cambios requeridos:

1. **`plugins.allow`** — agrega `financialclaw` junto a todos los canales y plugins activos para que nada deje de funcionar.
2. **`tools.profile`** — lo cambia a `"full"`. Profiles como `"coding"` o `"minimal"` excluyen tools de plugins, haciéndolos invisibles para el agente.
3. **`tools.allow`** — agrega `"financialclaw"` como entrada explícita en el allowlist de tools.

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

## Documentación

- [docs/setup.es.md](docs/setup.es.md): instalación y troubleshooting — [English](docs/setup.md)
- [docs/hitos.md](docs/hitos.md): estado final de implementación
- [docs/testing.md](docs/testing.md): estrategia de pruebas
