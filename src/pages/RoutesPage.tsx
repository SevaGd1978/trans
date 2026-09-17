import { useState } from "react";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "../components/ui";
import { fuelCost } from "../lib/calc";
import { money, numberRu, uid } from "../lib/format";
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
  const routes = useApp((s) => s.routes);
  const vehicles = useApp((s) => s.vehicles);
  const fuelPrice = useApp((s) => s.fuelPrice);
  const upsertRoute = useApp((s) => s.upsertRoute);
  const removeRoute = useApp((s) => s.removeRoute);
  const [editing, setEditing] = useState<RoutePlan | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          По каждому направлению считается топливо на рейс и маржа до постоянных затрат. Если
          маржинальность падает ниже 40%, направление стоит пересмотреть.
        </p>
        <PrimaryButton onClick={() => setEditing(blankRoute(vehicles[0]?.id ?? ""))}>
          Добавить маршрут
        </PrimaryButton>
      </div>

      <div className="overflow-auto rounded-3xl border border-line bg-white">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-paper-2 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Маршрут</th>
              <th className="px-4 py-3">Плечо</th>
              <th className="px-4 py-3">ТС</th>
              <th className="px-4 py-3 text-right">Рейсов / мес</th>
              <th className="px-4 py-3 text-right">Выручка рейса</th>
              <th className="px-4 py-3 text-right">ГСМ рейса</th>
              <th className="px-4 py-3 text-right">Маржа</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => {
              const vehicle = vehicles.find((v) => v.id === route.vehicleId);
              const fuel = vehicle ? fuelCost(route.distanceKm, vehicle.consumption, fuelPrice) : 0;
              const margin = route.avgRevenue - fuel;
              const pct = route.avgRevenue ? (margin / route.avgRevenue) * 100 : 0;
              return (
                <tr key={route.id} className="border-t border-line/70">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{route.name || `${route.from} — ${route.to}`}</div>
                    <div className="text-xs text-muted">
                      {route.from} → {route.to}
                    </div>
                  </td>
                  <td className="num px-4 py-3">{numberRu(route.distanceKm)} км</td>
                  <td className="px-4 py-3">{vehicle ? `${vehicle.plate}` : "—"}</td>
                  <td className="num px-4 py-3 text-right">{route.tripsPerMonth}</td>
                  <td className="num px-4 py-3 text-right">{money(route.avgRevenue)}</td>
                  <td className="num px-4 py-3 text-right">{money(fuel)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className={`num font-semibold ${pct < 40 ? "text-danger" : "text-teal"}`}>
                      {money(margin)}
                    </div>
                    <div className="text-xs text-muted">{numberRu(pct, 1)}%</div>
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
    </div>
  );
}
