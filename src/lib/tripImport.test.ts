import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { RoutePlan, Vehicle } from "../types";
import {
  buildTripDrafts,
  detectTripColumns,
  draftsToTripImport,
  parseTripTemplateExample,
  parseTripWorkbook,
  placeKey,
  splitRouteName,
  tripKey,
} from "./tripImport";
import { parseNumber } from "./fuelImport";

const vehicles: Vehicle[] = [
  {
    id: "v-volvo",
    name: "Volvo FH 500",
    plate: "А 123 ВС 777",
    type: "tractor",
    year: 2021,
    consumption: 32,
    plannedKm: 120000,
    status: "active",
    leaseMonthly: 0,
    insuranceAnnual: 0,
  },
  {
    id: "v-man",
    name: "MAN TGX",
    plate: "В 456 ОР 777",
    type: "tractor",
    year: 2020,
    consumption: 33,
    plannedKm: 110000,
    status: "active",
    leaseMonthly: 0,
    insuranceAnnual: 0,
  },
];

const routes: RoutePlan[] = [
  {
    id: "r-spb",
    name: "Москва — Санкт-Петербург",
    from: "Москва",
    to: "Санкт-Петербург",
    distanceKm: 710,
    avgRevenue: 100000,
    tripsPerMonth: 12,
    vehicleId: "v-volvo",
  },
];

describe("splitRouteName / placeKey", () => {
  it("делит направление по тире", () => {
    expect(splitRouteName("Москва — Санкт-Петербург")).toEqual({
      from: "Москва",
      to: "Санкт-Петербург",
      name: "Москва — Санкт-Петербург",
    });
    expect(placeKey("Москва", "Санкт-Петербург")).toBe(placeKey("москва", "санкт петербург"));
  });
});

describe("detectTripColumns", () => {
  it("находит таблицу перевозок", () => {
    const cols = detectTripColumns([
      "Дата",
      "Маршрут",
      "Откуда",
      "Куда",
      "Госномер",
      "Км",
      "Стоимость",
      "Заказчик",
    ]);
    expect(cols.date).toBe(0);
    expect(cols.route).toBe(1);
    expect(cols.from).toBe(2);
    expect(cols.to).toBe(3);
    expect(cols.plate).toBe(4);
    expect(cols.distance).toBe(5);
    expect(cols.amount).toBe(6);
    expect(cols.customer).toBe(7);
  });
});

describe("buildTripDrafts", () => {
  it("читает рейс, матчит ТС и существующий маршрут", () => {
    const drafts = buildTripDrafts(
      [["12.09.2026", "Москва — Санкт-Петербург", "", "", "A123BC777", 710, "110 000", "ООО Клиент", "металлопрокат"]],
      {
        date: 0,
        route: 1,
        from: 2,
        to: 3,
        plate: 4,
        distance: 5,
        amount: 6,
        customer: 7,
        cargo: 8,
      },
      vehicles,
      routes,
      new Set(),
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].errors).toEqual([]);
    expect(drafts[0].from).toBe("Москва");
    expect(drafts[0].to).toBe("Санкт-Петербург");
    expect(drafts[0].vehicleId).toBe("v-volvo");
    expect(drafts[0].routeId).toBe("r-spb");
    expect(drafts[0].amount).toBe(110000);
    expect(parseNumber("110 000")).toBe(110000);
  });

  it("помечает дубликат и строку только для справочника", () => {
    const key = tripKey({
      date: "2026-09-12",
      from: "Москва",
      to: "Казань",
      plate: "В456ОР777",
      amount: 125000,
    });
    const drafts = buildTripDrafts(
      [
        ["12.09.2026", "Москва — Казань", "", "", "В456ОР777", 820, 125000, "", ""],
        ["", "Подольск — Регион", "Подольск", "Регион", "", 280, 32000, "", ""],
      ],
      {
        date: 0,
        route: 1,
        from: 2,
        to: 3,
        plate: 4,
        distance: 5,
        amount: 6,
        customer: 7,
        cargo: 8,
      },
      vehicles,
      routes,
      new Set([key]),
    );
    expect(drafts[0].duplicate).toBe(true);
    expect(drafts[1].date).toBeUndefined();
    expect(drafts[1].errors).toEqual([]);
    expect(drafts[1].warnings.some((w) => w.includes("справочник"))).toBe(true);
  });
});

describe("draftsToTripImport", () => {
  it("добавляет маршрут и доходную операцию", () => {
    const drafts = buildTripDrafts(
      [["13.09.2026", "Москва — Казань", "", "", "В456ОР777", 820, 125000, "АО РусАгро", "сборный"]],
      {
        date: 0,
        route: 1,
        from: 2,
        to: 3,
        plate: 4,
        distance: 5,
        amount: 6,
        customer: 7,
        cargo: 8,
      },
      vehicles,
      routes,
      new Set(),
    );
    const payload = draftsToTripImport(drafts, routes);
    expect(payload.routes.some((r) => r.to === "Казань")).toBe(true);
    expect(payload.transactions).toHaveLength(1);
    expect(payload.transactions[0].type).toBe("income");
    expect(payload.transactions[0].categoryId).toBe("inc-freight");
    expect(payload.transactions[0].amount).toBe(125000);
    expect(payload.transactions[0].comment).toContain("Москва — Казань");
  });
});

describe("parseTripWorkbook", () => {
  it("читает шаблонный Excel", () => {
    const parsed = parseTripTemplateExample(vehicles, routes, new Set());
    expect(parsed.columns.date).toBeDefined();
    expect(parsed.columns.amount).toBeDefined();
    const ready = parsed.drafts.filter((d) => d.errors.length === 0);
    expect(ready.length).toBeGreaterThanOrEqual(3);
    const payload = draftsToTripImport(parsed.drafts, routes);
    expect(payload.transactions.length).toBeGreaterThanOrEqual(2);
    expect(payload.routes.some((r) => r.from === "Подольск")).toBe(true);
  });

  it("читает workbook из байтов", () => {
    const rows = [
      ["Дата", "Откуда", "Куда", "Стоимость"],
      ["16.09.2026", "Москва", "Тверь", 45000],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Рейсы");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const parsed = parseTripWorkbook(buf, vehicles, routes, new Set());
    expect(parsed.drafts[0].from).toBe("Москва");
    expect(parsed.drafts[0].to).toBe("Тверь");
    expect(parsed.drafts[0].amount).toBe(45000);
  });
});
