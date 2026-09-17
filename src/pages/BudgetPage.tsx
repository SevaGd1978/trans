import { useMemo, useState } from "react";
import { GhostButton, PrimaryButton } from "../components/ui";
import { budgetTotal } from "../lib/calc";
import { money, numberRu } from "../lib/format";
import { useApp } from "../store";
import { MONTHS } from "../types";

export function BudgetPage() {
  const year = useApp((s) => s.year);
  const categories = useApp((s) => s.categories);
  const budget = useApp((s) => s.budget);
  const budgetStatus = useApp((s) => s.budgetStatus);
  const setBudgetStatus = useApp((s) => s.setBudgetStatus);
  const setBudgetCell = useApp((s) => s.setBudgetCell);
  const fillFuelFromFleet = useApp((s) => s.fillFuelFromFleet);
  const copyBudgetEven = useApp((s) => s.copyBudgetEven);
  const [kind, setKind] = useState<"income" | "expense">("expense");

  const lines = useMemo(
    () => budget.filter((l) => l.year === year),
    [budget, year],
  );

  const visible = categories.filter((c) => c.kind === kind);
  const groups = [...new Set(visible.map((c) => c.group))];

  const monthTotals = Array.from({ length: 12 }, (_, m) =>
    visible.reduce((acc, c) => {
      const line = lines.find((l) => l.categoryId === c.id);
      return acc + (line?.months[m] ?? 0);
    }, 0),
  );
  const grand = monthTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex flex-wrap gap-2">
          {kind === "expense" ? (
            <GhostButton onClick={fillFuelFromFleet}>Заполнить ГСМ из автопарка</GhostButton>
          ) : null}
          <GhostButton
            onClick={() =>
              setBudgetStatus(budgetStatus === "approved" ? "draft" : "approved")
            }
          >
            {budgetStatus === "approved" ? "Вернуть в черновик" : "Утвердить бюджет"}
          </GhostButton>
        </div>
      </div>

      <p className="text-sm text-muted">
        Ячейки редактируются. Кнопка «ровно» раскладывает годовую сумму по месяцам. Для дизеля план
        считается как пробег × расход × цена литра.
      </p>

      <div className="overflow-auto rounded-3xl border border-line bg-white">
        <table className="min-w-[1100px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-paper-2 text-left text-xs uppercase tracking-wider text-muted">
              <th className="sticky left-0 z-10 bg-paper-2 px-4 py-3">Статья</th>
              {MONTHS.map((m) => (
                <th key={m} className="px-2 py-3 text-right">
                  {m}
                </th>
              ))}
              <th className="px-3 py-3 text-right">Год</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRows
                key={group}
                group={group}
                categories={visible.filter((c) => c.group === group)}
                lines={lines}
                onChange={setBudgetCell}
                onSpread={copyBudgetEven}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-ink text-paper">
              <td className="sticky left-0 bg-ink px-4 py-3 font-bold">Итого</td>
              {monthTotals.map((v, i) => (
                <td key={i} className="num px-2 py-3 text-right">
                  {numberRu(v / 1000)}
                </td>
              ))}
              <td className="num px-3 py-3 text-right font-bold">{money(grand)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted">В месячных ячейках суммы показаны в тыс. ₽, итог года — в рублях.</p>
    </div>
  );
}

function GroupRows({
  group,
  categories,
  lines,
  onChange,
  onSpread,
}: {
  group: string;
  categories: { id: string; name: string }[];
  lines: { categoryId: string; months: number[] }[];
  onChange: (categoryId: string, month: number, amount: number) => void;
  onSpread: (categoryId: string, annual: number) => void;
}) {
  return (
    <>
      <tr className="bg-paper-2/70">
        <td colSpan={15} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted">
          {group}
        </td>
      </tr>
      {categories.map((c) => {
        const line = lines.find((l) => l.categoryId === c.id);
        const months = line?.months ?? Array(12).fill(0);
        const yearSum = budgetTotal({
          id: "",
          categoryId: c.id,
          year: 0,
          months,
        });
        return (
          <tr key={c.id} className="border-t border-line/70 hover:bg-paper/60">
            <td className="sticky left-0 bg-white px-4 py-2 font-medium">{c.name}</td>
            {months.map((value, month) => (
              <td key={month} className="px-1 py-1">
                <input
                  className="num w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-right text-xs outline-none hover:border-line focus:border-accent focus:bg-white"
                  value={value ? Math.round(value / 1000) : ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\s/g, "");
                    const thousands = Number(raw);
                    onChange(c.id, month, Number.isFinite(thousands) ? thousands * 1000 : 0);
                  }}
                />
              </td>
            ))}
            <td className="num px-3 py-2 text-right font-semibold">{money(yearSum)}</td>
            <td className="px-2">
              <PrimaryButton
                className="!px-2 !py-1 text-xs"
                onClick={() => {
                  const annual = Number(prompt("Годовая сумма, ₽", String(yearSum)));
                  if (Number.isFinite(annual)) onSpread(c.id, annual);
                }}
              >
                ровно
              </PrimaryButton>
            </td>
          </tr>
        );
      })}
    </>
  );
}
