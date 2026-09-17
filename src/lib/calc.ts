import type { BudgetLine, Category, Transaction } from "../types";

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function sum(nums: number[]): number {
  return nums.reduce((acc, n) => acc + n, 0);
}

export function fuelCost(km: number, litersPer100: number, pricePerLiter: number): number {
  if (km <= 0 || litersPer100 < 0 || pricePerLiter < 0) return 0;
  return roundMoney((km / 100) * litersPer100 * pricePerLiter);
}

export function costPerKm(annualCost: number, km: number): number {
  if (km <= 0) return 0;
  return roundMoney(annualCost / km);
}

export function variance(plan: number, actual: number): { amount: number; percent: number } {
  const amount = roundMoney(actual - plan);
  if (plan === 0) {
    return { amount, percent: actual === 0 ? 0 : 100 };
  }
  return { amount, percent: roundMoney((amount / plan) * 100) };
}

export function monthIndex(date: string): { year: number; month: number } {
  const [y, m] = date.split("-").map(Number);
  return { year: y, month: m - 1 };
}

export function inYear(date: string, year: number): boolean {
  return monthIndex(date).year === year;
}

export function totals(transactions: Transaction[]): {
  income: number;
  expense: number;
  profit: number;
} {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === "income") income += tx.amount;
    else expense += tx.amount;
  }
  return { income, expense, profit: roundMoney(income - expense) };
}

export function yearTransactions(transactions: Transaction[], year: number): Transaction[] {
  return transactions.filter((tx) => inYear(tx.date, year));
}

export function monthTransactions(
  transactions: Transaction[],
  year: number,
  month: number,
): Transaction[] {
  return transactions.filter((tx) => {
    const d = monthIndex(tx.date);
    return d.year === year && d.month === month;
  });
}

export function monthlySeries(
  transactions: Transaction[],
  year: number,
): { month: number; income: number; expense: number; profit: number }[] {
  return Array.from({ length: 12 }, (_, month) => {
    const t = totals(monthTransactions(transactions, year, month));
    return { month, ...t };
  });
}

export function byCategory(
  transactions: Transaction[],
  kind: "income" | "expense",
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.type !== kind) continue;
    map[tx.categoryId] = (map[tx.categoryId] ?? 0) + tx.amount;
  }
  return map;
}

export function budgetTotal(line: BudgetLine, month?: number, throughMonth?: number): number {
  if (month !== undefined) return line.months[month] ?? 0;
  if (throughMonth !== undefined) return sum(line.months.slice(0, throughMonth + 1));
  return sum(line.months);
}

export function budgetMap(
  lines: BudgetLine[],
  year: number,
  month?: number,
  throughMonth?: number,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const line of lines) {
    if (line.year !== year) continue;
    map[line.categoryId] = budgetTotal(line, month, throughMonth);
  }
  return map;
}

export function planFactRows(
  categories: Category[],
  lines: BudgetLine[],
  transactions: Transaction[],
  year: number,
  month?: number,
  kind: "income" | "expense" = "expense",
  throughMonth?: number,
) {
  const plan = budgetMap(lines, year, month, throughMonth);
  const scoped =
    month === undefined
      ? yearTransactions(transactions, year).filter((tx) =>
          throughMonth === undefined ? true : monthIndex(tx.date).month <= throughMonth,
        )
      : monthTransactions(transactions, year, month);
  const actual = byCategory(scoped, kind);
  return categories
    .filter((c) => c.kind === kind)
    .map((category) => {
      const p = plan[category.id] ?? 0;
      const a = actual[category.id] ?? 0;
      return {
        category,
        plan: p,
        actual: a,
        ...variance(p, a),
      };
    });
}

export interface ScenarioInput {
  fuelPct: number;
  volumePct: number;
  salaryPct: number;
  repairPct: number;
}

export function applyScenario(
  income: number,
  expenses: Record<string, number>,
  scenario: ScenarioInput,
  categoryIds: { fuel: string; salary: string[]; repair: string },
): { income: number; expense: number; profit: number; byCategory: Record<string, number> } {
  const byCategory: Record<string, number> = {};
  let expense = 0;
  const volumeFactor = 1 + scenario.volumePct / 100;
  const adjustedIncome = roundMoney(income * volumeFactor);

  for (const [id, amount] of Object.entries(expenses)) {
    let factor = 1;
    if (id === categoryIds.fuel) {
      factor = (1 + scenario.fuelPct / 100) * volumeFactor;
    } else if (categoryIds.salary.includes(id)) {
      factor = 1 + scenario.salaryPct / 100;
    } else if (id === categoryIds.repair) {
      factor = (1 + scenario.repairPct / 100) * volumeFactor;
    } else if (id.startsWith("exp-")) {
      factor = volumeFactor > 1 ? 1 + (volumeFactor - 1) * 0.25 : volumeFactor;
    }
    const next = roundMoney(amount * factor);
    byCategory[id] = next;
    expense += next;
  }

  return {
    income: adjustedIncome,
    expense: roundMoney(expense),
    profit: roundMoney(adjustedIncome - expense),
    byCategory,
  };
}

export function elapsedMonth(year: number, now = new Date()): number {
  if (year < now.getFullYear()) return 11;
  if (year > now.getFullYear()) return 0;
  return now.getMonth();
}

export function executionPercent(plan: number, actual: number): number {
  if (plan === 0) return actual === 0 ? 0 : 100;
  return roundMoney((actual / plan) * 100);
}

export function emptyMonths(): number[] {
  return Array.from({ length: 12 }, () => 0);
}

export function spreadEven(annual: number): number[] {
  const base = Math.floor(annual / 12);
  const months = Array.from({ length: 12 }, () => base);
  months[11] += annual - base * 12;
  return months;
}
