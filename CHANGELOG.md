# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/). Versionado semántico.

## [1.0.2](https://github.com/riclara/financialclaw/compare/financialclaw-v1.0.1...financialclaw-v1.0.2) (2026-04-03)


### Fixed

* add source-repo and source-commit to clawhub publish ([#37](https://github.com/riclara/financialclaw/issues/37)) ([906e010](https://github.com/riclara/financialclaw/commit/906e0106fbd536cbebe322413635a4e9b61cac67))

## [1.0.1](https://github.com/riclara/financialclaw/compare/financialclaw-v1.0.0...financialclaw-v1.0.1) (2026-04-03)


### Fixed

* address clawhub security scan findings ([#35](https://github.com/riclara/financialclaw/issues/35)) ([00d0a6d](https://github.com/riclara/financialclaw/commit/00d0a6d537fb704cebc2f8a416a20946a1c54696))

## [1.0.0](https://github.com/riclara/financialclaw/compare/financialclaw-v0.7.0...financialclaw-v1.0.0) (2026-04-02)


### ⚠ BREAKING CHANGES

* package name changed from @riclara/financialclaw to financialclaw. Install with `openclaw plugins install financialclaw`.

### Added

* rename package from @riclara/financialclaw to financialclaw ([#33](https://github.com/riclara/financialclaw/issues/33)) ([9001d25](https://github.com/riclara/financialclaw/commit/9001d25ce3656cd765de053c0c7f0e26a3115150))

## [0.7.0](https://github.com/riclara/financialclaw/compare/financialclaw-v0.6.2...financialclaw-v0.7.0) (2026-04-02)


### Added

* translate all strings to english ([#31](https://github.com/riclara/financialclaw/issues/31)) ([124c935](https://github.com/riclara/financialclaw/commit/124c9358d2f904056f5d8cf4e1637386714daeae))

## [0.6.2](https://github.com/riclara/financialclaw/compare/financialclaw-v0.6.1...financialclaw-v0.6.2) (2026-04-02)


### Fixed

* exclude test files from published npm package ([#29](https://github.com/riclara/financialclaw/issues/29)) ([eb107fd](https://github.com/riclara/financialclaw/commit/eb107fd32ca1e8a165a1b2849fc0dbaa88d4163f))

## [0.6.1](https://github.com/riclara/financialclaw/compare/financialclaw-v0.6.0...financialclaw-v0.6.1) (2026-04-02)


### Fixed

* ship compiled JS and tighten setup check ([#26](https://github.com/riclara/financialclaw/issues/26)) ([1cf8779](https://github.com/riclara/financialclaw/commit/1cf8779c09f57fe5ecfdb11d7e264a9f5978126e))

## [0.6.0](https://github.com/riclara/financialclaw/compare/financialclaw-v0.5.4...financialclaw-v0.6.0) (2026-04-02)


### Added

* migrate from better-sqlite3 to node:sqlite built-in ([#24](https://github.com/riclara/financialclaw/issues/24)) ([0a9b1a4](https://github.com/riclara/financialclaw/commit/0a9b1a40daa4ccfa67b16982732f7f412125b8c6))

## [0.5.4](https://github.com/riclara/financialclaw/compare/financialclaw-v0.5.3...financialclaw-v0.5.4) (2026-04-02)


### Fixed

* restore financialclaw-setup bin in dedicated bin/ directory ([#21](https://github.com/riclara/financialclaw/issues/21)) ([57add2d](https://github.com/riclara/financialclaw/commit/57add2d2e8dc51cf0027ec6b31a1c075d2c0f60d))

## [0.5.3](https://github.com/riclara/financialclaw/compare/financialclaw-v0.5.2...financialclaw-v0.5.3) (2026-04-01)


### Fixed

* replace file read with version constants to clear security scanner ([#19](https://github.com/riclara/financialclaw/issues/19)) ([2e6a90f](https://github.com/riclara/financialclaw/commit/2e6a90fc364bcf325e31575937beaab5bc909708))

## [0.5.2](https://github.com/riclara/financialclaw/compare/financialclaw-v0.5.1...financialclaw-v0.5.2) (2026-04-01)


### Fixed

* remove financialclaw-setup bin and update docs ([#17](https://github.com/riclara/financialclaw/issues/17)) ([24b57c3](https://github.com/riclara/financialclaw/commit/24b57c3b8aa97ec16e456f1506e8d5ff70f4e81f))

## [0.5.1](https://github.com/riclara/financialclaw/compare/financialclaw-v0.5.0...financialclaw-v0.5.1) (2026-04-01)


### Fixed

* move npm publish into release-please workflow ([830b611](https://github.com/riclara/financialclaw/commit/830b611989ccdef94280095df8c5fb86c5e2d5cb))
* move npm publish into release-please workflow to bypass GITHUB_TOKEN trigger restriction ([2f1f0b1](https://github.com/riclara/financialclaw/commit/2f1f0b1a5e1644e83f82e9799d5bb6c0e3f44a67))
* use PAT for release-please so pull_request CI events fire on release PRs ([ee5791b](https://github.com/riclara/financialclaw/commit/ee5791be0623917f90ce848aa98babe8e5515927))
* use PAT for release-please to trigger CI on release PRs ([aa64659](https://github.com/riclara/financialclaw/commit/aa64659022e67db13a34ec6508c93c2e1f053715))

## [0.5.0](https://github.com/riclara/financialclaw/compare/financialclaw-v0.4.0...financialclaw-v0.5.0) (2026-04-01)


### Added

* check for updates in daily sync and update plugin update docs ([00c7e19](https://github.com/riclara/financialclaw/commit/00c7e1975fda128ac17ea74de082d58efef4dd26))
* check for updates in daily sync and update plugin update docs ([2964468](https://github.com/riclara/financialclaw/commit/296446870065d1f1129ae8f0357f45f24d6dc16c))


### Fixed

* guard version check with try-catch and use semver comparison ([ed64ea7](https://github.com/riclara/financialclaw/commit/ed64ea79b1882e13c6243da8306364d3f26a2091))
* remove daily-reminder-runner to eliminate child_process security warning ([5a2b40c](https://github.com/riclara/financialclaw/commit/5a2b40c0707ae4b49a1b0369cb637360971b5aa6))
* sync openclaw.plugin.json version to 0.4.0 ([3a137fa](https://github.com/riclara/financialclaw/commit/3a137fa7d8ee19e7595c0bc81b8fae039b061fd5))
* trigger npm publish on tag push instead of release event ([f704850](https://github.com/riclara/financialclaw/commit/f70485016155f12e823223156cc271024a1dd5dc))

## [0.4.0](https://github.com/riclara/financialclaw/compare/financialclaw-v0.3.2...financialclaw-v0.4.0) (2026-04-01)


### Added

* add run_daily_sync tool and automatic cron setup via SKILL ([d248720](https://github.com/riclara/financialclaw/commit/d248720a281bfb25ae5e892d4e1bc177e411348a))
* agentic OCR + OpenClaw skills (v0.3.0) ([0528e74](https://github.com/riclara/financialclaw/commit/0528e7418bc02df3f5059c1052a05903282e5b48))
* agregar skills para el agente OpenClaw ([d1b2bd2](https://github.com/riclara/financialclaw/commit/d1b2bd24d147b31a9362817cb8d460249e842566))
* expose ensure-plugins-allow.mjs as financialclaw-setup bin ([6617f5f](https://github.com/riclara/financialclaw/commit/6617f5f2daeae9d3a9eaddd9c73f7f6c58368d53))
* implement TASK-21 Refactorización a OCR Agéntico ([7834425](https://github.com/riclara/financialclaw/commit/78344251148e0f9290350683943f0a78d2071495))
* implement TASK-21 Refactorización a OCR Agéntico ([594f92b](https://github.com/riclara/financialclaw/commit/594f92beca5e0facd9db1bef7e27b881fa70a381))
* initialize financialclaw plugin ([6ce4918](https://github.com/riclara/financialclaw/commit/6ce4918e59617607a3611de139ab8ef940af3624))
* migrate to agentic OCR, rename log tool, and bump version to 0.2.0 ([dcdda56](https://github.com/riclara/financialclaw/commit/dcdda56c0398f08a97be4213030ec3757a4026a8))
* **skills:** botón inline de Telegram para confirmar gasto desde foto ([412f3e8](https://github.com/riclara/financialclaw/commit/412f3e87dd9a4b7fa5e00dbab6d578154db99878))
* **skills:** pedir confirmación antes de guardar gasto desde foto ([8f05df3](https://github.com/riclara/financialclaw/commit/8f05df37a6188caaaee211534138b5eeeb1b6cc9))
* **skills:** traducir todos los skills al inglés ([f4a048a](https://github.com/riclara/financialclaw/commit/f4a048a02e1e50e5f9559dda72d12cf518fea239))


### Fixed

* address Devin review comments on PR [#6](https://github.com/riclara/financialclaw/issues/6) ([2d81e56](https://github.com/riclara/financialclaw/commit/2d81e56a4323a592eccce97af445bb05486a0e72))
* address review feedback on plugins.allow script ([761dd9d](https://github.com/riclara/financialclaw/commit/761dd9d54440d784f76d04437436328128d9f366))
* auto-add financialclaw to plugins.allow on install ([42323e1](https://github.com/riclara/financialclaw/commit/42323e1bfeb27d933ccf8e064d78798107fb6ba3))
* auto-add plugin to plugins.allow on install ([0984224](https://github.com/riclara/financialclaw/commit/09842248ad4350dd540f08f22675c26efacda498))
* correct config path detection, remove broken openclaw config path call ([d327484](https://github.com/riclara/financialclaw/commit/d327484b5587f846b63c343c13318ba880d45dd7))
* correct import statements in src/index.ts for consistency ([7845e6f](https://github.com/riclara/financialclaw/commit/7845e6f6377e5d133cad685c625a2dbcecddd568))
* ensure-plugins-allow.mjs manual + dbPath config ([187763e](https://github.com/riclara/financialclaw/commit/187763ea93893a0ce56493ccba097cbd5f3fd8ce))
* include openclaw.plugin.json in published files ([d1b1c2d](https://github.com/riclara/financialclaw/commit/d1b1c2d8a56d8ab7b0b142cf97f576b5c2c5a814))
* make ensure-plugins-allow.mjs manual, add dbPath config ([b742e4f](https://github.com/riclara/financialclaw/commit/b742e4fa97c8a11acc6da92c7248a93f3af2e389))
* scope package name to @riclara/financialclaw ([bdb05fe](https://github.com/riclara/financialclaw/commit/bdb05fe33ad49a0963a8d176036bcdd1d6b02418))
* **skills:** cambiar value del botón de confirmar a si ([0048144](https://github.com/riclara/financialclaw/commit/004814477e48c5321bbc51c8d6fd708c17341a80))
* support custom OpenClaw config path in ensure-plugins-allow.mjs ([596dc30](https://github.com/riclara/financialclaw/commit/596dc3003bca3eacd7e978ce11f4ebe6b339f852))
* update openclaw.plugin.json and src/index.ts for TASK-21 ([84ae174](https://github.com/riclara/financialclaw/commit/84ae17423d0fe8b68f9ab30d41df721769724e93))
* use absolute default path for SQLite database ([929e017](https://github.com/riclara/financialclaw/commit/929e0177aa7a9a6a6b4cc704c1f7562ba1a1e49a))
* use absolute default path for SQLite database ([ea48c1a](https://github.com/riclara/financialclaw/commit/ea48c1a57ad8723b28948aa5e9699897946ef838))
* use explicit date ranges in list-expenses tests to avoid Date mock race conditions ([4cade7f](https://github.com/riclara/financialclaw/commit/4cade7ffa8446f8f6eddec80aa1a13d70140a61b))
* use openclaw gateway restart in post-install message ([a423e99](https://github.com/riclara/financialclaw/commit/a423e998636db6414535e472cd8ed62561b1d651))

## [0.3.2] - 2026-03-31
### Added
- Nuevo comando `financialclaw-setup` expuesto como bin de npm. Ejecutar con `npx @riclara/financialclaw financialclaw-setup` (o `--db-path` / `--config` para rutas personalizadas) tras instalar el plugin. Agrega `financialclaw` a `plugins.allow` preservando channels y plugins activos, y configura `dbPath`.
- Campo `files` en `package.json` para publicación correcta en npm: incluye `src/`, `scripts/`, `skills/` y `openclaw.plugin.json`.
- README en inglés como documento principal; versión en español en `README.es.md`.
- `docs/setup.md` reescrito en inglés (sin contenido de PaddleOCR ni Python); versión en español en `docs/setup.es.md`.

### Changed
- Nombre del paquete cambiado de `financialclaw` a `@riclara/financialclaw` (scope npm).
- Los 4 skills del agente (`registro-gastos`, `registro-ingresos`, `consultas-financieras`, `configuracion-moneda`) consolidados en un único skill `financialclaw`.
- `docs/bitacora.md` pasa a ser archivo local no versionado en git (`.gitignore`).

### Fixed
- BD creada en `./financialclaw.db` (relativo al cwd del gateway) cuando `dbPath` no estaba configurado, causando que se perdiera al reinstalar el plugin. El default ahora es `~/.openclaw/workspace/financialclaw.db` (ruta absoluta). El directorio se crea automáticamente si no existe.

## [0.3.1] - 2026-03-31
### Fixed
- `openclaw plugins install` no agrega el plugin a `plugins.allow` ni configura `dbPath`, causando que los tools no se carguen, que canales activos (Telegram) dejen de funcionar y que la BD quede sin ruta configurada. Nuevo script `scripts/ensure-plugins-allow.mjs` para ejecutar manualmente post-install: agrega `financialclaw` al allowlist preservando channels y plugins activos, y configura `plugins.entries.financialclaw.config.dbPath` con un default sensato o ruta custom vía `--db-path`.

## [0.3.0] - 2026-03-30
### Added
- 4 skills para el agente OpenClaw: `registro-gastos`, `registro-ingresos`, `consultas-financieras`, `configuracion-moneda`.
- Flujo de confirmación con botón inline de Telegram antes de guardar un gasto desde foto de recibo.

## [Unreleased]

### Added
- Infraestructura: se agrega CI en GitHub Actions (`.github/workflows/ci.yml`) para `push`, `pull_request` y ejecución manual; el pipeline usa Node 24 sobre `ubuntu-latest` y corre `npm ci`, `npx tsc --noEmit`, `npm run test:unit`, `npm run test:integration` y `npm run build` para fijar automáticamente el mismo checklist de release usado localmente.
- Operación: `docs/setup.md` ahora incluye ejemplos concretos para programar `src/bin/daily-reminder-runner.ts` con `cron`, `launchd` y `systemd`, incluyendo variables mínimas, rutas de log y comandos de activación para pasar del runner one-shot a operación diaria real.
- `TASK-19`: nuevo runner externo de reminders con `src/services/daily-reminder-runner.ts`, `src/bin/daily-reminder-runner.ts` y `tests/integration/daily-reminder-runner.test.ts`; ejecuta un ciclo one-shot de `dailySync()`, ordena `remindersDue` por `due_date` y `reminder_id`, entrega mensajes exclusivamente vía `openclaw message send`, marca `reminders.sent = 1` y `sent_at` solo tras éxito, expone `configureOpenClawCmd()` para cambiar el binario CLI y resuelve `target/channel/accountId/dbPath/openclawCmd` desde flags o variables de entorno sin usar `pluginConfig`, `registerService()` ni mensajería interna del runtime.
- Bootstrap inicial del proyecto con `package.json`, `tsconfig.json`, `openclaw.plugin.json`, `requirements.txt` y `.gitignore` conforme al contrato de `TASK-01`.
- Capa base de persistencia SQLite para `TASK-02`: `src/db/schema.ts` con `ALL_MIGRATIONS` y `ALL_SEEDS`, `src/db/database.ts` con `configureDb()` y `getDb()` lazy singleton, `tests/helpers/test-db.ts` y cobertura de integración para schema, seed `XXX` e inicialización tardía.
- `README.md` inicial con estado actual del proyecto, instalación rápida y advertencia visible sobre recompilación de `better-sqlite3` al cambiar de versión de Node.
- Helpers compartidos de `TASK-07`: `date-utils` con cálculo de frecuencias y presets de período (`this_month`, `last_month`, `last_30_days`, `this_year`), y `currency-utils` con `PLACEHOLDER_CURRENCY`, resolución de moneda default desde SQLite, detección de placeholder y formato monetario legible en español.
- `TASK-08`: nuevo módulo `manage_currency` con `InputSchema` TypeBox y `executeManageCurrency()` para agregar monedas, listarlas mostrando la default primero y cambiar la moneda por defecto con consistencia de flags; incluye cobertura de integración específica para duplicados, placeholder `XXX` y `set_default`.
- `TASK-10`: nuevo módulo `mark_expense_paid` con `InputSchema` TypeBox y `executeMarkExpensePaid()` para marcar gastos existentes por `expense_id`, persistir `payment_date`, escribir `updated_at` explícitamente y evitar mutaciones redundantes cuando el gasto ya está `PAID`; incluye cobertura de integración para `PENDING`, `OVERDUE`, ID inexistente, caso informativo y default de fecha.
- `TASK-09`: nuevo módulo `log_expense_manual` con `InputSchema` TypeBox y `executeLogExpenseManual()` para registrar gastos manuales; determina estado inicial (`PAID` / `PENDING`) comparando `due_date` contra `todayISO()`, resuelve moneda via `resolveCurrency()`, usa `OTHER` como categoría por defecto, incluye monto formateado en la respuesta y agrega sugerencia de `manage_currency` cuando la moneda default sigue siendo el placeholder `XXX`; incluye 8 tests de integración que cubren los criterios de aceptación de la tarea.
- `TASK-11`: nuevo módulo `log_income` con `InputSchema` TypeBox y `executeLogIncome()` para registrar ingresos; persiste en `incomes` e `income_receipts` en una sola transacción SQLite; calcula `next_expected_receipt_date` con `computeNextDate()` para frecuencias `WEEKLY`, `BIWEEKLY`, `MONTHLY` e `INTERVAL_DAYS`; valida la combinación `recurring/frequency/interval_days`; resuelve moneda con `resolveCurrency()`; incluye monto formateado y próxima fecha en la respuesta; agrega sugerencia de `manage_currency` cuando la moneda sigue en `XXX`; incluye 7 tests de integración.
- `TASK-13`: nuevo módulo `add_recurring_expense` con `InputSchema` TypeBox y `executeAddRecurringExpense()` para crear reglas de gasto recurrente; en una sola transacción inserta en `recurring_expense_rules` (campo `name` recibe `description`; `day_of_month` queda NULL), genera el primer `expense` con `status='PENDING'`, `generated_from_rule=1`, `updated_at` explícito, y opcionalmente el primer `reminder` con `scheduled_date = starts_on - reminder_days_before`; valida fechas calendario reales, `description` no vacío e `interval_days` obligatorio para `INTERVAL_DAYS`; incluye sugerencia de `manage_currency` cuando la moneda sigue en `XXX`; incluye 11 tests de integración.
- `TASK-12`: nuevo módulo `log_income_receipt` con `InputSchema` TypeBox y `executeLogIncomeReceipt()` para registrar pagos recibidos vinculados a un ingreso existente; verifica que el `income_id` exista antes de insertar; resuelve moneda desde el income (no la default global) cuando el usuario no provee `currency`; actualiza `next_expected_receipt_date` del income recurrente vía `computeNextDate()` en la misma transacción SQLite; incluye diferencia positiva o negativa en la respuesta cuando `received_amount` difiere de `expected_amount`; agrega sugerencia de `manage_currency` cuando la moneda efectiva sigue siendo `XXX`; incluye 9 tests de integración.
- `TASK-14`: nuevo módulo `get_financial_summary` con `InputSchema` TypeBox y `executeGetFinancialSummary()` para consultar resumen financiero del período; parámetros opcionales `period` (this_month / last_month / last_30_days / this_year, default: this_month) y `currency`; cuatro queries con patrón `(? IS NULL OR currency = ?)` para filtro opcional sin duplicar SQL; secciones por moneda ordenadas alfabéticamente con ingresos recibidos, gastos totales, gastos pendientes, balance, desglose por categoría y reglas recurrentes activas con equivalente mensual; estado vacío legible con "Sin movimientos registrados en el período." y "Compromisos fijos activos: 0"; helper `monthlyEquivalent()` para MONTHLY, WEEKLY, BIWEEKLY e INTERVAL_DAYS; incluye 13 tests de integración con anclas temporales via `todayISO()` y `resolvePeriodRange()`.
- `TASK-18`: nuevo módulo `daily-sync` con `dailySync(db, today)` para reconciliación diaria del estado financiero; genera ocurrencias faltantes de `recurring_expense_rules` activas hasta la fecha de referencia respetando `ends_on`, `is_active`, frecuencia e `interval_days`; mueve `expenses` `PENDING` vencidos a `OVERDUE` escribiendo `updated_at`; recopila `reminders` pendientes (`scheduled_date <= today`, `sent = 0`) sin marcar `sent`; incluye 7 tests de integración para generación normal, gaps largos, `ends_on`, regla inactiva, idempotencia, transición a `OVERDUE` y reminders pendientes.
- `TASK-06`: nuevo módulo `src/ocr/paddle-ocr-subprocess.ts` que implementa el wrapper TypeScript para invocar `paddle_ocr_cli.py` vía `spawnSync`; exporta `runPaddleOcr(imagePath)` y `configurePythonCmd(cmd)`; usa timeout de 60s, parsea stdout como JSON y maneja errores descriptivamente; resuelve la ruta del CLI relativa al archivo actual; permite configurar el intérprete Python desde variable de entorno o mediante la función de configuración; corrige mensaje de error para incluir el código de salida real cuando el proceso falla; **DONE**: TypeScript compila sin errores y cumple con los criterios de aceptación.
- `TASK-03`: nuevo módulo `ocr-classification.ts` portado desde sendafinanciera; define `ExpenseCategory` como enum local con las 9 categorías disponibles (`HOUSING`, `SERVICES`, `TRANSPORT`, `SUPERMARKET`, `HEALTH`, `EDUCATION`, `ENTERTAINMENT`, `RESTAURANT`, `OTHER`); exporta `normalizeOcrText()` para normalización Unicode NFD con eliminación de diacríticos y conversión a minúsculas; exporta `inferMerchantAndCategoryFromText()` que itera `CATEGORY_RULES` en orden fijo y retorna el primer match por keyword; incluye 15 tests unitarios cubriendo normalización y todas las categorías.
- `TASK-04`: nuevo módulo `receipt-parser.ts` portado desde sendafinanciera; exporta `normalizeReceiptText()`, `parseAmountFromReceiptText()` (soporta separadores `.` y `,`, prioridades PRIMARY/SECONDARY/SUBTOTAL, fallback genérico >= 1000), `parseDateFromReceiptText()` (ISO, LatAm con `/` y `-`, texto español) y `parseMerchantFromReceiptText()` (primeras 5 líneas, filtro de ruido, title case); import ajustado a `./ocr-classification.js` por convención ESM; incluye 27 tests unitarios cubriendo monto, fecha y merchant parsing.
- `TASK-05`: CLI `paddle_ocr_cli.py` creado; ejecuta PaddleOCR sobre imagen y emite JSON a stdout; recibe path de imagen por argumento posicional o flag `--warmup` para precargar modelos; portado desde `sendafinanciera/paddle-ocr/app.py` con funciones `_create_paddle_ocr_engine` (soporta 2.x y 3.x), `_extract_lines_from_paddle_result`, `_execute_paddle_ocr`, `_compute_average_confidence` y `_prepare_image_for_ocr` (resize max_side=1600, portrait=2200); logs van a stderr, JSON a stdout; **DONE**: verificado exitosamente con `./.venv/bin/python3 paddle_ocr_cli.py --warmup` (exit code 0, JSON válido). La TASK y la documentación operativa quedan alineadas con ese intérprete para no reabrir el falso negativo del `python3` genérico.
- Cierre del parche de compatibilidad de `ocr_extractions`: se refuerzan los tests de integración para verificar las columnas `status` (NOT NULL, default 'COMPLETED') y `failure_code` tanto en instalaciones nuevas como en bases legacy mediante migraciones idempotentes; 77/77 tests de integración pasan tras la verificación.
- `TASK-16`: nuevo módulo `list_expenses` con `InputSchema` TypeBox y `executeListExpenses()` para listar gastos con filtros; parámetros: `period?` (this_month/last_month/last_30_days/this_year/all), `start_date?`, `end_date?`, `category?`, `status?`, `search?`, `currency?`, `source?`, `limit?` (default 20, max 50), `offset?`; búsqueda en `description` y `merchant` con LIKE; conteo total con COUNT(*) sin LIMIT/OFFSET; retorna IDs utilizables; paginación con hint de más resultados; incluye 21 tests de integración.
- `TASK-17`: nuevo módulo `list_incomes` con `InputSchema` TypeBox y `executeListIncomes()` para listar ingresos con filtros; parámetros: `recurring?`, `search?`, `currency?`, `limit?` (default 20, max 50), `offset?`, `include_receipts?` (default false); búsqueda en `reason` con LIKE; conteo total con COUNT(*) sin LIMIT/OFFSET; si `include_receipts=true`, trae hasta 5 receipts por income ordenados por fecha DESC; retorna IDs utilizables; paginación con hint de más resultados; incluye 20 tests de integración.
- `TASK-20`: nuevo módulo `src/index.ts` que implementa el entry point del plugin financialclaw; exporta `default definePluginEntry({...})` que lee `api.pluginConfig`, llama `configureDb()` si llega `dbPath`, y registra exactamente los 10 tools con `api.registerTool()` usando `wrapExecute()`; no registra services; incluye tests de integración que verifican el registro correcto de tools y aplicación de configuración; **DONE**: TypeScript compila sin errores y todos los tests de integración pasan. (El soporte de `configurePythonCmd()`/`pythonCmd` fue retirado en TASK-21.)

### State (pre-release)
- 21/21 TASKs completadas y verificadas. Todos los hitos cerrados.

### Changed
- Preparación final de release interno/publicación del repositorio: `README.md`, `docs/setup.md`, `docs/hitos.md` y `openclaw.plugin.json` quedan alineados con el estado real del proyecto como plugin tools-only más runner externo de reminders.
- `docs/setup.md` ahora documenta una invocación manual concreta del runner externo, las variables mínimas (`FINANCIALCLAW_REMINDER_TARGET`, `FINANCIALCLAW_DB_PATH`, `FINANCIALCLAW_REMINDER_CHANNEL`, `FINANCIALCLAW_REMINDER_ACCOUNT_ID`, `FINANCIALCLAW_OPENCLAW_CMD`) y el comportamiento de exit code para operación/scheduling externo.
- `README.md` deja de presentar el repositorio como “en implementación” y resume explícitamente SQLite embebida, multi-moneda y el modelo tools-only con automatización fuera del plugin. (La mención de OCR local con PaddleOCR fue reemplazada en 0.2.0 por el modelo agéntico.)
- Verificación final de cierre ejecutada en el estado actual del repo: `npm install`, `npx tsc --noEmit`, `npm run test:unit`, `npm run test:integration` y `npm run build` en verde con `better-sqlite3` recompilado para el Node activo.
- Implementación final de `TASK-19`: el runner externo usa el flag público `--account` al invocar `openclaw message send` y mantiene el mapping explícito `accountId` -> `--account`; la cobertura de integración ahora fija también ese comando observable para evitar futuras derivas de la CLI.
- `TASK-19` queda corregida a nivel contractual para alinearse con la CLI pública actual de OpenClaw: la documentación del runner externo reemplaza `--account-id` por `--account` y deja explícito el mapping `accountId` (shape interno TypeScript) -> `--account` (flag CLI público). El cierre operativo deja `docs/hitos.md` con Hito 7 en `DONE`.
- `TASK-20` queda cerrado de forma contractual: `src/index.ts` elimina el registro duplicado de `manage_currency`, agrega `list_expenses`, conserva exactamente los 10 tools publicados por `openclaw.plugin.json`, mantiene `wrapExecute()` adaptando a `ToolResult` compatible con la SDK actual y sigue sin registrar services ni consumir `pluginConfig.reminders`; `tests/integration/plugin-entry.test.ts` blinda ese wiring con un smoke test que compila el entry point en memoria y stubbea `registerTool` y `configureDb()` sin depender del runtime real de OpenClaw.
- `docs/tasks/task-13.md` y `docs/hitos.md` alineados para cerrar tres contradicciones bloqueantes previas a la implementación de `add_recurring_expense`: (1) el campo de input se llama `description` y se mapea a `recurring_expense_rules.name` y a `expenses.description`; (2) `day_of_month` no se expone en el input ni se usa en el INSERT de esta TASK; para `MONTHLY`, el día queda anclado al `starts_on`; (3) la idempotencia de re-ejecución del tool fue eliminada como criterio — el índice único `(recurring_rule_id, due_date)` protege duplicados para una misma regla existente (dailySync), no ejecuciones repetidas del tool de creación.
- `AGENTS.md` ahora exige un preflight de contradicciones antes de implementar TASKs que crucen schema, nombres de columnas, defaults sensibles o side effects repartidos entre documentación y código; si aparece una ambigüedad material, la implementación debe frenarse y reportarse antes de inventar comportamiento.
- `docs/bitacora.md` registra esta práctica como aprendizaje explícito del proceso después del reproceso observado en TASKs con contrato documental y schema repartidos.
- `TASK-02` y el schema SQLite ahora cierran la deriva contractual sobre `expenses.updated_at`: instalaciones nuevas crean la columna desde `CREATE TABLE`, bases existentes la reciben vía migración idempotente con backfill desde `created_at`, y `tests/integration/database.test.ts` verifica ambos caminos.
- `TASK-01` y `package.json` actualizan `better-sqlite3` de `^9.6.0` a `^12.8.0` y `@types/better-sqlite3` a `^7.6.13` para que el bootstrap sea compatible con `Node 24`, que es el runtime recomendado en `docs/setup.md`.
- `package.json` ahora ejecuta `npm rebuild better-sqlite3` en `postinstall` para que las verificaciones directas de `TASK-02` no dependan de recompilar manualmente el addon nativo tras cambiar de versión de Node.
- `docs/setup.md` ahora deja explícito que cambiar de versión de Node requiere volver a correr `npm install`, y documenta `NODE_MODULE_VERSION` / `ERR_DLOPEN_FAILED` como síntoma esperado cuando `better-sqlite3` quedó compilado contra otro runtime.
- `docs/implementacion.md` pasa a ser un índice liviano y deja de duplicar el detalle completo de las TASK.
- `AGENTS.md`, `CLAUDE.md` y `docs/plan-tecnico.md` ahora apuntan a `docs/tasks/task-XX.md` como fuente canónica del detalle por tarea.
- Dependencias y referencias entre `docs/hitos.md` y varios `docs/tasks/task-XX.md` fueron alineadas para evitar contradicciones durante la implementación paralela.
- Se agrega `docs/tasks/TEMPLATE.md` como plantilla canónica para escribir TASKs con detalle crítico explícito y menor riesgo de suposiciones incorrectas.
- Se agrega `docs/tasks/tasks.yaml` como manifiesto canónico de metadata estable de TASKs y `scripts/validate_task_manifest.py` para validar consistencia contra `docs/hitos.md` y los `task-XX.md`.
- Se agrega `scripts/audit_task_template.py` para auditar deuda de plantilla y priorizar migración de `docs/tasks/task-XX.md`.
- `docs/bitacora.md` documenta la práctica recomendada para arrancar levantamiento de requerimientos y documentación en proyectos orientados a agentes.
- Se migra la primera ola de TASK docs (`TASK-02`, `TASK-05`, `TASK-07`, `TASK-14`, `TASK-20`) a la plantilla canónica y se aclara en bitácora cómo interpretar el score del auditor.
- Se migra la segunda ola de TASK docs (`TASK-08`, `TASK-09`, `TASK-15`, `TASK-18`, `TASK-19`) a la plantilla canónica; el auditor queda sin deuda alta y con `10` TASKs en cumplimiento exacto.
- Se completa la migración del resto de `docs/tasks/task-XX.md` a la plantilla canónica (`TASK-01`, `TASK-03`, `TASK-04`, `TASK-06`, `TASK-10`, `TASK-11`, `TASK-12`, `TASK-13`, `TASK-16`, `TASK-17`); el auditor queda en `20/20` TASKs con cumplimiento exacto.
- Se corrige la documentación de `TASK-19` para alinearla con la superficie pública verificada de OpenClaw (`registerService({ id, start, stop })`), se introduce configuración explícita de `reminders` y la tarea queda marcada como `BLOCKED` hasta que exista una API pública de mensajería proactiva.
- `docs/openclaw-sdk.md` y `docs/plan-tecnico.md` ahora documentan explícitamente que la SDK pública actual no expone envío proactivo para plugins de tools y que no debe usarse workaround por subprocess o reach-ins privados.
- Rediseño final del roadmap para salir del bloqueo upstream de reminders sin bajar el estándar: `TASK-19` deja de modelarse como service interno del plugin y pasa a `daily-reminder-runner` externo usando la CLI pública `openclaw message send`; `TASK-20` se redefine como `src/index.ts` tools-only, sin `registerService()` y sin depender ya de `TASK-19`.
- `docs/plan-tecnico.md` corrige la deriva del seed de moneda default y alinea la arquitectura con `XXX / Sin configurar / ¤` en vez de `COP`.
- `docs/hitos.md` cierra `TASK-01` como `DONE` después de verificar `npm install` con `better-sqlite3@^12.8.0`; `tsc` sigue pendiente de tener al menos un archivo TypeScript de entrada, tal como documenta la propia tarea.

## [0.2.0] - 2026-03-29
### Changed
- Refactorización a OCR Agéntico (TASK-21): Se eliminó el pipeline local basado en Python (PaddleOCR) y sus integraciones TypeScript, delegando la extracción directamente al agente OpenClaw.
- Cambio disruptivo: La herramienta `log_expense_from_image` fue renombrada a `log_expense_from_receipt` para aceptar datos estructurados en lugar de paths de imágenes locales.
- `src/index.ts` ya no llama `configurePythonCmd()` ni acepta `pluginConfig.pythonCmd`; la única configuración de runtime es `dbPath`.

## [0.1.0] - 2026-03-28
### Added
- Documentación inicial: producto, plan técnico, implementación, setup, versionamiento
- CLAUDE.md con reglas para agentes implementadores
- Estrategia de testing documentada (`docs/testing.md`)
- Documentación del SDK de OpenClaw (`docs/openclaw-sdk.md`): API real, contrato de tools, ciclo de vida, manifiesto
- Alineación de tools con API real de OpenClaw: `execute(_id, params) → { content: [{ type: "text", text }] }`
- Patrón de inyección de dependencia para testabilidad: `executeXxx(input, db?)`
- Manifiesto `openclaw.plugin.json` agregado al plan de implementación
