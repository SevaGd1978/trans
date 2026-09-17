import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FuelImportModal } from "../components/FuelImportModal";
import { StatCard } from "../components/Layout";
import { GhostButton, PrimaryButton } from "../components/ui";
import { yearTransactions } from "../lib/calc";
import { downloadFuelExport } from "../lib/fuelImport";
import { fuelTransactions, vehicleFuelSummaries, withConsumption } from "../lib/fuelStats";
import { money, moneyCompact, numberRu } from "../lib/format";
import { useApp } from "../store";

export function FuelPage() {
  const year = useApp((s) => s.year);
  const vehicles = useApp((s) => s.vehicles);
  const transactions = useApp((s) => s.transactions);
  const [vehicleId, setVehicleId] = useState("all");
  const [importOpen, setImportOpen] = useState(false);

  const yearFuel = useMemo(
    () => fuelTransactions(yearTransactions(transactions, year)),
    [transactions, year],
  );
  const scoped = useMemo(
    () => (vehicleId === "all" ? yearFuel : yearFuel.filter((tx) => tx.vehicleId === vehicleId)),
    [yearFuel, vehicleId],
  );
  const intervals = useMemo(() => withConsumption(scoped), [scoped]);
  const summaries = useMemo(
    () => vehicleFuelSummaries(yearFuel, vehicles).filter((s) => s.fillings > 0),
    [yearFuel, vehicles],
  );

  const liters = scoped.reduce((a, tx) => a + (tx.liters ?? 0), 0);
  const amount = scoped.reduce((a, tx) => a + tx.amount, 0);
  const km = intervals.reduce((a, row) => a + (row.km ?? 0), 0);
  const over = summaries.filter((s) => s.overNorm);
  const chart = summaries.map((s) => ({
    name: s.vehicle.plate.replace(/\s/g, "\u00a0"),
    Факт: s.avgConsumption ?? 0,
    Норма: s.vehicle.consumption,
  }));

  const table = [...intervals].sort((a, b) => b.tx.date.localeCompare(a.tx.date));
  const plate = (id?: string) => vehicles.find((v) => v.id === id)?.plate ?? "—";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          Показания одометра и литры с топливных карт. Между двумя заправками считается расход —
          его сравниваем с нормой машины. Импорт Excel и выгрузка используют один и тот же формат.
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="text-sm">
            <div className="mb-1 text-muted">Машина</div>
            <select
              className="rounded-xl border border-line bg-white px-3 py-2.5"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
            >
              <option value="all">Весь парк</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate}
                </option>
              ))}
            </select>
          </label>
          <GhostButton type="button" onClick={() => downloadFuelExport(scoped, vehicles)}>
            Выгрузить Excel
          </GhostButton>
          <PrimaryButton type="button" onClick={() => setImportOpen(true)}>
            Импорт Excel
          </PrimaryButton>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Заправок" value={String(scoped.length)} hint={`${year} год`} />
        <StatCard label="Литры" value={numberRu(liters, 0)} hint="по выбранным ТС" tone="accent" />
        <StatCard label="Затраты ГСМ" value={moneyCompact(amount)} />
        <StatCard
          label="Пробег между заправками"
          value={`${numberRu(km)} км`}
          hint={over.length ? `${over.length} ТС выше нормы` : "расход в пределах нормы"}
          tone={over.length ? "bad" : "good"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-line bg-white p-5">
          <h3 className="font-bold">Расход: факт и норма</h3>
          <p className="mb-4 text-sm text-muted">л/100 км по машинам с показаниями</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} barGap={2}>
                <CartesianGrid stroke="#e2d7c4" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#7a7368", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#7a7368", fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip formatter={(value) => `${numberRu(Number(value ?? 0), 1)} л/100`} />
                <Bar dataKey="Норма" fill="#d9cdba" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Факт" fill="#c45c26" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-3">
          {summaries.map((s) => (
            <article key={s.vehicle.id} className="rounded-3xl border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted">{s.vehicle.name}</div>
                  <div className="font-bold">{s.vehicle.plate}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    s.overNorm ? "bg-danger-2 text-danger" : "bg-teal-2 text-teal"
                  }`}
                >
                  {s.avgConsumption != null ? `${numberRu(s.avgConsumption, 1)} л/100` : "нет пробега"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-muted">Норма</div>
                  <div className="num font-semibold">{numberRu(s.vehicle.consumption, 1)}</div>
                </div>
                <div>
                  <div className="text-muted">Литры</div>
                  <div className="num font-semibold">{numberRu(s.liters, 0)}</div>
                </div>
                <div>
                  <div className="text-muted">ГСМ</div>
                  <div className="num font-semibold">{moneyCompact(s.amount)}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="max-h-[32rem] overflow-auto rounded-3xl border border-line bg-white">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="sticky top-0 z-10 bg-paper-2 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3">ТС</th>
              <th className="px-4 py-3">АЗС</th>
              <th className="px-4 py-3 text-right">Показания</th>
              <th className="px-4 py-3 text-right">Литры</th>
              <th className="px-4 py-3 text-right">Плечо</th>
              <th className="px-4 py-3 text-right">л/100</th>
              <th className="px-4 py-3 text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row) => {
              const vehicle = vehicles.find((v) => v.id === row.tx.vehicleId);
              const hot =
                row.consumption != null &&
                vehicle != null &&
                row.consumption > vehicle.consumption * 1.08;
              return (
              <tr key={row.tx.id} className="border-t border-line/70">
                <td className="num px-4 py-2">{row.tx.date}</td>
                <td className="px-4 py-2 font-medium">{plate(row.tx.vehicleId)}</td>
                <td className="px-4 py-2 text-muted">{row.tx.counterparty}</td>
                <td className="num px-4 py-2 text-right">
                  {row.tx.odometer != null ? numberRu(row.tx.odometer) : "—"}
                </td>
                <td className="num px-4 py-2 text-right">
                  {row.tx.liters != null ? numberRu(row.tx.liters, 1) : "—"}
                </td>
                <td className="num px-4 py-2 text-right">{row.km != null ? `${numberRu(row.km)} км` : "—"}</td>
                <td className={`num px-4 py-2 text-right font-semibold ${hot ? "text-danger" : ""}`}>
                  {row.consumption != null ? numberRu(row.consumption, 1) : "—"}
                </td>
                <td className="num px-4 py-2 text-right text-accent">{money(row.tx.amount)}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {table.length === 0 ? (
          <p className="p-6 text-sm text-muted">
            Нет заправок с показаниями.{" "}
            <button className="font-semibold text-accent" onClick={() => setImportOpen(true)}>
              Импортируйте Excel
            </button>{" "}
            или откройте{" "}
            <Link className="font-semibold text-accent" to="/ledger">
              журнал операций
            </Link>
            .
          </p>
        ) : null}
      </div>

      <FuelImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
