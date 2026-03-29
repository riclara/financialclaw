# financialclaw — Documento de producto

## Idea general

**financialclaw** es un plugin para OpenClaw que convierte tu canal de Telegram en un asistente de finanzas personales. La premisa es simple: interactúas en lenguaje natural o enviando fotos, y el plugin se encarga de registrar, organizar y recordarte lo que tu dinero está haciendo.

No es una app nueva que aprender. Vive donde ya estás: Telegram.

---

## Problema que resuelve

Llevar el control de gastos e ingresos personales exige disciplina y fricción: abrir una app, navegar a la sección correcta, ingresar datos manualmente. El resultado es que la mayoría abandona a los pocos días.

financialclaw reduce esa fricción al mínimo:
- Tomás una foto del recibo y la mandás al chat.
- Decís "cobré $3.000.000 de salario" y queda registrado.
- Decís "agrego el arriendo, $1.200.000 cada mes el 5" y el sistema lo recuerda.

---

## Funcionalidades

### 1. Registrar gastos a partir de una foto

El usuario envía una foto de un recibo o comprobante de pago por Telegram. El plugin:

1. Extrae el texto del recibo usando OCR (PaddleOCR).
2. Identifica automáticamente: monto total, fecha, nombre del comercio y categoría del gasto.
3. Confirma el registro en el chat con un resumen legible.
4. Guarda el gasto en la base de datos local.

El usuario puede corregir cualquier campo si el OCR no acertó.

**Categorías de gasto:**
`VIVIENDA`, `SERVICIOS`, `TRANSPORTE`, `SUPERMERCADO`, `SALUD`, `EDUCACIÓN`, `ENTRETENIMIENTO`, `RESTAURANTE`, `OTRO`

---

### 2. Registrar ingresos

El usuario informa un ingreso en lenguaje natural o con un comando estructurado:

- _"Recibí $3.500.000 de salario hoy"_
- _"Ingreso freelance $800.000, 25 de marzo"_

El plugin registra: monto, descripción, fecha y opcionalmente la frecuencia (si es un ingreso recurrente como un salario mensual).

---

### 3. Gastos y pagos recurrentes

El usuario puede registrar obligaciones fijas que se repiten:

- Arriendo: $1.500.000 el día 5 de cada mes.
- Gimnasio: $120.000 cada mes.
- Servicio de streaming: $45.900 cada 30 días.

El sistema guarda estas reglas y las usa para:
- **Recordatorios**: avisar por Telegram antes de que venza un pago.
- **Proyección**: calcular cuánto de los ingresos ya está comprometido en obligaciones fijas.

---

### 4. Resumen financiero (consulta)

El usuario puede pedir un resumen en cualquier momento:

- _"¿Cuánto he gastado este mes?"_
- _"¿Cómo voy en marzo?"_
- _"Muéstrame mis gastos por categoría"_

El plugin responde con un resumen del período: total de ingresos, total de gastos, balance, y desglose por categoría.

---

## Visión a futuro

### Recordatorios automáticos

El sistema detecta las reglas de gastos recurrentes y envía un mensaje de Telegram días antes del vencimiento:

> "El 5 te vence el arriendo ($1.500.000). Tu balance disponible actual es $2.100.000."

### Plan de aprovisionamiento financiero

Con el historial de gastos e ingresos, el sistema puede ayudar a distribuir activamente el dinero al momento de recibir un ingreso:

1. El usuario informa que recibió su sueldo.
2. El sistema calcula cuánto se necesita reservar para los compromisos fijos del mes.
3. Sugiere una distribución: obligaciones fijas, ahorro, gasto libre.

> "Recibiste $4.000.000. Tus compromisos fijos este mes suman $2.300.000. Te quedan $1.700.000 libres. ¿Querés que aparte algo para ahorro?"

### Metas de ahorro

Registrar objetivos financieros con un monto y fecha objetivo, y hacer seguimiento del progreso mes a mes.

### Análisis de tendencias

Comparar gastos por categoría entre meses para identificar patrones:
- "En restaurantes gastaste un 40% más que el mes pasado."
- "Tus servicios públicos subieron 3 meses seguidos."

---

## Principios de diseño

- **Fricción mínima**: una foto o una frase es suficiente para registrar algo.
- **Sin app nueva**: todo ocurre en Telegram, donde el usuario ya está.
- **Datos locales**: la información financiera se guarda en una base de datos local (SQLite), sin depender de servicios en la nube externos.
- **Extensible**: la arquitectura de plugin permite agregar nuevas capacidades sin romper lo existente.

---

## Stack técnico

| Componente | Tecnología |
|---|---|
| Canal de comunicación | Telegram (vía OpenClaw) |
| Plugin runtime | TypeScript / Node.js (ESM) |
| Framework de agente | OpenClaw |
| OCR | PaddleOCR (subprocess CLI, sin servidor) |
| Base de datos | SQLite embebida (`better-sqlite3`) |
| Parsing de recibos | Port de `sendafinanciera` (receipt-parser + ocr-classification) |
