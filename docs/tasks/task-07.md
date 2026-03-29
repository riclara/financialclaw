# TASK-07: Helpers compartidos (date-utils + currency-utils)

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Centralizar utilidades de fechas y monedas que usarán la mayoría de tools. Esta TASK evita que cada tool reimplemente defaults, formato monetario o cálculo de próximas fechas.

## Archivos a crear o tocar

- `src/tools/helpers/date-utils.ts`
- `src/tools/helpers/currency-utils.ts`
- `tests/unit/date-utils.test.ts`
- `tests/unit/currency-utils.test.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-01
- TASK-02

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `AGENTS.md` — secciones "Multi-moneda" y "Testing"
- `docs/testing.md`
- `docs/hitos.md`

## Contrato obligatorio

### `src/tools/helpers/date-utils.ts`

Debe exportar al menos:

- `computeNextDate(date: string, frequency: string, intervalDays?: number): string`
- `todayISO(): string`

Si durante la implementación se extrae lógica común de rangos de período para TASK-14 o TASK-16, esa lógica debe vivir aquí, no duplicada dentro de cada tool.

### `src/tools/helpers/currency-utils.ts`

Debe exportar:

- `export const PLACEHOLDER_CURRENCY = "XXX"`
- `resolveCurrency(inputCode?: string, db = getDb()): CurrencyRow`
- `isPlaceholderCurrency(db = getDb()): boolean`
- `formatAmount(amount: number, currency: CurrencyRow): string`

Además debe definir un tipo o interfaz equivalente a:

- `CurrencyRow { code, name, symbol, is_default? }`

## Reglas / invariantes de negocio

- `resolveCurrency()`:
  - si llega código, lo valida contra la tabla `currencies`
  - si no llega código, retorna la moneda default
  - si el código no existe, lanza error descriptivo en español
- `PLACEHOLDER_CURRENCY` debe ser exactamente `XXX`.
- `isPlaceholderCurrency()` debe leer la moneda default actual, no recibirla por parámetro.
- `formatAmount()` debe incluir símbolo y código de moneda.
- `computeNextDate()` debe soportar:
  - `WEEKLY`
  - `BIWEEKLY`
  - `MONTHLY`
  - `INTERVAL_DAYS`
- `todayISO()` debe retornar `YYYY-MM-DD`.

## No asumir

- No hardcodear `COP` ni ninguna moneda real.
- No duplicar consultas de moneda dentro de cada tool si ya existe `resolveCurrency()`.
- No formatear montos sin símbolo.
- No acoplar helpers a un tool específico.
- No cambiar `XXX` por otro placeholder.

## Casos borde

- `resolveCurrency()` sin parámetro debe funcionar con el seed fresco y retornar `XXX`.
- `resolveCurrency("USD")` debe fallar si USD aún no fue agregada.
- `isPlaceholderCurrency()` debe pasar de `true` a `false` cuando el usuario cambie la moneda default.
- `INTERVAL_DAYS` debe usar `intervalDays`; si no llega, el caller debe validar antes o asumir `0` explícitamente.

## Lógica de implementación

1. En `date-utils.ts`, implementar helpers puros sin depender de BD.
2. En `currency-utils.ts`, depender de `getDb()` por defecto pero permitir DI con `db` explícita.
3. Mantener errores en español, orientados al usuario final.
4. Usar `toLocaleString("es-CO")` para el cuerpo numérico del monto formateado.

### Comportamiento esperado

- `computeNextDate("2026-03-01", "WEEKLY")` suma 7 días.
- `computeNextDate("2026-03-01", "BIWEEKLY")` suma 14 días.
- `computeNextDate("2026-03-01", "MONTHLY")` avanza al mismo día del mes siguiente.
- `formatAmount(54900, { code: "COP", symbol: "$", name: "Peso colombiano" })`
  retorna `"$54.900 COP"`.

## Tests requeridos

- `tests/unit/date-utils.test.ts`
  - caso feliz por frecuencia
  - caso borde de `INTERVAL_DAYS`
  - `todayISO()` retorna formato válido
- `tests/unit/currency-utils.test.ts`
  - caso feliz con seed `XXX`
  - error por moneda inexistente
  - transición `isPlaceholderCurrency()` de true a false
  - formato de monto correcto

## Criterios de aceptación

- Tests unitarios pasan.
- `resolveCurrency()` sin argumento retorna la moneda default.
- `isPlaceholderCurrency()` retorna `true` con la BD recién seedada.
- `formatAmount()` formatea con símbolo y código correctos.
- `npx tsc --noEmit` pasa cuando el resto del proyecto exista.
