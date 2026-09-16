import { describe, expect, it } from "vitest";
import type { Transaction, Vehicle } from "../types";
import { vehicleFuelSummaries, withConsumption } from "./fuelStats";

const volvo: Vehicle = {
  id: "v-volvo",
  name: "Volvo",
  plate: "А 123 ВС 777",
  type: "tractor",
  year: 2021,
  consumption: 32,
  plannedKm: 120000,
  status: "active",
  leaseMonthly: 0,
  insuranceAnnual: 0,
};

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "date" | "amount">): Transaction {
  return {
    type: "expense",
    categoryId: "exp-fuel",
    counterparty: "ГПН",
    comment: "",
    vehicleId: "v-volvo",
    ...partial,
  };
}

describe("withConsumption", () => {
  it("считает л/100 км между двумя показаниями", () => {
    const rows = withConsumption([
      tx({ id: "a", date: "2026-09-01", amount: 1, odometer: 100000, liters: 300 }),
      tx({ id: "b", date: "2026-09-10", amount: 1, odometer: 101000, liters: 320 }),
    ]);
    const second = rows.find((r) => r.tx.id === "b");
    expect(second?.km).toBe(1000);
    expect(second?.consumption).toBe(32);
  });
});

describe("vehicleFuelSummaries", () => {
  it("помечает перерасход относительно нормы", () => {
    const [row] = vehicleFuelSummaries(
      [
        tx({ id: "a", date: "2026-09-01", amount: 10000, odometer: 100000, liters: 300 }),
        tx({ id: "b", date: "2026-09-10", amount: 20000, odometer: 101000, liters: 400 }),
      ],
      [volvo],
    );
    expect(row.km).toBe(1000);
    expect(row.avgConsumption).toBe(40);
    expect(row.overNorm).toBe(true);
    expect(row.liters).toBe(700);
  });
});
