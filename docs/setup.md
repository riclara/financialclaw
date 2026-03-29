# financialclaw — Instalación y configuración

Esta guía cubre todo lo necesario para tener el plugin funcionando desde cero: dependencias del sistema, entorno Python, dependencias Node, variables de entorno, registro en OpenClaw y ejecución del runner externo de reminders.

---

## Prerrequisitos del sistema

| Requisito | Versión mínima | Cómo verificar |
|---|---|---|
| Node.js | 22.14+ (recomendado: 24) | `node --version` |
| Python | 3.12+ | `python3 --version` |
| pip | cualquier reciente | `pip3 --version` |
| OpenClaw CLI | instalado y configurado | `openclaw --version` |

Si no tenés Python 3.12+:

```bash
# macOS con Homebrew
brew install python@3.12

# Ubuntu / Debian
sudo apt install python3.12 python3.12-venv python3.12-pip
```

---

## 1. Instalar dependencias Node

Desde la raíz del plugin:

```bash
npm install
```

Esto instala `better-sqlite3`, `@sinclair/typebox` y las devDependencies de TypeScript.

> **Importante**: `better-sqlite3` es un addon nativo. El `postinstall` del proyecto ejecuta `npm rebuild better-sqlite3` para recompilarlo con la versión de Node activa. Si cambiás de versión de Node después de haber instalado dependencias, corré `npm install` otra vez antes de ejecutar tests o usar el plugin.

---

## 2. Configurar el entorno Python para PaddleOCR

PaddleOCR y sus dependencias pesan aproximadamente **1 GB** (framework PaddlePaddle + modelos). Se instalan en un entorno virtual aislado para no afectar el Python del sistema.

### 2a. Crear el virtualenv

```bash
python3.12 -m venv .venv
```

Esto crea un directorio `.venv/` dentro del plugin. Está excluido del control de versiones (agregarlo a `.gitignore`).

### 2b. Activar el entorno (solo para instalación, no requerido en uso)

```bash
# macOS / Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate
```

### 2c. Instalar dependencias Python

Con el entorno activado:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

La instalación puede tardar **5-15 minutos** dependiendo de la conexión. PaddlePaddle descarga binarios precompilados para CPU.

### 2d. Descargar los modelos OCR (primera ejecución)

Los modelos (~200 MB) se descargan automáticamente la primera vez que se corre OCR. Para hacerlo ahora y no pagar esa latencia en el primer mensaje de Telegram:

```bash
./.venv/bin/python3 paddle_ocr_cli.py --warmup
```

> **Nota**: esta ejecución tarda ~30-60 s la primera vez. Las siguientes arrancan en ~5-10 s.
> **Importante**: usar siempre `./.venv/bin/python3` — el Python del sistema no tiene PaddleOCR instalado.

---

## 3. Configurar variables de entorno

Crear un archivo `.env` en la raíz del plugin (o exportar las variables en el shell):

```bash
# Ruta al archivo SQLite donde se guardan los datos
# Por defecto: ./financialclaw.db (se crea automáticamente)
FINANCIALCLAW_DB_PATH=./financialclaw.db

# Ruta al Python del virtualenv creado en el paso 2
# Apuntar al binario dentro de .venv para usar las dependencias instaladas
FINANCIALCLAW_PYTHON_CMD=./.venv/bin/python3

# Destino por defecto para el runner externo de reminders
FINANCIALCLAW_REMINDER_TARGET=<chat-o-destino>

# Canal soportado por el runner externo
FINANCIALCLAW_REMINDER_CHANNEL=telegram

# Cuenta opcional de OpenClaw cuando aplique
FINANCIALCLAW_REMINDER_ACCOUNT_ID=<account>

# Binario CLI de OpenClaw si no está en PATH
FINANCIALCLAW_OPENCLAW_CMD=openclaw
```

> En Windows: `FINANCIALCLAW_PYTHON_CMD=.\.venv\Scripts\python.exe`

---

## 4. Verificar la instalación

### Verificar OCR

```bash
# Pasar cualquier foto de un recibo
./.venv/bin/python3 paddle_ocr_cli.py /ruta/a/recibo.jpg
```

Debería imprimir un JSON como:

```json
{
  "rawText": "SUPERMERCADO EXITO\nTOTAL $54.900\n16/03/2026",
  "lines": [...],
  "averageConfidence": 0.95
}
```

Si hay errores, verificar que el virtualenv esté bien creado y que `FINANCIALCLAW_PYTHON_CMD` apunte al Python correcto.

### Verificar base de datos

```bash
node --input-type=module <<'EOF'
import { getDb } from './src/db/database.js';
const db = getDb();
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tablas creadas:', tables.map(t => t.name));
const currencies = db.prepare('SELECT * FROM currencies').all();
console.log('Monedas:', currencies);
EOF
```

Debería imprimir:
```
Tablas creadas: [ 'currencies', 'ocr_extractions', 'recurring_expense_rules', 'expenses', 'incomes', 'income_receipts', 'reminders' ]
Monedas: [ { code: 'XXX', name: 'Sin configurar', symbol: '¤', is_default: 1, ... } ]
```

---

## 5. Registrar el plugin en OpenClaw

```bash
openclaw plugin install /ruta/absoluta/a/financialclaw
```

O configurar manualmente en el archivo de configuración de OpenClaw:

```json5
{
  plugins: {
    entries: {
      "financialclaw": {
        enabled: true,
        config: {
          dbPath: "./financialclaw.db",
          pythonCmd: "./.venv/bin/python3"
        }
      }
    },
    load: {
      paths: ["/ruta/absoluta/a/financialclaw"]
    }
  }
}
```

Reiniciar el gateway de OpenClaw para que cargue el plugin:

```bash
openclaw gateway restart
```

Verificar que los tools estén disponibles:

```bash
openclaw tools list
```

Deberías ver 10 tools:
```
manage_currency           Gestiona monedas: agregar, listar o cambiar la default
log_expense_from_image    Registra un gasto a partir de una foto de recibo
log_expense_manual        Registra un gasto manualmente
log_income                Registra un ingreso
log_income_receipt        Registra un pago recibido de un ingreso
add_recurring_expense     Agrega una regla de gasto recurrente
mark_expense_paid         Marca un gasto como pagado
get_financial_summary     Muestra un resumen financiero del período
list_expenses             Busca y lista gastos con filtros
list_incomes              Busca y lista ingresos con filtros
```

---

## 6. Ejecutar el runner externo de reminders

El plugin no registra services. La automatización corre fuera del runtime del plugin mediante un runner one-shot que podés programar con `cron`, `systemd` o `launchd`.

### Invocación manual mínima

```bash
npx tsx src/bin/daily-reminder-runner.ts --target "<chat-o-destino>"
```

### Invocación manual completa

```bash
npx tsx src/bin/daily-reminder-runner.ts \
  --target "<chat-o-destino>" \
  --channel telegram \
  --account "<account-opcional>" \
  --db-path ./financialclaw.db \
  --openclaw-cmd openclaw
```

### Variables mínimas para correrlo por entorno

- `FINANCIALCLAW_REMINDER_TARGET`: obligatorio si no pasás `--target`.
- `FINANCIALCLAW_DB_PATH`: recomendado para apuntar al SQLite operativo.
- `FINANCIALCLAW_REMINDER_CHANNEL`: opcional, hoy solo soporta `telegram`.
- `FINANCIALCLAW_REMINDER_ACCOUNT_ID`: opcional.
- `FINANCIALCLAW_OPENCLAW_CMD`: opcional si `openclaw` ya está en `PATH`.

La ejecución devuelve `0` si todos los reminders salieron bien y `1` si hubo fallos parciales o error fatal. El runner solo marca `sent = 1` y `sent_at` después de cada envío exitoso.

---

## 7. Prueba end-to-end

1. Abrir Telegram y hablar con el bot de OpenClaw.
2. Enviar una foto de cualquier recibo.
3. El agente debería responder con algo como:
   > "Gasto registrado: $54.900 en Exito (SUPERMERCADO) — 16/03/2026"
4. Verificar el registro en la base de datos:

```bash
sqlite3 financialclaw.db "SELECT amount, merchant, category, date FROM expenses ORDER BY created_at DESC LIMIT 5;"
```

---

## 8. Estructura del directorio tras la instalación

```
financialclaw/
├── .venv/                  # Entorno Python (no versionar)
├── financialclaw.db        # Base de datos SQLite (no versionar)
├── openclaw.plugin.json    # Manifiesto del plugin
├── paddle_ocr_cli.py
├── requirements.txt
├── package.json
├── node_modules/           # (no versionar)
├── docs/
│   ├── producto.md
│   ├── plan-tecnico.md
│   ├── openclaw-sdk.md
│   ├── testing.md
│   ├── setup.md            # este archivo
│   ├── versionamiento.md
│   ├── hitos.md
│   └── bitacora.md
├── tests/                  # Tests (unit + integration)
└── src/
    └── ...
```

Agregar al `.gitignore`:

```
.venv/
node_modules/
financialclaw.db
*.db
```

---

## 9. Actualización del plugin

```bash
# Actualizar dependencias Node
npm install

# Actualizar dependencias Python
source .venv/bin/activate
pip install --upgrade -r requirements.txt
```

Si hay cambios en el esquema de la base de datos, la migración es automática: `database.ts` ejecuta los `CREATE TABLE IF NOT EXISTS` al arrancar, sin borrar datos existentes.

Si actualizaste Node.js desde la última instalación, este paso también recompone `better-sqlite3` para el runtime activo.

---

## Solución de problemas comunes

**`paddle_ocr_cli.py` falla con "No module named paddleocr"**
→ `FINANCIALCLAW_PYTHON_CMD` no apunta al Python del virtualenv. Verificar que sea `./.venv/bin/python3`.

**Primera ejecución OCR muy lenta (>60 s)**
→ Normal: los modelos se están descargando por primera vez. Ejecutar `--warmup` manualmente (paso 2d) para hacerlo una sola vez.

**`better-sqlite3` falla al instalar en npm**
→ Verificar primero que el proyecto esté usando la línea actual del lockfile (`better-sqlite3@^12.8.0`), que sí es compatible con Node 24. Si aun así npm cae a compilación nativa, instalar las herramientas de build:
```bash
# macOS
xcode-select --install

# Ubuntu
sudo apt install build-essential python3-dev
```

**Tests o arranque fallan con `NODE_MODULE_VERSION` o `ERR_DLOPEN_FAILED`**
→ El binario nativo de `better-sqlite3` fue compilado con otra versión de Node. Ejecutar:
```bash
npm install
```
Esto dispara `postinstall` y recompila `better-sqlite3` con el Node activo.

**OpenClaw no encuentra el plugin**
→ Verificar que la ruta en la configuración de OpenClaw sea absoluta y que `package.json` tenga el campo `"openclaw": { "extensions": [...] }`.
