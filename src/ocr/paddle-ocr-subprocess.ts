import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

/**
 * Interfaz para una línea de texto extraída por OCR
 */
export interface OcrLine {
  text: string;
  confidence: number;
}

/**
 * Interfaz para el resultado completo de OCR
 */
export interface OcrResult {
  rawText: string;
  lines: OcrLine[];
  averageConfidence: number;
}

/**
 * Comando Python por defecto: se puede sobrescribir con variable de entorno
 * o mediante configurePythonCmd()
 */
let _pythonCmd: string = process.env.FINANCIALCLAW_PYTHON_CMD ?? "python3";

/**
 * Ruta al script CLI de PaddleOCR, resuelta relativa a este archivo
 */
const __filenameUrl = fileURLToPath(import.meta.url);
const __dirname = dirname(__filenameUrl);
const CLI_SCRIPT = join(__dirname, "../../paddle_ocr_cli.py");

/**
 * Configura el intérprete Python a utilizar
 * @param cmd Ruta o comando del intérprete Python
 */
export function configurePythonCmd(cmd: string): void {
  _pythonCmd = cmd;
}

/**
 * Ejecuta PaddleOCR sobre una imagen mediante subprocess
 * @param imagePath Ruta absoluta o relativa a la imagen a procesar
 * @returns Resultado estructurado del OCR
 * @throws Error si el proceso falla, timeout o salida inválida
 */
export function runPaddleOcr(imagePath: string): OcrResult {
  // Ejecutar el proceso Python con el CLI de PaddleOCR
  const result = spawnSync(_pythonCmd, [CLI_SCRIPT, imagePath], {
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  // Manejar errores de ejecución del proceso
  if (result.error) {
    throw new Error(
      `Error al ejecutar el proceso Python: ${result.error.message}`
    );
  }

  // Manejar exit code distinto de 0
  if (result.status !== 0) {
    const stderrMessage = result.stderr?.trim() || "Sin stderr";
    throw new Error(
      `El proceso Python falló con código ${result.status}. stderr: ${stderrMessage}`
    );
  }

  // Verificar que haya stdout
  if (!result.stdout || result.stdout.length === 0) {
    throw new Error("El proceso Python no produjo salida en stdout");
  }

  // Parsear el JSON de salida
  try {
    const parsed = JSON.parse(result.stdout) as OcrResult;
    
    // Validar que tenga la estructura esperada
    if (
      typeof parsed.rawText !== "string" ||
      !Array.isArray(parsed.lines) ||
      typeof parsed.averageConfidence !== "number"
    ) {
      throw new Error("Formato de salida JSON inválido");
    }
    
    // Validar cada línea
    for (const line of parsed.lines) {
      if (typeof line.text !== "string" || typeof line.confidence !== "number") {
        throw new Error("Formato de línea OCR inválido");
      }
    }
    
    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        `Salida no es JSON válido: ${err.message}. stdout: "${result.stdout}"`
      );
    }
    // Re-lanzar errores de validación
    throw err;
  }
}