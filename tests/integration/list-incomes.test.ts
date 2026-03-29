import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeListIncomes } from "../../src/tools/list-incomes.js";
import { executeLogIncome } from "../../src/tools/log-income.js";
import { executeLogIncomeReceipt } from "../../src/tools/log-income-receipt.js";
import { createTestDb } from "../helpers/test-db.js";

describe("list_incomes — integración", () => {
  it("retorna mensaje claro cuando no hay ingresos", () => {
    const db = createTestDb();
    const result = executeListIncomes({}, db);
    assert.match(result, /No hay ingresos registrados/);
  });

  it("lista ingresos sin filtros (default limit 20)", () => {
    const db = createTestDb();

    executeLogIncome({
      expected_amount: 1000000,
      reason: "Salario mensual",
      date: "2026-03-01",
    }, db);

    executeLogIncome({
      expected_amount: 500000,
      reason: "Freelance proyecto X",
      date: "2026-03-15",
    }, db);

    const result = executeListIncomes({}, db);

    assert.ok(result.includes("Salario mensual"), result);
    assert.ok(result.includes("Freelance proyecto X"), result);
    assert.ok(result.includes("1.000.000"), result);
    assert.ok(result.includes("500.000"), result);
  });

  it("filtra por recurring=true", () => {
    const db = createTestDb();

    executeLogIncome({
      expected_amount: 1000000,
      reason: "Salario recurrente",
      date: "2026-03-01",
      recurring: true,
      frequency: "MONTHLY",
    }, db);

    executeLogIncome({
      expected_amount: 500000,
      reason: "Freelance puntual",
      date: "2026-03-15",
    }, db);

    const result = executeListIncomes({ recurring: true }, db);

    assert.ok(result.includes("Salario recurrente"), result);
    assert.ok(!result.includes("Freelance puntual"), result);
  });

  it("filtra por recurring=false", () => {
    const db = createTestDb();

    executeLogIncome({
      expected_amount: 1000000,
      reason: "Salario recurrente",
      date: "2026-03-01",
      recurring: true,
      frequency: "MONTHLY",
    }, db);

    executeLogIncome({
      expected_amount: 500000,
      reason: "Freelance puntual",
      date: "2026-03-15",
    }, db);

    const result = executeListIncomes({ recurring: false }, db);

    assert.ok(result.includes("Freelance puntual"), result);
    assert.ok(!result.includes("Salario recurrente"), result);
  });

  it("filtra por búsqueda en reason", () => {
    const db = createTestDb();

    executeLogIncome({
      expected_amount: 1000000,
      reason: "Salario mensual empresa",
      date: "2026-03-01",
    }, db);

    executeLogIncome({
      expected_amount: 500000,
      reason: "Pago freelance independiente",
      date: "2026-03-15",
    }, db);

    const result = executeListIncomes({ search: "salario" }, db);

    assert.ok(result.includes("Salario mensual empresa"), result);
    assert.ok(!result.includes("freelance"), result.toLowerCase());
  });

  it("filtra por moneda", () => {
    const db = createTestDb();

    db.prepare(`
      INSERT INTO currencies (code, name, symbol, is_default)
      VALUES ('USD', 'Dólar', '$', 0)
    `).run();

    executeLogIncome({
      expected_amount: 1000000,
      reason: "Ingreso en COP",
      date: "2026-03-01",
    }, db);

    executeLogIncome({
      expected_amount: 500,
      reason: "Ingreso en USD",
      date: "2026-03-15",
      currency: "USD",
    }, db);

    const result = executeListIncomes({ currency: "USD" }, db);

    assert.ok(result.includes("Ingreso en USD"), result);
    assert.ok(!result.includes("Ingreso en COP"), result);
  });

  it("lanza error si la moneda del filtro no está registrada", () => {
    const db = createTestDb();

    assert.throws(
      () => executeListIncomes({ currency: "EUR" }, db),
      /no está registrada/,
    );
  });

  it("soporta paginación con limit y offset", () => {
    const db = createTestDb();

    const ids: string[] = [];
    for (let i = 1; i <= 5; i++) {
      executeLogIncome({
        expected_amount: 100000 * i,
        reason: `Ingreso ${i}`,
        date: "2026-03-01",
      }, db);
      const row = db.prepare("SELECT id FROM incomes WHERE reason = ?").get(`Ingreso ${i}`) as { id: string };
      ids.push(row.id);
    }

    const page1 = executeListIncomes({ limit: 2, offset: 0 }, db);
    assert.ok(page1.includes("Ingresos (2"), page1);

    const page2 = executeListIncomes({ limit: 2, offset: 2 }, db);
    assert.ok(page2.includes("Ingresos (2"), page2);

    const page3 = executeListIncomes({ limit: 2, offset: 4 }, db);
    assert.ok(page3.includes("Ingresos (1"), page3);
  });

  it("reporta total correcto aunque la página esté truncada", () => {
    const db = createTestDb();

    for (let i = 1; i <= 5; i++) {
      executeLogIncome({
        expected_amount: 100000 * i,
        reason: `Ingreso ${i}`,
        date: "2026-03-01",
      }, db);
    }

    const result = executeListIncomes({ limit: 2, offset: 0 }, db);

    assert.ok(result.includes("de 5"), result);
  });

  it("retorna lista vacía con total correcto cuando offset está fuera del rango", () => {
    const db = createTestDb();

    executeLogIncome({
      expected_amount: 100000,
      reason: "Ingreso único",
      date: "2026-03-01",
    }, db);

    const result = executeListIncomes({ limit: 10, offset: 100 }, db);

    assert.ok(result.includes("No hay ingresos"), result);
    assert.ok(result.includes("total: 1"), result);
  });

  it("include_receipts=true muestra los últimos 5 receipts por income", () => {
    const db = createTestDb();

    executeLogIncome({
      expected_amount: 1000000,
      reason: "Salario mensual",
      date: "2026-03-01",
      recurring: true,
      frequency: "MONTHLY",
    }, db);

    const incomeRow = db.prepare("SELECT id FROM incomes WHERE reason = ?").get("Salario mensual") as { id: string };

    executeLogIncomeReceipt({
      income_id: incomeRow.id,
      received_amount: 1000000,
      received_on: "2026-03-01",
    }, db);

    executeLogIncomeReceipt({
      income_id: incomeRow.id,
      received_amount: 1000000,
      received_on: "2026-02-01",
    }, db);

    executeLogIncomeReceipt({
      income_id: incomeRow.id,
      received_amount: 1000000,
      received_on: "2026-01-01",
    }, db);

    const result = executeListIncomes({ include_receipts: true }, db);

    assert.ok(result.includes("Recibido:"), result);
    assert.ok(result.includes("2026-03-01"), result);
    assert.ok(result.includes("2026-02-01"), result);
    assert.ok(result.includes("2026-01-01"), result);
  });

  it("include_receipts=true muestra receipts asociados", () => {
    const db = createTestDb();

    executeLogIncome({
      expected_amount: 500000,
      reason: "Freelance con receipt",
      date: "2026-03-15",
    }, db);

    const result = executeListIncomes({ include_receipts: true }, db);

    assert.ok(result.includes("Recibido:"), result);
  });

  it("include_receipts=true limita a 5 receipts por cada income y en orden descendente", () => {
    const db = createTestDb();

    executeLogIncome({
      expected_amount: 1000000,
      reason: "Salario A",
      date: "2026-01-01",
      recurring: true,
      frequency: "MONTHLY",
    }, db);

    const incomeA = db.prepare("SELECT id FROM incomes WHERE reason = ?").get("Salario A") as { id: string };

    for (let i = 2; i <= 7; i++) {
      const month = String(i).padStart(2, "0");
      executeLogIncomeReceipt({
        income_id: incomeA.id,
        received_amount: 1000000,
        received_on: `2026-${month}-01`,
      }, db);
    }

    const result = executeListIncomes({ include_receipts: true }, db);

    const lines = result.split("\n");
    const receiptLines = lines.filter((l) => l.includes("Recibido:"));

    assert.equal(receiptLines.length, 5, `Debe haber exactamente 5 receipts, hay ${receiptLines.length}`);

    const dates = receiptLines.map((l) => {
      const match = /(\d{4}-\d{2}-\d{2})/.exec(l);
      return match ? match[1] : "";
    });

    const expectedOrder = ["2026-07-01", "2026-06-01", "2026-05-01", "2026-04-01", "2026-03-01"];
    for (let i = 0; i < expectedOrder.length; i++) {
      assert.equal(
        dates[i],
        expectedOrder[i],
        `Receipt ${i} debe ser ${expectedOrder[i]}, pero es ${dates[i]}. Orden: ${dates.join(", ")}`,
      );
    }
  });

  it("include_receipts=true con múltiples incomes limita a 5 receipts por cada uno", () => {
    const db = createTestDb();

    executeLogIncome({
      expected_amount: 1000000,
      reason: "Salario A",
      date: "2026-01-01",
      recurring: true,
      frequency: "MONTHLY",
    }, db);

    executeLogIncome({
      expected_amount: 500000,
      reason: "Salario B",
      date: "2026-01-01",
      recurring: true,
      frequency: "MONTHLY",
    }, db);

    const incomeA = db.prepare("SELECT id FROM incomes WHERE reason = ?").get("Salario A") as { id: string };
    const incomeB = db.prepare("SELECT id FROM incomes WHERE reason = ?").get("Salario B") as { id: string };

    for (let i = 2; i <= 8; i++) {
      const month = String(i).padStart(2, "0");
      executeLogIncomeReceipt({
        income_id: incomeA.id,
        received_amount: 1000000,
        received_on: `2026-${month}-01`,
      }, db);
    }

    for (let i = 2; i <= 4; i++) {
      const month = String(i).padStart(2, "0");
      executeLogIncomeReceipt({
        income_id: incomeB.id,
        received_amount: 500000,
        received_on: `2026-${month}-01`,
      }, db);
    }

    const result = executeListIncomes({ include_receipts: true }, db);

    const lines = result.split("\n");
    const idxA = lines.findIndex((l) => l.includes("Salario A"));
    const idxB = lines.findIndex((l) => l.includes("Salario B"));

    let salaryABlock, salaryBBlock;
    if (idxA < idxB) {
      salaryABlock = lines.slice(idxA, idxB).join("\n");
      salaryBBlock = lines.slice(idxB).join("\n");
    } else {
      salaryBBlock = lines.slice(idxB, idxA).join("\n");
      salaryABlock = lines.slice(idxA).join("\n");
    }

    assert.ok(salaryABlock.includes("2026-08-01"), "Salario A debe incluir receipt de agosto (más reciente)");
    assert.ok(salaryABlock.includes("2026-04-01"), "Salario A debe incluir receipt de abril (quinto más reciente)");
    assert.ok(!salaryABlock.includes("2026-03-01"), "Salario A no debe incluir receipt de marzo (sexto más reciente)");

    assert.ok(salaryBBlock.includes("2026-04-01"), "Salario B debe incluir receipt de abril");
    assert.ok(salaryBBlock.includes("2026-03-01"), "Salario B debe incluir receipt de marzo");
    assert.ok(salaryBBlock.includes("2026-02-01"), "Salario B debe incluir receipt de febrero");
    assert.ok(salaryBBlock.includes("2026-01-01"), "Salario B debe incluir receipt inicial de enero");

    const receiptMatches = result.match(/Recibido:/g);
    const totalReceipts = receiptMatches ? receiptMatches.length : 0;
    assert.equal(totalReceipts, 9, `Total receipts: 5 de A + 4 de B (incluye receipt inicial) = 9, encontrado: ${totalReceipts}`);
  });

  it("combina múltiples filtros", () => {
    const db = createTestDb();

    db.prepare(`
      INSERT INTO currencies (code, name, symbol, is_default)
      VALUES ('USD', 'Dólar', '$', 0)
    `).run();

    executeLogIncome({
      expected_amount: 1000000,
      reason: "Salario recurrente USD",
      date: "2026-03-01",
      recurring: true,
      frequency: "MONTHLY",
      currency: "USD",
    }, db);

    executeLogIncome({
      expected_amount: 500000,
      reason: "Freelance puntual COP",
      date: "2026-03-15",
    }, db);

    const result = executeListIncomes({
      recurring: true,
      currency: "USD",
    }, db);

    assert.ok(result.includes("Salario recurrente USD"), result);
    assert.ok(!result.includes("Freelance"), result);
  });

  it("incluye ID utilizable en la salida", () => {
    const db = createTestDb();

    executeLogIncome({
      expected_amount: 1000000,
      reason: "Salario",
      date: "2026-03-01",
    }, db);

    const incomeRow = db.prepare("SELECT id FROM incomes WHERE reason = ?").get("Salario") as { id: string };

    const result = executeListIncomes({}, db);

    assert.ok(result.includes(incomeRow.id), result);
  });

  it("muestra información de ingresos recurrentes correctamente", () => {
    const db = createTestDb();

    executeLogIncome({
      expected_amount: 1000000,
      reason: "Salario mensual",
      date: "2026-03-01",
      recurring: true,
      frequency: "MONTHLY",
    }, db);

    const result = executeListIncomes({}, db);

    assert.ok(result.includes("[MONTHLY]"), result);
    assert.ok(result.includes("Próxima:"), result);
  });

  it("muestra información de ingresos no recurrentes sin confusión", () => {
    const db = createTestDb();

    executeLogIncome({
      expected_amount: 500000,
      reason: "Freelance puntual",
      date: "2026-03-15",
    }, db);

    const result = executeListIncomes({}, db);

    assert.ok(result.includes("Freelance puntual"), result);
    assert.ok(!result.includes("Próxima:"), result);
  });

  it("ingreso inactivo se marca claramente", () => {
    const db = createTestDb();

    executeLogIncome({
      expected_amount: 1000000,
      reason: "Salario inactivo",
      date: "2026-03-01",
      recurring: true,
      frequency: "MONTHLY",
    }, db);

    db.prepare("UPDATE incomes SET is_active = 0 WHERE reason = ?").run("Salario inactivo");

    const result = executeListIncomes({}, db);

    assert.ok(result.includes("INACTIVO"), result);
  });

  it("search sin matches retorna mensaje legible", () => {
    const db = createTestDb();

    executeLogIncome({
      expected_amount: 1000000,
      reason: "Salario",
      date: "2026-03-01",
    }, db);

    const result = executeListIncomes({ search: "xyzinexistente" }, db);

    assert.ok(result.includes("No hay ingresos"), result);
  });

  it("hint de paginación cuando hay más resultados", () => {
    const db = createTestDb();

    for (let i = 1; i <= 3; i++) {
      executeLogIncome({
        expected_amount: 100000 * i,
        reason: `Ingreso ${i}`,
        date: "2026-03-01",
      }, db);
    }

    const result = executeListIncomes({ limit: 2, offset: 0 }, db);

    assert.ok(result.includes("Hay más resultados"), result);
  });

  it("mensaje de fin cuando no hay más resultados", () => {
    const db = createTestDb();

    for (let i = 1; i <= 3; i++) {
      executeLogIncome({
        expected_amount: 100000 * i,
        reason: `Ingreso pag ${i}`,
        date: "2026-03-01",
      }, db);
    }

    const page1 = executeListIncomes({ limit: 2, offset: 0 }, db);
    assert.ok(page1.includes("Hay más resultados"), page1);

    const page2 = executeListIncomes({ limit: 2, offset: 2 }, db);
    assert.ok(page2.includes("Has llegado al final"), page2);
  });
});
