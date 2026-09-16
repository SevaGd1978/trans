import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "../components/Layout";
import { applyScenario, budgetMap, byCategory, totals, yearTransactions } from "../lib/calc";
import { money, moneyCompact, numberRu } from "../lib/format";
import { useApp } from "../store";

function Slider({
  label,
  value,
  onChange,
  min = -30,
  max = 40,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="num text-muted">
          {value > 0 ? "+" : ""}
          {numberRu(value, 0)}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </label>
  );
}

export function ScenariosPage() {
  const year = useApp((s) => s.year);
  const categories = useApp((s) => s.categories);
  const budget = useApp((s) => s.budget);
  const transactions = useApp((s) => s.transactions);
  const scenario = useApp((s) => s.scenario);
  const setScenario = useApp((s) => s.setScenario);
  const fuelPrice = useApp((s) => s.fuelPrice);

  const yearTx = yearTransactions(transactions, year);
  const fact = totals(yearTx);
  const expenses = byCategory(yearTx, "expense");
  const scaled = applyScenario(fact.income, expenses, scenario, {
    fuel: "exp-fuel",
    salary: ["exp-salary-drivers", "exp-salary-shop"],
    repair: "exp-repair",
  });

  const plan = budgetMap(budget, year);
  const planIncome = categories.filter((c) => c.kind === "income").reduce((a, c) => a + (plan[c.id] ?? 0), 0);
  const planExpense = categories.filter((c) => c.kind === "expense").reduce((a, c) => a + (plan[c.id] ?? 0), 0);

  const chart = [
    { name: "План года", Прибыль: planIncome - planExpense },
    { name: "Факт YTD", Прибыль: fact.profit },
    { name: "Сценарий", Прибыль: scaled.profit },
  ];

  const newFuel = fuelPrice * (1 + scenario.fuelPct / 100);

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-muted">
        Сценарий пересчитывает уже накопленный факт {year} года: дорожает дизель, растёт или падает
        объём перевозок, индексируется ФОТ, меняется ремонт. Объём тянет за собой ГСМ и часть
        переменных затрат.
      </p>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.2fr]">
        <div className="space-y-5 rounded-3xl border border-line bg-white p-5">
          <Slider label="Цена дизеля" value={scenario.fuelPct} onChange={(fuelPct) => setScenario({ fuelPct })} />
          <Slider label="Объём перевозок" value={scenario.volumePct} onChange={(volumePct) => setScenario({ volumePct })} />
          <Slider label="Зарплаты" value={scenario.salaryPct} onChange={(salaryPct) => setScenario({ salaryPct })} />
          <Slider
            label="ТО и ремонт"
            value={scenario.repairPct}
            onChange={(repairPct) => setScenario({ repairPct })}
            min={-20}
            max={80}
          />
          <button
            className="text-sm font-semibold text-accent"
            onClick={() => setScenario({ fuelPct: 0, volumePct: 0, salaryPct: 0, repairPct: 0 })}
          >
            Сбросить к факту
          </button>
          <div className="rounded-2xl bg-paper-2 p-3 text-sm">
            Дизель в сценарии: <span className="num font-semibold">{numberRu(newFuel, 2)} ₽/л</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Выручка" value={moneyCompact(scaled.income)} hint={`было ${moneyCompact(fact.income)}`} />
            <StatCard label="Затраты" value={moneyCompact(scaled.expense)} hint={`было ${moneyCompact(fact.expense)}`} />
            <StatCard
              label="Прибыль"
              value={moneyCompact(scaled.profit)}
              tone={scaled.profit >= fact.profit ? "good" : "bad"}
              hint={`Δ ${moneyCompact(scaled.profit - fact.profit)}`}
            />
          </div>
          <div className="rounded-3xl border border-line bg-white p-5">
            <h3 className="mb-3 font-bold">Прибыль: план, факт и сценарий</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid stroke="#e2d7c4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#7a7368", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)}`}
                    tick={{ fill: "#7a7368", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip formatter={(value) => money(Number(value ?? 0))} />
                  <Bar dataKey="Прибыль" fill="#c45c26" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-auto rounded-3xl border border-line bg-white">
        <table className="min-w-[640px] w-full text-sm">
          <thead className="bg-paper-2 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Статья затрат</th>
              <th className="px-4 py-3 text-right">Факт</th>
              <th className="px-4 py-3 text-right">Сценарий</th>
            </tr>
          </thead>
          <tbody>
            {categories
              .filter((c) => c.kind === "expense")
              .map((c) => (
                <tr key={c.id} className="border-t border-line/70">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="num px-4 py-2 text-right">{money(expenses[c.id] ?? 0)}</td>
                  <td className="num px-4 py-2 text-right font-semibold">
                    {money(scaled.byCategory[c.id] ?? 0)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
