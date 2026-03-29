# TASK-19: Runner externo de reminders

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Implementar un runner Node.js **externo al plugin** que ejecute `dailySync()` bajo demanda y entregue reminders pendientes usando únicamente la interfaz pública `openclaw message send`. Esta TASK reemplaza el service bloqueado dentro del runtime de OpenClaw y deja la automatización lista para programarse vía `cron`, `launchd` o `systemd` fuera del plugin.

## Archivos a crear o tocar

- `src/services/daily-reminder-runner.ts`
- `src/bin/daily-reminder-runner.ts`
- `tests/integration/daily-reminder-runner.test.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-18

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `docs/openclaw-sdk.md`
- `src/services/daily-sync.ts`
- `src/tools/helpers/currency-utils.ts`
- `src/db/database.ts`
- `AGENTS.md`
- Documentación oficial verificada:
  - `https://docs.openclaw.ai/cli/message`
  - `https://docs.openclaw.ai/automation/cron-jobs`

## Contrato obligatorio

- Exportar:
  - `configureOpenClawCmd(cmd: string): void`
  - `runDailyReminderRunner(input: ReminderRunnerInput, deps?: ReminderRunnerDeps): Promise<ReminderRunnerResult>`
- Shape mínimo esperado:
  - `ReminderRunnerInput`
    - `target`: requerido
    - `channel?`: literal `"telegram"`, default `"telegram"`
    - `accountId?`: string
    - `today?`: ISO `YYYY-MM-DD` solo para tests/debug
  - `ReminderRunnerDeps`
    - `db?`
    - `sync?`
    - `sendMessage?`
    - `now?`
  - `ReminderRunnerResult`
    - `expensesGenerated`
    - `expensesMarkedOverdue`
    - `remindersDue`
    - `remindersSent`
    - `remindersFailed`
- `src/bin/daily-reminder-runner.ts` debe:
  - parsear argumentos/env
  - llamar `configureDb()` si llega `dbPath`
  - llamar `configureOpenClawCmd()` si llega `openclawCmd`
  - invocar `runDailyReminderRunner(...)`
  - terminar con exit code `0` si todos los envíos exitosos/no hay reminders
  - terminar con exit code `1` si falta config obligatoria o si hubo al menos un envío fallido
- Config operativa del runner:
  - `target`: `--target` o `FINANCIALCLAW_REMINDER_TARGET`
  - `channel`: `--channel` o `FINANCIALCLAW_REMINDER_CHANNEL`, default `"telegram"`
  - `accountId`: `--account` o `FINANCIALCLAW_REMINDER_ACCOUNT_ID`
  - `dbPath`: `--db-path` o `FINANCIALCLAW_DB_PATH`
  - `openclawCmd`: `--openclaw-cmd` o `FINANCIALCLAW_OPENCLAW_CMD`, default `"openclaw"`

## Reglas / invariantes de negocio

- El runner ejecuta un solo ciclo por invocación:
  - obtiene `db`
  - llama `dailySync(db, today?)`
  - recorre `remindersDue`
  - entrega cada reminder con `openclaw message send`
- La entrega usa solo la superficie pública CLI:
  - `openclaw message send --channel telegram --target ... --message ...`
  - si existe `accountId` en el input TypeScript, se mapea al flag público `--account`
- El texto del reminder debe incluir:
  - descripción
  - monto formateado con `formatAmount()`
  - fecha de vencimiento
  - contexto de anticipación (`days_before`) si aplica
- El reminder se marca con:
  - `sent = 1`
  - `sent_at = new Date().toISOString()`
  solo después de un envío exitoso.
- Si un envío falla:
  - el runner continúa con los demás reminders
  - el reminder fallido queda pendiente (`sent = 0`)
  - el resultado final incrementa `remindersFailed`
- El procesamiento debe ser determinista:
  - ordenar `remindersDue` por `due_date ASC`, luego `reminder_id ASC`
- El scheduler externo queda fuera del repo:
  - esta TASK implementa el runner invocable
  - no implementa cron/systemd/launchd dentro del código

## No asumir

- No usar `api.registerService(...)`.
- No usar `api.runtime.messaging.sendText(...)`.
- No leer `api.pluginConfig`.
- No inferir el destino desde “último chat activo”.
- No usar `shell: true`, pipes ni comandos compuestos para el envío.
- No marcar reminders como enviados antes de confirmar éxito.
- No resolver la programación periódica dentro de `src/index.ts`.

## Casos borde

- Sin reminders pendientes:
  - el runner debe retornar resumen legible y exit code `0`
- `target` ausente:
  - error descriptivo en español
  - exit code `1`
- `openclaw message send` devuelve exit code no cero:
  - no marcar el reminder
  - continuar con los demás
  - exit code final `1`
- El binario `openclaw` no existe:
  - error descriptivo en español
  - exit code final `1`
- Re-ejecución el mismo día:
  - no reenvía reminders ya marcados `sent = 1`
- Si `dailySync()` genera reminders nuevos listos para hoy:
  - el mismo run debe intentar entregarlos

## Lógica de implementación

1. Implementar el sender por defecto con `spawnSync(openclawCmd, [...])`.
2. Implementar `runDailyReminderRunner(...)` con DI de `db`, `sync`, `sendMessage` y `now`.
3. Ejecutar `dailySync()` y ordenar `remindersDue` antes de iterar.
4. Para cada reminder:
   - construir mensaje
   - enviar vía sender
   - marcar `sent/sent_at` solo si no hubo error
5. Retornar conteos agregados.
6. En `src/bin/daily-reminder-runner.ts`:
   - parsear argumentos/env
   - aplicar configuración compartida
   - imprimir resumen final
   - definir el exit code según `remindersFailed`

## Tests requeridos

- caso feliz: envía reminders y marca `sent = 1` + `sent_at`
- fallo parcial: continúa con otros reminders y no marca el fallido
- `configureOpenClawCmd()` cambia el comando usado por el sender por defecto
- error si falta `target`
- sin reminders pendientes retorna éxito sin invocar sender
- el wrapper CLI resuelve `target/dbPath/openclawCmd` desde flags/env antes de ejecutar
- archivo de test esperado: `tests/integration/daily-reminder-runner.test.ts`

## Criterios de aceptación

- `npx tsc --noEmit` pasa
- tests relevantes pasan
- el runner usa `openclaw message send` como única interfaz pública de entrega
- solo marca reminders como enviados después de un envío exitoso
- el resultado final refleja éxitos y fallos sin abortar en el primer error
