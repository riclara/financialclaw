# financialclaw — Instalación y configuración

> [English version](setup.md)

Esta guía cubre todo lo necesario para tener el plugin funcionando: prerrequisitos, instalación, configuración de OpenClaw y el runner externo de reminders.

---

## Prerrequisitos

| Requisito | Versión mínima | Cómo verificar |
|---|---|---|
| Node.js | 24+ | `node --version` |
| OpenClaw CLI | instalado y configurado | `openclaw --version` |

---

## 1. Instalar el plugin

```bash
# Desde ClawHub (recomendado)
openclaw plugins install clawhub:financialclaw

# O desde npm
openclaw plugins install financialclaw
```

---

## 2. Configurar OpenClaw

Ejecutar el comando de configuración:

```bash
npx financialclaw financialclaw-setup
```

El script mostrará un resumen de los cambios que va a hacer y pedirá confirmación antes de modificar tu config. Para saltar la confirmación (ej. en CI), usar `--yes`:

```bash
npx financialclaw financialclaw-setup --yes
```

Esto configura lo siguiente en `~/.openclaw/openclaw.json`:

**`plugins.allow`** — una vez que este campo existe, OpenClaw lo usa como allowlist explícita: todo lo que no esté listado deja de funcionar, incluyendo canales activos como Telegram. El comando descubre todos los canales y plugins activos y agrega `financialclaw` junto a ellos para que nada deje de funcionar.

**`tools.allow`** — agrega `"financialclaw"` como entrada explícita en el allowlist de tools para que el agente pueda llamar las tools del plugin.

> **Nota:** Si tu `tools.profile` está en algo distinto a `"full"` (ej. `"coding"` o `"minimal"`), los tools del plugin podrían no ser visibles para el agente. El script te avisará si es el caso. Puedes cambiarlo manualmente en tu config si lo necesitas.

**`plugins.entries.financialclaw.config.dbPath`** — sin esto, la base de datos se crea dentro del directorio del plugin y se borra al reinstalar. Por defecto: `~/.openclaw/workspace/financialclaw.db`.

### Opciones

```bash
# Ruta personalizada para la BD
npx financialclaw financialclaw-setup --db-path /tu/ruta/financialclaw.db

# Si el config de OpenClaw está en una ubicación no estándar
npx financialclaw financialclaw-setup --config /ruta/openclaw.json
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
→ Ejecutar `financialclaw-setup` y reiniciar el gateway. Verificar que `plugins.allow` incluya `financialclaw`. También verificar que `tools.profile` esté en `"full"` — profiles como `"coding"` o `"minimal"` excluyen tools de plugins por completo.

**La base de datos se borra al reinstalar**
→ Asegurarse de que `dbPath` apunte fuera del directorio del plugin. Ejecutar `financialclaw-setup` para configurarlo automáticamente.

**El canal deja de funcionar después de instalar**
→ `plugins.allow` fue creado sin incluir el canal. Ejecutar `financialclaw-setup` nuevamente — agregará las entradas faltantes.

**El plugin falla al cargar con un error de SQLite**
→ Verificar que se está usando Node.js 24+. El plugin usa `node:sqlite`, integrado en Node.js 24 y no requiere compilación nativa.
