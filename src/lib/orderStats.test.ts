import { describe, expect, it } from "vitest";
import { summarizeOrders, topCounterparties } from "./orderStats";
import type { Transaction } from "../types";

describe("summarizeOrders", () => {
  it("складывает сумму, исполнителю и диспетчеру по ключам заказа", () => {
    const txs: Transaction[] = [
      {
        id: "1",
        type: "income",
        date: "2026-08-01",
        amount: 180000,
        categoryId: "inc-freight",
        counterparty: "Клиент А",
        comment: "",
        importKey: "order|1|inc-freight",
      },
      {
        id: "2",
        type: "expense",
        date: "2026-08-01",
        amount: 160000,
        categoryId: "exp-carrier",
        counterparty: "Перевозчик",
        comment: "",
        importKey: "order|1|exp-carrier",
      },
      {
        id: "3",
        type: "expense",
        date: "2026-08-01",
        amount: 5000,
        categoryId: "exp-fuel",
        counterparty: "АЗС",
        comment: "",
      },
    ];
    expect(summarizeOrders(txs)).toEqual({
      count: 1,
      income: 180000,
      carrier: 160000,
      dispatch: 0,
      profit: 20000,
    });
    expect(topCounterparties(txs, "inc-freight")).toEqual([{ name: "Клиент А", amount: 180000 }]);
  });
});
