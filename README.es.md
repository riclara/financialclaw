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
openclaw plugins install @riclara/financialclaw
npx @riclara/financialclaw financialclaw-setup
openclaw gateway restart
```

### ¿Por qué es necesario `financialclaw-setup`?

`openclaw plugins install` registra el plugin pero no lo agrega a `plugins.allow`. Una vez que ese campo existe, OpenClaw lo usa como allowlist explícita — todo lo que no esté listado deja de funcionar, incluyendo canales activos como Telegram.

`financialclaw-setup` lee el config actual, descubre todos los canales y plugins activos, y agrega `financialclaw` junto a ellos para que nada deje de funcionar. También configura `plugins.entries.financialclaw.config.dbPath` para que la BD persista entre reinstalaciones (por defecto: `~/.openclaw/workspace/financialclaw.db`).

### Opciones

```bash
# Ruta personalizada para la BD
npx @riclara/financialclaw financialclaw-setup --db-path /tu/ruta/financialclaw.db

# Si el config de OpenClaw está en una ubicación no estándar
npx @riclara/financialclaw financialclaw-setup --config /ruta/openclaw.json
```

La guía completa está en [docs/setup.es.md](docs/setup.es.md).

## Importante sobre Node.js y `better-sqlite3`

Este proyecto usa `better-sqlite3`, que es un addon nativo. Eso significa que el binario compilado depende de la versión activa de Node.js.

- Si cambias de versión de Node, vuelve a ejecutar `npm install` antes de correr tests o usar el plugin.
- `package.json` ejecuta `npm rebuild better-sqlite3` en `postinstall` para recompilar automáticamente el binario nativo con el Node activo.
- Si ves errores como `NODE_MODULE_VERSION` o `ERR_DLOPEN_FAILED`, casi siempre se resuelve con `npm install`.

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
