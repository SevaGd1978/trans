import { emptyMonths, fuelCost, roundMoney, spreadEven } from "../lib/calc";
import { fillingKey } from "../lib/fuelImport";
import { numberRu, uid } from "../lib/format";
import type {
  AppState,
  BudgetLine,
  Category,
  RoutePlan,
  Transaction,
  Vehicle,
} from "../types";

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;

function jitter(rand: Rand, base: number, pct = 0.1): number {
  return Math.round(base * (1 + (rand() * 2 - 1) * pct));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export const CATEGORIES: Category[] = [
  { id: "inc-freight", name: "Грузоперевозки", kind: "income", group: "Выручка" },
  { id: "inc-forward", name: "Экспедирование", kind: "income", group: "Выручка" },
  { id: "inc-rent", name: "Аренда транспорта", kind: "income", group: "Выручка" },
  { id: "inc-other", name: "Прочие доходы", kind: "income", group: "Выручка" },
  { id: "exp-fuel", name: "ГСМ (дизель)", kind: "expense", group: "Переменные" },
  { id: "exp-tolls", name: "Платон и платные дороги", kind: "expense", group: "Переменные" },
  { id: "exp-salary-drivers", name: "Зарплата водителей", kind: "expense", group: "Персонал" },
  { id: "exp-salary-shop", name: "Зарплата сервиса и офиса", kind: "expense", group: "Персонал" },
  { id: "exp-repair", name: "ТО и ремонт", kind: "expense", group: "Автопарк" },
  { id: "exp-tires", name: "Шины", kind: "expense", group: "Автопарк" },
  { id: "exp-lease", name: "Лизинг", kind: "expense", group: "Автопарк" },
  { id: "exp-insurance", name: "Страхование", kind: "expense", group: "Автопарк" },
  { id: "exp-parking", name: "Стоянка и парковка", kind: "expense", group: "Автопарк" },
  { id: "exp-nav", name: "Связь и навигация", kind: "expense", group: "Офис" },
  { id: "exp-tax", name: "Налоги и сборы", kind: "expense", group: "Офис" },
  { id: "exp-admin", name: "Административные", kind: "expense", group: "Офис" },
];

export const VEHICLES: Vehicle[] = [
  {
    id: "v-volvo",
    name: "Volvo FH 500",
    plate: "А 123 ВС 777",
    type: "tractor",
    year: 2021,
    consumption: 32,
    plannedKm: 120000,
    status: "active",
    leaseMonthly: 180000,
    insuranceAnnual: 210000,
  },
  {
    id: "v-man",
    name: "MAN TGX 18.510",
    plate: "В 456 ОР 777",
    type: "tractor",
    year: 2020,
    consumption: 33,
    plannedKm: 110000,
    status: "active",
    leaseMonthly: 165000,
    insuranceAnnual: 198000,
  },
  {
    id: "v-kamaz",
    name: "КАМАЗ 54901",
    plate: "С 789 ТТ 777",
    type: "tractor",
    year: 2023,
    consumption: 34,
    plannedKm: 100000,
    status: "active",
    leaseMonthly: 140000,
    insuranceAnnual: 165000,
  },
  {
    id: "v-scania",
    name: "Scania R 450",
    plate: "Е 234 НК 777",
    type: "tractor",
    year: 2019,
    consumption: 31,
    plannedKm: 90000,
    status: "active",
    leaseMonthly: 0,
    insuranceAnnual: 186000,
  },
  {
    id: "v-actros",
    name: "Mercedes Actros",
    plate: "К 567 ММ 50",
    type: "truck",
    year: 2022,
    consumption: 28,
    plannedKm: 80000,
    status: "active",
    leaseMonthly: 120000,
    insuranceAnnual: 142000,
  },
  {
    id: "v-gaz1",
    name: "ГАЗель Next",
    plate: "М 890 ОР 777",
    type: "van",
    year: 2024,
    consumption: 13,
    plannedKm: 60000,
    status: "active",
    leaseMonthly: 45000,
    insuranceAnnual: 54000,
  },
  {
    id: "v-gaz2",
    name: "ГАЗель Next",
    plate: "Н 111 УУ 777",
    type: "van",
    year: 2023,
    consumption: 13.5,
    plannedKm: 55000,
    status: "idle",
    leaseMonthly: 42000,
    insuranceAnnual: 51000,
  },
  {
    id: "v-maz",
    name: "МАЗ 5440",
    plate: "Р 222 СС 777",
    type: "truck",
    year: 2020,
    consumption: 29,
    plannedKm: 40000,
    status: "repair",
    leaseMonthly: 0,
    insuranceAnnual: 98000,
  },
];

export const ROUTES: RoutePlan[] = [
  {
    id: "r-spb",
    name: "Москва — Санкт-Петербург",
    from: "Москва",
    to: "Санкт-Петербург",
    distanceKm: 710,
    avgRevenue: 110000,
    tripsPerMonth: 12,
    vehicleId: "v-volvo",
  },
  {
    id: "r-kazan",
    name: "Москва — Казань",
    from: "Москва",
    to: "Казань",
    distanceKm: 820,
    avgRevenue: 125000,
    tripsPerMonth: 10,
    vehicleId: "v-man",
  },
  {
    id: "r-nn",
    name: "Москва — Нижний Новгород",
    from: "Москва",
    to: "Нижний Новгород",
    distanceKm: 420,
    avgRevenue: 68000,
    tripsPerMonth: 14,
    vehicleId: "v-kamaz",
  },
  {
    id: "r-voronezh",
    name: "Москва — Воронеж",
    from: "Москва",
    to: "Воронеж",
    distanceKm: 530,
    avgRevenue: 78000,
    tripsPerMonth: 11,
    vehicleId: "v-scania",
  },
  {
    id: "r-region",
    name: "ЦФО, сборные грузы",
    from: "Подольск",
    to: "Регион",
    distanceKm: 280,
    avgRevenue: 32000,
    tripsPerMonth: 18,
    vehicleId: "v-actros",
  },
  {
    id: "r-city",
    name: "Городская доставка",
    from: "Москва",
    to: "МО",
    distanceKm: 90,
    avgRevenue: 14000,
    tripsPerMonth: 22,
    vehicleId: "v-gaz1",
  },
];

const YEAR = 2026;
const FUEL = 75.4;

function fuelBudget(): number {
  return Math.round(
    VEHICLES.reduce((acc, v) => acc + fuelCost(v.plannedKm, v.consumption, FUEL), 0),
  );
}

function makeBudget(): BudgetLine[] {
  const annual: Record<string, number> = {
    "inc-freight": 72_000_000,
    "inc-forward": 3_600_000,
    "inc-rent": 1_440_000,
    "inc-other": 360_000,
    "exp-fuel": fuelBudget(),
    "exp-tolls": 2_160_000,
    "exp-salary-drivers": 14_880_000,
    "exp-salary-shop": 5_280_000,
    "exp-repair": 4_200_000,
    "exp-tires": 1_080_000,
    "exp-lease": VEHICLES.reduce((a, v) => a + v.leaseMonthly * 12, 0),
    "exp-insurance": VEHICLES.reduce((a, v) => a + v.insuranceAnnual, 0),
    "exp-parking": 720_000,
    "exp-nav": 288_000,
    "exp-tax": 2_640_000,
    "exp-admin": 960_000,
  };

  return CATEGORIES.map((c) => ({
    id: `b-${c.id}`,
    categoryId: c.id,
    year: YEAR,
    months: spreadEven(annual[c.id] ?? 0),
  }));
}

const CLIENTS = [
  "ООО «Северсталь-Логистик»",
  "АО «РусАгро»",
  "ООО «ХолодТранс»",
  "ИП Ковалёв",
  "ООО «МегаСтрой»",
  "ПАО «Лента»",
  "ООО «ФармДистрибьюция»",
];

const COUNTERPARTIES = [
  "ГПН-АЗС",
  "Лукойл",
  "Платон",
  "Автодор-Платные Дороги",
  "СТО «ДизельМастер»",
  "Шинный центр «Кордиант»",
  "СберЛизинг",
  "Ингосстрах",
  "МТС",
  "ФНС России",
];

function makeTransactions(rand: Rand): Transaction[] {
  const tx: Transaction[] = [];
  let n = 0;
  const nextId = () => `tx-${++n}`;
  const odometer = new Map(
    VEHICLES.map((v) => [v.id, Math.round(22000 + (YEAR - v.year) * v.plannedKm * 0.42)]),
  );

  for (let month = 0; month < 9; month++) {
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30][month];
    const season = month >= 5 && month <= 7 ? 1.08 : month === 0 || month === 1 ? 0.9 : 1;

    for (const route of ROUTES) {
      const trips = Math.max(1, Math.round(route.tripsPerMonth * season * (0.92 + rand() * 0.16)));
      for (let t = 0; t < trips; t++) {
        const day = 1 + Math.floor(rand() * days);
        tx.push({
          id: nextId(),
          type: "income",
          date: `${YEAR}-${pad(month + 1)}-${pad(day)}`,
          amount: jitter(rand, route.avgRevenue, 0.08),
          categoryId: "inc-freight",
          vehicleId: route.vehicleId,
          routeId: route.id,
          counterparty: CLIENTS[Math.floor(rand() * CLIENTS.length)],
          comment: `Рейс ${route.from} — ${route.to}`,
        });
      }
    }

    tx.push({
      id: nextId(),
      type: "income",
      date: `${YEAR}-${pad(month + 1)}-12`,
      amount: jitter(rand, 300000, 0.15),
      categoryId: "inc-forward",
      counterparty: "ООО «Экспресс-Экспедиция»",
      comment: "Агентское вознаграждение",
    });

    if (month % 2 === 0) {
      tx.push({
        id: nextId(),
        type: "income",
        date: `${YEAR}-${pad(month + 1)}-20`,
        amount: 120000,
        categoryId: "inc-rent",
        vehicleId: "v-gaz2",
        counterparty: "ИП Сорокин",
        comment: "Субаренда ГАЗели",
      });
    }

    for (const v of VEHICLES) {
      if (v.status === "repair" && month >= 6) continue;
      const stops = v.status === "idle" ? 1 : 2;
      for (let f = 0; f < stops; f++) {
        const km = Math.round((v.plannedKm / 12 / stops) * (v.status === "idle" ? 0.25 : season) * (0.94 + rand() * 0.12));
        const nextOdo = (odometer.get(v.id) ?? 0) + km;
        odometer.set(v.id, nextOdo);
        const actualCons = v.consumption * (0.92 + rand() * 0.18);
        const liters = roundMoney((km / 100) * actualCons);
        const price = roundMoney(FUEL * (0.985 + rand() * 0.03));
        const amount = roundMoney(liters * price);
        const station = rand() > 0.55 ? "ГПН-АЗС" : rand() > 0.5 ? "Лукойл" : "Роснефть";
        const day = Math.min(days, 4 + f * 12 + Math.floor(rand() * 6));
        tx.push({
          id: nextId(),
          type: "expense",
          date: `${YEAR}-${pad(month + 1)}-${pad(day)}`,
          amount,
          categoryId: "exp-fuel",
          vehicleId: v.id,
          counterparty: station,
          comment: `${numberRu(liters, 1)} л · пробег ${numberRu(nextOdo)} км`,
          liters,
          odometer: nextOdo,
          pricePerLiter: price,
          importKey: fillingKey({
            date: `${YEAR}-${pad(month + 1)}-${pad(day)}`,
            plate: v.plate,
            liters,
            amount,
            odometer: nextOdo,
          }),
        });
      }
    }

    tx.push({
      id: nextId(),
      type: "expense",
      date: `${YEAR}-${pad(month + 1)}-28`,
      amount: jitter(rand, 180000, 0.12),
      categoryId: "exp-tolls",
      counterparty: "Платон / Автодор",
      comment: "Платон и М-4 / М-11",
    });

    tx.push({
      id: nextId(),
      type: "expense",
      date: `${YEAR}-${pad(month + 1)}-05`,
      amount: 1_240_000,
      categoryId: "exp-salary-drivers",
      counterparty: "Фонд оплаты труда",
      comment: "Водители, оклад + рейсовые",
    });

    tx.push({
      id: nextId(),
      type: "expense",
      date: `${YEAR}-${pad(month + 1)}-05`,
      amount: 440000,
      categoryId: "exp-salary-shop",
      counterparty: "Фонд оплаты труда",
      comment: "Механики, диспетчеры, бухгалтерия",
    });

    const lease = VEHICLES.reduce((a, v) => a + v.leaseMonthly, 0);
    tx.push({
      id: nextId(),
      type: "expense",
      date: `${YEAR}-${pad(month + 1)}-10`,
      amount: lease,
      categoryId: "exp-lease",
      counterparty: "СберЛизинг",
      comment: "Лизинговые платежи",
    });

    tx.push({
      id: nextId(),
      type: "expense",
      date: `${YEAR}-${pad(month + 1)}-15`,
      amount: jitter(rand, 60000, 0.05),
      categoryId: "exp-parking",
      counterparty: "Стоянка «Южные ворота»",
      comment: "Аренда боксов",
    });

    tx.push({
      id: nextId(),
      type: "expense",
      date: `${YEAR}-${pad(month + 1)}-08`,
      amount: 24000,
      categoryId: "exp-nav",
      counterparty: "МТС / Wialon",
      comment: "Связь и мониторинг",
    });

    tx.push({
      id: nextId(),
      type: "expense",
      date: `${YEAR}-${pad(month + 1)}-18`,
      amount: jitter(rand, 350000, 0.25),
      categoryId: "exp-repair",
      counterparty: "СТО «ДизельМастер»",
      comment: month === 7 ? "Капремонт МАЗ, ДВС" : "ТО, расходники, диагностика",
    });

    if (month === 2 || month === 8) {
      tx.push({
        id: nextId(),
        type: "expense",
        date: `${YEAR}-${pad(month + 1)}-22`,
        amount: 540000,
        categoryId: "exp-tires",
        counterparty: "Шинный центр «Кордиант»",
        comment: month === 2 ? "Летняя смена" : "Комплект на тягачи",
      });
    }

    if (month === 0 || month === 6) {
      const ins = VEHICLES.reduce((a, v) => a + Math.round(v.insuranceAnnual / 2), 0);
      tx.push({
        id: nextId(),
        type: "expense",
        date: `${YEAR}-${pad(month + 1)}-14`,
        amount: ins,
        categoryId: "exp-insurance",
        counterparty: "Ингосстрах",
        comment: "ОСАГО / КАСКО, полугодовой платёж",
      });
    }

    tx.push({
      id: nextId(),
      type: "expense",
      date: `${YEAR}-${pad(month + 1)}-25`,
      amount: jitter(rand, 220000, 0.08),
      categoryId: "exp-tax",
      counterparty: "ФНС России",
      comment: "УСН, транспортный налог (аванс)",
    });

    tx.push({
      id: nextId(),
      type: "expense",
      date: `${YEAR}-${pad(month + 1)}-27`,
      amount: jitter(rand, 80000, 0.2),
      categoryId: "exp-admin",
      counterparty: COUNTERPARTIES[Math.floor(rand() * COUNTERPARTIES.length)],
      comment: "Канцелярия, охрана, мелкие расходы",
    });
  }

  return tx.sort((a, b) => a.date.localeCompare(b.date));
}

export const DEFAULT_ACCESS_PASSWORD = "magistral";

export function createSeed(accessPassword = DEFAULT_ACCESS_PASSWORD): AppState {
  const rand = mulberry32(20260916);
  return {
    companyName: "ООО «СеверТранс»",
    inn: "7701234567",
    fuelPrice: FUEL,
    year: YEAR,
    budgetStatus: "approved",
    vehicles: VEHICLES,
    routes: ROUTES,
    categories: CATEGORIES,
    budget: makeBudget(),
    transactions: makeTransactions(rand),
    scenario: { fuelPct: 0, volumePct: 0, salaryPct: 0, repairPct: 0 },
    accessPassword,
  };
}

export function createEmpty(year: number, accessPassword: string): AppState {
  return {
    companyName: "",
    inn: "",
    fuelPrice: 0,
    year,
    budgetStatus: "draft",
    vehicles: [],
    routes: [],
    categories: CATEGORIES,
    budget: CATEGORIES.map((c) => ({
      id: uid("b"),
      categoryId: c.id,
      year,
      months: emptyMonths(),
    })),
    transactions: [],
    scenario: { fuelPct: 0, volumePct: 0, salaryPct: 0, repairPct: 0 },
    accessPassword,
  };
}
