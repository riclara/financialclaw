# TASK-01: Inicializar proyecto

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Dejar creada la base mínima del proyecto para que el resto de las TASKs pueda agregar código, dependencias, tests y manifiesto del plugin sin redefinir la configuración inicial.

## Archivos a crear o tocar

- `package.json`
- `tsconfig.json`
- `openclaw.plugin.json`
- `requirements.txt`
- `.gitignore`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- Ninguna

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `AGENTS.md`
- `docs/openclaw-sdk.md`
- `docs/setup.md`

## Contrato obligatorio

- `package.json` debe definir exactamente:
  - `name = "financialclaw"`
  - `version = "0.1.0"`
  - `description = "Plugin OpenClaw para finanzas personales via Telegram"`
  - `type = "module"`
  - `openclaw.extensions = ["./src/index.ts"]`
  - scripts:
    - `build = "tsc"`
    - `typecheck = "tsc --noEmit"`
    - `test = "tsx --test tests/**/*.test.ts"`
    - `test:unit = "tsx --test tests/unit/**/*.test.ts"`
    - `test:integration = "tsx --test tests/integration/**/*.test.ts"`
  - dependencies:
    - `@sinclair/typebox = ^0.34.0`
    - `better-sqlite3 = ^12.8.0`
  - `peerDependencies.openclaw = >=2026.3.0`
  - devDependencies:
    - `@types/better-sqlite3 = ^7.6.13`
    - `@types/node = ^22.0.0`
    - `openclaw = ^2026.3.0`
    - `tsx = ^4.19.0`
    - `typescript = ^5.5.0`
  - `engines.node = >=22.14.0`
- `openclaw.plugin.json` debe definir exactamente:
  - `id = "financialclaw"`
  - `name = "FinancialClaw"`
  - `description = "Plugin de finanzas personales: gastos, ingresos, recurrentes y OCR de recibos"`
  - `version = "0.1.0"`
  - `enabledByDefault = true`
  - `configSchema` con:
    - `dbPath: string`
    - `pythonCmd: string`
    - `reminders?`:
      - `enabled: boolean`
      - `channel: "telegram"`
      - `accountId?: string`
      - `target?: string`
    - `additionalProperties = false`
  - `contracts.tools` con:
    - `manage_currency`
    - `log_expense_from_image`
    - `log_expense_manual`
    - `log_income`
    - `log_income_receipt`
    - `add_recurring_expense`
    - `mark_expense_paid`
    - `get_financial_summary`
    - `list_expenses`
    - `list_incomes`
- `tsconfig.json` debe usar:
  - `target = ES2022`
  - `module = NodeNext`
  - `moduleResolution = NodeNext`
  - `strict = true`
  - `outDir = "./dist"`
  - `rootDir = "."`
  - `declaration = true`
  - `esModuleInterop = true`
  - `skipLibCheck = true`
  - `forceConsistentCasingInFileNames = true`
  - `resolveJsonModule = true`
  - `include = ["src/**/*.ts", "tests/**/*.ts"]`
  - `exclude = ["node_modules", "dist"]`
- `requirements.txt` debe contener:
  - `paddlepaddle==3.3.0`
  - `paddleocr==3.4.0`
  - `Pillow==10.3.0`
  - `numpy>=1.26,<3`
- `.gitignore` debe incluir:
  - `node_modules/`
  - `dist/`
  - `.venv/`
  - `financialclaw.db`
  - `*.db`
  - `.env`

## Reglas / invariantes de negocio

- El proyecto debe arrancar como TypeScript estricto + ESM desde el día 1.
- `openclaw` debe permanecer como `peerDependency`; el gateway lo provee en runtime.
- La dependencia `openclaw` en `devDependencies` existe solo para typecheck y desarrollo local.
- La configuración base debe ser compatible con imports relativos terminados en `.js`.
- La configuración inicial del plugin debe reservar desde el día 1 el bloque `reminders` para el wiring de recordatorios automáticos.
- `reminders.target` se valida en runtime cuando `reminders.enabled = true`; no hace falta inventar una condición JSON Schema compleja en esta TASK.
- No introducir dependencias adicionales en esta TASK.

## No asumir

- No cambiar a CommonJS.
- No reemplazar `tsx` por otro test runner.
- No mover el entry point fuera de `src/index.ts`.
- No agregar campos de config fuera de `dbPath`, `pythonCmd` y `reminders`.
- No usar versiones distintas de las listadas arriba sin una decisión explícita.

## Casos borde

- Repositorio todavía sin archivos `.ts`:
  - la validación principal es que la configuración quede lista para cuando aparezcan
- Entorno sin `openclaw` instalado globalmente:
  - el proyecto debe seguir pudiendo resolver tipos vía `devDependencies`
- Entorno Python sin PaddleOCR aún instalado:
  - `requirements.txt` debe ser suficiente para bootstrap posterior

## Lógica de implementación

1. Crear `package.json` con scripts, dependencias y engine base.
2. Crear `openclaw.plugin.json` con el manifiesto inicial del plugin.
3. Crear `tsconfig.json` con configuración estricta y salida a `dist`.
4. Crear `requirements.txt` para la capa OCR.
5. Crear `.gitignore` con artefactos Node, Python y SQLite.

## Tests requeridos

- No hay archivo de test dedicado en esta TASK.
- Verificación mínima:
  - `npm install`
  - `npx tsc --noEmit` una vez exista al menos un archivo `.ts`

## Criterios de aceptación

- `npm install` completa sin errores.
- `npx tsc --noEmit` valida la configuración base cuando exista al menos un archivo TypeScript.
- El manifiesto `openclaw.plugin.json` enumera los 10 tools esperados del plugin.
