import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { Vehicle } from "../types";
import {
  buildDrafts,
  detectColumns,
  draftsToTransactions,
  fillingKey,
  findHeaderRow,
  normalizePlate,
  parseDate,
  parseFuelWorkbook,
  parseNumber,
} from "./fuelImport";

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
];

describe("normalizePlate", () => {
  it("убирает пробелы и приводит латиницу к кириллице", () => {
    expect(normalizePlate("A 123 BC 777")).toBe(normalizePlate("А123ВС777"));
    expect(normalizePlate("а-123-вс-777")).toBe("А123ВС777");
  });
});

describe("parseDate / parseNumber", () => {
  it("читает дату ДД.ММ.ГГГГ и ISO", () => {
    expect(parseDate("16.09.2026")).toBe("2026-09-16");
    expect(parseDate("2026-09-16")).toBe("2026-09-16");
  });

  it("читает серийный номер Excel", () => {
    expect(parseDate(46281)).toBe("2026-09-16");
  });

  it("читает сумму в русском формате", () => {
    expect(parseNumber("29 406,50")).toBe(29406.5);
  });
});

describe("detectColumns", () => {
  it("находит русские заголовки топливного отчёта", () => {
    const cols = detectColumns(["Дата", "Госномер", "Показания одометра", "Литры", "Цена за литр", "Сумма", "АЗС"]);
    expect(cols.date).toBe(0);
    expect(cols.plate).toBe(1);
    expect(cols.odometer).toBe(2);
    expect(cols.liters).toBe(3);
    expect(cols.price).toBe(4);
    expect(cols.amount).toBe(5);
    expect(cols.station).toBe(6);
  });

  it("находит строку заголовка после шапки файла", () => {
    const rows = [
      ["ООО СеверТранс", "", ""],
      ["Отчёт по топливным картам", "", ""],
      ["Дата", "Госномер", "Литры"],
      ["16.09.2026", "А123ВС777", 100],
    ];
    expect(findHeaderRow(rows)).toBe(2);
  });
});

describe("buildDrafts", () => {
  it("считает сумму как литры × цена и расход по пробегу", () => {
    const cols = detectColumns(["Дата", "Госномер", "Показания", "Литры", "Цена за литр", "Сумма", "АЗС"]);
    const drafts = buildDrafts(
      [
        ["12.09.2026", "А123ВС777", 100000, 320, 75, "", "ГПН"],
        ["14.09.2026", "A 123 BC 777", 101000, 320, 75, "", "ГПН"],
      ],
      cols,
      vehicles,
      75.4,
      new Set(),
    );
    expect(drafts).toHaveLength(2);
    expect(drafts[0].errors).toEqual([]);
    expect(drafts[0].vehicleId).toBe("v-volvo");
    expect(drafts[0].amount).toBe(24000);
    expect(drafts[1].km).toBe(1000);
    expect(drafts[1].consumption).toBe(32);
  });

  it("помечает дубликаты и неизвестный госномер", () => {
    const cols = detectColumns(["Дата", "Госномер", "Литры", "Сумма"]);
    const row = ["16.09.2026", "Х999ХХ99", 10, 750];
    const key = fillingKey({ date: "2026-09-16", plate: "Х999ХХ99", liters: 10, amount: 750 });
    const drafts = buildDrafts([row], cols, vehicles, 75, new Set([key]));
    expect(drafts[0].duplicate).toBe(true);
    expect(drafts[0].warnings.some((w) => w.includes("не найдено"))).toBe(true);
  });

  it("требует дату и объём или сумму", () => {
    const cols = detectColumns(["Дата", "Госномер", "Литры"]);
    const drafts = buildDrafts([["", "А123ВС777", ""]], cols, vehicles, 75, new Set());
    expect(drafts[0].errors).toContain("Нет даты");
    expect(drafts[0].errors).toContain("Нет литров и суммы");
  });
});

describe("parseFuelWorkbook", () => {
  it("читает xlsx и готовит операции ГСМ", () => {
    const aoa = [
      ["Дата", "Госномер", "Показания", "Литры", "Цена за литр", "АЗС"],
      ["16.09.2026", "А 123 ВС 777", 120000, 200, 75, "Лукойл"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Заправки");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const { drafts } = parseFuelWorkbook(buf as Uint8Array, vehicles, 75.4, new Set());
    expect(drafts[0].vehicleId).toBe("v-volvo");
    expect(drafts[0].amount).toBe(15000);
    const txs = draftsToTransactions(drafts);
    expect(txs).toHaveLength(1);
    expect(txs[0].categoryId).toBe("exp-fuel");
    expect(txs[0].liters).toBe(200);
    expect(txs[0].odometer).toBe(120000);
  });
});
