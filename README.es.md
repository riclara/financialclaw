# financialclaw — Documentación en español

[![CI](https://github.com/riclara/financialclaw/actions/workflows/ci.yml/badge.svg)](https://github.com/riclara/financialclaw/actions/workflows/ci.yml)

Plugin de OpenClaw para finanzas personales. Registra gastos, ingresos, pagos recurrentes y genera resúmenes. Compatible con cualquier canal soportado por OpenClaw (Telegram, WhatsApp, etc.). El OCR de recibos es agéntico: si tu canal permite enviar imágenes, podés fotografiar un recibo y el agente extrae los datos automáticamente. Base de datos SQLite embebida. Soporte multi-moneda.

## Estado del proyecto

El plugin quedó cerrado como plugin **tools-only**: registra 10 tools en OpenClaw y no corre automatizaciones dentro del runtime del plugin.

Los reminders viven en un runner externo one-shot (`src/bin/daily-reminder-runner.ts`) que ejecuta `dailySync()` y entrega mensajes mediante `openclaw message send`. La programación periódica queda fuera del repositorio (`cron`, `systemd`, `launchd`, etc.).

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

`openclaw plugins install` registra el plugin pero no lo activa completamente. Hay dos cosas que deben configurarse manualmente en `~/openclaw.json` (o `~/.openclaw/openclaw.json`):

1. **`plugins.allow`** — sin esto, OpenClaw no carga el plugin aunque esté instalado. El script preserva los canales y plugins que ya estén en el allowlist para no romper nada.
2. **`plugins.entries.financialclaw.config.dbPath`** — sin esto, la base de datos se crea en una ruta temporal que se borra al reinstalar el plugin.

`financialclaw-setup` resuelve ambos automáticamente.

### Verificación manual

Para confirmar que la configuración quedó correcta:

```bash
# Verificar que plugins.allow incluye financialclaw
node -e "const c=require(require('os').homedir()+'/.openclaw/openclaw.json'); console.log(c.plugins.allow)"

# Verificar que dbPath está configurado
node -e "const c=require(require('os').homedir()+'/.openclaw/openclaw.json'); console.log(c.plugins.entries.financialclaw.config)"
```

O abrir `~/.openclaw/openclaw.json` directamente y buscar:

```json
"plugins": {
  "allow": ["financialclaw", "...otros canales activos..."],
  "entries": {
    "financialclaw": {
      "enabled": true,
      "config": {
        "dbPath": "/home/tuusuario/.openclaw/workspace/financialclaw.db"
      }
    }
  }
}
```

### Opciones

```bash
# Ruta personalizada para la BD (por defecto: ~/.openclaw/workspace/financialclaw.db)
npx @riclara/financialclaw financialclaw-setup --db-path /tu/ruta/financialclaw.db

# Si el config de OpenClaw está en una ubicación no estándar
npx @riclara/financialclaw financialclaw-setup --config /ruta/openclaw.json
```

La guía completa está en [docs/setup.md](docs/setup.md).

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
