import type { Transaction } from "../types";
import { roundMoney } from "./calc";

export const ORDER_INCOME_CATEGORY = "inc-freight";
export const ORDER_CARRIER_CATEGORY = "exp-carrier";
export const ORDER_DISPATCH_CATEGORY = "exp-dispatch";

export function isOrderTx(tx: Transaction): boolean {
  return Boolean(tx.importKey?.startsWith("order|"));
}

export function orderNoFromKey(key?: string): string | undefined {
  const match = key?.match(/^order\|([^|]+)/);
  return match?.[1];
}

export interface OrderSummary {
  count: number;
  income: number;
  carrier: number;
  dispatch: number;
  profit: number;
}

export function summarizeOrders(transactions: Transaction[]): OrderSummary {
  const orders = new Set<string>();
  let income = 0;
  let carrier = 0;
  let dispatch = 0;
  for (const tx of transactions) {
    if (!isOrderTx(tx)) continue;
    const no = orderNoFromKey(tx.importKey);
    if (no) orders.add(no);
    if (tx.categoryId === ORDER_INCOME_CATEGORY) income += tx.amount;
    else if (tx.categoryId === ORDER_CARRIER_CATEGORY) carrier += tx.amount;
    else if (tx.categoryId === ORDER_DISPATCH_CATEGORY) dispatch += tx.amount;
  }
  return {
    count: orders.size,
    income: roundMoney(income),
    carrier: roundMoney(carrier),
    dispatch: roundMoney(dispatch),
    profit: roundMoney(income - carrier - dispatch),
  };
}

export function summarizeRouteOrders(transactions: Transaction[], routeId: string): OrderSummary {
  return summarizeOrders(transactions.filter((tx) => tx.routeId === routeId));
}

export function topCounterparties(
  transactions: Transaction[],
  categoryId: string,
  limit = 6,
): { name: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (!isOrderTx(tx) || tx.categoryId !== categoryId) continue;
    const name = tx.counterparty || "—";
    map.set(name, (map.get(name) ?? 0) + tx.amount);
  }
  return [...map.entries()]
    .map(([name, amount]) => ({ name, amount: roundMoney(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}
