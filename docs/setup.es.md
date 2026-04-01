# financialclaw — Instalación y configuración

> [English version](setup.md)

Esta guía cubre todo lo necesario para tener el plugin funcionando: prerrequisitos, instalación, configuración de OpenClaw y el runner externo de reminders.

---

## Prerrequisitos

| Requisito | Versión mínima | Cómo verificar |
|---|---|---|
| Node.js | 22.14+ (recomendado: 24) | `node --version` |
| OpenClaw CLI | instalado y configurado | `openclaw --version` |

---

## 1. Instalar el plugin

```bash
openclaw plugins install @riclara/financialclaw
```

---

## 2. Configurar OpenClaw

Después de instalar, reiniciar el gateway para cargar el plugin (ver paso 3).

Para usar una ruta personalizada para la BD (por defecto: `~/.openclaw/workspace/financialclaw.db`), agregarla en `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "financialclaw": {
        "config": {
          "dbPath": "/tu/ruta/financialclaw.db"
        }
      }
    }
  }
}
```

---

## 3. Reiniciar el gateway

```bash
openclaw gateway restart
```

---

## 4. Verificar la instalación

Enviar un mensaje al bot de OpenClaw a través del canal configurado. Por ejemplo:

> "Registrá un gasto de $50 en el supermercado"

Debería responder con una confirmación. También podés verificar la base de datos directamente:

```bash
sqlite3 ~/.openclaw/workspace/financialclaw.db \
  "SELECT amount, description, category, date FROM expenses ORDER BY created_at DESC LIMIT 5;"
```

### OCR de recibos

Si tu canal soporta envío de imágenes, podés enviar una foto de un recibo. El agente de OpenClaw extrae los datos automáticamente y llama al tool `log_expense_from_receipt` — no se requiere configuración local de OCR.

---

## 5. Configurar el sync diario (opcional)

El plugin incluye el tool `run_daily_sync` que genera gastos recurrentes, marca vencidos y entrega reminders. Para ejecutarlo automáticamente cada día, usar el sistema de cron integrado de OpenClaw:

Pedirle al agente de OpenClaw que cree el schedule:

> "Creá un cron job diario a las 8am que ejecute el sync diario de financialclaw"

El agente llamará a `cron.add` con un payload `agentTurn` apuntando a `run_daily_sync`. Para verificar que está activo, pedirle al agente que liste las tareas programadas.

---

## 6. Actualizar el plugin

```bash
openclaw plugins update financialclaw
openclaw gateway restart
```

La base de datos y todos los datos se preservan entre actualizaciones. Las migraciones de schema se ejecutan automáticamente al arrancar.

Para previsualizar qué cambiaría antes de actualizar:

```bash
openclaw plugins update financialclaw --dry-run
```

El sync diario también te notificará automáticamente cuando haya una nueva versión disponible.

---

## Solución de problemas

**Los tools del plugin no están disponibles para el agente**
→ Reiniciar el gateway con `openclaw gateway restart`. Si el problema persiste, verificar que el plugin esté habilitado en `~/.openclaw/openclaw.json`.

**La base de datos se borra al reinstalar**
→ Configurar un `dbPath` persistente fuera del directorio del plugin en `~/.openclaw/openclaw.json` (ver paso 2).

**`better-sqlite3` falla con `NODE_MODULE_VERSION` o `ERR_DLOPEN_FAILED`**
→ El binario nativo fue compilado para otra versión de Node. Ejecutar:
```bash
npm install
```

**`better-sqlite3` falla al compilar desde fuente**
→ Instalar herramientas de build:
```bash
# macOS
xcode-select --install

# Ubuntu / Debian
sudo apt install build-essential
```
