# AGENTS.md — Reglas para agentes implementadores

Este archivo define las convenciones y restricciones que todo agente de código debe seguir al trabajar en financialclaw.

## Qué es este proyecto

Plugin de OpenClaw (TypeScript/Node.js) para finanzas personales vía Telegram. Registra gastos (con OCR de recibos), ingresos, pagos recurrentes y genera resúmenes. Base de datos SQLite embebida. Multi-moneda.

## Protocolo de arranque (LEER PRIMERO)

Cada nueva conversación o agente debe seguir este protocolo para no desperdiciar contexto.

### Paso 1: SIEMPRE leer estos dos archivos
1. **Este archivo** (`AGENTS.md`) — ya lo estás leyendo, contiene todas las reglas
2. **`docs/hitos.md`** — estado de cada tarea, qué está disponible, qué está bloqueado

### Paso 2: según lo que vas a hacer, leer SOLO lo necesario

| Si vas a... | Leer además |
|---|---|
| **Implementar una TASK** | El archivo de detalle `docs/tasks/task-XX.md` de tu TASK (link desde `docs/hitos.md`). Si es un tool: leer también la sección "Tools de OpenClaw" de este archivo. Si usa moneda: leer "Multi-moneda" de este archivo. |
| **Modificar dependencias, archivos o estructura de TASKs** | `docs/tasks/tasks.yaml` + `scripts/validate_task_manifest.py` + `scripts/audit_task_template.py` |
| **Portear desde sendafinanciera** (TASK-03, 04, 05) | Los archivos fuente en `/Users/riclara/workspace/sendafinanciera` referenciados en la TASK. Leer "Referencia: proyecto sendafinanciera" en este archivo. |
| **Escribir tests** | `docs/testing.md` + la sección "Testing" de este archivo. |
| **Trabajar en index.ts** (TASK-20) | `docs/openclaw-sdk.md` (necesario para entender `definePluginEntry`, `api.registerTool`, `api.registerService`). |
| **Entender el contexto del producto** | `docs/producto.md` + `docs/plan-tecnico.md` (solo si necesitas visión general, NO para implementar una TASK individual). |

**REGLA: no leer documentos que no necesitas. El contexto es limitado — cada token cuenta.**

### Paso 3: antes de escribir código
1. Verificar en `docs/hitos.md` que las dependencias de tu TASK están en `DONE`
2. Marcar tu TASK como `IN_PROGRESS` con timestamp
3. Leer los archivos fuente que ya existen y que tu TASK va a usar (imports, tipos, etc.)
4. Si la TASK toca schema, nombres de columnas, side effects en varias tablas, defaults sensibles o contratos repartidos entre documentación y código, hacer un **preflight de contradicciones** antes de implementar:
   - comparar `docs/tasks/task-XX.md`, `docs/hitos.md` y el schema/API real que vaya a usar la tarea
   - verificar alias semánticos (`reason` vs columna real, `received_on` vs `date`, etc.)
   - verificar que índices, defaults y side effects realmente soporten lo que promete la TASK
   - si aparece una ambigüedad material, **detener la implementación** y reportarla antes de inventar comportamiento

### Paso 4: al terminar
1. Ejecutar verificación (sección "Verificación" abajo)
2. Marcar TASK como `DONE` en `docs/hitos.md`
3. Agregar entrada en `docs/bitacora.md` si hubo algo relevante (archivo local, no versionado en git)

## Catálogo de documentación

Referencia completa de todos los documentos (NO leer todos — usar la tabla del Paso 2):

| # | Documento | Contenido | Cuándo leerlo |
|---|---|---|---|
| 1 | `docs/producto.md` | Visión, funcionalidades, UX | Solo si necesitas contexto de producto |
| 2 | `docs/openclaw-sdk.md` | API de OpenClaw, registerTool, ToolResult, ciclo de vida | Solo para TASK-20 (index.ts) o si tu TASK necesita entender el SDK |
| 3 | `docs/plan-tecnico.md` | Arquitectura, modelo de datos, decisiones técnicas | Solo si necesitas visión general de arquitectura |
| 4 | `docs/tasks/tasks.yaml` | Manifiesto canónico de metadata de TASKs | IDs, dependencias, archivos y documentos de detalle |
| 4b | `docs/tasks/task-XX.md` | Detalle de cada TASK con código de referencia y criterios | **Leer SOLO el archivo de tu TASK** (link desde hitos.md) |
| 4c | `docs/tasks/TEMPLATE.md` | Plantilla canónica de TASK | Si vas a crear o reescribir una TASK y quieres mantener el detalle sin forzar supuestos |
| 4d | `docs/implementacion.md` | Índice general y mapa de navegación | Solo si necesitas ubicar documentos o contexto cruzado entre tareas |
| 5 | `scripts/validate_task_manifest.py` | Validador de consistencia entre manifest, hitos y task docs | Úsalo cuando cambies metadata de TASKs |
| 6 | `scripts/audit_task_template.py` | Auditor de deuda de plantilla para `task-XX.md` | Úsalo para priorizar migración a la plantilla canónica |
| 7 | `docs/testing.md` | Framework, patterns, helpers, fixtures | Cuando escribas tests |
| 8 | `docs/setup.md` | Instalación, verificación, troubleshooting | Solo si necesitas instalar o debuggear entorno |
| 9 | `docs/versionamiento.md` | Migraciones, changelog, compatibilidad | Solo si modificas schema o haces release |
| 10 | `docs/hitos.md` | Estado de tareas, sincronización | **SIEMPRE** (Paso 1) |
| 11 | `docs/bitacora.md` | Bitácora de desarrollo (local, no versionado) | Leer antes de escribir para no duplicar |

## Convenciones de código

- **TypeScript estricto**, ESM (`"type": "module"`)
- **Target**: ES2022, `moduleResolution: "NodeNext"`
- **Imports**: extensión `.js` obligatoria en todos los imports relativos
- **IDs**: `crypto.randomUUID()`
- **Fechas**: ISO `YYYY-MM-DD` como TEXT en SQLite, `new Date().toISOString()` para timestamps
- **Errores**: lanzar `Error` con mensaje descriptivo en español; OpenClaw lo muestra al usuario

## Multi-moneda (IMPORTANTE)

- Toda operación monetaria requiere `currency` explícito (código ISO 4217)
- Si el tool no recibe `currency`, usar la moneda con `is_default = 1` de la tabla `currencies`
- **NUNCA hardcodear `'COP'`** ni ningún código de moneda en los tools
- La BD se inicializa con `XXX` ("Sin configurar", símbolo `¤`) como moneda placeholder
- Si la moneda default sigue siendo `XXX`, los tools deben incluir en su respuesta una sugerencia para que el usuario configure su moneda real con `manage_currency`
- Usar `resolveCurrency()` de `src/tools/helpers/currency-utils.ts` para resolver la moneda
- Usar `isPlaceholderCurrency()` para detectar si el usuario aún no configuró su moneda
- Usar `formatAmount()` para formatear montos con el símbolo correcto

## Base de datos — Reglas de migración

- **NUNCA** usar `DROP TABLE`, `DROP COLUMN`, ni borrar datos del usuario
- Tablas nuevas: `CREATE TABLE IF NOT EXISTS`
- Columnas nuevas: `ALTER TABLE ADD COLUMN` con DEFAULT o nullable, envuelto en try/catch
- Índices: `CREATE INDEX IF NOT EXISTS`
- Seed data: `INSERT OR IGNORE`
- Las migraciones deben ser idempotentes (seguras de re-ejecutar)

## Referencia: proyecto sendafinanciera

El proyecto en `/Users/riclara/workspace/sendafinanciera` es la referencia para:
- `receipt-parser.ts` y `ocr-classification.ts` (port verbatim, solo ajustar imports)
- `paddle-ocr/app.py` (funciones `_create_paddle_ocr_engine`, `_extract_lines_from_paddle_result`, `_execute_paddle_ocr`)
- Modelo de datos (enums, relaciones entre entidades)

Al portear código de sendafinanciera: **no modificar la lógica**, solo ajustar imports y definir tipos localmente en vez de importarlos del dominio de sendafinanciera.

## Tools de OpenClaw

Cada tool se registra via `api.registerTool()` dentro de `definePluginEntry`. El contrato exacto:

```typescript
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "@sinclair/typebox";

// Tipo de retorno de execute
interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
}

api.registerTool({
  name: "tool_name",                          // snake_case
  description: "Descripción en español",      // para el agente LLM
  parameters: Type.Object({ ... }),           // TypeBox schema
  async execute(_id: string, params: T): Promise<ToolResult> {
    // _id = identificador de invocación (ignorar)
    // params = objeto validado contra el schema
    return { content: [{ type: "text", text: "Resultado" }] };
  },
});
```

**Patrón interno**: cada tool exporta la lógica en una función `executeXxx(params, db?)` testeable, y la registración la hace `index.ts`.

```typescript
// src/tools/log-expense-manual.ts
export function executeLogExpenseManual(params: Input, db = getDb()): string {
  // ... lógica de negocio, retorna string
}

// src/index.ts
api.registerTool({
  name: "log_expense_manual",
  description: "...",
  parameters: InputSchema,
  async execute(_id, params) {
    const text = executeLogExpenseManual(params);
    return { content: [{ type: "text", text }] };
  },
});
```

Reglas:
- Nombres de tools en `snake_case`
- Descripción en español, clara para que el LLM sepa cuándo usarlo
- Parámetros nuevos siempre `Type.Optional` con default sensato
- No renombrar ni eliminar tools existentes sin bump de versión MAJOR
- No cambiar el tipo de parámetros existentes
- `openclaw` es **peerDependency** — el gateway lo provee en runtime
- Usar `@sinclair/typebox` `^0.34.0` (alineado con OpenClaw)
- Ver `docs/openclaw-sdk.md` para detalles completos del SDK

## Bitácora de desarrollo (OBLIGATORIO)

El archivo `docs/bitacora.md` es un registro vivo del proceso de construcción. **Todo agente debe actualizarlo al completar una tarea o al tomar una decisión significativa.** El archivo es local y no está versionado en git — si no existe, crearlo.

### Cuándo escribir una entrada

- Al completar una TASK: qué fue fácil, qué fue difícil, qué se descubrió
- Al encontrar un bug o problema no anticipado por la documentación
- Al tomar una decisión de diseño que no estaba prevista en los docs
- Al descubrir que una suposición era incorrecta
- Al recibir feedback del humano que cambia el enfoque
- Al detectar en preflight una contradicción material que obligue a frenar una implementación

### Qué escribir

- **Proceso (Parte 1)**: lecciones sobre desarrollo con agentes IA — qué funcionó, qué no, qué preguntas clave surgieron
- **Producto (Parte 2)**: evolución funcional de financialclaw — nuevas capacidades, cambios de enfoque, decisiones de UX

### Qué NO escribir

- Detalles que ya están en el commit o en la documentación técnica
- Descripciones de código (el código se describe solo)
- Entradas genéricas sin insight ("implementé TASK-08, todo salió bien")

### Formato

Usar la plantilla al final de `docs/bitacora.md`. Incluir siempre: fecha, autor, contexto, qué pasó, por qué importa.

## Changelog

Todo cambio visible va en `CHANGELOG.md` (raíz del proyecto). Formato: Keep a Changelog.

## Estructura de TASKs (IMPORTANTE)

Cuando se cree o reescriba un archivo `docs/tasks/task-XX.md`, usar `docs/tasks/TEMPLATE.md`.

Reglas:

- La TASK debe contener suficiente detalle para que el agente no invente comportamiento.
- Lo crítico no va en prosa difusa: debe ir en secciones explícitas como `Contrato obligatorio`, `Reglas / invariantes de negocio`, `No asumir` y `Casos borde`.
- No pegar código completo por defecto. Solo hacerlo si la exactitud del código es parte del requisito o si se está portando lógica casi verbatim.
- Si una decisión cambia comportamiento visible, schema, defaults, side effects o compatibilidad, no puede quedar implícita.
- Comprimir boilerplate está bien. Comprimir invariantes no.

## Manifiesto de TASKs (IMPORTANTE)

`docs/tasks/tasks.yaml` es el manifiesto canónico para metadata estructurada de las TASKs:

- `id`
- `title`
- `hito`
- `deps`
- `detail_doc`
- `files`

`docs/hitos.md` sigue siendo la vista operativa para estados y notas.

Si cambias dependencias, archivos, títulos o el documento de detalle de una TASK:

1. Actualiza `docs/tasks/tasks.yaml`
2. Ejecuta `python3 scripts/validate_task_manifest.py`
3. Sincroniza `docs/hitos.md`
4. Ajusta `docs/tasks/task-XX.md` si corresponde

Si además estás migrando TASKs a la nueva plantilla:

1. Ejecuta `python3 scripts/audit_task_template.py`
2. Empieza por la "primera ola" recomendada por score
3. Repite el auditor después de cada ola para ver la deuda restante

## Testing

- **Framework**: Node.js built-in test runner (`node --test`) con `tsx` para ejecutar TypeScript
- **Ejecución**: `npm test` (todos), `npm run test:unit`, `npm run test:integration`
- **BD de test**: SQLite `:memory:` via `tests/helpers/test-db.ts` — cada test crea su propia BD
- **Inyección de dependencia**: cada tool exporta `executeXxx(input, db?)` donde `db` es opcional (default: singleton de producción). Los tests pasan `createTestDb()`
- **Mock**: solo mockear el subprocess de PaddleOCR. SQLite en memoria se usa directamente, no se mockea
- **Nombres de tests**: en español, descriptivos. Un archivo de test por módulo
- **Cobertura mínima**: caso feliz + caso de error + caso borde por función exportada
- **Los tests se escriben junto con el módulo**, no después. Ver `docs/testing.md` para el mapeo completo

## Verificación

Antes de considerar una tarea completa:
1. `npx tsc --noEmit` debe pasar sin errores
2. `npm run test:unit` y `npm run test:integration` deben pasar
3. Los criterios de aceptación de la tarea (en `docs/tasks/task-XX.md`) deben cumplirse
4. No introducir dependencias nuevas sin justificación
