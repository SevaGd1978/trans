import * as XLSX from "xlsx";
import type { RoutePlan, Transaction, Vehicle } from "../types";
import { uid } from "./format";
import { normalizePlate, parseDate, parseNumber } from "./fuelImport";

export type TripColumn =
  | "date"
  | "route"
  | "from"
  | "to"
  | "plate"
  | "distance"
  | "amount"
  | "trips"
  | "customer"
  | "cargo";

const COLUMN_ALIASES: Record<TripColumn, string[]> = {
  date: ["дата", "date", "день рейса", "дата рейса"],
  route: ["маршрут", "направление", "route"],
  from: ["откуда", "пункт погрузки", "погрузка", "город отправления", "from", "departure"],
  to: ["куда", "пункт разгрузки", "разгрузка", "город назначения", "to", "destination"],
  plate: ["госномер", "гос номер", "грз", "номер тс", "авто", "машина", "тс", "plate"],
  distance: ["км", "расстояние", "дистанция", "пробег рейса", "км рейса", "distance"],
  amount: [
    "стоимость",
    "сумма",
    "выручка",
    "тариф",
    "ставка",
    "цена рейса",
    "стоимость рейса",
    "фрахт",
    "amount",
    "cost",
    "revenue",
  ],
  trips: ["рейсов", "рейсы", "рейсов в месяц", "частота", "trips"],
  customer: ["заказчик", "клиент", "контрагент", "грузоотправитель", "плательщик", "customer"],
  cargo: ["груз", "номенклатура", "комментарий", "примечание", "cargo", "comment"],
};

function normHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9/]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectTripColumns(headers: unknown[]): Partial<Record<TripColumn, number>> {
  const candidates: { field: TripColumn; col: number; score: number }[] = [];
  headers.forEach((header, col) => {
    const n = normHeader(String(header ?? ""));
    if (!n) return;
    (Object.keys(COLUMN_ALIASES) as TripColumn[]).forEach((field) => {
      let score = 0;
      for (const alias of COLUMN_ALIASES[field]) {
        if (n === alias) score = Math.max(score, alias.length + 20);
        else if (n.includes(alias)) score = Math.max(score, alias.length);
      }
      if (score) candidates.push({ field, col, score });
    });
  });
  candidates.sort((a, b) => b.score - a.score);
  const usedFields = new Set<TripColumn>();
  const usedCols = new Set<number>();
  const map: Partial<Record<TripColumn, number>> = {};
  for (const c of candidates) {
    if (usedFields.has(c.field) || usedCols.has(c.col)) continue;
    usedFields.add(c.field);
    usedCols.add(c.col);
    map[c.field] = c.col;
  }
  return map;
}

export function findTripHeaderRow(rows: unknown[][]): number {
  let best = 0;
  let bestCount = 0;
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const count = Object.keys(detectTripColumns(rows[i] ?? [])).length;
    if (count > bestCount) {
      bestCount = count;
      best = i;
    }
  }
  return bestCount >= 2 ? best : 0;
}

export function splitRouteName(raw: string): { from: string; to: string; name: string } {
  const name = raw.replace(/\s+/g, " ").trim();
  const parts = name.split(/\s*[—–−→]+|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { from: parts[0], to: parts.slice(1).join(" — "), name: `${parts[0]} — ${parts.slice(1).join(" — ")}` };
  }
  return { from: name, to: "", name };
}

export function placeKey(from: string, to: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^a-zа-я0-9]+/gi, " ")
      .trim();
  return `${norm(from)}|${norm(to)}`;
}

function cell(row: unknown[], index: number | undefined): unknown {
  if (index == null) return "";
  return row[index];
}

export function tripKey(input: {
  date?: string;
  from: string;
  to: string;
  plate: string;
  amount?: number;
}): string {
  return [
    "trip",
    input.date ?? "",
    placeKey(input.from, input.to),
    normalizePlate(input.plate),
    input.amount ?? "",
  ].join("|");
}

export interface TripDraft {
  row: number;
  date?: string;
  from: string;
  to: string;
  routeName: string;
  plateRaw: string;
  vehicleId?: string;
  vehiclePlate?: string;
  routeId?: string;
  distanceKm?: number;
  amount?: number;
  tripsPerMonth?: number;
  customer: string;
  cargo: string;
  errors: string[];
  warnings: string[];
  duplicate: boolean;
  importKey: string;
}

export function buildTripDrafts(
  rows: unknown[][],
  columns: Partial<Record<TripColumn, number>>,
  vehicles: Vehicle[],
  routes: RoutePlan[],
  existingKeys: Set<string>,
): TripDraft[] {
  const byPlate = new Map(vehicles.map((v) => [normalizePlate(v.plate), v]));
  const byRoute = new Map(routes.map((r) => [placeKey(r.from, r.to), r]));
  const drafts: TripDraft[] = [];

  rows.forEach((row, i) => {
    const empty = !row.some((c) => String(c ?? "").trim() !== "");
    if (empty) return;

    const routeRaw = String(cell(row, columns.route) ?? "").trim();
    const split = routeRaw ? splitRouteName(routeRaw) : { from: "", to: "", name: "" };
    const from = String(cell(row, columns.from) ?? "").trim() || split.from;
    const to = String(cell(row, columns.to) ?? "").trim() || split.to;
    const date = parseDate(cell(row, columns.date));
    const plateRaw = String(cell(row, columns.plate) ?? "").trim();
    const distanceKm = parseNumber(cell(row, columns.distance));
    const amount = parseNumber(cell(row, columns.amount));
    const tripsPerMonth = parseNumber(cell(row, columns.trips));
    const customer = String(cell(row, columns.customer) ?? "").trim();
    const cargo = String(cell(row, columns.cargo) ?? "").trim();
    const vehicle = plateRaw ? byPlate.get(normalizePlate(plateRaw)) : undefined;
    const route = from && to ? byRoute.get(placeKey(from, to)) : undefined;

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!from && !to) errors.push("Нет маршрута (откуда / куда)");
    else if (!from || !to) errors.push("Укажите и пункт погрузки, и разгрузки");
    if (date && amount == null) errors.push("Нет стоимости рейса");
    if (!date && amount == null && distanceKm == null && !from) errors.push("Пустая строка");
    if (amount != null && amount < 0) errors.push("Стоимость не может быть отрицательной");
    if (distanceKm != null && distanceKm < 0) errors.push("Расстояние не может быть отрицательным");

    if (plateRaw && !vehicle) warnings.push("ТС не найдено в автопарке");
    if (from && to && !route) warnings.push("Маршрут будет добавлен в справочник");
    if (!date && amount != null) warnings.push("Только в справочник маршрутов, без журнала");
    if (date && !plateRaw) warnings.push("Нет госномера");

    const routeName = split.name || (from && to ? `${from} — ${to}` : routeRaw);
    const importKey = tripKey({ date, from, to, plate: plateRaw, amount });

    drafts.push({
      row: i + 1,
      date,
      from,
      to,
      routeName,
      plateRaw,
      vehicleId: vehicle?.id,
      vehiclePlate: vehicle?.plate,
      routeId: route?.id,
      distanceKm,
      amount,
      tripsPerMonth: tripsPerMonth != null ? Math.round(tripsPerMonth) : undefined,
      customer,
      cargo,
      errors,
      warnings,
      duplicate: Boolean(date && existingKeys.has(importKey)),
      importKey,
    });
  });

  return drafts;
}

export function draftsToTripImport(
  drafts: TripDraft[],
  existingRoutes: RoutePlan[],
): { routes: RoutePlan[]; transactions: Transaction[] } {
  const ready = drafts.filter((d) => d.errors.length === 0);
  const byKey = new Map<string, RoutePlan>();
  for (const r of existingRoutes) {
    byKey.set(placeKey(r.from, r.to), { ...r });
  }

  for (const d of ready) {
    if (!d.from || !d.to) continue;
    const key = placeKey(d.from, d.to);
    const prev = byKey.get(key);
    if (!prev) {
      const created: RoutePlan = {
        id: uid("r"),
        name: d.routeName || `${d.from} — ${d.to}`,
        from: d.from,
        to: d.to,
        distanceKm: d.distanceKm ?? 0,
        avgRevenue: d.amount ?? 0,
        tripsPerMonth: d.tripsPerMonth ?? 8,
        vehicleId: d.vehicleId ?? "",
      };
      byKey.set(key, created);
    } else {
      byKey.set(key, {
        ...prev,
        distanceKm: d.distanceKm ?? prev.distanceKm,
        avgRevenue: d.amount ?? prev.avgRevenue,
        tripsPerMonth: d.tripsPerMonth ?? prev.tripsPerMonth,
        vehicleId: prev.vehicleId || d.vehicleId || "",
        name: prev.name || d.routeName,
      });
    }
  }

  const routes = [...byKey.values()];
  const transactions: Transaction[] = ready
    .filter((d) => d.date && d.amount != null && !d.duplicate)
    .map((d) => {
      const route = byKey.get(placeKey(d.from, d.to));
      const commentParts = [`Рейс ${d.from} — ${d.to}`];
      if (d.distanceKm != null) commentParts.push(`${d.distanceKm} км`);
      if (d.cargo) commentParts.push(d.cargo);
      return {
        id: uid("tx"),
        type: "income" as const,
        date: d.date as string,
        amount: d.amount as number,
        categoryId: "inc-freight",
        vehicleId: d.vehicleId,
        routeId: route?.id ?? d.routeId,
        counterparty: d.customer || "Заказчик",
        comment: commentParts.join(" · "),
        importKey: d.importKey,
      };
    });

  return { routes, transactions };
}

export function parseTripWorkbook(
  data: ArrayBuffer | Uint8Array,
  vehicles: Vehicle[],
  routes: RoutePlan[],
  existingKeys: Set<string>,
): { drafts: TripDraft[]; columns: Partial<Record<TripColumn, number>>; sheet: string } {
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
  const headerIndex = findTripHeaderRow(rows);
  const columns = detectTripColumns(rows[headerIndex] ?? []);
  const body = rows.slice(headerIndex + 1);
  return {
    drafts: buildTripDrafts(body, columns, vehicles, routes, existingKeys),
    columns,
    sheet,
  };
}

export const TRIP_TEMPLATE_HEADERS = [
  "Дата",
  "Маршрут",
  "Откуда",
  "Куда",
  "Госномер",
  "Км",
  "Стоимость",
  "Рейсов в месяц",
  "Заказчик",
  "Груз",
] as const;

export function buildTripTemplateWorkbook(): XLSX.WorkBook {
  const rows = [
    [...TRIP_TEMPLATE_HEADERS],
    [
      "12.09.2026",
      "Москва — Санкт-Петербург",
      "Москва",
      "Санкт-Петербург",
      "А123ВС777",
      710,
      110000,
      12,
      "ООО «Северсталь-Логистик»",
      "Металлопрокат",
    ],
    [
      "13.09.2026",
      "Москва — Казань",
      "",
      "",
      "В456ОР777",
      820,
      125000,
      10,
      "АО «РусАгро»",
      "Сборный груз",
    ],
    [
      "14.09.2026",
      "Москва-Нижний Новгород",
      "Москва",
      "Нижний Новгород",
      "C789TT777",
      420,
      68000,
      "",
      "ООО «МегаСтрой»",
      "",
    ],
    ["", "ЦФО, сборные грузы", "Подольск", "Регион", "К567ММ50", 280, 32000, 18, "", "только маршрут"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = TRIP_TEMPLATE_HEADERS.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Перевозки");
  return wb;
}

export function parseTripTemplateExample(
  vehicles: Vehicle[],
  routes: RoutePlan[],
  existingKeys: Set<string>,
) {
  const wb = buildTripTemplateWorkbook();
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer | Uint8Array;
  return parseTripWorkbook(buf, vehicles, routes, existingKeys);
}

export function downloadTripTemplate() {
  const wb = buildTripTemplateWorkbook();
  XLSX.writeFile(wb, "perevozki-severtrans.xlsx");
}
