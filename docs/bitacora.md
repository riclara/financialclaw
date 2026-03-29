# financialclaw — Bitácora de desarrollo

Este archivo es un registro vivo del proceso de construcción de financialclaw. Tiene dos propósitos:

1. **Framework de vibe coding**: documentar la experiencia de desarrollo con agentes IA para extraer mejores prácticas, procesos y preguntas clave que sirvan como guía replicable para otros proyectos.
2. **Historia del producto**: narrar la evolución de financialclaw como herramienta, sus decisiones de diseño y el valor que aporta.

---

## Convenciones de la bitácora

- Cada entrada lleva fecha, TASK asociada (si aplica), y autor (humano o agente).
- Ser honesto: registrar lo que salió mal es más valioso que lo que salió bien.
- Priorizar el **por qué** sobre el **qué**. El código ya dice qué se hizo; la bitácora explica por qué.
- No repetir lo que ya está en commits o en la documentación técnica.

---

## Parte 1: Proceso de desarrollo (vibe coding)

> Lecciones sobre cómo construir software con agentes IA. Cada entrada responde: ¿qué descubrimos sobre el proceso?

### 2026-03-29 — TASK-21: Refactorización a OCR Agéntico completada exitosamente
- Autor: agente
- Contexto: implementación de TASK-21 para reemplazar el pipeline OCR basado en Python con integración directa al agente OpenClaw.
- Qué pasó: se eliminaron completamente las dependencias Python (paddle_ocr_cli.py, requirements.txt, directorio src/ocr y tests asociados). Se creó un nuevo tool `log_expense_from_receipt` que recibe datos estructurados directamente del agente OpenClaw (amount, date, merchant, category, etc.) y los persiste en las tablas `ocr_extractions` y `expenses`. Se actualizó el entry point en src/index.ts para registrar el nuevo tool y eliminar el obsoleto `log_expense_from_image`. Se escribieron tests de integración completos que verifican el caso feliz y diversos casos de error.
- Por qué importa: esta refactorización simplifica radicalmente la arquitectura al eliminar la complejidad de los subprocesses Python y las dependencias pesadas, manteniendo intacta la capa de persistencia para compatibilidad histórica. El agente OpenClaw ahora maneja directamente la visión por computadora y el parsing, mientras que financialclaw se enfoca en la lógica de negocio y almacenamiento.
- Pregunta clave: *"¿cómo podemos asegurar que la transición a capacidades agénticas mantenga o mejore la experiencia del usuario mientras reduce la deuda técnica?"*