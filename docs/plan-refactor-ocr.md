# Plan de Refactorización: Migración de OCR a Agente OpenClaw

## 1. Contexto y Motivación
Actualmente, el proyecto utiliza un pipeline de OCR local basado en Python (PaddleOCR) invocado a través de un subprocess en TypeScript. Esto introduce complejidad en la infraestructura, mayores tiempos de ejecución y problemas de compatibilidad (como la gestión de entornos virtuales y dependencias pesadas de Python). 

El objetivo de esta refactorización es delegar la extracción de texto y su estructuración (OCR y Parsing) a las capacidades multimodales nativas del agente OpenClaw. El agente analizará directamente las imágenes de recibos usando visión por computadora y pasará los datos ya parseados al backend de TypeScript, simplificando radicalmente la arquitectura y manteniendo intacta la capa de persistencia.

## 2. Nueva Arquitectura

- **Antes:** 
  Agente invoca `log_expense_from_image(image_path)` → TS ejecuta subprocess `paddle_ocr_cli.py` → TS parsea texto y clasifica → TS inserta `ocr_extractions` y `expenses`.
- **Después:**
  Agente procesa la imagen usando visión nativa → Agente extrae `amount`, `currency`, `date`, `merchant`, `category`, etc. → Agente invoca directamente un tool de persistencia pasándole los datos estructurados.

## 3. Impacto en Componentes

### 3.1 Pipeline Python y Binarios [A ELIMINAR]
- Se eliminará por completo `paddle_ocr_cli.py` y `requirements.txt`.

### 3.2 Lógica TypeScript de Parsing/Clasificación [A ELIMINAR]
- Se eliminará `src/ocr/ocr-classification.ts`, `src/ocr/receipt-parser.ts`, `src/ocr/paddle-ocr-subprocess.ts` y sus respectivos tests unitarios. Todo el directorio `src/ocr` será removido.

### 3.3 Tools Abiertas a OpenClaw [A REFACTORIZAR]
- La herramienta `log_expense_from_image` será modificada sustancialmente (o renombada, ej. a `log_expense_from_receipt_data`). En lugar de recibir una ruta de imagen y correr OCR, recibirá los campos extraídos por el agente (amount, raw_text, parsed_lines, merchant, category, date).
- Este tool se encargará de insertar en la base de datos de auditoría (`ocr_extractions`) y registrar el gasto en `expenses` con el origen correcto (source = "OCR"), para preservar el rastro que se tenía antes.

### 3.4 Persistencia y Base de Datos [MANTENER]
- **Las migraciones son idempotentes:** No se hará ningún `DROP TABLE` de `ocr_extractions`. Seguirá en la base de datos para no romper compatibilidad hacia atrás y preservar el registro de extracciones pasadas y futuras (enviadas ahora por el agente).

## 4. Evolución de las Tasks y Metadatos
En lugar de simplemente "borrar las tareas que se definieron antes", se documentará su refactorización explícitamente:
- Las tareas originales de OCR (`TASK-03`, `TASK-04`, `TASK-05`, `TASK-06`, `TASK-15`) serán actualizadas o refactorizadas en el historial. Por ejemplo, `TASK-15` ahora se transformará en la adaptación del tool para recibir datos estructurados desde el agente.
- En `docs/hitos.md`, se dejará claro el cambio de arquitectura bajo una nueva iteración.

## 5. Criterios de Éxito de la Refactorización
- Eliminación total de dependencias Python.
- Reducción sustancial del tamaño del código fuente manteniéndose el feature visual a través del agente.
- Pipeline de tests completo en verde (`npm run test:unit`, `npm run test:integration`) adaptado a los nuevos esquemas.
- Base de datos preservando esquemas.
