/**
 * Utilidades de parsing posicional para recibos de caja en formato colombiano.
 *
 * SEPARACIÓN DE RESPONSABILIDADES:
 * - ocr-classification.ts: lookup por keywords (mapa conocido → categoría/comercio hardcoded)
 * - receipt-parser.ts: extracción posicional del texto crudo del recibo (regex + posición de líneas)
 */

import { normalizeOcrText } from "./ocr-classification.js";

/**
 * Normaliza el texto crudo de un recibo para comparaciones.
 * Delega a normalizeOcrText de ocr-classification (NFD + minúsculas).
 */
export function normalizeReceiptText(text: string): string {
  return normalizeOcrText(text);
}

// ---------------------------------------------------------------------------
// Parsing de monto (COP)
// ---------------------------------------------------------------------------

/**
 * Extrae el monto principal de un texto de recibo en formato COP.
 *
 * Soporta:
 *   "TOTAL $54.900"  → 54900
 *   "TOTAL 54,900"   → 54900
 *   "VLR 120000"     → 120000
 *   "$54.900"        → 54900
 *   "54.900"         → 54900  (interpretado como miles, no decimales en COP)
 *
 * Estrategia: busca primero una línea con etiqueta de pago (TOTAL, VALOR, etc.),
 * si no encuentra, cae al mayor número plausible del texto.
 */
export function parseAmountFromReceiptText(text: string): number | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const primaryCandidate = findLabeledAmountCandidate(lines, PRIMARY_TOTAL_LABELS);
  if (primaryCandidate !== null) {
    return primaryCandidate.amount;
  }

  const secondaryCandidate = findLabeledAmountCandidate(lines, SECONDARY_TOTAL_LABELS);
  if (secondaryCandidate !== null) {
    return secondaryCandidate.amount;
  }

  const subtotalCandidate = findLabeledAmountCandidate(lines, SUBTOTAL_LABELS);
  if (subtotalCandidate !== null) {
    return subtotalCandidate.amount;
  }

  const normalized = normalizeOcrText(text);
  const dollarPattern = /\$\s*([\d]+(?:[.,][\d]+)+|[\d]{4,})/g;
  const dollarMatches: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = dollarPattern.exec(normalized)) !== null) {
    const parsed = parseCopNumber(match[1] ?? "");
    if (parsed !== null && parsed >= 1000) {
      dollarMatches.push(parsed);
    }
  }

  if (dollarMatches.length > 0) {
    return Math.max(...dollarMatches);
  }

  const genericCandidates = lines
    .filter((line) => !EXCLUDED_GENERIC_AMOUNT_LABELS.some((pattern) => pattern.test(normalizeOcrText(line))))
    .flatMap((line) => extractAmountCandidatesFromText(line))
    .filter((amount) => amount >= 1000);

  if (genericCandidates.length > 0) {
    return Math.max(...genericCandidates);
  }

  return null;
}

/**
 * Convierte una cadena numérica en formato COP a número entero.
 *
 * En COP el separador de miles es "." o "," y no hay decimales en recibos de caja.
 * Ejemplos:
 *   "54.900" → 54900
 *   "54,900" → 54900
 *   "120000" → 120000
 */
function parseCopNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/^\$\s*/, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalSeparatorIndex = Math.max(lastComma, lastDot);

  if (decimalSeparatorIndex !== -1) {
    const fractional = cleaned.slice(decimalSeparatorIndex + 1);
    const integerPart = cleaned.slice(0, decimalSeparatorIndex);
    if (/^\d{1,2}$/.test(fractional) && /\d/.test(integerPart)) {
      const normalizedDecimal = `${integerPart.replace(/[.,]/g, "")}.${fractional}`;
      const decimalValue = Number.parseFloat(normalizedDecimal);
      if (Number.isFinite(decimalValue) && decimalValue > 0) {
        return Math.round(decimalValue);
      }
    }
  }

  const digitsOnly = cleaned.replace(/[.,]/g, "");
  const value = Number.parseInt(digitsOnly, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

interface AmountCandidate {
  amount: number;
  lineIndex: number;
}

const PRIMARY_TOTAL_LABELS = [
  /\btotal\s+a\s+pagar\b/i,
  /\bvalor\s+total\b/i,
  /\bgran\s+total\b/i,
  /\btotal\b/i,
];

const SECONDARY_TOTAL_LABELS = [
  /\ba\s+pagar\b/i,
  /\bvalor\b/i,
  /\bpago\b/i,
  /\bvlr\b/i,
  /\bimporte\b/i,
  /\bneto\b/i,
  /\befectivo\b/i,
];

const SUBTOTAL_LABELS = [/\bsub\s*total\b/i];

const EXCLUDED_AMOUNT_LINE_LABELS = [
  /\bpropina\b/i,
  /\bservicio\b/i,
  /\biva\b/i,
  /\bimpuesto\b/i,
  /\bdescuento\b/i,
  /\bcambio\b/i,
];

const EXCLUDED_GENERIC_AMOUNT_LABELS = [
  ...EXCLUDED_AMOUNT_LINE_LABELS,
  /\bnit\b/i,
  /\bfecha\b/i,
  /\bmesa\b/i,
  /\bpax\b/i,
  /\bpreticket\b/i,
  /\bempleado\b/i,
  /\bcaja\b/i,
  /\bfactura\b/i,
  /\bpedido\b/i,
  /\bcufe\b/i,
  /\bautorizacion\b/i,
  /\btelefono\b/i,
  /\btel\b/i,
];

function findLabeledAmountCandidate(lines: string[], labelPatterns: RegExp[]): AmountCandidate | null {
  const candidates: AmountCandidate[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const normalizedLine = normalizeOcrText(line);
    if (!labelPatterns.some((pattern) => pattern.test(normalizedLine))) continue;
    if (EXCLUDED_AMOUNT_LINE_LABELS.some((pattern) => pattern.test(normalizedLine))) continue;

    const sameLineAmounts = extractAmountCandidatesFromText(line);
    if (sameLineAmounts.length > 0) {
      candidates.push({
        amount: Math.max(...sameLineAmounts),
        lineIndex: index,
      });
      continue;
    }

    const nextLine = lines[index + 1];
    if (!nextLine) continue;
    const nextLineAmounts = extractAmountCandidatesFromText(nextLine);
    if (nextLineAmounts.length > 0) {
      candidates.push({
        amount: Math.max(...nextLineAmounts),
        lineIndex: index + 1,
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => right.lineIndex - left.lineIndex || right.amount - left.amount);
  return candidates[0] ?? null;
}

function extractAmountCandidatesFromText(text: string): number[] {
  const amountPattern = /\$?\s*([\d]+(?:[.,][\d]+)+|[\d]{4,})/g;
  const candidates: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = amountPattern.exec(text)) !== null) {
    const parsed = parseCopNumber(match[1] ?? "");
    if (parsed !== null && parsed > 0) {
      candidates.push(parsed);
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Parsing de fecha
// ---------------------------------------------------------------------------

const SPANISH_MONTHS: Record<string, string> = {
  ene: "01",
  feb: "02",
  mar: "03",
  abr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dic: "12",
};

/**
 * Extrae la fecha de un texto de recibo y la retorna en formato YYYY-MM-DD.
 *
 * Soporta:
 *   "2026-03-16"     → "2026-03-16"  (ISO)
 *   "16/03/2026"     → "2026-03-16"  (LatAm barra)
 *   "16-03-2026"     → "2026-03-16"  (LatAm guión)
 *   "16 mar 2026"    → "2026-03-16"  (texto español)
 */
export function parseDateFromReceiptText(text: string): string | null {
  // ISO: YYYY-MM-DD o YYYY/MM/DD
  const isoMatch = text.match(/\b(20\d{2})[-/](\d{2})[-/](\d{2})\b/);
  if (isoMatch) {
    const year = isoMatch[1] ?? "";
    const month = isoMatch[2] ?? "";
    const day = isoMatch[3] ?? "";
    if (isValidDate(year, month, day)) {
      return `${year}-${month}-${day}`;
    }
  }

  // LatAm: DD/MM/YYYY o DD-MM-YYYY
  const latamMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (latamMatch) {
    const day = latamMatch[1] ?? "";
    const month = latamMatch[2] ?? "";
    const year = latamMatch[3] ?? "";
    const dd = day.padStart(2, "0");
    const mm = month.padStart(2, "0");
    if (isValidDate(year, mm, dd)) {
      return `${year}-${mm}-${dd}`;
    }
  }

  // Texto español: "16 mar 2026" o "16 de mar de 2026"
  const spanishMatch = text.match(
    /\b(\d{1,2})\s+(?:de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\w*\s+(?:de\s+)?(20\d{2})\b/i,
  );
  if (spanishMatch) {
    const day = spanishMatch[1] ?? "";
    const monthAbbr = spanishMatch[2] ?? "";
    const year = spanishMatch[3] ?? "";
    const month = SPANISH_MONTHS[monthAbbr.toLowerCase().slice(0, 3)];
    if (month) {
      const dd = day.padStart(2, "0");
      if (isValidDate(year, month, dd)) {
        return `${year}-${month}-${dd}`;
      }
    }
  }

  return null;
}

function isValidDate(year: string, month: string, day: string): boolean {
  const y = Number.parseInt(year, 10);
  const m = Number.parseInt(month, 10);
  const d = Number.parseInt(day, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  if (y < 2000 || y > 2100) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Parsing de comercio (merchant)
// ---------------------------------------------------------------------------

/**
 * Palabras clave que indican ruido típico de recibos — no son nombres de comercio.
 * Mayúsculas para comparación insensible.
 */
const RECEIPT_NOISE_KEYWORDS = new Set([
  "NIT",
  "FECHA",
  "TOTAL",
  "SUBTOTAL",
  "IVA",
  "FACTURA",
  "COPIA",
  "TEL",
  "TELEFONO",
  "RECIBO",
  "CAJA",
  "CAJERO",
  "CUFE",
  "AUTORIZACION",
  "GRACIAS",
  "EFECTIVO",
  "CAMBIO",
  "PAGO",
  "TICKET",
  "NO.",
  "N°",
  "NUM",
  "CODIGO",
  "TARJETA",
  "COMPROBANTE",
  "DIRECCION",
  "WWW",
  "HTTP",
]);

/**
 * Extrae el nombre del comercio de las primeras líneas útiles del recibo.
 *
 * Estrategia: toma las primeras 5 líneas no vacías del texto crudo,
 * filtra las que contienen palabras de ruido o son solo números/símbolos,
 * y retorna la primera línea válida en title case.
 */
export function parseMerchantFromReceiptText(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 5); // solo las primeras 5 líneas

  for (const line of lines) {
    if (isNoiseLine(line)) continue;
    if (line.length < 3) continue;
    return toTitleCase(line);
  }

  return null;
}

function isNoiseLine(line: string): boolean {
  const upper = line.toUpperCase();

  // Línea es solo dígitos, espacios y símbolos (NIT, teléfonos, totales numéricos)
  if (/^[\d\s\-\.\,\$\#\*\/\(\)\:]+$/.test(line)) return true;

  // Contiene palabra clave de ruido
  const words = upper.split(/[\s\-\.\/\:]+/).filter(Boolean);
  for (const word of words) {
    if (RECEIPT_NOISE_KEYWORDS.has(word)) return true;
  }

  // Empieza con etiqueta de campo típica
  if (/^(?:tel[eé]fono|direcci[oó]n|fecha|nit|caja|cajero|factura|cufe)\b/i.test(line)) {
    return true;
  }

  return false;
}

function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
}
