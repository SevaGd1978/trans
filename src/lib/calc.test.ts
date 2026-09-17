import { describe, expect, it } from "vitest";
import {
  applyScenario,
  budgetMap,
  costPerKm,
  executionPercent,
  fuelCost,
  monthlySeries,
  planFactRows,
  spreadEven,
  totals,
  variance,
} from "./calc";
import type { Category, Transaction } from "../types";

describe("fuelCost", () => {
  it("считает расход по пробегу и цене литра", () => {
    expect(fuelCost(1000, 32, 75)).toBe(24000);
  });

  it("возвращает 0 при нулевом пробеге", () => {
    expect(fuelCost(0, 32, 75)).toBe(0);
  });
});

describe("variance", () => {
  it("считает перерасход относительно плана", () => {
    expect(variance(100, 120)).toEqual({ amount: 20, percent: 20 });
  });

  it("считает экономию", () => {
    expect(variance(100, 80)).toEqual({ amount: -20, percent: -20 });
  });

  it("обрабатывает нулевой план", () => {
    expect(variance(0, 50)).toEqual({ amount: 50, percent: 100 });
    expect(variance(0, 0)).toEqual({ amount: 0, percent: 0 });
  });
});

describe("spreadEven", () => {
  it("раскладывает годовую сумму по 12 месяцам без потери копеек", () => {
    const months = spreadEven(100);
    expect(months).toHaveLength(12);
    expect(months.reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("costPerKm", () => {
  it("делит годовые затраты на пробег", () => {
    expect(costPerKm(120000, 10000)).toBe(12);
  });
});

describe("totals and monthlySeries", () => {
  const tx: Transaction[] = [
    {
      id: "1",
      type: "income",
      date: "2026-01-10",
      amount: 100000,
      categoryId: "inc-freight",
      counterparty: "A",
      comment: "",
    },
    {
      id: "2",
      type: "expense",
      date: "2026-01-12",
      amount: 40000,
      categoryId: "exp-fuel",
      counterparty: "B",
      comment: "",
    },
    {
      id: "3",
      type: "income",
      date: "2026-02-01",
      amount: 50000,
      categoryId: "inc-freight",
      counterparty: "A",
      comment: "",
    },
  ];

  it("считает прибыль", () => {
    expect(totals(tx)).toEqual({ income: 150000, expense: 40000, profit: 110000 });
  });

  it("раскладывает доходы и расходы по месяцам", () => {
    const series = monthlySeries(tx, 2026);
    expect(series[0]).toMatchObject({ income: 100000, expense: 40000, profit: 60000 });
    expect(series[1]).toMatchObject({ income: 50000, expense: 0 });
  });
});

describe("planFactRows", () => {
  const categories: Category[] = [
    { id: "exp-fuel", name: "ГСМ", kind: "expense", group: "Переменные" },
  ];

  it("сводит план и факт по статье", () => {
    const rows = planFactRows(
      categories,
      [{ id: "b1", categoryId: "exp-fuel", year: 2026, months: spreadEven(1200) }],
      [
        {
          id: "t1",
          type: "expense",
          date: "2026-03-01",
          amount: 150,
          categoryId: "exp-fuel",
          counterparty: "x",
          comment: "",
        },
      ],
      2026,
      2,
      "expense",
    );
    expect(rows[0].plan).toBe(100);
    expect(rows[0].actual).toBe(150);
    expect(rows[0].amount).toBe(50);
  });

  it("считает план нарастающим итогом по март", () => {
    const rows = planFactRows(
      categories,
      [{ id: "b1", categoryId: "exp-fuel", year: 2026, months: Array(12).fill(100) }],
      [
        {
          id: "t1",
          type: "expense",
          date: "2026-02-01",
          amount: 150,
          categoryId: "exp-fuel",
          counterparty: "x",
          comment: "",
        },
        {
          id: "t2",
          type: "expense",
          date: "2026-05-01",
          amount: 999,
          categoryId: "exp-fuel",
          counterparty: "x",
          comment: "",
        },
      ],
      2026,
      undefined,
      "expense",
      2,
    );
    expect(rows[0].plan).toBe(300);
    expect(rows[0].actual).toBe(150);
  });
});

describe("applyScenario", () => {
  it("масштабирует выручку, топливо, зарплату и ремонт", () => {
    const result = applyScenario(
      1_000_000,
      {
        "exp-fuel": 200000,
        "exp-salary-drivers": 300000,
        "exp-repair": 100000,
        "exp-admin": 50000,
      },
      { fuelPct: 10, volumePct: 20, salaryPct: 5, repairPct: 50 },
      {
        fuel: "exp-fuel",
        salary: ["exp-salary-drivers"],
        repair: "exp-repair",
      },
    );
    expect(result.income).toBe(1_200_000);
    expect(result.byCategory["exp-fuel"]).toBe(264000);
    expect(result.byCategory["exp-salary-drivers"]).toBe(315000);
    expect(result.byCategory["exp-repair"]).toBe(180000);
  });
});

describe("budgetMap / executionPercent", () => {
  it("собирает годовой план", () => {
    const map = budgetMap(
      [{ id: "b", categoryId: "exp-fuel", year: 2026, months: spreadEven(1200) }],
      2026,
    );
    expect(map["exp-fuel"]).toBe(1200);
  });

  it("считает процент исполнения", () => {
    expect(executionPercent(200, 100)).toBe(50);
  });
});
