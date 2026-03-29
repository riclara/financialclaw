import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { createTestDb } from "../helpers/test-db.js";
import { executeLogExpenseFromImage } from "../../src/tools/log-expense-from-image.js";
import type { OcrResult } from "../../src/ocr/paddle-ocr-subprocess.js";

const createMockOcr = (result: OcrResult) => {
  return (_path: string) => result;
};

const createMockOcrError = (errorMsg: string) => {
  return (_path: string) => {
    throw new Error(errorMsg);
  };
};

describe("log_expense_from_image", async () => {
  const tempDir = join(tmpdir(), `test-ocr-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  it("caso feliz: persiste ocr_extractions y expenses enlazados", () => {
    const imagePath = join(tempDir, "recibo.jpg");
    writeFileSync(imagePath, "fake image content");

    const ocrImpl = createMockOcr({
      rawText: "SUPERMERCADO EXITO\nTOTAL $54.900\n16/03/2026",
      lines: [
        { text: "SUPERMERCADO EXITO", confidence: 0.98 },
        { text: "TOTAL $54.900", confidence: 0.95 },
        { text: "16/03/2026", confidence: 0.97 },
      ],
      averageConfidence: 0.96,
    });

    const db = createTestDb();

    const result = executeLogExpenseFromImage(
      { image_path: imagePath },
      db,
      ocrImpl,
    );

    assert.ok(result.includes("54.900"), "Debe incluir monto formateado");

    const ocrRow = db.prepare("SELECT * FROM ocr_extractions").get() as any;
    assert.ok(ocrRow, "Debe existir fila en ocr_extractions");
    assert.equal(ocrRow.status, "COMPLETED");
    assert.equal(ocrRow.provider, "paddleocr");
    assert.equal(ocrRow.suggested_amount, 54900);

    const expenseRow = db.prepare("SELECT * FROM expenses").get() as any;
    assert.ok(expenseRow, "Debe existir fila en expenses");
    assert.equal(expenseRow.amount, 54900);
    assert.equal(expenseRow.source, "OCR");
    assert.equal(expenseRow.status, "PAID");
    assert.equal(expenseRow.ocr_extraction_id, ocrRow.id);
    assert.equal(expenseRow.due_date, expenseRow.payment_date);
  });

  it("caso sin monto detectable: no crea gasto pero crea extracción fallida", () => {
    const imagePath = join(tempDir, "recibo-sin-monto.jpg");
    writeFileSync(imagePath, "fake image content");

    const ocrImpl = createMockOcr({
      rawText: "SOLO UNA LINEA DE TEXTO",
      lines: [{ text: "SOLO UNA LINEA DE TEXTO", confidence: 0.5 }],
      averageConfidence: 0.5,
    });

    const db = createTestDb();

    assert.throws(
      () => executeLogExpenseFromImage({ image_path: imagePath }, db, ocrImpl),
      /No se detectó un monto válido/,
    );

    const ocrRow = db.prepare("SELECT * FROM ocr_extractions").get() as any;
    assert.ok(ocrRow, "Debe persistir extracción fallida");
    assert.equal(ocrRow.status, "FAILED");
    assert.equal(ocrRow.failure_code, "EMPTY_CONTENT");

    const expenseCount = db.prepare("SELECT COUNT(*) as count FROM expenses").get() as any;
    assert.equal(expenseCount.count, 0, "No debe crear gasto");
  });

  it("caso de fallo del subprocess OCR: no crea gasto", () => {
    const imagePath = join(tempDir, "recibo-error.jpg");
    writeFileSync(imagePath, "fake image content");

    const ocrImpl = createMockOcrError("Python process failed");

    const db = createTestDb();

    assert.throws(
      () => executeLogExpenseFromImage({ image_path: imagePath }, db, ocrImpl),
      /Error al ejecutar OCR/,
    );

    const ocrRow = db.prepare("SELECT * FROM ocr_extractions").get() as any;
    assert.ok(ocrRow, "Debe persistir extracción fallida");
    assert.equal(ocrRow.status, "FAILED");
    assert.equal(ocrRow.failure_code, "PROVIDER_ERROR");

    const expenseCount = db.prepare("SELECT COUNT(*) as count FROM expenses").get() as any;
    assert.equal(expenseCount.count, 0, "No debe crear gasto");
  });

  it("caso de image_path relativo: se resuelve correctamente", () => {
    const timestamp = Date.now();
    const relativeDir = `test-rel-${timestamp}`;
    const relativePath = `${relativeDir}/recibo.jpg`;
    const absolutePath = resolve(relativePath);
    mkdirSync(relativeDir, { recursive: true });
    writeFileSync(absolutePath, "fake image content");

    let ocrImplCalledWithResolvedPath = false;
    const ocrImpl = createMockOcr({
      rawText: "TIENDA\nTOTAL $12.500",
      lines: [
        { text: "TIENDA", confidence: 0.9 },
        { text: "TOTAL $12.500", confidence: 0.9 },
      ],
      averageConfidence: 0.9,
    });

    const db = createTestDb();

    const result = executeLogExpenseFromImage(
      { image_path: relativePath },
      db,
      (path) => {
        ocrImplCalledWithResolvedPath = path === absolutePath;
        return ocrImpl(path);
      },
    );

    assert.ok(result.includes("12.500"));
    assert.ok(ocrImplCalledWithResolvedPath, "Debe resolver el path relativo a absoluto");

    try {
      rmSync(relativeDir, { recursive: true, force: true });
    } catch {}
  });

  it("caso con description y due_date provistos por el usuario", () => {
    const imagePath = join(tempDir, "recibo-user-inputs.jpg");
    writeFileSync(imagePath, "fake image content");

    const ocrImpl = createMockOcr({
      rawText: "RESTAURANTE\nTOTAL $25.000\n15/03/2026",
      lines: [
        { text: "RESTAURANTE", confidence: 0.95 },
        { text: "TOTAL $25.000", confidence: 0.95 },
        { text: "15/03/2026", confidence: 0.98 },
      ],
      averageConfidence: 0.96,
    });

    const db = createTestDb();

    const result = executeLogExpenseFromImage(
      {
        image_path: imagePath,
        description: "Cena de trabajo",
        due_date: "2026-03-20",
      },
      db,
      ocrImpl,
    );

    assert.ok(result.includes("Cena de trabajo"), "Debe usar description provista");
    assert.ok(result.includes("2026-03-20"), "Debe usar due_date provisto");

    const expenseRow = db.prepare("SELECT * FROM expenses").get() as any;
    assert.equal(expenseRow.description, "Cena de trabajo");
    assert.equal(expenseRow.due_date, "2026-03-20");
    assert.equal(expenseRow.payment_date, "2026-03-20");
  });

  it("caso sin description: usa merchant o fallback genérico", () => {
    const imagePath = join(tempDir, "recibo-sin-desc.jpg");
    writeFileSync(imagePath, "fake image content");

    const ocrImpl = createMockOcr({
      rawText: "UBER\nTOTAL $15.000",
      lines: [
        { text: "UBER", confidence: 0.99 },
        { text: "TOTAL $15.000", confidence: 0.95 },
      ],
      averageConfidence: 0.97,
    });

    const db = createTestDb();

    const result = executeLogExpenseFromImage(
      { image_path: imagePath },
      db,
      ocrImpl,
    );

    assert.ok(result.includes("Gasto en Uber") || result.includes("Gasto por OCR"));

    const expenseRow = db.prepare("SELECT * FROM expenses").get() as any;
    assert.ok(
      expenseRow.description === "Gasto en Uber" ||
      expenseRow.description === "Gasto por OCR",
    );
  });

  it("sugerencia de manage_currency cuando moneda es XXX", () => {
    const imagePath = join(tempDir, "recibo-xxx.jpg");
    writeFileSync(imagePath, "fake image content");

    const ocrImpl = createMockOcr({
      rawText: "TIENDA\nTOTAL $10.000",
      lines: [
        { text: "TIENDA", confidence: 0.9 },
        { text: "TOTAL $10.000", confidence: 0.9 },
      ],
      averageConfidence: 0.9,
    });

    const db = createTestDb();

    const result = executeLogExpenseFromImage(
      { image_path: imagePath },
      db,
      ocrImpl,
    );

    assert.ok(
      result.includes("manage_currency"),
      "Debe sugerir configurar moneda cuando es XXX",
    );
  });

  it("fallo por archivo inexistente antes de invocar OCR", () => {
    const ocrImpl = createMockOcr({
      rawText: "TEST",
      lines: [],
      averageConfidence: 0,
    });

    const db = createTestDb();

    assert.throws(
      () => executeLogExpenseFromImage(
        { image_path: "/ruta/inexistente/imagen.jpg" },
        db,
        ocrImpl,
      ),
      /no existe/,
    );
  });

  it("bloquea description con solo espacios", () => {
    const imagePath = join(tempDir, "recibo-espacios.jpg");
    writeFileSync(imagePath, "fake image content");

    const ocrImpl = createMockOcr({
      rawText: "TIENDA\nTOTAL $10.000",
      lines: [
        { text: "TIENDA", confidence: 0.9 },
        { text: "TOTAL $10.000", confidence: 0.9 },
      ],
      averageConfidence: 0.9,
    });

    const db = createTestDb();

    assert.throws(
      () => executeLogExpenseFromImage(
        { image_path: imagePath, description: "   " },
        db,
        ocrImpl,
      ),
      /solo espacios/,
    );
  });

  it("bloquea due_date con fecha imposible (Feb 31) antes de invocar OCR", () => {
    const imagePath = join(tempDir, "recibo-fechainv.jpg");
    writeFileSync(imagePath, "fake image content");

    let ocrInvoked = false;
    const ocrImpl = (_path: string) => {
      ocrInvoked = true;
      return {
        rawText: "TIENDA\nTOTAL $10.000",
        lines: [
          { text: "TIENDA", confidence: 0.9 },
          { text: "TOTAL $10.000", confidence: 0.9 },
        ],
        averageConfidence: 0.9,
      };
    };

    const db = createTestDb();

    assert.throws(
      () => executeLogExpenseFromImage(
        { image_path: imagePath, due_date: "2026-02-31" },
        db,
        ocrImpl,
      ),
      /no es válida/,
    );

    assert.equal(ocrInvoked, false, "OCR no debe invocarse con due_date inválido");

    const extractions = db.prepare("SELECT * FROM ocr_extractions").all();
    assert.equal(extractions.length, 0, "No debe persistir extracción OCR cuando la validación falla");
  });

  it("usa merchant posicional antes que keyword merchant", () => {
    const imagePath = join(tempDir, "recibo-merchant.jpg");
    writeFileSync(imagePath, "fake image content");

    const ocrImpl = createMockOcr({
      rawText: "MI TIENDITA\nTOTAL $50.000\nvia uber",
      lines: [
        { text: "MI TIENDITA", confidence: 0.9 },
        { text: "TOTAL $50.000", confidence: 0.9 },
        { text: "via uber", confidence: 0.9 },
      ],
      averageConfidence: 0.9,
    });

    const db = createTestDb();

    const result = executeLogExpenseFromImage(
      { image_path: imagePath },
      db,
      ocrImpl,
    );

    const expenseRow = db.prepare("SELECT * FROM expenses").get() as any;
    assert.equal(expenseRow.merchant, "Mi Tiendita", "Debe usar merchant posicional, no keyword");
  });

  it("cleanup", async () => {
    try {
      rmdirSync(tempDir);
    } catch {}
  });
});
