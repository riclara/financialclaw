# financialclaw — Estrategia de testing

## Framework y herramientas

| Herramienta | Rol | Justificación |
|---|---|---|
| **Node.js test runner** (`node --test`) | Framework de testing | Built-in desde Node 22, cero dependencias, mismo enfoque que sendafinanciera |
| **tsx** | Ejecutor TypeScript | Ejecuta `.test.ts` sin compilar previamente |
| **assert** (node:assert/strict) | Aserciones | Built-in, suficiente para este proyecto |
| **better-sqlite3** `:memory:` | BD de test | SQLite en memoria, aislamiento total entre tests, sin cleanup |

### Script de ejecución

```bash
# Todos los tests
tsx --test tests/**/*.test.ts

# Solo unit tests
tsx --test tests/unit/**/*.test.ts

# Solo integration tests
tsx --test tests/integration/**/*.test.ts
```

---

## Estructura de directorios

```
tests/
├── unit/
│   ├── receipt-parser.test.ts
│   ├── ocr-classification.test.ts
│   ├── date-utils.test.ts
│   └── currency-utils.test.ts
├── integration/
│   ├── manage-currency.test.ts
│   ├── log-expense-manual.test.ts
│   ├── mark-expense-paid.test.ts
│   ├── log-income.test.ts
│   ├── log-income-receipt.test.ts
│   ├── add-recurring-expense.test.ts
│   ├── get-financial-summary.test.ts
│   ├── log-expense-from-image.test.ts
│   ├── list-expenses.test.ts
│   ├── list-incomes.test.ts
│   ├── daily-sync.test.ts
│   ├── daily-reminder-runner.test.ts
│   └── plugin-entry.test.ts
└── helpers/
    └── test-db.ts            # Factory de BD en memoria para tests
```

---

## Categorías de tests

### 1. Unit tests (obligatorios)

Prueban funciones puras sin I/O. No requieren base de datos ni PaddleOCR.

| Módulo | Qué probar | Ejemplos |
|---|---|---|
| `receipt-parser.ts` | Parsing de montos, fechas, merchant desde texto OCR | Texto con "$54.900" → 54900, "16/03/2026" → "2026-03-16", "SUPERMERCADO EXITO" → merchant |
| `ocr-classification.ts` | Inferencia de categoría por keywords | "EXITO" → SUPERMARKET, "UBER" → TRANSPORT, texto sin match → OTHER |
| `date-utils.ts` | Resolución de períodos a rangos de fecha | `this_month` → {start, end} correctos, `last_30_days`, `this_year` |
| `currency-utils.ts` | `resolveCurrency()` y `formatAmount()` | Moneda explícita, moneda default, moneda no registrada → Error, formato con símbolo |

**Regla**: toda función exportada de estos módulos debe tener al menos un test de caso feliz y un test de caso de error/borde.

### 2. Integration tests (obligatorios)

Prueban cada tool contra una base de datos SQLite en memoria. Verifican que el tool inserta/lee datos correctamente.

| Tool | Qué probar |
|---|---|
| `manage_currency` | Agregar moneda, listar, cambiar default, agregar duplicada → error |
| `log_expense_manual` | Insertar gasto con moneda explícita, con moneda default, sin moneda default → error |
| `mark_expense_paid` | Marcar gasto existente como PAID, ID inexistente → error |
| `log_income` | Insertar ingreso, verificar campos en BD |
| `log_income_receipt` | Insertar recibo de ingreso vinculado a income |
| `add_recurring_expense` | Insertar regla, validar que INTERVAL_DAYS requiere interval_days; para MONTHLY el día ancla a starts_on sin day_of_month |
| `get_financial_summary` | Con datos: sumas correctas por categoría. Sin datos: resumen vacío |
| `log_expense_from_image` | Con mock de OCR subprocess: verificar que parsea y persiste |
| `list_expenses` | Con datos: filtros por categoría, status, search, paginación. Sin datos: mensaje vacío |
| `list_incomes` | Con datos: filtros por recurrente, search, include_receipts. Sin datos: mensaje vacío |
| `daily-sync` | Generación de recurrentes (normal, gap de meses, ends_on, inactiva), idempotencia, PENDING→OVERDUE, reminders pendientes |
| `daily-reminder-runner` | Mock del sender CLI, verificar marcado de `sent=1`, fallos parciales, resumen final y resolución de config |
| `plugin-entry` | Registro de los 10 tools, aplicación de config compartida y ausencia de `registerService()` |

### 3. E2E OCR tests (opcionales, solo local)

Requieren PaddleOCR instalado (virtualenv + modelos). No corren en CI.

| Qué probar | Cómo |
|---|---|
| `paddle_ocr_cli.py` con imagen real | `python3 paddle_ocr_cli.py tests/fixtures/recibo.jpg` → JSON válido |
| Pipeline completo: imagen → OCR → parse → DB | Ejecutar `log_expense_from_image` con imagen real, verificar registro |

Se marcan con un prefijo en el nombre del test o se colocan en un directorio separado (`tests/e2e/`) para poder excluirlos fácilmente.

---

## Helper: base de datos de test (`tests/helpers/test-db.ts`)

Cada test de integración usa una BD en memoria aislada. Esto evita conflictos entre tests y no requiere cleanup.

```typescript
// tests/helpers/test-db.ts
import Database from "better-sqlite3";
import { ALL_MIGRATIONS, ALL_SEEDS } from "../../src/db/schema.js";

export function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  for (const sql of ALL_MIGRATIONS) {
    db.exec(sql);
  }

  for (const sql of ALL_SEEDS) {
    db.exec(sql);
  }

  return db;
}
```

### Inyección de dependencia para tests

Los tools usan el singleton de `database.ts` en producción. Para tests, cada tool debe aceptar una instancia de BD inyectada opcionalmente:

```typescript
// Patrón en cada tool:
import { getDb } from "../db/database.js";

export function executeLogExpenseManual(input: Input, db = getDb()) {
  // usa `db` en vez del singleton directo
}

export const logExpenseManualTool = {
  name: "log_expense_manual",
  // ...
  execute: (input: Input) => executeLogExpenseManual(input),
};
```

De esta forma, el test puede pasar `createTestDb()` directamente:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "../helpers/test-db.js";
import { executeLogExpenseManual } from "../../src/tools/log-expense-manual.js";

describe("log_expense_manual", () => {
  it("inserta un gasto con moneda default y marcado como pagado", () => {
    const db = createTestDb();
    const result = executeLogExpenseManual({
      amount: 54900,
      description: "Almuerzo",
      category: "RESTAURANT",
      due_date: "2026-03-28",
    }, db);

    assert.ok(result.includes("54.900"));

    const row = db.prepare("SELECT * FROM expenses").get() as any;
    assert.equal(row.amount, 54900);
    assert.equal(row.currency, "XXX"); // moneda placeholder del seed
    assert.equal(row.status, "PAID");
  });
});
```

El mismo patrón aplica para `currency-utils.ts`: las funciones `resolveCurrency()` y `formatAmount()` deben aceptar un `db` opcional.

---

## Mock del subprocess OCR

Para tests de integración de `log_expense_from_image`, no se invoca PaddleOCR real. Se mockea `runPaddleOcr`:

```typescript
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "../helpers/test-db.js";

describe("log_expense_from_image", () => {
  it("parsea recibo y registra gasto", async () => {
    // Mock del módulo OCR
    const ocrModule = await import("../../src/ocr/paddle-ocr-subprocess.js");
    mock.method(ocrModule, "runPaddleOcr", () => ({
      rawText: "SUPERMERCADO EXITO\nTOTAL $54.900\n16/03/2026",
      lines: [
        { text: "SUPERMERCADO EXITO", confidence: 0.98 },
        { text: "TOTAL $54.900", confidence: 0.95 },
        { text: "16/03/2026", confidence: 0.97 },
      ],
      averageConfidence: 0.96,
    }));

    const db = createTestDb();
    const { executeLogExpenseFromImage } = await import(
      "../../src/tools/log-expense-from-image.js"
    );

    const result = executeLogExpenseFromImage(
      { image_path: "/fake/recibo.jpg" },
      db,
    );

    assert.ok(result.includes("54.900"));
    const row = db.prepare("SELECT * FROM expenses").get() as any;
    assert.equal(row.amount, 54900);
    assert.equal(row.merchant, "EXITO");
  });
});
```

---

## Fixtures

```
tests/fixtures/
├── recibo-exito.jpg          # Foto real de recibo (solo para e2e, no versionar si pesa mucho)
└── ocr-samples/
    ├── supermercado.json      # Output JSON de PaddleOCR para mock
    ├── restaurante.json
    ├── transporte.json
    └── sin-total.json         # Caso sin monto detectable
```

Los archivos `.json` en `ocr-samples/` son outputs reales capturados de PaddleOCR para usar como fixtures en unit tests del parser.

---

## Qué debe pasar antes de considerar una tarea completa

| Check | Comando | Obligatorio |
|---|---|---|
| TypeScript compila | `npx tsc --noEmit` | Si |
| Unit tests pasan | `tsx --test tests/unit/**/*.test.ts` | Si |
| Integration tests pasan | `tsx --test tests/integration/**/*.test.ts` | Si |
| E2E OCR (si aplica) | `tsx --test tests/e2e/**/*.test.ts` | No (requiere PaddleOCR) |

---

## Reglas para escribir tests

1. **Un archivo de test por módulo**. `receipt-parser.ts` → `receipt-parser.test.ts`.
2. **Nombres descriptivos en español**. `it("retorna OTHER si no hay keywords que coincidan")`.
3. **Cada test es independiente**. No compartir estado entre tests. Cada integration test crea su propia BD en memoria.
4. **No testear implementación interna**. Testear inputs → outputs y efectos observables (filas en BD).
5. **Cubrir al menos**: caso feliz, caso de error esperado, caso borde (e.g., texto vacío, monto cero, fecha inválida).
6. **No mockear lo que se puede usar real**. SQLite en memoria es rápido — usarlo directamente, no mockearlo.
7. **Mock solo lo necesario**: subprocess de PaddleOCR (lento, requiere instalación), nada más.

---

## Dependencias de dev adicionales

Agregar a `package.json` en `devDependencies`:

```json
{
  "tsx": "^4.19.0"
}
```

Y el script de test:

```json
{
  "scripts": {
    "test": "tsx --test tests/**/*.test.ts",
    "test:unit": "tsx --test tests/unit/**/*.test.ts",
    "test:integration": "tsx --test tests/integration/**/*.test.ts"
  }
}
```

---

## Cuándo escribir los tests

Los tests se implementan junto con cada módulo, no después. La tarea de implementación de cada módulo incluye escribir sus tests correspondientes:

| Tarea de implementación | Tests a escribir |
|---|---|
| TASK-03 (ocr-classification) | `tests/unit/ocr-classification.test.ts` |
| TASK-04 (receipt-parser) | `tests/unit/receipt-parser.test.ts` |
| TASK-07 (helpers) | `tests/unit/date-utils.test.ts` + `tests/unit/currency-utils.test.ts` |
| TASK-08 a TASK-17 (tools) | `tests/integration/<tool-name>.test.ts` correspondiente |
| TASK-18 (daily-sync) | `tests/integration/daily-sync.test.ts` |
| TASK-19 (daily-reminder-runner) | `tests/integration/daily-reminder-runner.test.ts` |
| TASK-20 (plugin-entry) | `tests/integration/plugin-entry.test.ts` |

La tarea TASK-02 (database) incluye escribir `tests/helpers/test-db.ts`.
