import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import Database from "better-sqlite3";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { getDb } from "../db/database.js";
import {
  runPaddleOcr,
  type OcrResult,
} from "../ocr/paddle-ocr-subprocess.js";
import {
  parseAmountFromReceiptText,
  parseDateFromReceiptText,
  parseMerchantFromReceiptText,
} from "../ocr/receipt-parser.js";
import {
  normalizeOcrText,
  inferMerchantAndCategoryFromText,
} from "../ocr/ocr-classification.js";
import { todayISO } from "./helpers/date-utils.js";
import {
  formatAmount,
  isPlaceholderCurrency,
  resolveCurrency,
} from "./helpers/currency-utils.js";

const ISO_DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

export const InputSchema = Type.Object(
  {
    image_path: Type.String({ minLength: 1 }),
    description: Type.Optional(Type.String({ minLength: 1 })),
    due_date: Type.Optional(Type.String({ pattern: ISO_DATE_PATTERN })),
    currency: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type LogExpenseFromImageInput = Static<typeof InputSchema>;

function assertValidInput(input: LogExpenseFromImageInput): void {
  if (!Value.Check(InputSchema, input)) {
    throw new Error(
      "Parámetros inválidos: image_path es requerido y no puede estar vacío. description no puede tener solo espacios. due_date debe tener formato YYYY-MM-DD.",
    );
  }
  if (input.description !== undefined && input.description.trim().length === 0) {
    throw new Error("description no puede contener solo espacios en blanco.");
  }
  if (input.due_date !== undefined && !parseValidDate(input.due_date)) {
    throw new Error(
      `La fecha proporcionada no es válida: ${input.due_date}`,
    );
  }
}

function parseValidDate(dateStr: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return false;
  const [, year, month, day] = match;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (m < 1 || m > 12 || d < 1) return false;
  if (y < 2000 || y > 2100) return false;
  const daysInMonth = new Date(y, m, 0).getDate();
  if (d > daysInMonth) return false;
  return true;
}

interface ParsedOcrData {
  amount: number | null;
  date: string | null;
  merchant: string | null;
  category: string;
}

export function executeLogExpenseFromImage(
  input: LogExpenseFromImageInput,
  db: Database.Database = getDb(),
  ocrImpl: (path: string) => OcrResult = runPaddleOcr,
): string {
  assertValidInput(input);

  const currency = resolveCurrency(input.currency, db);
  const imagePath = resolve(input.image_path);

  if (!existsSync(imagePath)) {
    throw new Error(
      `El archivo de imagen no existe: ${input.image_path}`,
    );
  }

  let ocrResult: OcrResult;
  try {
    ocrResult = ocrImpl(imagePath);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error desconocido";
    const extractionId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `
        INSERT INTO ocr_extractions (
          id, provider, source_path, raw_text, lines_json,
          average_confidence, suggested_amount, suggested_currency,
          suggested_date, suggested_merchant, suggested_category,
          status, failure_code, failure_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      extractionId,
      "paddleocr",
      input.image_path,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "FAILED",
      "PROVIDER_ERROR",
      errorMessage,
      now,
    );

    throw new Error(
      `Error al ejecutar OCR en la imagen: ${errorMessage}`,
    );
  }

  const rawText = ocrResult.rawText;
  const normalizedText = normalizeOcrText(rawText);
  const linesJson = JSON.stringify(ocrResult.lines);
  const avgConfidence = ocrResult.averageConfidence;

  const parsedAmount = parseAmountFromReceiptText(rawText);
  const parsedDate = parseDateFromReceiptText(rawText);
  const parsedMerchant = parseMerchantFromReceiptText(rawText);

  const { merchant: keywordMerchant, category: keywordCategory } =
    inferMerchantAndCategoryFromText(normalizedText);

  const extractionId = randomUUID();
  const now = new Date().toISOString();

  if (parsedAmount === null) {
    db.prepare(
      `
        INSERT INTO ocr_extractions (
          id, provider, source_path, raw_text, lines_json,
          average_confidence, suggested_amount, suggested_currency,
          suggested_date, suggested_merchant, suggested_category,
          status, failure_code, failure_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      extractionId,
      "paddleocr",
      input.image_path,
      rawText,
      linesJson,
      avgConfidence,
      null,
      null,
      parsedDate,
      parsedMerchant,
      keywordCategory ?? null,
      "FAILED",
      "EMPTY_CONTENT",
      "No se detectó un monto válido en el recibo",
      now,
    );

    throw new Error(
      "No se detectó un monto válido en el recibo. Verifica que la imagen sea legible.",
    );
  }

  const suggestedAmount = parsedAmount;
  const suggestedDate = parsedDate;
  const merchantPositional = parsedMerchant;
  const merchant = merchantPositional ?? keywordMerchant ?? null;
  const category = keywordCategory ?? "OTHER";

  const dueDateFinal = input.due_date ?? suggestedDate ?? todayISO();

  const descriptionFinal = input.description?.trim()
    ?? (merchant ? `Gasto en ${merchant}` : "Gasto por OCR");

  const expenseId = randomUUID();

  db.transaction(() => {
    db.prepare(
      `
        INSERT INTO ocr_extractions (
          id, provider, source_path, raw_text, lines_json,
          average_confidence, suggested_amount, suggested_currency,
          suggested_date, suggested_merchant, suggested_category,
          status, failure_code, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      extractionId,
      "paddleocr",
      input.image_path,
      rawText,
      linesJson,
      avgConfidence,
      suggestedAmount,
      currency.code,
      suggestedDate,
      merchant,
      category,
      "COMPLETED",
      null,
      now,
    );

    db.prepare(
      `
        INSERT INTO expenses (
          id, amount, currency, category, merchant, description,
          due_date, payment_date, status, source,
          ocr_extraction_id, recurring_rule_id, generated_from_rule,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      expenseId,
      suggestedAmount,
      currency.code,
      category,
      merchant,
      descriptionFinal,
      dueDateFinal,
      dueDateFinal,
      "PAID",
      "OCR",
      extractionId,
      null,
      0,
      1,
      now,
      now,
    );
  })();

  const formattedAmount = formatAmount(suggestedAmount, currency);
  const datePart = dueDateFinal;
  const merchantPart = merchant ? ` — ${merchant}` : "";
  const categoryPart = category !== "OTHER" ? ` [${category}]` : "";

  let message =
    `Gasto registrado por OCR: ${formattedAmount}${categoryPart} · ${descriptionFinal}${merchantPart} · ${datePart} · Pagado (ID: ${expenseId})`;

  if (isPlaceholderCurrency(db)) {
    message +=
      "\n\nSugerencia: aún no has configurado una moneda real. Usa manage_currency para agregar la tuya y establecerla como moneda por defecto.";
  }

  return message;
}
