import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOcrText,
  inferMerchantAndCategoryFromText,
  ExpenseCategory,
} from "../../src/ocr/ocr-classification.js";

describe("ocr-classification", () => {
  describe("normalizeOcrText", () => {
    it("normaliza texto con tildes a minúsculas sin diacríticos", () => {
      const result = normalizeOcrText("Cafe Ultimo");
      assert.equal(result, "cafe ultimo");
    });

    it("elimina tildes correctamente", () => {
      const result = normalizeOcrText("ión acción relación");
      assert.equal(result, "ion accion relacion");
    });

    it("convierte a minúsculas sin modificar texto sin tildes", () => {
      const result = normalizeOcrText("SUPERMERCADO EXITO");
      assert.equal(result, "supermercado exito");
    });
  });

  describe("inferMerchantAndCategoryFromText", () => {
    it("retorna categoria SUPERMARKET para exito", () => {
      const result = inferMerchantAndCategoryFromText("compra en exito laureles");
      assert.equal(result.category, ExpenseCategory.SUPERMARKET);
      assert.equal(result.merchant, "Exito");
    });

    it("retorna categoria TRANSPORT para uber", () => {
      const result = inferMerchantAndCategoryFromText("viaje uber");
      assert.equal(result.category, ExpenseCategory.TRANSPORT);
      assert.equal(result.merchant, "Uber");
    });

    it("retorna categoria SERVICES para epm", () => {
      const result = inferMerchantAndCategoryFromText("factura epm");
      assert.equal(result.category, ExpenseCategory.SERVICES);
      assert.equal(result.merchant, "EPM");
    });

    it("retorna categoria HEALTH para farmacia", () => {
      const result = inferMerchantAndCategoryFromText("medicamentos en farmacia");
      assert.equal(result.category, ExpenseCategory.HEALTH);
      assert.equal(result.merchant, "Farmacia");
    });

    it("retorna categoria RESTAURANT para cafe", () => {
      const result = inferMerchantAndCategoryFromText("cafe colombia");
      assert.equal(result.category, ExpenseCategory.RESTAURANT);
      assert.equal(result.merchant, "Restaurante");
    });

    it("retorna null para merchant y categoria cuando no hay match", () => {
      const result = inferMerchantAndCategoryFromText("compra random sin categoria");
      assert.equal(result.merchant, null);
      assert.equal(result.category, null);
    });

    it("la primera regla que hace match gana", () => {
      const result = inferMerchantAndCategoryFromText("uber en el exito");
      assert.equal(result.category, ExpenseCategory.TRANSPORT);
      assert.equal(result.merchant, "Uber");
    });

    it("matchea keywords en cualquier posicion del texto", () => {
      const result = inferMerchantAndCategoryFromText("la cuenta del restaurante");
      assert.equal(result.category, ExpenseCategory.RESTAURANT);
    });

    it("matchea D1 como SUPERMARKET", () => {
      const result = inferMerchantAndCategoryFromText("compra en d1");
      assert.equal(result.category, ExpenseCategory.SUPERMARKET);
    });

    it("matchea netflix como ENTERTAINMENT", () => {
      const result = inferMerchantAndCategoryFromText("suscripcion netflix");
      assert.equal(result.category, ExpenseCategory.ENTERTAINMENT);
    });

    it("matchea arriendo como HOUSING", () => {
      const result = inferMerchantAndCategoryFromText("pago de arriendo");
      assert.equal(result.category, ExpenseCategory.HOUSING);
    });

    it("matchea universidad como EDUCATION", () => {
      const result = inferMerchantAndCategoryFromText("matricula universidad");
      assert.equal(result.category, ExpenseCategory.EDUCATION);
    });
  });
});
