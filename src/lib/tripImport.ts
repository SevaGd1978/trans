import * as XLSX from "xlsx";
import type { RoutePlan, Transaction, Vehicle } from "../types";
import { uid } from "./format";
import { normalizePlate, parseDate, parseNumber } from "./fuelImport";
import { extractPlace } from "./place";
import {
  ORDER_CARRIER_CATEGORY,
  ORDER_DISPATCH_CATEGORY,
  ORDER_INCOME_CATEGORY,
} from "./orderStats";

export type TripColumn =
  | "orderNo"
  | "period"
  | "date"
  | "route"
  | "from"
  | "to"
  | "plate"
  | "distance"
  | "amount"
  | "carrierAmount"
  | "dispatchAmount"
  | "profit"
  | "trips"
  | "customer"
  | "cargo"
  | "carrier"
  | "driver"
  | "weight"
  | "volume"
  | "places";

const COLUMN_ALIASES: Record<TripColumn, string[]> = {
  orderNo: ["номер заказа", "номер заявки", "номер", "order number"],
  period: ["период заказа", "период", "period"],
  date: ["дата", "date", "день рейса", "дата рейса"],
  route: ["маршрут", "направление", "route"],
  from: ["загрузка", "откуда", "пункт погрузки", "погрузка", "город отправления", "from", "departure"],
  to: ["разгрузка", "куда", "пункт разгрузки", "город назначения", "to", "destination"],
  plate: ["госномер", "гос номер", "грз", "номер тс", "авто", "машина", "тс", "plate"],
  distance: ["км", "расстояние", "дистанция", "пробег рейса", "км рейса", "distance"],
  amount: [
    "сумма",
    "стоимость",
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
  carrierAmount: ["исполнителю", "перевозчику", "оплата исполнителю"],
  dispatchAmount: ["диспетчеру", "комиссия диспетчера"],
  profit: ["прибыль", "маржа", "profit"],
  trips: ["рейсов", "рейсы", "рейсов в месяц", "частота", "trips"],
  customer: ["клиент", "заказчик", "контрагент", "грузоотправитель", "плательщик", "customer"],
  cargo: ["груз", "номенклатура", "комментарий", "примечание", "cargo", "comment"],
  carrier: ["исполнитель", "перевозчик", "подрядчик"],
  driver: ["водитель", "driver"],
  weight: ["вес", "масса", "тн", "weight"],
  volume: ["объем", "объём", "м3", "volume"],
  places: ["мест", "место", "places"],
};

function normHeader(raw: string): string {
  const mapped = raw
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[№#]/g, " номер ")
    .replace(/[^a-zа-я0-9/]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return mapped;
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

export function orderKey(orderNo: string): string {
  return `order|${orderNo.trim()}`;
}

export function orderTxKey(orderNo: string, categoryId: string): string {
  return `${orderKey(orderNo)}|${categoryId}`;
}

function moneyPositive(value: number | undefined): number | undefined {
  if (value == null || value === 0) return undefined;
  return value;
}

function looksLikeTotalsLabel(value: string): boolean {
  const n = value.toLowerCase().replace(/ё/g, "е").trim();
  return /^(итого|всего|сумма|итого:|всего:)$/.test(n);
}

export interface TripDraft {
  row: number;
  orderNo: string;
  date?: string;
  periodRaw: string;
  from: string;
  to: string;
  fromRaw: string;
  toRaw: string;
  routeName: string;
  plateRaw: string;
  vehicleId?: string;
  vehiclePlate?: string;
  routeId?: string;
  distanceKm?: number;
  amount?: number;
  carrierAmount?: number;
  dispatchAmount?: number;
  profit?: number;
  tripsPerMonth?: number;
  customer: string;
  cargo: string;
  carrier: string;
  driver: string;
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
  const seenInFile = new Set<string>();

  rows.forEach((row, i) => {
    const empty = !row.some((c) => String(c ?? "").trim() !== "");
    if (empty) return;

    const orderNo = String(cell(row, columns.orderNo) ?? "").trim();
    const periodRaw = String(cell(row, columns.period) ?? "").trim();
    const routeRaw = String(cell(row, columns.route) ?? "").trim();
    const split = routeRaw ? splitRouteName(routeRaw) : { from: "", to: "", name: "" };
    const fromRaw = String(cell(row, columns.from) ?? "").trim() || split.from;
    const toRaw = String(cell(row, columns.to) ?? "").trim() || split.to;
    const from = extractPlace(fromRaw) || fromRaw;
    const to = extractPlace(toRaw) || toRaw;
    const date = parseDate(cell(row, columns.period)) ?? parseDate(cell(row, columns.date));
    const plateRaw = String(cell(row, columns.plate) ?? "").trim();
    const distanceKm = parseNumber(cell(row, columns.distance));
    const amount = moneyPositive(parseNumber(cell(row, columns.amount)));
    const carrierAmount = moneyPositive(parseNumber(cell(row, columns.carrierAmount)));
    const dispatchAmount = moneyPositive(parseNumber(cell(row, columns.dispatchAmount)));
    const profit = parseNumber(cell(row, columns.profit));
    const tripsPerMonth = parseNumber(cell(row, columns.trips));
    const customer = String(cell(row, columns.customer) ?? "").trim();
    const cargo = String(cell(row, columns.cargo) ?? "").trim();
    const carrier = String(cell(row, columns.carrier) ?? "").trim();
    const driver = String(cell(row, columns.driver) ?? "").trim();
    const vehicle = plateRaw ? byPlate.get(normalizePlate(plateRaw)) : undefined;
    const route = from && to ? byRoute.get(placeKey(from, to)) : undefined;

    const firstCell = String(row[0] ?? "").trim();
    const isFooter =
      looksLikeTotalsLabel(firstCell) ||
      looksLikeTotalsLabel(orderNo) ||
      (!orderNo && !date && !from && !to && !customer && !routeRaw);
    if (isFooter) return;

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!from && !to) errors.push("Нет загрузки и разгрузки");
    if (amount == null && carrierAmount == null && dispatchAmount == null) {
      if (orderNo) warnings.push("Нулевые суммы по заказу");
      else errors.push("Нет сумм по заказу");
    }
    if (amount != null && amount < 0) errors.push("Сумма не может быть отрицательной");
    if (carrierAmount != null && carrierAmount < 0) errors.push("Оплата исполнителю не может быть отрицательной");
    if (dispatchAmount != null && dispatchAmount < 0) errors.push("Оплата диспетчеру не может быть отрицательной");
    if (distanceKm != null && distanceKm < 0) errors.push("Расстояние не может быть отрицательным");
    if (columns.period != null && !date && (amount != null || carrierAmount != null || dispatchAmount != null)) {
      errors.push("Нет периода заказа");
    }

    if (plateRaw && !vehicle) warnings.push("ТС не найдено в автопарке");
    if (from && to && !route) warnings.push("Маршрут будет добавлен в справочник");
    if (!date && (amount != null || carrierAmount != null || dispatchAmount != null) && columns.period == null) {
      warnings.push("Только в справочник маршрутов, без журнала");
    }
    if (columns.plate != null && date && !plateRaw) warnings.push("Нет госномера");

    const routeName =
      split.name || (from && to ? `${from} — ${to}` : from || to || routeRaw);
    const importKey = orderNo
      ? orderKey(orderNo)
      : tripKey({ date, from, to, plate: plateRaw, amount });
    const duplicate = existingKeys.has(importKey) || seenInFile.has(importKey);
    if (!duplicate && orderNo) seenInFile.add(importKey);

    drafts.push({
      row: i + 1,
      orderNo,
      date,
      periodRaw,
      from,
      to,
      fromRaw,
      toRaw,
      routeName,
      plateRaw,
      vehicleId: vehicle?.id,
      vehiclePlate: vehicle?.plate,
      routeId: route?.id,
      distanceKm,
      amount,
      carrierAmount,
      dispatchAmount,
      profit: profit ?? undefined,
      tripsPerMonth: tripsPerMonth != null ? Math.round(tripsPerMonth) : undefined,
      customer,
      cargo,
      carrier,
      driver,
      errors,
      warnings,
      duplicate,
      importKey,
    });
  });

  return drafts;
}

export function draftsToTripImport(
  drafts: TripDraft[],
  existingRoutes: RoutePlan[],
): { routes: RoutePlan[]; transactions: Transaction[] } {
  const ready = drafts.filter((d) => d.errors.length === 0 && !d.duplicate);
  const byKey = new Map<string, RoutePlan>();
  for (const r of existingRoutes) {
    byKey.set(placeKey(r.from, r.to), { ...r });
  }

  const counts = new Map<string, number>();
  for (const d of ready) {
    if (!d.from || !d.to) continue;
    const key = placeKey(d.from, d.to);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const prev = byKey.get(key);
    if (!prev) {
      const created: RoutePlan = {
        id: uid("r"),
        name: d.routeName || `${d.from} — ${d.to}`,
        from: d.from,
        to: d.to,
        distanceKm: d.distanceKm ?? 0,
        avgRevenue: d.amount ?? 0,
        tripsPerMonth: d.tripsPerMonth ?? 1,
        vehicleId: d.vehicleId ?? "",
      };
      byKey.set(key, created);
    } else {
      const n = counts.get(key) ?? 1;
      const prevCount = n - 1;
      const avgRevenue =
        d.amount != null
          ? Math.round(((prev.avgRevenue * prevCount + d.amount) / n) * 100) / 100
          : prev.avgRevenue;
      byKey.set(key, {
        ...prev,
        distanceKm: d.distanceKm ?? prev.distanceKm,
        avgRevenue,
        tripsPerMonth: d.tripsPerMonth ?? Math.max(prev.tripsPerMonth, n),
        vehicleId: prev.vehicleId || d.vehicleId || "",
        name: prev.name || d.routeName,
      });
    }
  }

  const routes = [...byKey.values()];
  const transactions: Transaction[] = [];

  for (const d of ready) {
    if (!d.date) continue;
    const route = d.from && d.to ? byKey.get(placeKey(d.from, d.to)) : undefined;
    const orderLabel = d.orderNo ? `Заказ №${d.orderNo}` : `Рейс ${d.from} — ${d.to}`;
    const routeLabel = d.from && d.to ? `${d.from} — ${d.to}` : d.routeName;
    const extras = [d.cargo, d.driver].filter(Boolean);

    if (d.amount != null) {
      transactions.push({
        id: uid("tx"),
        type: "income",
        date: d.date,
        amount: d.amount,
        categoryId: ORDER_INCOME_CATEGORY,
        vehicleId: d.vehicleId,
        routeId: route?.id ?? d.routeId,
        counterparty: d.customer || "Клиент",
        comment: [orderLabel, routeLabel, ...extras].filter(Boolean).join(" · "),
        importKey: d.orderNo ? orderTxKey(d.orderNo, ORDER_INCOME_CATEGORY) : d.importKey,
      });
    }
    if (d.carrierAmount != null) {
      transactions.push({
        id: uid("tx"),
        type: "expense",
        date: d.date,
        amount: d.carrierAmount,
        categoryId: ORDER_CARRIER_CATEGORY,
        vehicleId: d.vehicleId,
        routeId: route?.id ?? d.routeId,
        counterparty: d.carrier || "Исполнитель",
        comment: [orderLabel, routeLabel, d.driver ? `водитель ${d.driver}` : ""]
          .filter(Boolean)
          .join(" · "),
        importKey: d.orderNo ? orderTxKey(d.orderNo, ORDER_CARRIER_CATEGORY) : undefined,
      });
    }
    if (d.dispatchAmount != null) {
      transactions.push({
        id: uid("tx"),
        type: "expense",
        date: d.date,
        amount: d.dispatchAmount,
        categoryId: ORDER_DISPATCH_CATEGORY,
        vehicleId: d.vehicleId,
        routeId: route?.id ?? d.routeId,
        counterparty: d.carrier || "Диспетчер",
        comment: [orderLabel, routeLabel, "диспетчер"].filter(Boolean).join(" · "),
        importKey: d.orderNo ? orderTxKey(d.orderNo, ORDER_DISPATCH_CATEGORY) : undefined,
      });
    }
  }

  return { routes, transactions };
}

function looksLikeSpreadsheet(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return true;
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) return true;
  return false;
}

export function decodeTableText(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1251").decode(bytes);
  }
}

function detectDelimiter(text: string): string {
  const head = text.split(/\r?\n/, 4).join("\n");
  const semi = (head.match(/;/g) ?? []).length;
  const comma = (head.match(/,/g) ?? []).length;
  return semi > comma ? ";" : ",";
}

export function workbookRowsFromBytes(data: ArrayBuffer | Uint8Array): {
  rows: unknown[][];
  sheet: string;
} {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (looksLikeSpreadsheet(bytes)) {
    const wb = XLSX.read(bytes, { type: "array", cellDates: true, codepage: 1251 });
    const sheet = wb.SheetNames[0] ?? "";
    if (!sheet) return { rows: [], sheet: "" };
    return {
      sheet,
      rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], {
        header: 1,
        raw: true,
        defval: "",
      }),
    };
  }
  const text = decodeTableText(bytes);
  const wb = XLSX.read(text, { type: "string", FS: detectDelimiter(text), raw: true });
  const sheet = wb.SheetNames[0] ?? "";
  if (!sheet) return { rows: [], sheet: "" };
  return {
    sheet,
    rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], {
      header: 1,
      raw: true,
      defval: "",
    }),
  };
}

export function parseTripWorkbook(
  data: ArrayBuffer | Uint8Array,
  vehicles: Vehicle[],
  routes: RoutePlan[],
  existingKeys: Set<string>,
): { drafts: TripDraft[]; columns: Partial<Record<TripColumn, number>>; sheet: string } {
  const { rows, sheet } = workbookRowsFromBytes(data);
  if (!sheet || rows.length === 0) {
    return { drafts: [], columns: {}, sheet };
  }
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
] as const;

export function buildTripTemplateWorkbook(): XLSX.WorkBook {
  const rows = [
    ["Сводный отчет по выбранным заказам", ...Array(TRIP_TEMPLATE_HEADERS.length - 1).fill("")],
    [...TRIP_TEMPLATE_HEADERS],
    [
      "23856",
      "01.08.2026 00:00 — 04.08.2026 00:00",
      'ООО "ТЭК "ЛИДЕРТРАНС"',
      "г.Домодедово",
      "г.Екатеринбург",
      "Инструменты",
      "",
      "",
      20,
      'ООО "ЛК "В ТОЧКУ Б"',
      "Рыбалко Валерий Андреевич",
      180000,
      160000,
      0,
      20000,
    ],
    [
      "23860",
      "03.08.2026 00:00 — 04.08.2026 00:00",
      'ООО "Уральский Завод Трубной Изоляции"',
      "2833 Полевской Восточный промышленный район 3/5",
      "Омск ул.70 лет Октября 13\\2",
      "Труба ППУ",
      "",
      "",
      20,
      'ООО "ЛК "В ТОЧКУ Б"',
      "Даренко Иван Иванович",
      110000,
      100000,
      0,
      10000,
    ],
    [
      "24031",
      "31.08.2026 00:00 — 00:00",
      'ООО "ПЗПТ"',
      "317/08 Первоуральск УМПЦ Ревда",
      "Полевской",
      "Труба ППУ",
      "",
      "",
      20,
      'ООО "Терминал"',
      "Погудин Андрей",
      33000,
      0,
      33000,
      0,
    ],
    ["", "", "", "", "", "", "", "", "", "", "", 323000, 260000, 33000, 30000],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = TRIP_TEMPLATE_HEADERS.map(() => ({ wch: 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Заказы");
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
  XLSX.writeFile(wb, "svodnyj-otchet-zakazy.xlsx");
}

export function collectTripImportKeys(transactions: { importKey?: string }[]): Set<string> {
  const keys = new Set<string>();
  for (const tx of transactions) {
    if (!tx.importKey) continue;
    keys.add(tx.importKey);
    const order = tx.importKey.match(/^(order\|[^|]+)/);
    if (order) keys.add(order[1]);
  }
  return keys;
}
