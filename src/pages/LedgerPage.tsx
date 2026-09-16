import { useMemo, useState } from "react";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "../components/ui";
import { yearTransactions } from "../lib/calc";
import { money, uid } from "../lib/format";
import { useApp } from "../store";
import type { Transaction, TxType } from "../types";

const emptyTx = (year: number): Transaction => ({
  id: uid("tx"),
  type: "expense",
  date: `${year}-09-16`,
  amount: 0,
  categoryId: "exp-fuel",
  counterparty: "",
  comment: "",
});

export function LedgerPage() {
  const year = useApp((s) => s.year);
  const categories = useApp((s) => s.categories);
  const vehicles = useApp((s) => s.vehicles);
  const transactions = useApp((s) => s.transactions);
  const upsertTransaction = useApp((s) => s.upsertTransaction);
  const removeTransaction = useApp((s) => s.removeTransaction);

  const [filter, setFilter] = useState<"all" | TxType>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [vehicleId, setVehicleId] = useState("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);

  const rows = useMemo(() => {
    return yearTransactions(transactions, year)
      .filter((tx) => (filter === "all" ? true : tx.type === filter))
      .filter((tx) => (categoryId === "all" ? true : tx.categoryId === categoryId))
      .filter((tx) => (vehicleId === "all" ? true : tx.vehicleId === vehicleId))
      .filter((tx) => {
        const hay = `${tx.counterparty} ${tx.comment}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, year, filter, categoryId, vehicleId, q]);

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const plate = (id?: string) => vehicles.find((v) => v.id === id)?.plate ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-3xl border border-line bg-white p-4">
        <label className="text-sm">
          <div className="mb-1 text-muted">Тип</div>
          <select className={inputClass} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">Все</option>
            <option value="income">Доходы</option>
            <option value="expense">Расходы</option>
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 text-muted">Статья</div>
          <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="all">Все статьи</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 text-muted">Машина</div>
          <select className={inputClass} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="all">Весь парк</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-48 flex-1 text-sm">
          <div className="mb-1 text-muted">Поиск</div>
          <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="контрагент, комментарий" />
        </label>
        <PrimaryButton onClick={() => setEditing(emptyTx(year))}>Новая операция</PrimaryButton>
      </div>

      <div className="overflow-auto rounded-3xl border border-line bg-white">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-paper-2 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3">Статья</th>
              <th className="px-4 py-3">Контрагент</th>
              <th className="px-4 py-3">ТС</th>
              <th className="px-4 py-3 text-right">Сумма</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.id} className="border-t border-line/70">
                <td className="num px-4 py-2">{tx.date}</td>
                <td className="px-4 py-2">
                  <div className="font-medium">{catName(tx.categoryId)}</div>
                  <div className="text-xs text-muted">{tx.comment}</div>
                </td>
                <td className="px-4 py-2">{tx.counterparty}</td>
                <td className="px-4 py-2 text-muted">{plate(tx.vehicleId)}</td>
                <td className={`num px-4 py-2 text-right font-semibold ${tx.type === "income" ? "text-teal" : "text-accent"}`}>
                  {tx.type === "income" ? "+" : "−"}
                  {money(tx.amount)}
                </td>
                <td className="px-4 py-2 text-right">
                  <button className="mr-2 text-xs font-semibold text-muted hover:text-ink" onClick={() => setEditing(tx)}>
                    изменить
                  </button>
                  <button className="text-xs font-semibold text-danger" onClick={() => removeTransaction(tx.id)}>
                    удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-6 text-sm text-muted">Нет операций по фильтру.</p> : null}
      </div>

      <Modal
        open={Boolean(editing)}
        title={editing && transactions.some((t) => t.id === editing.id) ? "Операция" : "Новая операция"}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing.amount || !editing.counterparty) return;
              upsertTransaction(editing);
              setEditing(null);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Тип">
                <select
                  className={inputClass}
                  value={editing.type}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      type: e.target.value as TxType,
                      categoryId: categories.find((c) => c.kind === e.target.value)?.id ?? editing.categoryId,
                    })
                  }
                >
                  <option value="income">Доход</option>
                  <option value="expense">Расход</option>
                </select>
              </Field>
              <Field label="Дата">
                <input
                  type="date"
                  className={inputClass}
                  value={editing.date}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Статья">
              <select
                className={inputClass}
                value={editing.categoryId}
                onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
              >
                {categories
                  .filter((c) => c.kind === editing.type)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Сумма, ₽">
              <input
                className={inputClass}
                type="number"
                min={0}
                value={editing.amount || ""}
                onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Контрагент">
              <input
                className={inputClass}
                value={editing.counterparty}
                onChange={(e) => setEditing({ ...editing, counterparty: e.target.value })}
              />
            </Field>
            <Field label="Машина">
              <select
                className={inputClass}
                value={editing.vehicleId ?? ""}
                onChange={(e) => setEditing({ ...editing, vehicleId: e.target.value || undefined })}
              >
                <option value="">Не указана</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} · {v.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Комментарий">
              <input
                className={inputClass}
                value={editing.comment}
                onChange={(e) => setEditing({ ...editing, comment: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
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
