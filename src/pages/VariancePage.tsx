import { useMemo, useState } from "react";
import { StatCard } from "../components/Layout";
import { executionPercent, planFactRows, sum } from "../lib/calc";
import { money, percent, signedMoney } from "../lib/format";
import { useApp } from "../store";
import { MONTHS_FULL } from "../types";

export function VariancePage() {
  const year = useApp((s) => s.year);
  const categories = useApp((s) => s.categories);
  const budget = useApp((s) => s.budget);
  const transactions = useApp((s) => s.transactions);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [month, setMonth] = useState<number | "ytd">("ytd");

  const monthIndex = month === "ytd" ? undefined : month;
  const rows = useMemo(
    () => planFactRows(categories, budget, transactions, year, monthIndex, kind),
    [categories, budget, transactions, year, monthIndex, kind],
  );
  const plan = sum(rows.map((r) => r.plan));
  const actual = sum(rows.map((r) => r.actual));
  const delta = actual - plan;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex rounded-xl border border-line bg-white p-1">
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${kind === "expense" ? "bg-ink text-paper" : ""}`}
            onClick={() => setKind("expense")}
          >
            Расходы
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${kind === "income" ? "bg-ink text-paper" : ""}`}
            onClick={() => setKind("income")}
          >
            Доходы
          </button>
        </div>
        <label className="text-sm">
          <div className="mb-1 text-muted">Период</div>
          <select
            className="rounded-xl border border-line bg-white px-3 py-2.5"
            value={month}
            onChange={(e) => {
              const v = e.target.value;
              setMonth(v === "ytd" ? "ytd" : Number(v));
            }}
          >
            <option value="ytd">Весь {year}</option>
            {MONTHS_FULL.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="План" value={money(plan)} />
        <StatCard label="Факт" value={money(actual)} tone="accent" />
        <StatCard
          label="Отклонение"
          value={signedMoney(delta)}
          hint={`${percent(plan ? (delta / plan) * 100 : 0)} · исполнение ${executionPercent(plan, actual)}%`}
          tone={kind === "expense" ? (delta > 0 ? "bad" : "good") : delta >= 0 ? "good" : "bad"}
        />
      </div>

      <div className="overflow-auto rounded-3xl border border-line bg-white">
        <table className="min-w-[760px] w-full text-sm">
          <thead className="bg-paper-2 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Статья</th>
              <th className="px-4 py-3 text-right">План</th>
              <th className="px-4 py-3 text-right">Факт</th>
              <th className="px-4 py-3 text-right">Δ</th>
              <th className="w-56 px-4 py-3">Исполнение</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pct = Math.min(140, executionPercent(row.plan, row.actual));
              const over =
                kind === "expense" ? row.actual > row.plan && row.plan > 0 : row.actual < row.plan;
              return (
                <tr key={row.category.id} className="border-t border-line/70">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.category.name}</div>
                    <div className="text-xs text-muted">{row.category.group}</div>
                  </td>
                  <td className="num px-4 py-3 text-right">{money(row.plan)}</td>
                  <td className="num px-4 py-3 text-right font-semibold">{money(row.actual)}</td>
                  <td className={`num px-4 py-3 text-right ${over ? "text-danger" : "text-teal"}`}>
                    {signedMoney(row.amount)}
                    <div className="text-xs">{percent(row.percent)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-2 overflow-hidden rounded-full bg-paper-2">
                      <div
                        className={`h-full rounded-full ${over ? "bg-danger" : "bg-teal"}`}
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-muted">{executionPercent(row.plan, row.actual)}%</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
