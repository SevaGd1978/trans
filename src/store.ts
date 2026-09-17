import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEmpty, createSeed, DEFAULT_ACCESS_PASSWORD } from "./data/seed";
import { emptyMonths, fuelCost, spreadEven } from "./lib/calc";
import { uid } from "./lib/format";
import { placeKey } from "./lib/tripImport";
import type {
  AppState,
  BudgetLine,
  BudgetStatus,
  RoutePlan,
  Scenario,
  Transaction,
  Vehicle,
} from "./types";

interface Actions {
  setYear: (year: number) => void;
  setCompany: (companyName: string, inn: string) => void;
  setFuelPrice: (fuelPrice: number) => void;
  setBudgetStatus: (budgetStatus: BudgetStatus) => void;
  setScenario: (scenario: Partial<Scenario>) => void;
  upsertVehicle: (vehicle: Vehicle) => void;
  removeVehicle: (id: string) => void;
  upsertRoute: (route: RoutePlan) => void;
  removeRoute: (id: string) => void;
  upsertTransaction: (tx: Transaction) => void;
  importTransactions: (txs: Transaction[]) => { added: number; skipped: number };
  importTrips: (payload: {
    routes: RoutePlan[];
    transactions: Transaction[];
  }) => { routesAdded: number; routesUpdated: number; tripsAdded: number; skipped: number };
  removeTransaction: (id: string) => void;
  setBudgetCell: (categoryId: string, month: number, amount: number) => void;
  fillFuelFromFleet: () => void;
  copyBudgetEven: (categoryId: string, annual: number) => void;
  changeAccessPassword: (next: string) => void;
  resetDemo: () => void;
  clearAll: () => void;
}

function ensureBudgetYear(budget: BudgetLine[], year: number, categoryIds: string[]): BudgetLine[] {
  const has = budget.some((l) => l.year === year);
  if (has) return budget;
  return [
    ...budget,
    ...categoryIds.map((categoryId) => ({
      id: uid("b"),
      categoryId,
      year,
      months: emptyMonths(),
    })),
  ];
}

export const useApp = create<AppState & Actions>()(
  persist(
    (set, get) => ({
      ...createSeed(),
      setYear: (year) =>
        set((s) => ({
          year,
          budget: ensureBudgetYear(
            s.budget,
            year,
            s.categories.map((c) => c.id),
          ),
        })),
      setCompany: (companyName, inn) => set({ companyName, inn }),
      setFuelPrice: (fuelPrice) => set({ fuelPrice }),
      setBudgetStatus: (budgetStatus) => set({ budgetStatus }),
      setScenario: (scenario) => set((s) => ({ scenario: { ...s.scenario, ...scenario } })),
      upsertVehicle: (vehicle) =>
        set((s) => {
          const exists = s.vehicles.some((v) => v.id === vehicle.id);
          return {
            vehicles: exists
              ? s.vehicles.map((v) => (v.id === vehicle.id ? vehicle : v))
              : [...s.vehicles, vehicle],
          };
        }),
      removeVehicle: (id) => set((s) => ({ vehicles: s.vehicles.filter((v) => v.id !== id) })),
      upsertRoute: (route) =>
        set((s) => {
          const exists = s.routes.some((r) => r.id === route.id);
          return {
            routes: exists
              ? s.routes.map((r) => (r.id === route.id ? route : r))
              : [...s.routes, route],
          };
        }),
      removeRoute: (id) => set((s) => ({ routes: s.routes.filter((r) => r.id !== id) })),
      upsertTransaction: (tx) =>
        set((s) => {
          const exists = s.transactions.some((t) => t.id === tx.id);
          return {
            transactions: exists
              ? s.transactions.map((t) => (t.id === tx.id ? tx : t))
              : [...s.transactions, tx].sort((a, b) => b.date.localeCompare(a.date)),
          };
        }),
      importTransactions: (txs) => {
        const s = get();
        const keys = new Set(
          s.transactions.map((t) => t.importKey).filter((k): k is string => Boolean(k)),
        );
        const added: Transaction[] = [];
        for (const tx of txs) {
          if (tx.importKey && keys.has(tx.importKey)) continue;
          added.push(tx);
          if (tx.importKey) keys.add(tx.importKey);
        }
        if (added.length) {
          set({
            transactions: [...s.transactions, ...added].sort((a, b) => b.date.localeCompare(a.date)),
          });
        }
        return { added: added.length, skipped: txs.length - added.length };
      },
      importTrips: ({ routes: nextRoutes, transactions: txs }) => {
        const s = get();
        const before = new Map(s.routes.map((r) => [placeKey(r.from, r.to), r]));
        let routesAdded = 0;
        let routesUpdated = 0;
        for (const route of nextRoutes) {
          const key = placeKey(route.from, route.to);
          const prev = before.get(key);
          if (!prev) routesAdded += 1;
          else if (
            prev.distanceKm !== route.distanceKm ||
            prev.avgRevenue !== route.avgRevenue ||
            prev.tripsPerMonth !== route.tripsPerMonth ||
            prev.vehicleId !== route.vehicleId
          ) {
            routesUpdated += 1;
          }
        }
        const keys = new Set(
          s.transactions.map((t) => t.importKey).filter((k): k is string => Boolean(k)),
        );
        const added: Transaction[] = [];
        for (const tx of txs) {
          if (tx.importKey && keys.has(tx.importKey)) continue;
          added.push(tx);
          if (tx.importKey) keys.add(tx.importKey);
        }
        set({
          routes: nextRoutes,
          transactions: added.length
            ? [...s.transactions, ...added].sort((a, b) => b.date.localeCompare(a.date))
            : s.transactions,
        });
        return {
          routesAdded,
          routesUpdated,
          tripsAdded: added.length,
          skipped: txs.length - added.length,
        };
      },
      removeTransaction: (id) =>
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),
      setBudgetCell: (categoryId, month, amount) =>
        set((s) => ({
          budget: s.budget.map((line) =>
            line.year === s.year && line.categoryId === categoryId
              ? {
                  ...line,
                  months: line.months.map((v, i) => (i === month ? Math.max(0, amount) : v)),
                }
              : line,
          ),
        })),
      fillFuelFromFleet: () => {
        const { vehicles, fuelPrice, year } = get();
        const annual = Math.round(
          vehicles
            .filter((v) => v.status !== "idle")
            .reduce((acc, v) => acc + fuelCost(v.plannedKm, v.consumption, fuelPrice), 0),
        );
        set((s) => ({
          budget: s.budget.map((line) =>
            line.year === year && line.categoryId === "exp-fuel"
              ? { ...line, months: spreadEven(annual) }
              : line,
          ),
        }));
      },
      copyBudgetEven: (categoryId, annual) =>
        set((s) => ({
          budget: s.budget.map((line) =>
            line.year === s.year && line.categoryId === categoryId
              ? { ...line, months: spreadEven(Math.max(0, Math.round(annual))) }
              : line,
          ),
        })),
      changeAccessPassword: (next) => set({ accessPassword: next.trim() }),
      resetDemo: () => {
        const accessPassword = get().accessPassword || DEFAULT_ACCESS_PASSWORD;
        set(createSeed(accessPassword));
      },
      clearAll: () => {
        const accessPassword = get().accessPassword || DEFAULT_ACCESS_PASSWORD;
        set(createEmpty(get().year, accessPassword));
      },
    }),
    {
      name: "magistral-budget-v3",
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...saved,
          accessPassword: saved.accessPassword || DEFAULT_ACCESS_PASSWORD,
        };
      },
    },
  ),
);
