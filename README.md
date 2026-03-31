# financialclaw

[![CI](https://github.com/riclara/financialclaw/actions/workflows/ci.yml/badge.svg)](https://github.com/riclara/financialclaw/actions/workflows/ci.yml)

Plugin de OpenClaw para finanzas personales vía Telegram. Expone un set de tools para registrar gastos, ingresos, pagos recurrentes y generar resúmenes sobre una base SQLite embebida. OCR de recibos delegado al agente OpenClaw (arquitectura agéntica). Soporte multi-moneda.

## Estado del proyecto

El plugin quedó cerrado como plugin **tools-only**: registra 10 tools en OpenClaw y no corre automatizaciones dentro del runtime del plugin.

Los reminders viven en un runner externo one-shot (`src/bin/daily-reminder-runner.ts`) que ejecuta `dailySync()` y entrega mensajes mediante `openclaw message send`. La programación periódica queda fuera del repositorio (`cron`, `systemd`, `launchd`, etc.).

Si necesitas el detalle de avance por tarea, revisa [docs/hitos.md](docs/hitos.md).

## Capacidades principales

- Tools de OpenClaw para gastos, ingresos, reglas recurrentes y consultas.
- OCR de recibos agéntico: el agente OpenClaw extrae los datos y los pasa al tool `log_expense_from_receipt`.
- Persistencia en SQLite embebida.
- Resolución explícita de moneda con soporte multi-moneda y placeholder inicial `XXX`.

## Instalación rápida

La guía completa está en [docs/setup.md](docs/setup.md).

```bash
# 1. Instalar el plugin en OpenClaw
openclaw plugins install /ruta/al/financialclaw

# 2. Configurar plugins.allow y dbPath en el config de OpenClaw
#    (openclaw plugins install no hace esto automáticamente)
#    Desde path local:
financialclaw-setup
#    Desde npm (sin clonar el repo):
#    npx @riclara/financialclaw financialclaw-setup
# Con ruta personalizada para la BD:
# financialclaw-setup --db-path /tu/ruta/financialclaw.db
# Si el config de OpenClaw está en otro lado:
# financialclaw-setup --config /ruta/openclaw.json

# 3. Reiniciar el gateway
openclaw gateway stop && openclaw gateway
```

Para dejar listo el runner externo de reminders:

```bash
npx tsx src/bin/daily-reminder-runner.ts --target "<chat-o-destino>"
```

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

- [docs/setup.md](docs/setup.md): instalación y troubleshooting
- [docs/hitos.md](docs/hitos.md): estado final de implementación
- [docs/testing.md](docs/testing.md): estrategia de pruebas
