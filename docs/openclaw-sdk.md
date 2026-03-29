# financialclaw — OpenClaw SDK y sistema de plugins

Este documento explica cómo funciona el sistema de plugins de OpenClaw, cómo se integra financialclaw, y las decisiones de diseño derivadas de la API real.

---

## Qué es OpenClaw

OpenClaw es un framework para construir agentes LLM conectados a canales de mensajería (Telegram, WhatsApp, etc.). Expone una arquitectura de plugins donde cada plugin puede registrar:

- **Tools** (herramientas para el agente LLM)
- Providers (modelos LLM, TTS/STT, vision)
- Channels (canales de mensajería)
- HTTP routes, CLI commands, hooks, services

financialclaw es un **plugin de tools**: registra herramientas que el agente LLM puede invocar cuando el usuario le habla por Telegram.

---

## SDK: imports y paquete

No existe un paquete npm separado para el SDK. El SDK viene incluido en el paquete principal `openclaw`, expuesto via subpath imports:

```typescript
// Entry point para plugins de tools
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

// Otros entry points (no usamos en financialclaw)
import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";
import { defineSetupPluginEntry } from "openclaw/plugin-sdk/core";
import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";
```

**Regla**: siempre importar desde subpaths (`openclaw/plugin-sdk/<subpath>`). Los imports monoliticos desde la raiz estan deprecados.

`openclaw` se agrega como **peerDependency** en `package.json` del plugin (el gateway lo provee en runtime).

---

## Estructura de un plugin

### Archivos requeridos

```
financialclaw/
├── package.json              # Con campo "openclaw.extensions"
├── openclaw.plugin.json      # Manifiesto del plugin (REQUERIDO)
└── src/
    └── index.ts              # Entry point exporta definePluginEntry
```

### `package.json` — campo openclaw

```json
{
  "name": "financialclaw",
  "type": "module",
  "openclaw": {
    "extensions": ["./src/index.ts"]
  },
  "peerDependencies": {
    "openclaw": ">=2026.3.0"
  }
}
```

El campo `openclaw.extensions` es un array de rutas a los entry points del plugin. OpenClaw los importa al arrancar.

### `openclaw.plugin.json` — manifiesto

Archivo JSON en la raiz del plugin. OpenClaw lo lee **antes** de ejecutar codigo para validar configuracion.

```json
{
  "id": "financialclaw",
  "name": "FinancialClaw",
  "description": "Plugin de finanzas personales: gastos, ingresos, recurrentes y OCR de recibos",
  "version": "0.1.0",
  "enabledByDefault": true,
  "configSchema": {
    "type": "object",
    "properties": {
      "dbPath": {
        "type": "string",
        "description": "Ruta al archivo SQLite"
      },
      "pythonCmd": {
        "type": "string",
        "description": "Ruta al interprete Python con PaddleOCR instalado"
      },
      "reminders": {
        "type": "object",
        "properties": {
          "enabled": {
            "type": "boolean",
            "description": "Activa o desactiva los reminders automáticos"
          },
          "channel": {
            "type": "string",
            "enum": ["telegram"],
            "description": "Canal para reminders automáticos"
          },
          "accountId": {
            "type": "string",
            "description": "Cuenta de Telegram a usar si OpenClaw tiene varias"
          },
          "target": {
            "type": "string",
            "description": "Chat, peer o destino explícito donde enviar reminders"
          }
        },
        "additionalProperties": false
      }
    },
    "additionalProperties": false
  },
  "contracts": {
    "tools": [
      "manage_currency",
      "log_expense_from_image",
      "log_expense_manual",
      "log_income",
      "log_income_receipt",
      "add_recurring_expense",
      "mark_expense_paid",
      "get_financial_summary",
      "list_expenses",
      "list_incomes"
    ]
  }
}
```

**Campos clave**:

| Campo | Tipo | Descripcion |
|---|---|---|
| `id` | string | Identificador canonico del plugin. Debe coincidir con `plugins.entries.<id>` en la config de OpenClaw |
| `name` | string | Nombre visible |
| `description` | string | Descripcion corta |
| `version` | string | Semver |
| `enabledByDefault` | boolean | Si `true`, se habilita automaticamente al instalar |
| `configSchema` | JSON Schema | Schema de la configuracion que acepta el plugin |
| `contracts` | object | Snapshot estatico de capacidades: `tools`, `speechProviders`, etc. |
| `uiHints` | object | Metadata de UI para campos de config (labels, placeholders, sensitive) |

---

## Entry point: `definePluginEntry`

```typescript
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "financialclaw",
  name: "FinancialClaw",
  description: "Plugin de finanzas personales",

  register(api) {
    // api.registrationMode: "full" | "setup-only" | "setup-runtime"

    api.registerTool({
      name: "log_expense_manual",
      description: "Registra un gasto manualmente",
      parameters: schema,
      async execute(_id, params) {
        // ...
        return { content: [{ type: "text", text: "Gasto registrado" }] };
      },
    });
  },
});
```

### Propiedades y metodos disponibles en `api`

**Propiedades**:

| Propiedad | Tipo | Descripcion |
|---|---|---|
| `api.pluginConfig` | `Record<string, unknown>` | Config del plugin desde `plugins.entries.<id>.config` en la config de OpenClaw |
| `api.config` | `OpenClawConfig` | Snapshot completo de la config global de OpenClaw (no del plugin) |
| `api.registrationMode` | `"full" \| "setup-only" \| "setup-runtime"` | Contexto de registro |
| `api.logger` | `PluginLogger` | Logger con scope del plugin |
| `api.resolvePath(input)` | method | Resuelve paths relativos al root del plugin |

**Metodos de registro**:

| Metodo | Uso |
|---|---|
| `api.registerTool(toolDef, options?)` | Registrar una herramienta para el agente |
| `api.registerProvider()` | Registrar un proveedor LLM |
| `api.registerChannel()` | Registrar un canal de mensajeria |
| `api.registerSpeechProvider()` | TTS/STT |
| `api.registerMediaUnderstandingProvider()` | Analisis de imagenes/audio |
| `api.registerImageGenerationProvider()` | Generacion de imagenes |
| `api.registerWebSearchProvider()` | Busqueda web |
| `api.registerHttpRoute()` | Endpoint HTTP |
| `api.registerCommand()` / `api.registerCli()` | Comandos CLI |
| `api.registerHook()` / `api.on()` | Hooks del ciclo de vida |
| `api.registerService()` | Servicio en background |

Para financialclaw usamos `api.registerTool()` y `api.pluginConfig` dentro del plugin. `api.registerService()` sigue documentado como superficie pública del SDK, pero no forma parte del build actual porque la automatización de reminders quedó rediseñada como runner externo.

Para el runner externo de reminders, la superficie pública outbound confirmada no sale de la SDK del plugin sino de la CLI `openclaw message send`. En esa CLI, la cuenta se selecciona con el flag público `--account`; si el código de financialclaw mantiene un campo interno `accountId`, debe mapearlo explícitamente a `--account` al construir el comando.

### Services background: contrato confirmado

La superficie pública verificada para services de plugin es:

```typescript
api.registerService({
  id: "my-service",
  start: async () => {
    // inicialización
  },
  stop: async () => {
    // cleanup
  },
});
```

Esto coincide con la guía oficial de plugins y con el plugin oficial `@openclaw/voice-call`.

Implicaciones prácticas para financialclaw:

- `start()` no recibe `ctx`
- `stop()` debe encargarse del cleanup (`clearInterval`, sockets, handles, etc.)
- patrones tipo `start(ctx)`, `ctx.onStop(...)`, `ctx.sendMessage(...)` o `ctx.notify(...)` **no** están confirmados por la SDK pública

### Acceso a la configuracion del plugin

El usuario configura el plugin en el archivo de configuracion de OpenClaw:

```json5
{
  plugins: {
    entries: {
      "financialclaw": {
        enabled: true,
        config: {
          dbPath: "/data/financialclaw.db",
          pythonCmd: "./.venv/bin/python3",
          reminders: {
            enabled: true,
            channel: "telegram",
            target: "@mi_chat_finanzas"
          }
        }
      }
    }
  }
}
```

OpenClaw valida estos valores contra el `configSchema` de `openclaw.plugin.json` y los inyecta en `api.pluginConfig`:

```typescript
register(api) {
  const config = api.pluginConfig as {
    dbPath?: string;
    pythonCmd?: string;
    reminders?: {
      enabled?: boolean;
      channel?: "telegram";
      accountId?: string;
      target?: string;
    };
  };

  // Prioridad: pluginConfig → env var → default
  const dbPath = config.dbPath ?? process.env.FINANCIALCLAW_DB_PATH ?? "./financialclaw.db";
  const pythonCmd = config.pythonCmd ?? process.env.FINANCIALCLAW_PYTHON_CMD ?? "python3";
}
```

**Importante**: `api.pluginConfig` es una **propiedad**, no un metodo. `api.getConfig()` no existe y lanza `TypeError`.

Para financialclaw, el entry point actual consume directamente:

- `dbPath`
- `pythonCmd`

El bloque `reminders` sigue reservado en `openclaw.plugin.json` por compatibilidad futura, pero **no** se consume dentro de `src/index.ts` mientras la automatización viva fuera del plugin.

### Runtime helpers y límite actual para reminders

La SDK pública documenta `api.runtime.agent`, `api.runtime.tts`, `api.runtime.mediaUnderstanding`, `api.runtime.system`, `api.runtime.channel`, entre otros helpers.

Lo relevante para financialclaw es que la referencia pública **no** documenta hoy una capacidad de mensajería proactiva para plugins de tools/feature, por ejemplo:

```typescript
api.runtime.messaging.sendText(...)
```

Por tanto, dentro del plugin:

- no se debe asumir que `api.runtime.channel` sirve para enviar mensajes outbound arbitrarios
- no se debe hacer reach-in a internals privados del gateway
- no se debe modelar una automatización de reminders como `registerService(...)` si depende de mensajería proactiva inexistente

Sin embargo, OpenClaw sí expone una interfaz pública distinta para entrega outbound fuera del plugin:

- CLI: `openclaw message send ...`

La conclusión operativa para financialclaw es:

- el plugin (`src/index.ts`) queda tools-only
- la automatización de reminders se rediseña como runner externo que invoca `dailySync()` y luego usa `openclaw message send`
- el scheduler periódico queda fuera del plugin (`cron`, `launchd`, `systemd` o equivalente)

---

## API de Tools (detalle completo)

### Firma de `registerTool`

```typescript
api.registerTool({
  name: string,
  description: string,
  parameters: TypeBoxSchema,
  execute: (id: string, params: T) => Promise<ToolResult>,
}, options?: { optional: boolean });
```

### Parametros del tool definition

| Campo | Tipo | Descripcion |
|---|---|---|
| `name` | `string` | Nombre en `snake_case`. No debe colisionar con tools del core |
| `description` | `string` | Descripcion para el LLM. Es lo que el agente lee para decidir cuando invocar el tool |
| `parameters` | `Type.Object(...)` | Schema TypeBox que define los parametros de entrada |
| `execute` | `(id, params) => Promise<ToolResult>` | Funcion que ejecuta el tool |

### `execute(id, params)`

- **`id`** (`string`): Identificador unico de la invocacion. Generado por OpenClaw para tracking. Tipicamente se ignora (`_id`).
- **`params`** (`T`): Objeto validado contra el schema TypeBox. OpenClaw valida los tipos antes de llamar a `execute`.
- **Retorno**: `Promise<ToolResult>`

### `ToolResult` — formato de retorno

```typescript
interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
}
```

Ejemplo:
```typescript
return {
  content: [
    { type: "text", text: "Gasto registrado: $54.900 en Exito (SUPERMERCADO) — 2026-03-16" }
  ]
};
```

**Para retornar archivos** (imagenes, PDFs), usar el prefijo `MEDIA:` en el texto:
```typescript
return {
  content: [
    { type: "text", text: "MEDIA:/absolute/path/to/chart.png" }
  ]
};
```
OpenClaw adjunta automaticamente el archivo en la respuesta de Telegram.

### `options`

| Campo | Default | Descripcion |
|---|---|---|
| `optional` | `false` | Si `true`, el tool no esta disponible por defecto; el usuario debe habilitarlo en `tools.allow` |

---

## Como llegan las imagenes desde Telegram

Hay dos capas que procesan las imagenes **antes** de que un tool las reciba:

### Capa 1: Media Understanding (automatica)

Cuando el usuario envia una foto por Telegram:

1. OpenClaw descarga la imagen del servidor de Telegram
2. La envia a un modelo con vision (Claude, GPT-4o, Gemini) para generar una descripcion textual
3. Inyecta la descripcion en el mensaje que ve el agente LLM:
   > `[Image] Un recibo de Supermercado Exito mostrando total $54.900, fecha 16/03/2026`
4. La imagen se guarda en `media/inbound/<filename>` dentro del workspace

Configurable via `tools.media.image.maxBytes` (default 10 MB).

### Capa 2: Ruta local del archivo

- La imagen queda disponible como archivo local en el workspace de OpenClaw
- Las template variables `{{MediaUrl}}` y `{{MediaPath}}` proveen la ruta
- El agente LLM, al ver la descripcion de la imagen y conocer la ruta, decide invocar el tool pasando la ruta como parametro

### Flujo completo para `log_expense_from_image`

```
Usuario envia foto por Telegram
  → OpenClaw descarga imagen a media/inbound/recibo_123.jpg
  → Media Understanding genera descripcion textual
  → Agente LLM ve: "[Image] recibo de supermercado..." + ruta del archivo
  → Agente decide invocar log_expense_from_image({ image_path: "media/inbound/recibo_123.jpg" })
  → Nuestro tool recibe la ruta, ejecuta PaddleOCR, parsea, persiste en SQLite
  → Retorna { content: [{ type: "text", text: "Gasto registrado: ..." }] }
  → OpenClaw envia la respuesta al usuario por Telegram
```

**Implicacion para financialclaw**: el parametro `image_path` del tool recibe una ruta local valida. No necesitamos descargar nada — OpenClaw ya lo hizo.

---

## Instalacion de plugins

```bash
# Desde npm / ClawHub
openclaw plugins install @myorg/openclaw-my-plugin

# Desde path local
openclaw plugins install ./my-plugin

# Link para desarrollo (no copia, referencia directa)
openclaw plugins install -l ./my-plugin

# Reiniciar gateway despues de instalar (requerido)
openclaw gateway restart
```

### Reglas de habilitacion

- `plugins.enabled: false` desactiva TODOS los plugins
- `deny` siempre tiene prioridad sobre `allow`
- `plugins.entries.<id>.enabled: false` desactiva un plugin especifico
- Plugins de workspace (`.openclaw/extensions/`) estan deshabilitados por defecto
- Cambios de config requieren reiniciar el gateway

---

## Descubrimiento de plugins (orden de prioridad)

1. `plugins.load.paths` — rutas explicitas en la configuracion de OpenClaw
2. `<workspace>/.openclaw/extensions/*.ts` y `*/index.ts`
3. `~/.openclaw/extensions/*.ts` y `*/index.ts`
4. Plugins bundled (incluidos con OpenClaw)

El primer match gana. Si dos plugins registran el mismo tool name, el primero en cargarse prevalece.

---

## Ciclo de vida del plugin

```
1. OpenClaw escanea openclaw.plugin.json (sin ejecutar codigo)
2. Valida configSchema contra la config del usuario
3. Importa el entry point (src/index.ts)
4. Llama register(api) con api.registrationMode:
   - "full"          → operacion normal
   - "setup-only"    → canal deshabilitado
   - "setup-runtime" → flujo de setup
5. El plugin registra sus tools/providers/hooks
6. OpenClaw incluye los tools en el contexto del agente LLM
7. El agente decide cuando invocar cada tool segun su description
```

Los background services se registran durante `register(api)`, pero su contrato observado públicamente sigue siendo `start/stop`; la documentación pública no muestra un contexto de entrega de mensajes asociado al lifecycle del service.

### Seguridad

Los plugins corren **in-process** con el Gateway de OpenClaw. Son codigo de confianza. No hay sandbox entre el plugin y el proceso del gateway.

### Hooks disponibles

| Hook | Uso |
|---|---|
| `before_tool_call` | Interceptar llamadas a tools. `{ block: true }` cancela la ejecucion |
| `message_sending` | Interceptar mensajes salientes. `{ cancel: true }` los cancela |

---

## TypeBox: schemas para tools

OpenClaw usa `@sinclair/typebox` para definir los schemas de parametros de los tools. Version actual en OpenClaw: `0.34.x`.

```typescript
import { Type } from "@sinclair/typebox";

const InputSchema = Type.Object({
  amount: Type.Number({ description: "Monto del gasto" }),
  description: Type.String({ description: "Descripcion del gasto" }),
  category: Type.Optional(
    Type.String({ description: "Categoria. Si no se indica, se infiere como OTHER" })
  ),
  currency: Type.Optional(
    Type.String({ description: "Codigo ISO 4217 de la moneda (ej: COP, USD)" })
  ),
  date: Type.String({ description: "Fecha en formato YYYY-MM-DD" }),
});
```

Las `description` de cada campo son visibles para el agente LLM y lo ayudan a decidir que valores pasar.

---

## Impacto en financialclaw

### Cambios respecto a lo que teniamos asumido

| Aspecto | Lo que asumimos | Lo que es realmente |
|---|---|---|
| Retorno de `execute` | `string` | `Promise<{ content: [{ type: "text", text: string }] }>` |
| Firma de `execute` | `(input) => string` | `async (id: string, params: T) => Promise<ToolResult>` |
| Manifest | Solo `package.json` | `package.json` + `openclaw.plugin.json` (ambos requeridos) |
| SDK import | Asumido generico | `openclaw/plugin-sdk/plugin-entry` (subpath import) |
| `openclaw` como dep | No listado | Debe ser `peerDependency` |
| TypeBox version | `^0.33.0` | `^0.34.0` (para alinear con OpenClaw `0.34.48`) |
| Imagenes | Asumido como path directo | OpenClaw descarga y guarda en `media/inbound/`, el agente pasa la ruta |
| Config del plugin | No definido | `api.pluginConfig` (propiedad, no metodo) con fallback a env vars |
| Services background | Asumido `start(ctx)` con helpers de canal | Contrato público verificado: `registerService({ id, start, stop })` |
| Mensajería proactiva | Asumida disponible desde service | No documentada en la SDK pública actual para plugins de tools |

### Archivos nuevos o modificados necesarios

1. **Crear** `openclaw.plugin.json` (nuevo, no existia en el plan)
2. **Modificar** `package.json` — agregar `peerDependencies`, actualizar TypeBox a `^0.34.0`
3. **Modificar** `src/index.ts` — usar `definePluginEntry`, leer `api.pluginConfig`, configurar modulos
4. **Modificar** todos los tools — cambiar firma de `execute` y formato de retorno
5. **Modificar** `src/db/database.ts` — agregar `configureDb()` para recibir ruta desde config
6. **Modificar** `src/ocr/paddle-ocr-subprocess.ts` — agregar `configurePythonCmd()` para recibir comando desde config
7. **Modificar** `CLAUDE.md` — actualizar contrato de tools
