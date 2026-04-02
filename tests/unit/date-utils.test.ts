import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeNextDate,
  resolvePeriodRange,
  todayISO,
} from "../../src/tools/helpers/date-utils.js";

describe("date-utils", () => {
  it("calcula la siguiente fecha para cada frecuencia soportada", () => {
    assert.equal(computeNextDate("2026-03-01", "WEEKLY"), "2026-03-08");
    assert.equal(computeNextDate("2026-03-01", "BIWEEKLY"), "2026-03-15");
    assert.equal(computeNextDate("2026-03-01", "MONTHLY"), "2026-04-01");
    assert.equal(computeNextDate("2026-03-01", "INTERVAL_DAYS", 10), "2026-03-11");
  });

  it("clampa el día al final del mes y respeta intervalos explícitos en cero", () => {
    assert.equal(computeNextDate("2026-01-31", "MONTHLY"), "2026-02-28");
    assert.equal(computeNextDate("2026-03-01", "INTERVAL_DAYS", 0), "2026-03-01");
  });

  it("lanza un error descriptivo si la frecuencia no existe", () => {
    assert.throws(
      () => computeNextDate("2026-03-01", "DAILY"),
      /The frequency "DAILY" is not valid\./,
    );
  });

  it("resuelve rangos correctos para los períodos soportados", () => {
    assert.deepEqual(resolvePeriodRange("this_month", "2026-03-28"), {
      start: "2026-03-01",
      end: "2026-03-28",
    });
    assert.deepEqual(resolvePeriodRange("last_month", "2026-03-28"), {
      start: "2026-02-01",
      end: "2026-02-28",
    });
    assert.deepEqual(resolvePeriodRange("last_30_days", "2026-03-28"), {
      start: "2026-02-27",
      end: "2026-03-28",
    });
    assert.deepEqual(resolvePeriodRange("this_year", "2026-03-28"), {
      start: "2026-01-01",
      end: "2026-03-28",
    });
  });

  it("lanza un error descriptivo si el período no existe", () => {
    assert.throws(
      () => resolvePeriodRange("quarter" as never, "2026-03-28"),
      /The period "quarter" is not valid\./,
    );
  });

  it("retorna la fecha de hoy en formato ISO simple", () => {
    assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
  });
});
