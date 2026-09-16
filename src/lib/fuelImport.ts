import * as XLSX from "xlsx";
import { roundMoney } from "./calc";
import { numberRu, uid } from "./format";
import type { Transaction, Vehicle } from "../types";

export type FuelColumn =
  | "date"
  | "plate"
  | "odometer"
  | "liters"
  | "price"
  | "amount"
  | "station"
  | "comment";

const COLUMN_ALIASES: Record<FuelColumn, string[]> = {
  date: ["дата", "date", "день"],
  plate: ["госномер", "гос номер", "грз", "номер тс", "авто", "машина", "тс", "plate", "reg"],
  odometer: ["показания", "одометр", "пробег", "спидометр", "odometer"],
  liters: ["литры", "литр", "объём", "объем", "количество л", "fuel", "volume"],
  price: ["цена за литр", "цена/л", "цена л", "тариф", "price"],
  amount: ["сумма", "стоимость", "итого", "amount", "cost"],
  station: ["азс", "станция", "контрагент", "поставщик", "station"],
  comment: ["комментарий", "примечание", "comment"],
};

const LATIN_TO_CYR: Record<string, string> = {
  A: "А",
  B: "В",
  C: "С",
  E: "Е",
  H: "Н",
  K: "К",
  M: "М",
  O: "О",
  P: "Р",
  T: "Т",
  X: "Х",
  Y: "У",
};

export function normalizePlate(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/Ё/g, "Е")
    .replace(/[\s\-._]/g, "")
    .replace(/[ABCEHKMOPTXY]/g, (ch) => LATIN_TO_CYR[ch] ?? ch);
}

export function parseNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value)
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return undefined;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseDate(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const utc = Date.UTC(1899, 11, 30) + Math.round(value) * 86400000;
    const d = new Date(utc);
    return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(value).trim();
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    return isoDate(year, month, day);
  }
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) return isoDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  return undefined;
}

function normHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9/]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectColumns(headers: unknown[]): Partial<Record<FuelColumn, number>> {
  const candidates: { field: FuelColumn; col: number; score: number }[] = [];
  headers.forEach((header, col) => {
    const n = normHeader(String(header ?? ""));
    if (!n) return;
    (Object.keys(COLUMN_ALIASES) as FuelColumn[]).forEach((field) => {
      let score = 0;
      for (const alias of COLUMN_ALIASES[field]) {
        if (n === alias) score = Math.max(score, alias.length + 20);
        else if (n.includes(alias)) score = Math.max(score, alias.length);
      }
      if (score) candidates.push({ field, col, score });
    });
  });
  candidates.sort((a, b) => b.score - a.score);
  const usedFields = new Set<FuelColumn>();
  const usedCols = new Set<number>();
  const map: Partial<Record<FuelColumn, number>> = {};
  for (const c of candidates) {
    if (usedFields.has(c.field) || usedCols.has(c.col)) continue;
    usedFields.add(c.field);
    usedCols.add(c.col);
    map[c.field] = c.col;
  }
  return map;
}

export function findHeaderRow(rows: unknown[][]): number {
  let best = 0;
  let bestCount = 0;
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const count = Object.keys(detectColumns(rows[i] ?? [])).length;
    if (count > bestCount) {
      bestCount = count;
      best = i;
    }
  }
  return bestCount >= 2 ? best : 0;
}

export interface FuelFillingDraft {
  row: number;
  date?: string;
  plateRaw: string;
  vehicleId?: string;
  vehiclePlate?: string;
  odometer?: number;
  liters?: number;
  pricePerLiter?: number;
  amount?: number;
  station: string;
  note: string;
  km?: number;
  consumption?: number;
  errors: string[];
  warnings: string[];
  duplicate: boolean;
  importKey: string;
}

function cell(row: unknown[], index: number | undefined): unknown {
  if (index == null) return "";
  return row[index];
}

export function fillingKey(input: {
  date?: string;
  plate: string;
  liters?: number;
  amount?: number;
  odometer?: number;
}): string {
  return [
    input.date ?? "",
    normalizePlate(input.plate),
    input.liters ?? "",
    input.amount ?? "",
    input.odometer ?? "",
  ].join("|");
}

export function buildDrafts(
  rows: unknown[][],
  columns: Partial<Record<FuelColumn, number>>,
  vehicles: Vehicle[],
  fallbackPrice: number,
  existingKeys: Set<string>,
): FuelFillingDraft[] {
  const byPlate = new Map(vehicles.map((v) => [normalizePlate(v.plate), v]));
  const drafts: FuelFillingDraft[] = [];

  rows.forEach((row, i) => {
    const empty = !row.some((c) => String(c ?? "").trim() !== "");
    if (empty) return;

    const plateRaw = String(cell(row, columns.plate) ?? "").trim();
    const date = parseDate(cell(row, columns.date));
    const liters = parseNumber(cell(row, columns.liters));
    let price = parseNumber(cell(row, columns.price));
    let amount = parseNumber(cell(row, columns.amount));
    const odometer = parseNumber(cell(row, columns.odometer));
    const station = String(cell(row, columns.station) ?? "").trim();
    const note = String(cell(row, columns.comment) ?? "").trim();
    const vehicle = plateRaw ? byPlate.get(normalizePlate(plateRaw)) : undefined;

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!date) errors.push("Нет даты");
    if (!plateRaw) errors.push("Нет госномера");
    if (liters == null && amount == null) errors.push("Нет литров и суммы");
    if (liters != null && liters <= 0) errors.push("Литры должны быть больше 0");
    if (odometer != null && odometer < 0) errors.push("Пробег не может быть отрицательным");

    if (price == null && liters != null) price = fallbackPrice;
    if (amount == null && liters != null && price != null) {
      amount = roundMoney(liters * price);
      warnings.push("Сумма посчитана как литры × цена");
    }
    if (price == null && amount != null && liters != null && liters > 0) {
      price = roundMoney(amount / liters);
    }
    if (plateRaw && !vehicle) warnings.push("ТС не найдено в автопарке");
    if (odometer == null) warnings.push("Нет показаний пробега");

    const importKey = fillingKey({
      date,
      plate: plateRaw,
      liters,
      amount,
      odometer,
    });

    drafts.push({
      row: i + 1,
      date,
      plateRaw,
      vehicleId: vehicle?.id,
      vehiclePlate: vehicle?.plate,
      odometer,
      liters,
      pricePerLiter: price,
      amount,
      station: station || "АЗС",
      note,
      errors,
      warnings,
      duplicate: existingKeys.has(importKey),
      importKey,
    });
  });

  enrichConsumption(drafts, vehicles);
  return drafts;
}

function enrichConsumption(drafts: FuelFillingDraft[], vehicles: Vehicle[]) {
  const byVehicle = new Map<string, FuelFillingDraft[]>();
  for (const d of drafts) {
    const key = d.vehicleId ?? normalizePlate(d.plateRaw);
    if (!key) continue;
    const list = byVehicle.get(key) ?? [];
    list.push(d);
    byVehicle.set(key, list);
  }
  for (const [key, list] of byVehicle) {
    list.sort((a, b) => {
      const da = a.date ?? "";
      const db = b.date ?? "";
      if (da !== db) return da.localeCompare(db);
      return (a.odometer ?? 0) - (b.odometer ?? 0);
    });
    const vehicle = vehicles.find((v) => v.id === key);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      if (prev.odometer == null || cur.odometer == null || cur.liters == null) continue;
      const km = cur.odometer - prev.odometer;
      if (km <= 0) {
        cur.warnings.push("Показания пробега не выросли");
        continue;
      }
      cur.km = km;
      cur.consumption = roundMoney((cur.liters / km) * 100);
      if (vehicle && cur.consumption > vehicle.consumption * 1.35) {
        cur.warnings.push(
          `Расход ${numberRu(cur.consumption, 1)} л/100 км выше нормы ${numberRu(vehicle.consumption, 1)}`,
        );
      }
    }
  }
}

export function fuelComment(draft: FuelFillingDraft): string {
  const parts: string[] = [];
  if (draft.liters != null) parts.push(`${numberRu(draft.liters, 1)} л`);
  if (draft.odometer != null) parts.push(`пробег ${numberRu(draft.odometer)} км`);
  if (draft.km != null) parts.push(`+${numberRu(draft.km)} км`);
  if (draft.consumption != null) parts.push(`${numberRu(draft.consumption, 1)} л/100 км`);
  if (draft.note) parts.push(draft.note);
  return parts.join(" · ");
}

export function draftsToTransactions(drafts: FuelFillingDraft[]): Transaction[] {
  return drafts
    .filter((d) => d.errors.length === 0 && !d.duplicate)
    .map((d) => ({
      id: uid("tx"),
      type: "expense" as const,
      date: d.date as string,
      amount: d.amount ?? 0,
      categoryId: "exp-fuel",
      vehicleId: d.vehicleId,
      counterparty: d.station,
      comment: fuelComment(d),
      liters: d.liters,
      odometer: d.odometer,
      pricePerLiter: d.pricePerLiter,
      importKey: d.importKey,
    }));
}

export function parseFuelWorkbook(
  data: ArrayBuffer | Uint8Array,
  vehicles: Vehicle[],
  fallbackPrice: number,
  existingKeys: Set<string>,
): { drafts: FuelFillingDraft[]; columns: Partial<Record<FuelColumn, number>>; sheet: string } {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  const sheet = wb.SheetNames[0];
  if (!sheet) {
    return { drafts: [], columns: {}, sheet: "" };
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], {
    header: 1,
    raw: true,
    defval: "",
  });
  const headerIndex = findHeaderRow(rows);
  const columns = detectColumns(rows[headerIndex] ?? []);
  const body = rows.slice(headerIndex + 1);
  return {
    drafts: buildDrafts(body, columns, vehicles, fallbackPrice, existingKeys),
    columns,
    sheet,
  };
}

export const TEMPLATE_HEADERS = [
  "Дата",
  "Госномер",
  "Показания",
  "Литры",
  "Цена за литр",
  "Сумма",
  "АЗС",
  "Комментарий",
] as const;

export function buildFuelTemplateWorkbook(): XLSX.WorkBook {
  const rows = [
    [...TEMPLATE_HEADERS],
    ["12.09.2026", "А123ВС777", 118400, 390, 75.4, 29406, "ГПН-АЗС", "карта 1044"],
    ["14.09.2026", "А 123 ВС 777", 119620, 385, 75.4, 29029, "Лукойл", ""],
    ["13.09.2026", "В456ОР777", 97210, 410, 76.1, 31201, "Роснефть", ""],
    ["15.09.2026", "A456OP777", 98540, 402, "", "", "ГПН-АЗС", "сумма по цене компании"],
    ["15.09.2026", "К567ММ50", 64110, 220, 75.4, 16588, "ГПН-АЗС", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Заправки");
  return wb;
}

export function downloadFuelTemplate() {
  const wb = buildFuelTemplateWorkbook();
  XLSX.writeFile(wb, "zapravki-severtrans.xlsx");
}
