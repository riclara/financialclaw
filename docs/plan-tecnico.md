# financialclaw — Plan técnico

## Arquitectura general

financialclaw es un **plugin nativo de OpenClaw** escrito en TypeScript/Node.js. No expone un servidor HTTP ni un endpoint MCP: se registra directamente en el runtime de OpenClaw mediante su sistema de extensiones.

```
OpenClaw runtime
└── financialclaw plugin
    ├── 10 tools (TypeBox schemas + handlers)
    ├── SQLite embebida (better-sqlite3) — 7 tablas
    ├── Entry point tools-only
    └── PaddleOCR subprocess (paddle_ocr_cli.py)

Runner externo (fuera del plugin)
└── daily reminder runner
    ├── ejecuta dailySync()
    └── entrega reminders via `openclaw message send`
```

---

## Stack

| Capa | Tecnología | Justificación |
|---|---|---|
| Runtime plugin | TypeScript + Node.js v24, ESM | Mismo stack que sendafinanciera backend; requerido por OpenClaw |
| Schema de tools | `@sinclair/typebox` | Requerido por la API de OpenClaw para `registerTool` |
| Base de datos | SQLite vía `better-sqlite3` | Embebida, sin servidor, sincrónica — ideal para plugin personal |
| OCR | PaddleOCR 3.x (Python) | Reutiliza modelos y lógica ya validada en sendafinanciera |
| Parsing de recibos | Port de sendafinanciera | `receipt-parser.ts` y `ocr-classification.ts` probados en producción |
| Canal de entrada | Telegram vía OpenClaw | OpenClaw ya gestiona el canal; el plugin no toca la API de Telegram |

---

## Estructura de directorios

```
financialclaw/
├── package.json                    # type:module, openclaw.extensions, deps
├── tsconfig.json                   # target ES2022, NodeNext modules
├── openclaw.plugin.json            # manifiesto del plugin (requerido por OpenClaw)
├── paddle_ocr_cli.py               # CLI Python: imagen → JSON por stdout
├── requirements.txt                # paddlepaddle, paddleocr, Pillow, numpy
├── docs/
│   ├── producto.md
│   ├── plan-tecnico.md             # este archivo
│   ├── openclaw-sdk.md             # API real de OpenClaw
│   ├── testing.md                  # estrategia de testing
│   ├── setup.md                    # instalación
│   ├── versionamiento.md           # migraciones, changelog
│   ├── hitos.md                    # estado de tareas, sincronización entre agentes
│   └── bitacora.md                 # bitácora de desarrollo
├── tests/
│   ├── helpers/
│   │   └── test-db.ts              # factory BD en memoria
│   ├── unit/                       # tests funciones puras
│   └── integration/                # tests tools contra SQLite :memory:
└── src/
    ├── index.ts                    # definePluginEntry → register(api)
    ├── db/
    │   ├── schema.ts               # strings CREATE TABLE IF NOT EXISTS
    │   └── database.ts             # getDb() lazy singleton + migrate
    ├── ocr/
    │   ├── paddle-ocr-subprocess.ts  # spawnSync → OcrResult
    │   ├── receipt-parser.ts         # port de sendafinanciera (verbatim)
    │   └── ocr-classification.ts     # port de sendafinanciera (verbatim)
    ├── services/
    │   ├── daily-sync.ts             # generación recurrentes + OVERDUE + reminders
    │   └── daily-reminder-runner.ts  # runner externo para delivery de reminders
    ├── bin/
    │   └── daily-reminder-runner.ts  # entry point CLI one-shot
    └── tools/
        ├── helpers/
        │   ├── date-utils.ts         # computeNextDate, getDateRange, todayISO
        │   └── currency-utils.ts     # resolveCurrency, formatAmount, isPlaceholderCurrency
        ├── manage-currency.ts
        ├── log-expense-from-image.ts
        ├── log-expense-manual.ts
        ├── log-income.ts
        ├── log-income-receipt.ts
        ├── add-recurring-expense.ts
        ├── mark-expense-paid.ts
        ├── get-financial-summary.ts
        ├── list-expenses.ts
        └── list-incomes.ts
```

---

## Integración con OpenClaw

OpenClaw carga el plugin a través de dos archivos:

1. `package.json` con `openclaw.extensions`:
```json
{
  "name": "financialclaw",
  "type": "module",
  "openclaw": { "extensions": ["./src/index.ts"] },
  "peerDependencies": { "openclaw": ">=2026.3.0" }
}
```

2. `openclaw.plugin.json` (manifiesto requerido): declara `id`, `configSchema` y `contracts` (lista de tools). Ver `docs/openclaw-sdk.md` para el detalle completo.

El entry point registra 10 tools y no registra services:

```typescript
// src/index.ts
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "financialclaw",
  name: "FinancialClaw",
  description: "Plugin de finanzas personales",
  register(api) {
    // Leer config: api.pluginConfig → env vars → defaults
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
    if (config.dbPath) configureDb(config.dbPath);
    if (config.pythonCmd) configurePythonCmd(config.pythonCmd);

    // 10 tools, sin background services
    api.registerTool({ name: "manage_currency", ... });
    api.registerTool({ name: "log_expense_from_image", ... });
    api.registerTool({ name: "log_expense_manual", ... });
    api.registerTool({ name: "log_income", ... });
    api.registerTool({ name: "log_income_receipt", ... });
    api.registerTool({ name: "add_recurring_expense", ... });
    api.registerTool({ name: "mark_expense_paid", ... });
    api.registerTool({ name: "get_financial_summary", ... });
    api.registerTool({ name: "list_expenses", ... });
    api.registerTool({ name: "list_incomes", ... });
  },
});
```

Cada tool expone `name`, `description`, `parameters` (TypeBox schema) y `execute(_id, params) → ToolResult`. El agente LLM de OpenClaw usa esos metadatos para decidir cuándo invocar cada tool. Ver `docs/openclaw-sdk.md` para la firma completa.

### Nota importante sobre reminders automáticos

El diseño de financialclaw mantiene los reminders automáticos como requisito de producto, pero **ya no** los modela como un service dentro del plugin. A la fecha de esta documentación:

- el contrato público confirmado de services es `api.registerService({ id, start, stop })`
- la SDK pública no documenta una capacidad general de mensajería proactiva para plugins de tools
- sí existe una interfaz pública outbound fuera del plugin: `openclaw message send`

Por eso, la automatización se rediseña así:

- `TASK-19` implementa un runner externo one-shot
- el runner ejecuta `dailySync()`
- luego entrega reminders vía `openclaw message send`
- si el runner recibe `accountId` internamente, lo mapea al flag público `--account`
- el scheduler periódico queda fuera del plugin (`cron`, `launchd`, `systemd`)

Esto evita depender de APIs privadas del runtime y desacopla el build del plugin (`TASK-20`) de la capa de delivery.

---

## Base de datos SQLite

Archivo local configurado via `FINANCIALCLAW_DB_PATH` (default: `./financialclaw.db`).

### Enums (alineados con sendafinanciera)

| Enum | Valores | Uso |
|---|---|---|
| `ExpenseCategory` | `HOUSING`, `SERVICES`, `TRANSPORT`, `SUPERMARKET`, `HEALTH`, `EDUCATION`, `ENTERTAINMENT`, `RESTAURANT`, `OTHER` | Categoría de gasto |
| `ExpenseStatus` | `PENDING`, `PAID`, `OVERDUE` | Estado de pago del gasto |
| `ExpenseSource` | `MANUAL`, `OCR` | Origen del registro |
| `OcrExtractionStatus` | `COMPLETED`, `FAILED` | Resultado del proceso OCR |
| `IncomeFrequency` | `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `INTERVAL_DAYS` | Frecuencia de recurrencia |

En SQLite estos valores se almacenan como `TEXT` con validación en la capa de aplicación.

### Tablas

#### `currencies` — Monedas registradas por el usuario

El usuario puede operar en múltiples monedas. Cada ingreso, gasto y pago debe tener una moneda explícita (no hay default implícito). La tabla sirve como catálogo de monedas habilitadas y define cuál es la moneda principal para los resúmenes.

```sql
CREATE TABLE IF NOT EXISTS currencies (
  code        TEXT PRIMARY KEY,        -- ISO 4217: COP, USD, EUR, etc.
  name        TEXT NOT NULL,           -- "Peso colombiano", "US Dollar"
  symbol      TEXT NOT NULL,           -- "$", "US$", "€"
  is_default  INTEGER NOT NULL DEFAULT 0,  -- 1 = moneda principal para resúmenes
  created_at  TEXT NOT NULL
);
```

Al inicializar la base de datos se inserta `XXX` ("Sin configurar") como moneda placeholder si la tabla está vacía:
```sql
INSERT OR IGNORE INTO currencies (code, name, symbol, is_default, created_at)
  VALUES ('XXX', 'Sin configurar', '¤', 1, datetime('now'));
```

**Reglas de negocio**:
- Solo una moneda puede tener `is_default = 1` a la vez
- Todas las tablas monetarias referencian `currencies(code)` como FK
- El resumen financiero agrupa por moneda; los totales solo se suman entre registros de la misma moneda

---

#### `ocr_extractions` — Resultado del proceso OCR

Tabla separada (como en sendafinanciera) para mantener trazabilidad del OCR independiente del gasto final. Un OCR puede fallar sin generar gasto, o el usuario puede corregir los valores sugeridos.

```sql
CREATE TABLE IF NOT EXISTS ocr_extractions (
  id                  TEXT PRIMARY KEY,
  status              TEXT NOT NULL DEFAULT 'COMPLETED',  -- COMPLETED | FAILED
  file_name           TEXT,
  raw_text            TEXT,
  suggested_amount    REAL,
  suggested_currency  TEXT,                               -- ISO 4217 inferido del recibo
  suggested_date      TEXT,                               -- YYYY-MM-DD
  suggested_merchant  TEXT,
  suggested_category  TEXT,                               -- ExpenseCategory
  confidence          REAL,                               -- 0.0 – 1.0
  provider            TEXT NOT NULL DEFAULT 'paddleocr',
  failure_code        TEXT,                               -- PROVIDER_ERROR | EMPTY_CONTENT | ...
  failure_message     TEXT,
  created_at          TEXT NOT NULL
);
```

Origen en sendafinanciera: `OcrExtraction` (Prisma). Simplificaciones: sin `userId`, sin `fileMimeType`/`fileSizeBytes`/`fileKey`/`storedFilePath` (no almacenamos el archivo original en esta versión).

---

#### `expenses` — Gastos registrados

```sql
CREATE TABLE IF NOT EXISTS expenses (
  id                  TEXT PRIMARY KEY,
  amount              REAL NOT NULL,
  currency            TEXT NOT NULL REFERENCES currencies(code),  -- ISO 4217, explícito
  category            TEXT NOT NULL DEFAULT 'OTHER',       -- ExpenseCategory
  merchant            TEXT,
  description         TEXT NOT NULL,
  due_date            TEXT NOT NULL,                        -- YYYY-MM-DD
  payment_date        TEXT,                                 -- YYYY-MM-DD, NULL si pendiente
  status              TEXT NOT NULL DEFAULT 'PENDING',      -- PENDING | PAID | OVERDUE
  source              TEXT NOT NULL DEFAULT 'MANUAL',       -- MANUAL | OCR
  ocr_extraction_id   TEXT REFERENCES ocr_extractions(id),
  recurring_rule_id   TEXT REFERENCES recurring_expense_rules(id),
  generated_from_rule INTEGER NOT NULL DEFAULT 0,
  reminder_days_before INTEGER,                             -- días antes de due_date para recordar
  is_active           INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_due_date ON expenses(due_date);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_rule_due ON expenses(recurring_rule_id, due_date)
  WHERE recurring_rule_id IS NOT NULL;
```

Cambios respecto al modelo anterior:
- `date` → `due_date` + `payment_date` (como sendafinanciera: distingue cuándo vence vs. cuándo se pagó)
- Agregado `status` (PENDING/PAID/OVERDUE) para ciclo de vida del gasto
- Agregado `source` (MANUAL/OCR) para saber cómo se creó
- `ocr_extraction_id` como FK a `ocr_extractions` en vez de `ocr_raw_text` inline
- Agregado `recurring_rule_id` + `generated_from_rule` para vincular gastos generados por reglas recurrentes
- Agregado `reminder_days_before` para futuros recordatorios
- Agregado `currency`, `is_active`, `updated_at`
- Índice único `(recurring_rule_id, due_date)` evita duplicar gastos de la misma regla

---

#### `incomes` — Definición de fuentes de ingreso

En sendafinanciera, ingreso se divide en dos: `Income` (la definición/fuente) e `IncomeReceipt` (cada recepción real). Adoptamos el mismo patrón.

```sql
CREATE TABLE IF NOT EXISTS incomes (
  id                          TEXT PRIMARY KEY,
  reason                      TEXT NOT NULL,                -- ej: "Salario", "Freelance"
  expected_amount             REAL NOT NULL,
  currency                    TEXT NOT NULL REFERENCES currencies(code),  -- ISO 4217, explícito
  recurring                   INTEGER NOT NULL DEFAULT 0,
  frequency                   TEXT,                         -- WEEKLY | BIWEEKLY | MONTHLY | INTERVAL_DAYS
  interval_days               INTEGER,                      -- requerido si frequency=INTERVAL_DAYS
  starts_on                   TEXT,                          -- YYYY-MM-DD
  ends_on                     TEXT,                          -- YYYY-MM-DD, NULL = indefinido
  next_expected_receipt_date  TEXT,                          -- YYYY-MM-DD, próxima fecha esperada
  is_active                   INTEGER NOT NULL DEFAULT 1,
  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL
);
```

---

#### `income_receipts` — Ingresos realmente recibidos

```sql
CREATE TABLE IF NOT EXISTS income_receipts (
  id              TEXT PRIMARY KEY,
  income_id       TEXT NOT NULL REFERENCES incomes(id),
  received_amount REAL NOT NULL,
  currency        TEXT NOT NULL REFERENCES currencies(code),  -- ISO 4217, explícito
  received_on     TEXT NOT NULL,      -- YYYY-MM-DD
  note            TEXT,
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_income_receipts_income ON income_receipts(income_id, received_on DESC);
```

Esto permite:
- Registrar que esperás $3.500.000 de salario mensual (en `incomes`)
- Registrar cada vez que realmente lo cobrás (en `income_receipts`), incluso si fue un monto diferente
- Calcular diferencias entre ingreso esperado y real

---

#### `recurring_expense_rules` — Reglas de gastos recurrentes

```sql
CREATE TABLE IF NOT EXISTS recurring_expense_rules (
  id                   TEXT PRIMARY KEY,
  amount               REAL NOT NULL,
  currency             TEXT NOT NULL REFERENCES currencies(code),  -- ISO 4217, explícito
  category             TEXT NOT NULL DEFAULT 'OTHER',       -- ExpenseCategory
  merchant             TEXT,
  description          TEXT NOT NULL,
  frequency            TEXT NOT NULL,                        -- WEEKLY | BIWEEKLY | MONTHLY | INTERVAL_DAYS
  interval_days        INTEGER,                              -- requerido si frequency=INTERVAL_DAYS
  starts_on            TEXT NOT NULL,                         -- YYYY-MM-DD
  ends_on              TEXT,                                  -- YYYY-MM-DD, NULL = indefinido
  reminder_days_before INTEGER,
  is_active            INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
```

Cambios respecto al modelo anterior:
- `name` → `description` (alineado con sendafinanciera)
- Agregado `merchant` para vincular la regla a un comercio
- Agregado `currency`, `ends_on`, `reminder_days_before`, `updated_at`
- Eliminado `day_of_month`: la fecha de vencimiento mensual se calcula a partir de `starts_on`

---

#### `reminders` — Recordatorios programados (para futuro)

Tabla preparada para la funcionalidad de recordatorios descrita en el roadmap.

```sql
CREATE TABLE IF NOT EXISTS reminders (
  id              TEXT PRIMARY KEY,
  expense_id      TEXT NOT NULL REFERENCES expenses(id),
  scheduled_date  TEXT NOT NULL,        -- YYYY-MM-DD
  days_before     INTEGER NOT NULL,
  sent            INTEGER NOT NULL DEFAULT 0,
  sent_at         TEXT,                  -- ISO 8601
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_unique
  ON reminders(expense_id, scheduled_date, days_before);
```

---

### Entidades de sendafinanciera NO incluidas (y por qué)

| Entidad | Razón de exclusión |
|---|---|
| `User`, `AuthRefreshSession` | Plugin single-user; autenticación la maneja OpenClaw |
| `FinancialProfile` | Configuración hardcoded/env vars por ahora (COP, America/Bogota) |
| `Account`, `AccountTransfer`, `AccountBalanceAdjustment` | Gestión de cuentas bancarias/efectivo queda fuera del MVP; se puede agregar después |
| `ExpensePaymentEvent` | Simplificado: el pago se marca directamente en `expenses.status`/`payment_date` |
| `PersonalLoan`, `PersonalLoanRepayment` | Préstamos personales no están en el alcance actual |
| `ReminderDispatchAttempt` | Canal único (Telegram vía OpenClaw); no necesitamos retry/audit multi-canal |

Estas entidades se pueden agregar incrementalmente si las funcionalidades lo requieren.

---

### Diagrama de relaciones

```
currencies ──1:N──→ expenses
           ──1:N──→ incomes
           ──1:N──→ income_receipts
           ──1:N──→ recurring_expense_rules
                       "toda operación monetaria referencia una moneda registrada"

incomes ──1:N──→ income_receipts
                     "cada recepción real de un ingreso"

ocr_extractions ──1:N──→ expenses
                             "el OCR genera el gasto"

recurring_expense_rules ──1:N──→ expenses
                                    "la regla genera gastos periódicos"

expenses ──1:N──→ reminders
                     "cada gasto puede tener recordatorios"
```

`database.ts` abre (o crea) el archivo, aplica `PRAGMA journal_mode = WAL` y ejecuta todos los `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` en una transacción al arrancar.

---

## OCR: PaddleOCR como subprocess

En lugar de un servidor HTTP, el plugin lanza `paddle_ocr_cli.py` como proceso hijo por cada imagen. Esto simplifica el deployment (sin Docker, sin puerto, sin warmup persistente) a costa de una latencia de ~5-10 s por arranque en frío del modelo.

### Contrato de `paddle_ocr_cli.py`

```bash
python3 paddle_ocr_cli.py /ruta/a/imagen.jpg
```

**stdout** (siempre un único objeto JSON):
```json
{
  "rawText": "SUPERMERCADO EXITO\nTOTAL $54.900\n16/03/2026",
  "lines": [
    { "text": "SUPERMERCADO EXITO", "confidence": 0.97 },
    { "text": "TOTAL $54.900",      "confidence": 0.94 },
    { "text": "16/03/2026",         "confidence": 0.98 }
  ],
  "averageConfidence": 0.963
}
```

**stderr**: logs de diagnóstico (descartados por el caller).
**Exit code**: `0` éxito · `1` error.

El script porta directamente las funciones `_create_paddle_ocr_engine()` y `_extract_lines()` de `sendafinanciera/paddle-ocr/app.py`, que ya normalizan el output entre PaddleOCR 2.x y 3.x y manejan el resize a `max_side=1600px`.

### Caller TypeScript (`paddle-ocr-subprocess.ts`)

```typescript
export function runPaddleOcr(imagePath: string): OcrResult {
  const result = spawnSync(PYTHON_CMD, [CLI_SCRIPT, imagePath], {
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr?.trim());
  return JSON.parse(result.stdout) as OcrResult;
}
```

`PYTHON_CMD` viene de `FINANCIALCLAW_PYTHON_CMD` (default: `python3`) para soportar virtualenvs.

---

## Parsing de recibos

Port casi verbatim de `sendafinanciera/backend/src/infrastructure/ocr/`:

| Archivo | Función exportada | Qué hace |
|---|---|---|
| `receipt-parser.ts` | `parseAmountFromReceiptText` | Extrae monto COP: busca etiquetas TOTAL/VALOR/VLR, cae a mayor número plausible |
| `receipt-parser.ts` | `parseDateFromReceiptText` | Detecta fechas ISO, LatAm (DD/MM/YYYY) y texto español ("16 mar 2026") |
| `receipt-parser.ts` | `parseMerchantFromReceiptText` | Primeras líneas del recibo, filtra ruido (NIT, FECHA, números) |
| `ocr-classification.ts` | `inferMerchantAndCategoryFromText` | Lookup por keywords → categoría hardcoded (SUPERMERCADO, RESTAURANTE, etc.) |
| `ocr-classification.ts` | `normalizeOcrText` | NFD + minúsculas para comparaciones |

El único ajuste al portear: definir `ExpenseCategory` localmente en `ocr-classification.ts` en lugar de importarla del dominio de sendafinanciera.

---

## Tools: detalle de implementación

**Convención multi-moneda**: todo tool que registra un monto acepta un parámetro `currency` (código ISO 4217). Si no se proporciona, se usa la moneda con `is_default = 1` de la tabla `currencies`. Si la moneda enviada no existe en `currencies`, se lanza error. El agente de OpenClaw debería preguntar la moneda al usuario cuando no sea obvia del contexto.

---

### `manage_currency`

Permite al usuario agregar monedas, listar las registradas, y cambiar la moneda default.

```
action   ('add' | 'list' | 'set_default', requerido)
code     (string, requerido para 'add' y 'set_default' — código ISO 4217)
name     (string, requerido para 'add' — nombre legible)
symbol   (string, requerido para 'add' — símbolo: "$", "US$", "€")
```

Flujo:
- `add`: INSERT en `currencies`. Si ya existe: error.
- `list`: SELECT todas las monedas. Retorna lista formateada.
- `set_default`: UPDATE `is_default = 0` en todas → UPDATE `is_default = 1` en la indicada. Si no existe: error.

---

### `log_expense_from_image`

Registra un gasto a partir de una foto de recibo. Crea primero un registro en `ocr_extractions` y luego el gasto en `expenses` vinculado.

```
image_path  (string, requerido)
currency    (string, opcional — código ISO 4217; default: moneda default del usuario)
description (string, opcional — override si OCR no es claro)
due_date    (string YYYY-MM-DD, opcional — override si OCR no detecta fecha)
```

Flujo:
1. `runPaddleOcr(image_path)` → `OcrResult`
2. Parsing:
   - `parseAmountFromReceiptText(rawText)` → `suggestedAmount | null`
   - `parseDateFromReceiptText(rawText)` → `suggestedDate | null`
   - `parseMerchantFromReceiptText(rawText)` → `suggestedMerchant | null`
   - `inferMerchantAndCategoryFromText(normalizeOcrText(rawText))` → `suggestedCategory`
3. INSERT en `ocr_extractions` con status `COMPLETED`, todos los valores sugeridos y confidence
4. Si `suggestedAmount === null` → INSERT en `ocr_extractions` con status `FAILED`, retorna error al usuario
5. INSERT en `expenses` con:
   - `source = 'OCR'`
   - `ocr_extraction_id` = id de la extracción
   - `status = 'PAID'` (si mandás foto del recibo, ya pagaste)
   - `payment_date = due_date`
   - merchant posicional tiene prioridad sobre el inferido por keywords
6. Retorna: `"Gasto registrado: $54.900 en Exito (SUPERMERCADO) — 16/03/2026"`

Si PaddleOCR falla (exit code ≠ 0): INSERT en `ocr_extractions` con status `FAILED` + `failure_code`/`failure_message`, retorna error legible.

---

### `log_expense_manual`

Registra un gasto sin foto, dictado en lenguaje natural. Tool separado del OCR para que el agente elija el correcto según el contexto.

```
amount      (number, requerido)
currency    (string, opcional — código ISO 4217; default: moneda default del usuario)
description (string, requerido)
category    (ExpenseCategory, opcional — default: 'OTHER')
merchant    (string, opcional)
due_date    (string YYYY-MM-DD, requerido)
is_paid     (boolean, opcional — default: true)
```

Flujo: INSERT en `expenses` con `source = 'MANUAL'`, status según `is_paid` → confirmación.

---

### `log_income`

Registra una fuente de ingreso (definición) y opcionalmente la primera recepción.

```
reason           (string, requerido — ej: "Salario", "Freelance")
expected_amount  (number, requerido)
currency         (string, opcional — código ISO 4217; default: moneda default del usuario)
date             (string YYYY-MM-DD, requerido — fecha de recepción o inicio)
recurring        (boolean, opcional — default: false)
frequency        (WEEKLY | BIWEEKLY | MONTHLY | INTERVAL_DAYS, requerido si recurring=true)
interval_days    (integer ≥1, requerido si frequency=INTERVAL_DAYS)
```

Flujo:
1. INSERT en `incomes` con `next_expected_receipt_date` calculada según frecuencia
2. INSERT en `income_receipts` con `received_amount = expected_amount`, `received_on = date`
3. Retorna: `"Ingreso registrado: $3.500.000 (Salario) — 28/03/2026. Próximo esperado: 28/04/2026"`

---

### `log_income_receipt`

Registra la recepción real de un ingreso ya definido. Útil para ingresos recurrentes donde el monto puede variar.

```
income_id       (string, requerido — o que el agente lo resuelva por nombre)
received_amount (number, requerido)
currency        (string, opcional — código ISO 4217; default: la moneda del income asociado)
received_on     (string YYYY-MM-DD, requerido)
note            (string, opcional)
```

Flujo:
1. Buscar el income por id (o que el agente resuelva por reason/nombre)
2. INSERT en `income_receipts`
3. Actualizar `next_expected_receipt_date` en `incomes` según frecuencia
4. Retorna confirmación con diferencia vs. monto esperado si aplica

---

### `add_recurring_expense`

Crea una regla de gasto recurrente.

```
description       (string, requerido — ej: "Arriendo", "Netflix")
amount            (number, requerido)
currency          (string, opcional — código ISO 4217; default: moneda default del usuario)
category          (ExpenseCategory, opcional — default: 'OTHER')
merchant          (string, opcional)
frequency         (WEEKLY | BIWEEKLY | MONTHLY | INTERVAL_DAYS, requerido)
interval_days     (integer ≥1, requerido si frequency=INTERVAL_DAYS)
starts_on         (string YYYY-MM-DD, requerido)
ends_on           (string YYYY-MM-DD, opcional)
reminder_days_before (integer, opcional — días antes para recordar)
```

Flujo:
1. Validar combinación frequency/interval_days
2. INSERT en `recurring_expense_rules`
3. Generar el primer `expense` con status `PENDING`, `recurring_rule_id` y `generated_from_rule = 1`
4. Si `reminder_days_before` definido, crear `reminder` asociado al expense
5. Retorna: `"Regla creada: Arriendo $1.500.000 mensual desde 05/04/2026. Recordatorio 3 días antes."`

---

### `mark_expense_paid`

Marca un gasto pendiente como pagado. Útil para gastos recurrentes generados automáticamente.

```
expense_id    (string, requerido — o que el agente lo resuelva por contexto)
payment_date  (string YYYY-MM-DD, opcional — default: hoy)
```

Flujo: UPDATE `expenses` SET `status = 'PAID'`, `payment_date`, `updated_at` → confirmación.

---

### `get_financial_summary`

Resumen financiero del período consultado.

```
period   ('this_month' | 'last_month' | 'last_30_days' | 'this_year', default: 'this_month')
currency (string, opcional — código ISO 4217; si no se envía, muestra resumen por cada moneda)
```

Flujo:
1. Calcular rango de fechas ISO según `period`
2. Gastos: `SELECT currency, SUM(amount) as total, category FROM expenses WHERE due_date BETWEEN ... GROUP BY currency, category`
3. Gastos pendientes: `SELECT currency, SUM(amount) as total FROM expenses WHERE status = 'PENDING' AND due_date BETWEEN ... GROUP BY currency`
4. Ingresos recibidos: `SELECT currency, SUM(received_amount) as total FROM income_receipts WHERE received_on BETWEEN ... GROUP BY currency`
5. Compromisos fijos: `SELECT * FROM recurring_expense_rules WHERE is_active = 1`
6. Si se envió `currency`: filtrar solo esa moneda. Si no: mostrar todas, agrupadas.
7. Retorna texto formateado:

```
Período: marzo 2026

── COP ──
Ingresos recibidos:  $4.000.000
Gastos totales:      $1.820.000
Gastos pendientes:   $1.500.000
Balance recibido:    $2.180.000

Por categoría:
  SUPERMERCADO     $450.000
  RESTAURANTE      $380.000
  TRANSPORTE       $320.000
  SERVICIOS        $280.000
  OTRO             $390.000

── USD ──
Ingresos recibidos:  US$800
Gastos totales:      US$250
Balance recibido:    US$550

Compromisos fijos activos: 3 ($2.300.000 COP/mes)
```

El símbolo de cada moneda se obtiene de `currencies.symbol`.

---

## Configuración

La configuración se lee con esta prioridad: `api.pluginConfig` (config de OpenClaw) → variables de entorno → defaults.

| Variable de entorno | Config OpenClaw | Default | Uso |
|---|---|---|---|
| `FINANCIALCLAW_DB_PATH` | `dbPath` | `./financialclaw.db` | Ruta del archivo SQLite |
| `FINANCIALCLAW_PYTHON_CMD` | `pythonCmd` | `python3` | Intérprete Python con paddleocr instalado |
| `FINANCIALCLAW_REMINDER_TARGET` | — | `undefined` | Destino explícito del runner externo; obligatorio para TASK-19 |
| `FINANCIALCLAW_REMINDER_CHANNEL` | — | `"telegram"` | Canal usado por `openclaw message send` |
| `FINANCIALCLAW_REMINDER_ACCOUNT_ID` | — | `undefined` | Cuenta explícita si hay varias cuentas Telegram |
| `FINANCIALCLAW_OPENCLAW_CMD` | — | `"openclaw"` | Binario/alias del CLI de OpenClaw para el runner externo |

### Reminder target explícito

financialclaw sigue asumiendo una sola persona usuaria por instancia, pero **no** infiere el chat destino desde “último chat activo”.

La regla es:

- el destino de reminders del runner se configura explícitamente en `FINANCIALCLAW_REMINDER_TARGET` o `--target`
- si falta `target`, la ejecución del runner debe fallar de forma descriptiva
- no existe fallback por actividad reciente del usuario

---

## Dependencias

**`package.json`**
```json
{
  "dependencies": {
    "@sinclair/typebox": "^0.34.0",
    "better-sqlite3": "^12.8.0"
  },
  "peerDependencies": {
    "openclaw": ">=2026.3.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^22.0.0",
    "openclaw": "^2026.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
```

**`requirements.txt`** (Python)
```
paddlepaddle==3.3.0
paddleocr==3.4.0
Pillow==10.3.0
numpy>=1.26,<3
```

---

## Secuencia de implementación

**Fase 1 — Infraestructura**
1. `package.json` + `tsconfig.json` + `openclaw.plugin.json` + `.gitignore`
2. `src/db/schema.ts` + `src/db/database.ts` (7 tablas + índices) + `tests/helpers/test-db.ts`

**Fase 2 — OCR**
3. Port `src/ocr/ocr-classification.ts` desde sendafinanciera
4. Port `src/ocr/receipt-parser.ts` desde sendafinanciera
5. `paddle_ocr_cli.py` + `requirements.txt`
6. `src/ocr/paddle-ocr-subprocess.ts`

**Fase 3 — Tools y servicios (de más simple a más complejo)**
7. `src/tools/helpers/date-utils.ts` + `src/tools/helpers/currency-utils.ts`
8. `src/tools/manage-currency.ts` (CRUD monedas — base para los demás)
9. `src/tools/log-expense-manual.ts` (el más simple, sin OCR)
10. `src/tools/mark-expense-paid.ts` (UPDATE simple)
11. `src/tools/log-income.ts` (INSERT en 2 tablas)
12. `src/tools/log-income-receipt.ts` (INSERT + UPDATE)
13. `src/tools/add-recurring-expense.ts` (INSERT + genera primer expense + reminder)
14. `src/tools/get-financial-summary.ts` (queries de agregación multi-moneda)
15. `src/tools/log-expense-from-image.ts` (depende de OCR + parsers + ocr_extractions)
16. `src/tools/list-expenses.ts` (búsqueda y filtrado de gastos)
17. `src/tools/list-incomes.ts` (búsqueda y filtrado de ingresos)
18. `src/services/daily-sync.ts` (generación recurrentes + OVERDUE + reminders)
19. `src/services/daily-reminder-runner.ts` + `src/bin/daily-reminder-runner.ts` (runner externo de reminders)

**Fase 4 — Wiring**
20. `src/index.ts` — registro de los 10 tools (sin background service)

Ver `docs/hitos.md` para el estado y dependencias de cada tarea, y `docs/tasks/task-XX.md` para el detalle completo de implementacion.

---

## Verificación

| Paso | Cómo verificar |
|---|---|
| OCR standalone | `python3 paddle_ocr_cli.py foto_recibo.jpg` → JSON válido en stdout |
| Tablas SQLite | Script Node que importe `database.ts` → debe crear 7 tablas + índices |
| Gasto por foto | Enviar foto por Telegram → verificar fila en `expenses` (source=OCR) + `ocr_extractions` |
| Gasto manual | Decir "Gasté $25.000 en taxi" → verificar fila en `expenses` (source=MANUAL) |
| Marcar pagado | Marcar un gasto pendiente → verificar `status=PAID`, `payment_date` actualizado |
| Ingreso | Decir "Cobré $3.500.000 de salario" → verificar fila en `incomes` + `income_receipts` |
| Recepción ingreso | "Recibí el salario de abril" → verificar nueva fila en `income_receipts` + `next_expected_receipt_date` actualizado |
| Regla recurrente | Agregar arriendo → verificar fila en `recurring_expense_rules` + primer expense PENDING generado |
| Resumen | "¿Cómo voy este mes?" → verificar que el resumen refleje gastos, ingresos recibidos, pendientes y reglas activas |
| Listar gastos | "Muéstrame los gastos de esta semana" → verificar lista con IDs, montos, categorías |
| Listar ingresos | "Cuáles son mis ingresos" → verificar lista con IDs y próximas fechas |
| Daily sync / runner externo | Ejecutar el runner one-shot → verificar que `dailySync()` corre, que los reminders se entregan vía `openclaw message send` y que solo los exitosos quedan con `sent=1` |

---

## Consideraciones y limitaciones conocidas

- **Latencia OCR en frío**: cada invocación lanza un nuevo proceso Python que carga el modelo (~5-10 s). Para uso personal en Telegram esto es aceptable. Si se vuelve un problema, se puede mantener un proceso Python caliente con IPC stdin/stdout.
- **`spawnSync` bloquea el event loop**: durante el OCR el hilo Node queda bloqueado. Si OpenClaw corre tools en paralelo podría ser un problema; la solución es migrar a `spawn` con un wrapper `Promise`.
- **Parsing COP**: `receipt-parser.ts` está optimizado para recibos colombianos (`.` como separador de miles). Para recibos en otros formatos el heurístico de "mayor número plausible" sigue funcionando pero con menos precisión.
- **Sin usuario múltiple**: la BD no tiene columna `userId`. Este plugin asume un solo usuario por instancia de OpenClaw.
