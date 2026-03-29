# financialclaw — Guia de implementacion

Este documento ya no contiene el detalle completo de cada TASK.

Su funcion es servir como mapa de navegacion entre los documentos de implementacion para reducir duplicacion y consumo de contexto. El detalle canonico vive en `docs/tasks/task-XX.md`.

---

## Fuentes de verdad

Usar los documentos en este orden, segun el tipo de informacion que se necesite:

| Necesidad | Documento canonico | Nota |
|---|---|---|
| Reglas globales para agentes | `AGENTS.md` / `CLAUDE.md` | Convenciones, protocolo de trabajo, migraciones, testing, multi-moneda |
| Metadata estructurada de TASKs | `docs/tasks/tasks.yaml` | IDs, títulos, hitos, dependencias, archivos y detalle asociado |
| Estado de tareas y dependencias operativas | `docs/hitos.md` | Vista humana para saber qué está bloqueado, disponible o completo |
| Detalle de una tarea puntual | `docs/tasks/task-XX.md` | Archivos a crear, referencias, logica y criterios de aceptacion |
| Estructura recomendada para escribir TASKs | `docs/tasks/TEMPLATE.md` | Plantilla para mantener detalle critico sin duplicacion innecesaria |
| Estrategia de testing | `docs/testing.md` | Patrones, fixtures y helpers |
| SDK y wiring del plugin | `docs/openclaw-sdk.md` | Necesario para TASK-20 y cualquier duda del contrato OpenClaw |
| Contexto funcional y arquitectura | `docs/producto.md`, `docs/plan-tecnico.md` | Leer solo cuando haga falta contexto cruzado |
| Setup y troubleshooting | `docs/setup.md` | Instalacion y validacion del entorno |
| Versionado y migraciones | `docs/versionamiento.md` | Cambios de schema, compatibilidad y releases |

### Regla de precedencia

Si dos documentos parecen contradecirse:

1. `AGENTS.md` / `CLAUDE.md` mandan para reglas globales.
2. `docs/tasks/tasks.yaml` manda para metadata estructurada de TASKs.
3. `docs/hitos.md` manda para estado operativo visible y notas de seguimiento.
4. `docs/tasks/task-XX.md` manda para el detalle de implementacion de esa TASK.

Este archivo no debe volver a duplicar instrucciones completas de las TASK.

---

## Flujo recomendado para un agente

1. Leer `AGENTS.md`.
2. Leer `docs/hitos.md`.
3. Elegir una TASK cuyas dependencias esten en `DONE`.
4. Abrir solo `docs/tasks/task-XX.md` de esa TASK.
5. Si vas a revisar o cambiar metadata de TASKs, abrir `docs/tasks/tasks.yaml`.
6. Si aplica:
   - tools: releer la seccion "Tools de OpenClaw" en `AGENTS.md`
   - multi-moneda: releer la seccion "Multi-moneda" en `AGENTS.md`
   - testing: abrir `docs/testing.md`
   - wiring final: abrir `docs/openclaw-sdk.md`
7. Implementar y verificar.
8. Actualizar `docs/hitos.md`, `docs/bitacora.md` y `CHANGELOG.md` si corresponde.

---

## Catalogo de tareas

### Hito 1 — Fundacion

- [TASK-01](./tasks/task-01.md) — Inicializar proyecto

### Hito 2 — Persistencia

- [TASK-02](./tasks/task-02.md) — Base de datos SQLite

### Hito 3 — Pipeline OCR

- [TASK-03](./tasks/task-03.md) — Port de `ocr-classification.ts`
- [TASK-04](./tasks/task-04.md) — Port de `receipt-parser.ts`
- [TASK-05](./tasks/task-05.md) — CLI Python para PaddleOCR
- [TASK-06](./tasks/task-06.md) — Subprocess TypeScript para PaddleOCR

### Hito 4 — Helpers compartidos

- [TASK-07](./tasks/task-07.md) — `date-utils` + `currency-utils`

### Hito 5 — Tools core

- [TASK-08](./tasks/task-08.md) — `manage_currency`
- [TASK-09](./tasks/task-09.md) — `log_expense_manual`
- [TASK-10](./tasks/task-10.md) — `mark_expense_paid`
- [TASK-11](./tasks/task-11.md) — `log_income`
- [TASK-12](./tasks/task-12.md) — `log_income_receipt`
- [TASK-13](./tasks/task-13.md) — `add_recurring_expense`
- [TASK-14](./tasks/task-14.md) — `get_financial_summary`
- [TASK-15](./tasks/task-15.md) — `log_expense_from_image`

### Hito 6 — Tools de consulta

- [TASK-16](./tasks/task-16.md) — `list_expenses`
- [TASK-17](./tasks/task-17.md) — `list_incomes`

### Hito 7 — Automatizacion

- [TASK-18](./tasks/task-18.md) — `daily-sync`
- [TASK-19](./tasks/task-19.md) — `daily-reminder-runner`

### Hito 8 — Integracion final

- [TASK-20](./tasks/task-20.md) — `src/index.ts` (tools-only)

---

## Patrones compartidos

Los patrones compartidos ya no se repiten dentro de cada TASK. Revisarlos en:

- `AGENTS.md` para convenciones globales, multi-moneda, migraciones y contrato de tools
- `docs/testing.md` para estrategia de pruebas
- `docs/openclaw-sdk.md` para `definePluginEntry`, `api.registerTool()` y `api.registerService()`

## Plantilla de TASK

Cuando se cree o reescriba una TASK, usar [docs/tasks/TEMPLATE.md](./tasks/TEMPLATE.md).

La plantilla esta pensada para optimizar contexto sin perder detalle critico. En particular obliga a explicitar:

- contrato obligatorio
- reglas e invariantes de negocio
- "No asumir"
- casos borde
- tests requeridos

La regla practica es simple: comprimir boilerplate, no comprimir comportamiento.

## Manifiesto canónico

La metadata estable de las TASK vive en [docs/tasks/tasks.yaml](./tasks/tasks.yaml).

Ese manifiesto es canónico para:

- `id`
- `title`
- `hito`
- `deps`
- `detail_doc`
- `files`

`docs/hitos.md` sigue siendo la vista operativa para estado y notas de avance.

Para validar que no haya deriva entre el manifiesto, `docs/hitos.md` y los `task-XX.md`, ejecutar:

```bash
python3 scripts/validate_task_manifest.py
```

La implementacion usa un subconjunto compatible con JSON dentro de `tasks.yaml` para permitir validacion con la libreria estandar, sin agregar una dependencia de parsing YAML antes de TASK-01.

## Auditoría de plantilla

Para detectar qué `docs/tasks/task-XX.md` todavía no siguen la nueva plantilla y priorizar la migración, ejecutar:

```bash
python3 scripts/audit_task_template.py
```

El auditor clasifica las TASKs según:

- secciones canónicas faltantes
- uso de anti-patterns como `Código completo`
- uso de marcadores legacy como `**Archivo a crear**` y `**Depende de**`
- tamaño y superficie de la TASK

La recomendación es migrar primero la "primera ola" que reporta el script.

---

## Nota de mantenimiento

Cuando se agregue o cambie una TASK:

1. Actualizar primero `docs/tasks/tasks.yaml` si cambian ids, dependencias, archivos o detalle asociado.
2. Ejecutar `python3 scripts/validate_task_manifest.py`.
3. Sincronizar `docs/hitos.md`.
4. Crear o editar el archivo `docs/tasks/task-XX.md`.
5. Seguir `docs/tasks/TEMPLATE.md` para la estructura del detalle.
6. Ejecutar `python3 scripts/audit_task_template.py` si la TASK fue creada o migrada a la nueva plantilla.
7. Ajustar este indice solo si cambia la navegacion general.

Si una instruccion solo afecta a una TASK, no debe agregarse aqui.
