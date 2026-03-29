# financialclaw

[![CI](https://github.com/riclara/financialclaw/actions/workflows/ci.yml/badge.svg)](https://github.com/riclara/financialclaw/actions/workflows/ci.yml)

Plugin de OpenClaw para finanzas personales vía Telegram. Expone un set de tools para registrar gastos, ingresos, pagos recurrentes y generar resúmenes sobre una base SQLite embebida, con OCR local de recibos vía PaddleOCR y soporte multi-moneda.

## Estado del proyecto

El plugin quedó cerrado como plugin **tools-only**: registra 10 tools en OpenClaw y no corre automatizaciones dentro del runtime del plugin.

Los reminders viven en un runner externo one-shot (`src/bin/daily-reminder-runner.ts`) que ejecuta `dailySync()` y entrega mensajes mediante `openclaw message send`. La programación periódica queda fuera del repositorio (`cron`, `systemd`, `launchd`, etc.).

Si necesitas el detalle de avance por tarea, revisa [docs/hitos.md](docs/hitos.md).

## Capacidades principales

- Tools de OpenClaw para gastos, ingresos, reglas recurrentes y consultas.
- OCR local con PaddleOCR ejecutado en un virtualenv Python.
- Persistencia en SQLite embebida.
- Resolución explícita de moneda con soporte multi-moneda y placeholder inicial `XXX`.

## Instalación rápida

La guía completa está en [docs/setup.md](docs/setup.md).

Pasos mínimos:

```bash
npm install
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Para precalentar OCR y dejar listo el runner externo:

```bash
./.venv/bin/python3 paddle_ocr_cli.py --warmup
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
