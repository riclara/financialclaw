# TASK-08: Tool — manage_currency

> Volver al [índice de hitos](../hitos.md)

## Objetivo

Permitir que el agente LLM agregue monedas, las liste y cambie la moneda default del usuario. Este tool es la base del flujo multi-moneda del proyecto y elimina la dependencia de una moneda hardcodeada.

## Archivos a crear o tocar

- `src/tools/manage-currency.ts`
- `tests/integration/manage-currency.test.ts`

Estos archivos deben coincidir con `docs/tasks/tasks.yaml`.

## Dependencias

- TASK-02
- TASK-07

Estas dependencias deben coincidir con `docs/tasks/tasks.yaml`.

## Referencias obligatorias

- `AGENTS.md` — secciones "Multi-moneda" y "Tools de OpenClaw"
- `docs/openclaw-sdk.md`
- `src/db/database.ts`

## Contrato obligatorio

- Exportar:
  - `InputSchema`
  - `executeManageCurrency(input, db = getDb()): string`
- Acciones soportadas:
  - `add`
  - `list`
  - `set_default`
- Input esperado:
  - `action`: requerido
  - `code?`
  - `name?`
  - `symbol?`
- No exportar objeto tool; el registro va en `src/index.ts`.

## Reglas / invariantes de negocio

- `add` requiere `code`, `name` y `symbol`.
- `code` siempre se persiste en mayúsculas.
- No se puede registrar una moneda duplicada.
- `list` debe mostrar la moneda default primero y marcarla visualmente.
- `set_default` debe:
  - fallar si la moneda no existe
  - apagar cualquier `is_default = 1` previo
  - dejar exactamente una moneda como default
- La moneda seed `XXX` debe aparecer mientras no se reemplace por otra default.

## No asumir

- No hardcodear `COP` ni otro código.
- No permitir múltiples monedas default simultáneas.
- No borrar la moneda previa al cambiar default; solo cambiar flags.
- No ocultar la moneda placeholder `XXX` en `list`.
- No mezclar registro del tool con la lógica del tool.

## Casos borde

- `add` con `code = XXX`:
  - debe fallar porque ya existe por seed
- `set_default` con moneda inexistente:
  - error descriptivo
- `list` con solo la moneda placeholder:
  - mostrarla como default
- `list` sin filas:
  - mensaje legible, no string vacío

## Lógica de implementación

1. Definir `InputSchema` con TypeBox.
2. Implementar switch por `action`.
3. `add`:
   - validar campos requeridos
   - normalizar `code`
   - comprobar duplicados
   - insertar con `is_default = 0`
4. `list`:
   - consultar `currencies`
   - ordenar default primero
   - formatear salida legible
5. `set_default`:
   - validar `code`
   - verificar existencia
   - ejecutar transacción con dos updates

## Tests requeridos

- `add` exitoso
- error por duplicado
- `list` con placeholder y monedas adicionales
- `set_default` exitoso
- error por `set_default` con código inexistente

## Criterios de aceptación

- Tests de integración pasan.
- Agregar moneda persiste en BD.
- `set_default` cambia correctamente `is_default`.
- Moneda duplicada lanza error.
