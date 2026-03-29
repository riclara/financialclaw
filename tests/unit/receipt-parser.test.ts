import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeReceiptText,
  parseAmountFromReceiptText,
  parseDateFromReceiptText,
  parseMerchantFromReceiptText,
} from "../../src/ocr/receipt-parser.js";

describe("receipt-parser", () => {
  describe("normalizeReceiptText", () => {
    it("normaliza texto a minúsculas sin acentos", () => {
      const result = normalizeReceiptText("ÉXITO CAFÉ");
      assert.equal(result, "exito cafe");
    });
  });

  describe("parseAmountFromReceiptText", () => {
    it("parsea monto con punto como separador de miles", () => {
      const result = parseAmountFromReceiptText("TOTAL $54.900");
      assert.equal(result, 54900);
    });

    it("parsea monto con coma como separador de miles", () => {
      const result = parseAmountFromReceiptText("TOTAL 54,900");
      assert.equal(result, 54900);
    });

    it("parsea monto sin separador", () => {
      const result = parseAmountFromReceiptText("VLR 120000");
      assert.equal(result, 120000);
    });

    it("parsea monto con etiqueta primary total a pagar", () => {
      const result = parseAmountFromReceiptText("Total a pagar $45.000");
      assert.equal(result, 45000);
    });

    it("parsea monto con etiqueta valor total", () => {
      const result = parseAmountFromReceiptText("Valor total: 80.500");
      assert.equal(result, 80500);
    });

    it("retorna null cuando no hay monto parseable", () => {
      const result = parseAmountFromReceiptText("Sin montos en este texto");
      assert.equal(result, null);
    });

    it("ignora montos menores a 1000 en búsqueda genérica", () => {
      const result = parseAmountFromReceiptText("Propina $500");
      assert.equal(result, null);
    });

    it("excluye líneas con IVA del parsing genérico", () => {
      const result = parseAmountFromReceiptText("IVA: 19%\nTOTAL $100.000");
      assert.equal(result, 100000);
    });

    it("excluye líneas con cambio del parsing genérico", () => {
      const result = parseAmountFromReceiptText("Cambio: $50.000\nTOTAL $25.000");
      assert.equal(result, 25000);
    });
  });

  describe("parseDateFromReceiptText", () => {
    it("parsea fecha en formato ISO", () => {
      const result = parseDateFromReceiptText("2026-03-16");
      assert.equal(result, "2026-03-16");
    });

    it("parsea fecha con barra DD/MM/YYYY", () => {
      const result = parseDateFromReceiptText("16/03/2026");
      assert.equal(result, "2026-03-16");
    });

    it("parsea fecha con guión DD-MM-YYYY", () => {
      const result = parseDateFromReceiptText("16-03-2026");
      assert.equal(result, "2026-03-16");
    });

    it("parsea fecha en texto español sin de", () => {
      const result = parseDateFromReceiptText("16 mar 2026");
      assert.equal(result, "2026-03-16");
    });

    it("parsea fecha en texto español con de", () => {
      const result = parseDateFromReceiptText("16 de mar de 2026");
      assert.equal(result, "2026-03-16");
    });

    it("retorna null cuando no hay fecha parseable", () => {
      const result = parseDateFromReceiptText("Sin fecha en este recibo");
      assert.equal(result, null);
    });

    it("parsea fecha con separador / en formato ISO", () => {
      const result = parseDateFromReceiptText("2026/03/16");
      assert.equal(result, "2026-03-16");
    });
  });

  describe("parseMerchantFromReceiptText", () => {
    it("extrae merchant desde primera línea válida", () => {
      const result = parseMerchantFromReceiptText("EXITO LAURELES\nNIT 890.900.123\nFECHA 16/03/2026");
      assert.equal(result, "Exito Laureles");
    });

    it("retorna null cuando todas las líneas son ruido", () => {
      const result = parseMerchantFromReceiptText("NIT 123456\nFECHA 16/03/2026\nTOTAL $50.000");
      assert.equal(result, null);
    });

    it("ignora líneas con NIT", () => {
      const result = parseMerchantFromReceiptText("NIT 890900123\nSUPERMERCADO ÉXITO\nFECHA 16/03/2026");
      assert.equal(result, "Supermercado Éxito");
    });

    it("ignora líneas con TEL/Teléfono", () => {
      const result = parseMerchantFromReceiptText("Teléfono: 1234567\nRESTAURANTE BUEN GUSTO\nFECHA 16/03/2026");
      assert.equal(result, "Restaurante Buen Gusto");
    });

    it("retorna null para líneas muy cortas", () => {
      const result = parseMerchantFromReceiptText("AB\nNIT 123\nFECHA 16/03/2026");
      assert.equal(result, null);
    });

    it("convierte a title case correctamente", () => {
      const result = parseMerchantFromReceiptText("RESTAURANTE EL BUEN GUSTO\nNIT 123");
      assert.equal(result, "Restaurante El Buen Gusto");
    });

    it("solo mira las primeras 5 líneas", () => {
      const result = parseMerchantFromReceiptText("NIT 123456\nFECHA 01/01/2026\nTOTAL 50000\nSUBTOTAL 50000\nCAJA 1\nTIENDA VALIDA");
      assert.equal(result, null);
    });
  });

  describe("casos de borde del contrato", () => {
    it("parseAmountFromReceiptText con $54.900 retorna 54900", () => {
      const result = parseAmountFromReceiptText("TOTAL $54.900");
      assert.equal(result, 54900);
    });

    it("parseDateFromReceiptText con 16/03/2026 retorna 2026-03-16", () => {
      const result = parseDateFromReceiptText("16/03/2026");
      assert.equal(result, "2026-03-16");
    });

    it("parseMerchantFromReceiptText con EXITO LAURELES retorna Exito Laureles", () => {
      const result = parseMerchantFromReceiptText("EXITO LAURELES\nNIT 890.900.123\nFECHA 16/03/2026");
      assert.equal(result, "Exito Laureles");
    });
  });
});
