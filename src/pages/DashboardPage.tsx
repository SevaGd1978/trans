import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Wrench } from "lucide-react";
import { StatCard } from "../components/Layout";
import {
  budgetMap,
  byCategory,
  executionPercent,
  monthlySeries,
  totals,
  yearTransactions,
} from "../lib/calc";
import { money, moneyCompact, VEHICLE_STATUS_LABEL } from "../lib/format";
import { useApp } from "../store";
import { MONTHS } from "../types";

const PIE_COLORS = ["#c45c26", "#1f6f5b", "#b45309", "#3d3830", "#7a7368", "#e39a63", "#8b5e3c", "#4a6d7c"];

export function DashboardPage() {
  const year = useApp((s) => s.year);
  const companyName = useApp((s) => s.companyName);
  const inn = useApp((s) => s.inn);
  const fuelPrice = useApp((s) => s.fuelPrice);
  const vehicles = useApp((s) => s.vehicles);
  const routes = useApp((s) => s.routes);
  const categories = useApp((s) => s.categories);
  const budget = useApp((s) => s.budget);
  const transactions = useApp((s) => s.transactions);

  const yearTx = yearTransactions(transactions, year);
  const actual = totals(yearTx);
  const planMap = budgetMap(budget, year);
  const incomeCats = categories.filter((c) => c.kind === "income").map((c) => c.id);
  const expenseCats = categories.filter((c) => c.kind === "expense").map((c) => c.id);
  const planIncome = incomeCats.reduce((a, id) => a + (planMap[id] ?? 0), 0);
  const planExpense = expenseCats.reduce((a, id) => a + (planMap[id] ?? 0), 0);
  const planProfit = planIncome - planExpense;
  const series = monthlySeries(yearTx, year).map((row) => ({
    name: MONTHS[row.month],
    Доходы: row.income,
    Расходы: row.expense,
  }));
  const expenseActual = byCategory(yearTx, "expense");
  const pie = categories
    .filter((c) => c.kind === "expense")
    .map((c) => ({ name: c.name, value: expenseActual[c.id] ?? 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const alerts: string[] = [];
  if (actual.expense > planExpense && planExpense > 0) {
    alerts.push(`Затраты превысили годовой план на ${money(actual.expense - planExpense)}.`);
  }
  const fuelPlan = planMap["exp-fuel"] ?? 0;
  const fuelFact = expenseActual["exp-fuel"] ?? 0;
  if (fuelFact > fuelPlan * 0.75 && fuelPlan > 0) {
    alerts.push(`ГСМ уже ${executionPercent(fuelPlan, fuelFact)}% от годового лимита.`);
  }
  const inRepair = vehicles.filter((v) => v.status === "repair");
  if (inRepair.length) {
    alerts.push(`В ремонте: ${inRepair.map((v) => v.plate).join(", ")}.`);
  }
  const idle = vehicles.filter((v) => v.status === "idle");
  if (idle.length) {
    alerts.push(`Простой: ${idle.map((v) => v.plate).join(", ")} — не приносит выручку.`);
  }

  const monthNow = year === 2026 ? 8 : 11;
  const ytdPlanExpense = expenseCats.reduce((acc, id) => {
    const line = budget.find((l) => l.year === year && l.categoryId === id);
    if (!line) return acc;
    return acc + line.months.slice(0, monthNow + 1).reduce((a, b) => a + b, 0);
  }, 0);

  return (
    <div className="space-y-6">
      <section className="waybill-grid relative overflow-hidden rounded-3xl border border-line bg-white p-5 md:p-7">
        <div className="absolute right-8 top-8 hidden md:block">
          <div className="stamp">СеверТранс</div>
        </div>
        <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-accent">
          Путевой лист бюджета
        </div>
        <h2 className="mt-1 max-w-2xl text-3xl font-extrabold tracking-tight">
          {companyName}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          ИНН {inn} · дизель {fuelPrice.toLocaleString("ru-RU")} ₽/л · {vehicles.length} единиц
          техники · {routes.length} маршрутов. План и факт за {year} год, факт заполнен по сентябрь.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-paper-2 px-3 py-1">Магистральные тягачи</span>
          <span className="rounded-full bg-paper-2 px-3 py-1">ГСМ из пробега</span>
          <span className="rounded-full bg-paper-2 px-3 py-1">План-факт по статьям</span>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Выручка факт"
          value={moneyCompact(actual.income)}
          hint={moneyHintSimple(planIncome, "план года")}
          tone="accent"
        />
        <StatCard
          label="Затраты факт"
          value={moneyCompact(actual.expense)}
          hint={`Нарастающим итогом к плану ${moneyCompact(ytdPlanExpense)}`}
        />
        <StatCard
          label="Прибыль факт"
          value={moneyCompact(actual.profit)}
          hint={`План года ${moneyCompact(planProfit)}`}
          tone={actual.profit >= 0 ? "good" : "bad"}
        />
        <StatCard
          label="Исполнение затрат"
          value={`${executionPercent(planExpense, actual.expense).toLocaleString("ru-RU")}%`}
          hint="Факт / годовой бюджет расходов"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-3xl border border-line bg-white p-5">
          <h3 className="font-bold">Динамика доходов и расходов</h3>
          <p className="mb-4 text-sm text-muted">По месяцам {year} года, ₽</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} barGap={2}>
                <CartesianGrid stroke="#e2d7c4" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#7a7368", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)}`}
                  tick={{ fill: "#7a7368", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  formatter={(value) => money(Number(value ?? 0))}
                  contentStyle={{ borderRadius: 12, borderColor: "#d9cdba" }}
                />
                <Bar dataKey="Доходы" fill="#1f6f5b" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Расходы" fill="#c45c26" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-muted">Ось Y — млн ₽</div>
        </div>

        <div className="rounded-3xl border border-line bg-white p-5">
          <h3 className="font-bold">Структура затрат</h3>
          <p className="mb-4 text-sm text-muted">Факт с начала года</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}>
                  {pie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => money(Number(value ?? 0))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-sm">
            {pie.slice(0, 6).map((slice, i) => (
              <li key={slice.name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  {slice.name}
                </span>
                <span className="num text-muted">{moneyCompact(slice.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-line bg-white p-5">
          <h3 className="mb-3 flex items-center gap-2 font-bold">
            <AlertTriangle size={18} className="text-accent" />
            Контроль
          </h3>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted">Отклонений нет: парк в линии, лимиты в норме.</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a} className="rounded-xl bg-paper-2 px-3 py-2 text-sm">
                  {a}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-3xl border border-line bg-white p-5">
          <h3 className="mb-3 flex items-center gap-2 font-bold">
            <Wrench size={18} className="text-accent" />
            Состояние парка
          </h3>
          <div className="space-y-2">
            {vehicles.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <div className="font-semibold">{v.name}</div>
                  <div className="text-xs text-muted">{v.plate}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    v.status === "active"
                      ? "bg-teal-2 text-teal"
                      : v.status === "repair"
                        ? "bg-danger-2 text-danger"
                        : "bg-paper-2 text-muted"
                  }`}
                >
                  {VEHICLE_STATUS_LABEL[v.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function moneyHintSimple(plan: number, suffix: string) {
  return `${moneyCompact(plan)} ${suffix}`;
}
