import { useState } from "react";
import { TripImportModal } from "../components/TripImportModal";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "../components/ui";
import { fuelCost, yearTransactions } from "../lib/calc";
import { money, numberRu, uid } from "../lib/format";
import { summarizeRouteOrders } from "../lib/orderStats";
import { useApp } from "../store";
import type { RoutePlan } from "../types";

const blankRoute = (vehicleId: string): RoutePlan => ({
  id: uid("r"),
  name: "",
  from: "",
  to: "",
  distanceKm: 0,
  avgRevenue: 0,
  tripsPerMonth: 8,
  vehicleId,
});

export function RoutesPage() {
  const year = useApp((s) => s.year);
  const routes = useApp((s) => s.routes);
  const vehicles = useApp((s) => s.vehicles);
  const fuelPrice = useApp((s) => s.fuelPrice);
  const transactions = useApp((s) => s.transactions);
  const upsertRoute = useApp((s) => s.upsertRoute);
  const removeRoute = useApp((s) => s.removeRoute);
  const [editing, setEditing] = useState<RoutePlan | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const yearTx = yearTransactions(transactions, year);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          Направления собираются из загрузки и разгрузки сводного отчёта 1С. Маржа заказа — сумма минус
          оплата исполнителю и диспетчеру. Если к маршруту привязана машина и известен километраж,
          дополнительно считается ГСМ.
        </p>
        <div className="flex flex-wrap gap-2">
          <GhostButton type="button" onClick={() => setImportOpen(true)}>
            Импорт заказов 1С
          </GhostButton>
          <PrimaryButton onClick={() => setEditing(blankRoute(vehicles[0]?.id ?? ""))}>
            Добавить маршрут
          </PrimaryButton>
        </div>
      </div>

      <div className="overflow-auto rounded-3xl border border-line bg-white">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-paper-2 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Маршрут</th>
              <th className="px-4 py-3 text-right">Заказов</th>
              <th className="px-4 py-3 text-right">Сумма</th>
              <th className="px-4 py-3 text-right">Исполнителю</th>
              <th className="px-4 py-3 text-right">Диспетчеру</th>
              <th className="px-4 py-3 text-right">Прибыль</th>
              <th className="px-4 py-3 text-right">ГСМ / ТС</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {routes.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-sm text-muted" colSpan={8}>
                  Маршрутов нет. Загрузите сводный отчёт 1С по заказам.
                </td>
              </tr>
            ) : null}
            {routes.map((route) => {
              const vehicle = vehicles.find((v) => v.id === route.vehicleId);
              const fuel = vehicle ? fuelCost(route.distanceKm, vehicle.consumption, fuelPrice) : 0;
              const fact = summarizeRouteOrders(yearTx, route.id);
              const hasOrders = fact.count > 0;
              const income = hasOrders ? fact.income : route.avgRevenue * route.tripsPerMonth;
              const profit = hasOrders ? fact.profit : route.avgRevenue - fuel;
              const base = hasOrders ? fact.income : route.avgRevenue;
              const pct = base ? (profit / base) * 100 : 0;
              return (
                <tr key={route.id} className="border-t border-line/70">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{route.name || `${route.from} — ${route.to}`}</div>
                    <div className="text-xs text-muted">
                      {route.from} → {route.to}
                      {route.distanceKm ? ` · ${numberRu(route.distanceKm)} км` : ""}
                    </div>
                  </td>
                  <td className="num px-4 py-3 text-right">
                    {hasOrders ? fact.count : route.tripsPerMonth}
                  </td>
                  <td className="num px-4 py-3 text-right">{money(income)}</td>
                  <td className="num px-4 py-3 text-right">{hasOrders ? money(fact.carrier) : "—"}</td>
                  <td className="num px-4 py-3 text-right">{hasOrders ? money(fact.dispatch) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className={`num font-semibold ${pct < 10 ? "text-danger" : "text-teal"}`}>
                      {money(profit)}
                    </div>
                    <div className="text-xs text-muted">{numberRu(pct, 1)}%</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="num">{vehicle && route.distanceKm ? money(fuel) : "—"}</div>
                    <div className="text-xs text-muted">{vehicle?.plate ?? "без ТС"}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="mr-2 text-xs font-semibold text-muted" onClick={() => setEditing(route)}>
                      изменить
                    </button>
                    <button className="text-xs font-semibold text-danger" onClick={() => removeRoute(route.id)}>
                      удалить
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={Boolean(editing)} title="Маршрут" onClose={() => setEditing(null)}>
        {editing ? (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              upsertRoute({
                ...editing,
                name: editing.name || `${editing.from} — ${editing.to}`,
              });
              setEditing(null);
            }}
          >
            <Field label="Название">
              <input className={inputClass} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Машина">
              <select
                className={inputClass}
                value={editing.vehicleId}
                onChange={(e) => setEditing({ ...editing, vehicleId: e.target.value })}
              >
                <option value="">Не указана</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} · {v.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Откуда">
              <input className={inputClass} value={editing.from} onChange={(e) => setEditing({ ...editing, from: e.target.value })} />
            </Field>
            <Field label="Куда">
              <input className={inputClass} value={editing.to} onChange={(e) => setEditing({ ...editing, to: e.target.value })} />
            </Field>
            <Field label="Расстояние, км">
              <input
                type="number"
                className={inputClass}
                value={editing.distanceKm}
                onChange={(e) => setEditing({ ...editing, distanceKm: Number(e.target.value) })}
              />
            </Field>
            <Field label="Средняя выручка рейса, ₽">
              <input
                type="number"
                className={inputClass}
                value={editing.avgRevenue}
                onChange={(e) => setEditing({ ...editing, avgRevenue: Number(e.target.value) })}
              />
            </Field>
            <Field label="Рейсов в месяц">
              <input
                type="number"
                className={inputClass}
                value={editing.tripsPerMonth}
                onChange={(e) => setEditing({ ...editing, tripsPerMonth: Number(e.target.value) })}
              />
            </Field>
            <div className="flex items-end justify-end gap-2">
              <GhostButton type="button" onClick={() => setEditing(null)}>
                Отмена
              </GhostButton>
              <PrimaryButton type="submit">Сохранить</PrimaryButton>
            </div>
          </form>
        ) : null}
      </Modal>
      <TripImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
