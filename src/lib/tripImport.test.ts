import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { RoutePlan, Vehicle } from "../types";
import { parseNumber } from "./fuelImport";
import {
  buildTripDrafts,
  collectTripImportKeys,
  decodeTableText,
  detectTripColumns,
  draftsToTripImport,
  orderKey,
  parseTripTemplateExample,
  parseTripWorkbook,
  placeKey,
  splitRouteName,
  tripKey,
} from "./tripImport";

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

function encodeWin1251(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 128) out.push(c);
    else if (c >= 0x410 && c <= 0x44f) out.push(c - 0x410 + 0xc0);
    else if (c === 0x401) out.push(0xa8);
    else if (c === 0x451) out.push(0xb8);
    else if (c === 0x2116) out.push(0xb9);
    else if (c === 0x2014 || c === 0x2013) out.push(0x97);
    else if (c === 0xa0) out.push(0xa0);
    else out.push(0x3f);
  }
  return Uint8Array.from(out);
}

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "fixtures/orders-1c.csv");
const realReportPath = "/home/ubuntu/.cursor/projects/workspace/uploads/1111_523d.csv";

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

  it("находит колонки сводного отчёта 1С", () => {
    const cols = detectTripColumns([
      "№",
      "Период заказа",
      "Клиент",
      "Загрузка",
      "Разгрузка",
      "Груз",
      "Мест",
      "Объем",
      "Вес",
      "Исполнитель",
      "Водитель",
      "Сумма",
      "Исполнителю",
      "Диспетчеру",
      "Прибыль",
    ]);
    expect(cols.orderNo).toBe(0);
    expect(cols.period).toBe(1);
    expect(cols.customer).toBe(2);
    expect(cols.from).toBe(3);
    expect(cols.to).toBe(4);
    expect(cols.cargo).toBe(5);
    expect(cols.carrier).toBe(9);
    expect(cols.driver).toBe(10);
    expect(cols.amount).toBe(11);
    expect(cols.carrierAmount).toBe(12);
    expect(cols.dispatchAmount).toBe(13);
    expect(cols.profit).toBe(14);
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

  it("раскладывает заказ 1С на выручку, исполнителю и диспетчеру", () => {
    const drafts = buildTripDrafts(
      [
        [
          "24031",
          "31.08.2026  00:00 — 00:00",
          'ООО "ПЗПТ"',
          "317/08 Первоуральск УМПЦ Ревда",
          "Полевской",
          "Труба ППУ",
          "",
          "",
          "20",
          'ООО "Терминал"',
          "Погудин Андрей",
          "33 000,00",
          "0,00",
          "33 000,00",
          "0,00",
        ],
      ],
      {
        orderNo: 0,
        period: 1,
        customer: 2,
        from: 3,
        to: 4,
        cargo: 5,
        carrier: 9,
        driver: 10,
        amount: 11,
        carrierAmount: 12,
        dispatchAmount: 13,
        profit: 14,
      },
      [],
      [],
      new Set(),
    );
    expect(drafts[0].errors).toEqual([]);
    expect(drafts[0].from).toBe("Первоуральск");
    expect(drafts[0].to).toBe("Полевской");
    expect(drafts[0].date).toBe("2026-08-31");
    expect(drafts[0].carrierAmount).toBeUndefined();
    expect(drafts[0].dispatchAmount).toBe(33000);
    const payload = draftsToTripImport(drafts, []);
    expect(payload.transactions).toHaveLength(2);
    expect(payload.transactions.map((t) => t.categoryId).sort()).toEqual(["exp-dispatch", "inc-freight"]);
    expect(payload.transactions.every((t) => t.importKey?.startsWith("order|24031"))).toBe(true);
  });
});

describe("parseTripWorkbook", () => {
  it("читает шаблон сводного отчёта", () => {
    const parsed = parseTripTemplateExample(vehicles, routes, new Set());
    expect(parsed.columns.orderNo).toBeDefined();
    expect(parsed.columns.period).toBeDefined();
    expect(parsed.columns.amount).toBeDefined();
    expect(parsed.columns.carrierAmount).toBeDefined();
    const ready = parsed.drafts.filter((d) => d.errors.length === 0);
    expect(ready).toHaveLength(3);
    const payload = draftsToTripImport(parsed.drafts, routes);
    expect(payload.transactions.length).toBeGreaterThanOrEqual(6);
    expect(payload.routes.some((r) => r.from === "Домодедово" && r.to === "Екатеринбург")).toBe(true);
    expect(payload.routes.some((r) => r.from === "Полевской" && r.to === "Омск")).toBe(true);
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

  it("читает UTF-8 CSV сводного отчёта и пропускает итоги", () => {
    const buf = readFileSync(fixturePath);
    const parsed = parseTripWorkbook(buf, [], [], new Set());
    expect(parsed.drafts).toHaveLength(3);
    expect(parsed.drafts.every((d) => d.errors.length === 0)).toBe(true);
    const payload = draftsToTripImport(parsed.drafts, []);
    const income = payload.transactions.filter((t) => t.categoryId === "inc-freight");
    const carrier = payload.transactions.filter((t) => t.categoryId === "exp-carrier");
    const dispatch = payload.transactions.filter((t) => t.categoryId === "exp-dispatch");
    expect(income.reduce((a, t) => a + t.amount, 0)).toBe(323000);
    expect(carrier.reduce((a, t) => a + t.amount, 0)).toBe(260000);
    expect(dispatch.reduce((a, t) => a + t.amount, 0)).toBe(33000);
    expect(payload.transactions.some((t) => t.amount === 323000)).toBe(false);
    expect(collectTripImportKeys(payload.transactions).has(orderKey("23856"))).toBe(true);
  });

  it("читает тот же отчёт в Windows-1251", () => {
    const utf8 = readFileSync(fixturePath, "utf8");
    const bytes = encodeWin1251(utf8);
    expect(decodeTableText(bytes)).toContain("Сводный отчет");
    const parsed = parseTripWorkbook(bytes, [], [], new Set());
    expect(parsed.drafts).toHaveLength(3);
    expect(parsed.drafts[0].customer).toContain("ЛИДЕРТРАНС");
    expect(parsed.drafts[0].from).toBe("Домодедово");
  });
});

describe("реальный сводный отчёт 1С", () => {
  it.skipIf(!existsSync(realReportPath))("принимает 123 заказа и сходится с подвалом", () => {
    const buf = readFileSync(realReportPath);
    const parsed = parseTripWorkbook(buf, [], [], new Set());
    const ready = parsed.drafts.filter((d) => d.errors.length === 0);
    expect(ready).toHaveLength(123);
    expect(ready.some((d) => d.orderNo === "24008" && d.warnings.some((w) => w.includes("Нулевые")))).toBe(
      true,
    );
    expect(parsed.drafts.some((d) => d.amount === 10_292_564)).toBe(false);
    const payload = draftsToTripImport(parsed.drafts, []);
    const sum = (cat: string) =>
      payload.transactions.filter((t) => t.categoryId === cat).reduce((a, t) => a + t.amount, 0);
    expect(sum("inc-freight")).toBeCloseTo(10_292_564, 0);
    expect(sum("exp-carrier")).toBeCloseTo(8_586_696, 0);
    expect(sum("exp-dispatch")).toBeCloseTo(728_000, 0);
    expect(payload.routes.some((r) => r.from === "Полевской")).toBe(true);
    expect(payload.routes.some((r) => r.to === "Екатеринбург")).toBe(true);
  });
});
