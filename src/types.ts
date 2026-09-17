export const MONTHS = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
] as const;

export const MONTHS_FULL = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

export type VehicleType = "tractor" | "truck" | "van" | "bus";
export type VehicleStatus = "active" | "repair" | "idle";
export type TxType = "income" | "expense";
export type BudgetStatus = "draft" | "approved";

export interface Category {
  id: string;
  name: string;
  kind: TxType;
  group: string;
}

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  type: VehicleType;
  year: number;
  consumption: number;
  plannedKm: number;
  status: VehicleStatus;
  leaseMonthly: number;
  insuranceAnnual: number;
}

export interface RoutePlan {
  id: string;
  name: string;
  from: string;
  to: string;
  distanceKm: number;
  avgRevenue: number;
  tripsPerMonth: number;
  vehicleId: string;
}

export interface BudgetLine {
  id: string;
  categoryId: string;
  year: number;
  months: number[];
}

export interface Transaction {
  id: string;
  type: TxType;
  date: string;
  amount: number;
  categoryId: string;
  vehicleId?: string;
  routeId?: string;
  counterparty: string;
  comment: string;
  liters?: number;
  odometer?: number;
  pricePerLiter?: number;
  importKey?: string;
}

export interface Scenario {
  fuelPct: number;
  volumePct: number;
  salaryPct: number;
  repairPct: number;
}

export interface AppState {
  companyName: string;
  inn: string;
  fuelPrice: number;
  year: number;
  budgetStatus: BudgetStatus;
  vehicles: Vehicle[];
  routes: RoutePlan[];
  categories: Category[];
  budget: BudgetLine[];
  transactions: Transaction[];
  scenario: Scenario;
  accessPassword: string;
}
