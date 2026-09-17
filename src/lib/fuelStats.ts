import { roundMoney } from "./calc";
import type { Transaction, Vehicle } from "../types";

export interface FillingInterval {
  tx: Transaction;
  km?: number;
  consumption?: number;
}

export interface VehicleFuelSummary {
  vehicle: Vehicle;
  fillings: number;
  liters: number;
  amount: number;
  km: number;
  avgConsumption?: number;
  overNorm: boolean;
}

export function fuelTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => tx.categoryId === "exp-fuel");
}

export function withConsumption(fillings: Transaction[]): FillingInterval[] {
  const groups = new Map<string, Transaction[]>();
  for (const tx of fillings) {
    const key = tx.vehicleId ?? tx.id;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const result: FillingInterval[] = fillings.map((tx) => ({ tx }));
  const byId = new Map(result.map((row) => [row.tx.id, row]));

  for (const list of groups.values()) {
    list.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.odometer ?? 0) - (b.odometer ?? 0);
    });
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      if (prev.odometer == null || cur.odometer == null || cur.liters == null) continue;
      const km = cur.odometer - prev.odometer;
      if (km <= 0) continue;
      const row = byId.get(cur.id);
      if (!row) continue;
      row.km = km;
      row.consumption = roundMoney((cur.liters / km) * 100);
    }
  }
  return result;
}

export function vehicleFuelSummaries(
  fillings: Transaction[],
  vehicles: Vehicle[],
): VehicleFuelSummary[] {
  const intervals = withConsumption(fillings);
  return vehicles.map((vehicle) => {
    const rows = intervals.filter((row) => row.tx.vehicleId === vehicle.id);
    const liters = rows.reduce((a, r) => a + (r.tx.liters ?? 0), 0);
    const amount = rows.reduce((a, r) => a + r.tx.amount, 0);
    const km = rows.reduce((a, r) => a + (r.km ?? 0), 0);
    const litersWithKm = rows.reduce((a, r) => a + (r.km ? (r.tx.liters ?? 0) : 0), 0);
    const avgConsumption = km > 0 ? roundMoney((litersWithKm / km) * 100) : undefined;
    return {
      vehicle,
      fillings: rows.length,
      liters,
      amount,
      km,
      avgConsumption,
      overNorm: avgConsumption != null && avgConsumption > vehicle.consumption * 1.08,
    };
  });
}
