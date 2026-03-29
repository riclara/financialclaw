# Plantilla canónica para `docs/tasks/task-XX.md`

Usar esta plantilla cuando se cree una TASK nueva o se reescriba una existente.

Objetivo: reducir consumo de contexto sin perder detalle crítico ni empujar al agente a asumir reglas no documentadas.

Si al reescribir la TASK cambian `title`, `deps`, `detail_doc` o `files`, sincronizar también `docs/tasks/tasks.yaml` y ejecutar `python3 scripts/validate_task_manifest.py`.

---

## Principios

1. La TASK debe ser autocontenida para su objetivo puntual.
2. La TASK no debe repetir reglas globales ya definidas en `AGENTS.md` o `CLAUDE.md`, salvo que la tarea las refine o restrinja.
3. Todo comportamiento que no deba inferirse debe aparecer como contrato, invariante, caso borde o "No asumir".
4. No incluir "código completo" salvo cuando:
   - la implementación exacta sea el requisito
   - exista alto riesgo de divergencia
   - el agente deba portarlo casi verbatim
5. Si basta con una firma, query, algoritmo o fragmento corto, preferir eso sobre pegar archivos enteros.

---

## Estructura requerida

```md
# TASK-XX: Título corto

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Qué debe existir al terminar esta TASK y por qué importa dentro del flujo del producto.

## Archivos a crear o tocar

- `ruta/al/archivo-a.ts`
- `ruta/al/archivo-b.test.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-01
- TASK-07

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `AGENTS.md` — secciones: "Tools de OpenClaw", "Multi-moneda"
- `/ruta/al/proyecto/referencia.ts`
- `docs/openclaw-sdk.md`

## Contrato obligatorio

- Export esperado:
  - `export const InputSchema = ...`
  - `export function executeXxx(input, db = getDb()): string`
- Input:
  - `amount`: requerido, number, `> 0`
  - `currency`: opcional, ISO 4217
- Output:
  - texto en español
  - monto formateado con símbolo correcto
- Side effects:
  - INSERT en `expenses`
  - no registrar tool en este archivo; eso ocurre en `src/index.ts`

## Reglas / invariantes de negocio

- Si `currency` no llega, usar `resolveCurrency()`
- Nunca hardcodear `COP`
- Si la moneda default sigue siendo `XXX`, agregar sugerencia para `manage_currency`
- Si `due_date <= hoy`, el estado inicial es `PAID`
- Si `due_date > hoy`, el estado inicial es `PENDING`

## No asumir

- No asumir timezone distinta a la del proyecto
- No asumir que el usuario configuró moneda real
- No cambiar la lógica del port desde `sendafinanciera`
- No cambiar nombres ni tipos de parámetros existentes

## Casos borde

- ID inexistente => `Error` descriptivo en español
- Sin resultados => mensaje legible, no string vacío
- Re-ejecución => no duplicar registros si la tarea exige idempotencia

## Lógica de implementación

1. Validar input específico de la TASK.
2. Resolver dependencias compartidas.
3. Ejecutar las lecturas/escrituras mínimas necesarias.
4. Formatear salida final.

## Tests requeridos

- caso feliz
- caso de error
- caso borde
- archivo de test esperado: `tests/integration/nombre-del-tool.test.ts`

## Criterios de aceptación

- `npx tsc --noEmit` pasa
- tests relevantes pasan
- comportamiento observable cumple cada invariante anterior
```

---

## Guía de detalle: qué sí preservar

No condensar estos elementos:

- contratos de entrada y salida
- defaults
- side effects en BD
- invariantes de negocio
- dependencias reales
- reglas de idempotencia
- edge cases importantes
- restricciones de compatibilidad

Sí condensar cuando sea posible:

- boilerplate repetido
- explicación narrativa extensa
- imports obvios
- bloques largos de código si una firma o pseudocódigo preciso basta

---

## Heurística práctica

Si una frase empieza con "el agente debería entender que...", probablemente falta documentarla.

Si una decisión cambiaría el comportamiento del producto o del schema, no debe quedar implícita.
