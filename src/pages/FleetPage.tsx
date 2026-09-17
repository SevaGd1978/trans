import { useState } from "react";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "../components/ui";
import { costPerKm, fuelCost } from "../lib/calc";
import { money, numberRu, uid, VEHICLE_STATUS_LABEL, VEHICLE_TYPE_LABEL } from "../lib/format";
import { useApp } from "../store";
import type { Vehicle, VehicleStatus, VehicleType } from "../types";

const blankVehicle = (): Vehicle => ({
  id: uid("v"),
  name: "",
  plate: "",
  type: "tractor",
  year: 2024,
  consumption: 30,
  plannedKm: 80000,
  status: "active",
  leaseMonthly: 0,
  insuranceAnnual: 0,
});

export function FleetPage() {
  const vehicles = useApp((s) => s.vehicles);
  const fuelPrice = useApp((s) => s.fuelPrice);
  const upsertVehicle = useApp((s) => s.upsertVehicle);
  const removeVehicle = useApp((s) => s.removeVehicle);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="max-w-2xl text-sm text-muted">
          По каждой машине считается годовая стоимость владения: лизинг, страховка и ГСМ из планового
          пробега. Себестоимость километра нужна, чтобы отсекать убыточные рейсы.
        </p>
        <PrimaryButton onClick={() => setEditing(blankVehicle())}>Добавить ТС</PrimaryButton>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {vehicles.map((v) => {
          const fuel = fuelCost(v.plannedKm, v.consumption, fuelPrice);
          const own = v.leaseMonthly * 12 + v.insuranceAnnual + fuel;
          const kmCost = costPerKm(own, v.plannedKm);
          return (
            <article key={v.id} className="flex flex-col rounded-3xl border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted">
                    {VEHICLE_TYPE_LABEL[v.type]} · {v.year}
                  </div>
                  <h3 className="text-lg font-bold">{v.name}</h3>
                  <div className="num text-sm text-muted">{v.plate}</div>
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
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted">Расход</dt>
                  <dd className="num font-semibold">{numberRu(v.consumption, 1)} л/100</dd>
                </div>
                <div>
                  <dt className="text-muted">План пробега</dt>
                  <dd className="num font-semibold">{numberRu(v.plannedKm)} км</dd>
                </div>
                <div>
                  <dt className="text-muted">ГСМ / год</dt>
                  <dd className="num font-semibold">{money(fuel)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Лизинг / мес</dt>
                  <dd className="num font-semibold">{money(v.leaseMonthly)}</dd>
                </div>
              </dl>
              <div className="mt-4 rounded-2xl bg-paper-2 p-3">
                <div className="text-xs uppercase tracking-wider text-muted">Стоимость владения / год</div>
                <div className="num text-xl font-bold">{money(own)}</div>
                <div className="text-sm text-muted">
                  {numberRu(kmCost, 2)} ₽/км при плановом пробеге
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <GhostButton onClick={() => setEditing(v)}>Изменить</GhostButton>
                <button className="text-sm font-semibold text-danger" onClick={() => removeVehicle(v.id)}>
                  Удалить
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <Modal open={Boolean(editing)} title="Карточка ТС" onClose={() => setEditing(null)}>
        {editing ? (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing.name || !editing.plate) return;
              upsertVehicle(editing);
              setEditing(null);
            }}
          >
            <Field label="Модель">
              <input className={inputClass} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Госномер">
              <input className={inputClass} value={editing.plate} onChange={(e) => setEditing({ ...editing, plate: e.target.value })} />
            </Field>
            <Field label="Тип">
              <select
                className={inputClass}
                value={editing.type}
                onChange={(e) => setEditing({ ...editing, type: e.target.value as VehicleType })}
              >
                {Object.entries(VEHICLE_TYPE_LABEL).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Статус">
              <select
                className={inputClass}
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as VehicleStatus })}
              >
                {Object.entries(VEHICLE_STATUS_LABEL).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Год выпуска">
              <input
                type="number"
                className={inputClass}
                value={editing.year}
                onChange={(e) => setEditing({ ...editing, year: Number(e.target.value) })}
              />
            </Field>
            <Field label="Расход, л/100 км">
              <input
                type="number"
                step="0.1"
                className={inputClass}
                value={editing.consumption}
                onChange={(e) => setEditing({ ...editing, consumption: Number(e.target.value) })}
              />
            </Field>
            <Field label="Плановый пробег, км/год">
              <input
                type="number"
                className={inputClass}
                value={editing.plannedKm}
                onChange={(e) => setEditing({ ...editing, plannedKm: Number(e.target.value) })}
              />
            </Field>
            <Field label="Лизинг, ₽/мес">
              <input
                type="number"
                className={inputClass}
                value={editing.leaseMonthly}
                onChange={(e) => setEditing({ ...editing, leaseMonthly: Number(e.target.value) })}
              />
            </Field>
            <Field label="Страховка, ₽/год">
              <input
                type="number"
                className={inputClass}
                value={editing.insuranceAnnual}
                onChange={(e) => setEditing({ ...editing, insuranceAnnual: Number(e.target.value) })}
              />
            </Field>
            <div className="flex justify-end gap-2 sm:col-span-2">
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
