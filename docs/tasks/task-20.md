# TASK-20: Entry point tools-only (src/index.ts)

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Ensamblar el plugin buildable de OpenClaw en un único entry point que lea configuración, prepare módulos compartidos y registre los 10 tools. Esta TASK **no** conecta automatización background: los reminders automáticos viven en el runner externo de `TASK-19`.

## Archivos a crear o tocar

- `src/index.ts`
- `tests/integration/plugin-entry.test.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-08
- TASK-09
- TASK-10
- TASK-11
- TASK-12
- TASK-13
- TASK-14
- TASK-15
- TASK-16
- TASK-17

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `docs/openclaw-sdk.md`
- `AGENTS.md` — sección "Tools de OpenClaw"
- `src/db/database.ts`
- `src/ocr/paddle-ocr-subprocess.ts`
- `openclaw.plugin.json`

## Contrato obligatorio

- Exportar `default definePluginEntry({...})`.
- El `register(api)` debe:
  - leer `api.pluginConfig`
  - llamar `configureDb()` si llega `dbPath`
  - llamar `configurePythonCmd()` si llega `pythonCmd`
  - registrar exactamente los 10 tools documentados
- Cada tool se registra con:
  - `name`
  - `description`
  - `parameters`
  - `execute`
- `execute` debe envolver funciones `executeXxx()` que retornan `string` y adaptarlas a:

```typescript
{ content: [{ type: "text", text: "..." }] }
```

- Esta TASK no debe:
  - registrar services
  - registrar el runner externo
  - fallar por ausencia de `pluginConfig.reminders.target`

## Reglas / invariantes de negocio

- `src/index.ts` no contiene lógica de negocio de tools.
- Cada tool importa:
  - `InputSchema`
  - `executeXxx`
- Las descripciones de tools deben estar en español y orientar bien al LLM.
- Los nombres registrados deben respetar exactamente el contrato definido por cada tool.
- La configuración debe aplicarse antes de cualquier uso efectivo de BD o Python OCR.
- El bloque `reminders` en `openclaw.plugin.json` queda reservado para compatibilidad futura, pero `src/index.ts` no lo consume ni lo valida en esta versión.

## No asumir

- No duplicar schemas TypeBox dentro de `index.ts`.
- No reimplementar lógica de formateo o validación de tools aquí.
- No importar objetos tool completos; el patrón del proyecto es `InputSchema + executeXxx`.
- No asumir que `api.pluginConfig` siempre trae valores.
- No registrar `api.registerService(...)`.
- No conectar `TASK-19` desde el plugin.

## Casos borde

- Si `pluginConfig` no trae `dbPath`, usar el fallback configurado en `database.ts`.
- Si `pluginConfig` no trae `pythonCmd`, usar el fallback configurado en `paddle-ocr-subprocess.ts`.
- Si `pluginConfig.reminders` existe pero está incompleto:
  - no fallar la carga del plugin
  - ignorar ese bloque en esta TASK
- Si `executeXxx()` lanza error, OpenClaw debe recibir la excepción; no ocultarla con `try/catch` silencioso.

## Lógica de implementación

1. Importar `definePluginEntry`.
2. Importar configuradores compartidos:
   - `configureDb`
   - `configurePythonCmd`
3. Importar, por cada tool:
   - `InputSchema`
   - `executeXxx`
4. Definir `wrapExecute(fn)` para adaptar `string -> ToolResult`.
5. Dentro de `register(api)`:
   - leer `api.pluginConfig`
   - aplicar configuración
   - registrar los 10 tools en orden legible
6. No registrar ningún service ni scheduler.

## Tests requeridos

- compilación completa del proyecto
- smoke check de carga del plugin
- verificación de que los 10 tools quedan registrados
- verificación de que `configureDb()` y `configurePythonCmd()` se llaman cuando llega config
- verificación de que no se llama `api.registerService(...)`
- archivo de test esperado: `tests/integration/plugin-entry.test.ts`

## Criterios de aceptación

- `npx tsc --noEmit` pasa para todo el proyecto.
- OpenClaw puede cargar el plugin sin errores.
- Los 10 tools quedan registrados.
- No se registra ningún background service desde `src/index.ts`.
- `wrapExecute()` entrega el formato de `ToolResult` esperado por OpenClaw.
