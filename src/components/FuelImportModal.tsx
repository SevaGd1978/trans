import { FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { GhostButton, Modal, PrimaryButton } from "./ui";
import { money, numberRu } from "../lib/format";
import {
  downloadFuelTemplate,
  draftsToTransactions,
  fillingKey,
  parseFuelWorkbook,
  type FuelFillingDraft,
} from "../lib/fuelImport";
import { useApp } from "../store";

export function FuelImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const vehicles = useApp((s) => s.vehicles);
  const fuelPrice = useApp((s) => s.fuelPrice);
  const transactions = useApp((s) => s.transactions);
  const importTransactions = useApp((s) => s.importTransactions);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<FuelFillingDraft[]>([]);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const existingKeys = (() => {
    const keys = new Set<string>();
    for (const tx of transactions) {
      if (tx.importKey) keys.add(tx.importKey);
      if (tx.categoryId !== "exp-fuel") continue;
      const plate = vehicles.find((v) => v.id === tx.vehicleId)?.plate ?? "";
      keys.add(
        fillingKey({
          date: tx.date,
          plate,
          liters: tx.liters,
          amount: tx.amount,
          odometer: tx.odometer,
        }),
      );
    }
    return keys;
  })();

  const reset = () => {
    setFileName("");
    setError("");
    setDrafts([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const ready = drafts.filter((d) => d.errors.length === 0 && !d.duplicate);
  const blocked = drafts.length - ready.length;
  const litersTotal = ready.reduce((a, d) => a + (d.liters ?? 0), 0);
  const amountTotal = ready.reduce((a, d) => a + (d.amount ?? 0), 0);

  async function onFile(file: File) {
    setResult(null);
    setError("");
    setBusy(true);
    try {
      const data = await file.arrayBuffer();
      const parsed = parseFuelWorkbook(data, vehicles, fuelPrice, existingKeys);
      if (!parsed.columns.date || (!parsed.columns.liters && !parsed.columns.amount)) {
        setDrafts([]);
        setError(
          "Не найдены колонки «Дата» и «Литры»/«Сумма». Скачайте шаблон или проверьте заголовки первой строки.",
        );
        setFileName(file.name);
        return;
      }
      setFileName(file.name);
      setDrafts(parsed.drafts);
      if (parsed.drafts.length === 0) {
        setError("В файле нет строк с заправками.");
      }
    } catch {
      setDrafts([]);
      setError("Не удалось прочитать файл. Нужен Excel (.xlsx) или CSV с заголовками.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Импорт заправок из Excel"
      onClose={() => {
        reset();
        onClose();
      }}
      wide
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Подходит отчёт топливных карт или собственная таблица: дата, госномер, показания одометра,
          литры, цена, сумма, АЗС. Если суммы нет — она считается как литры × цена (или цена дизеля в
          настройках). По двум показаниям пробега считается расход л/100 км.
        </p>

        <div className="flex flex-wrap gap-2">
          <GhostButton type="button" onClick={downloadFuelTemplate}>
            Скачать шаблон
          </GhostButton>
          <GhostButton type="button" onClick={() => fileRef.current?.click()}>
            Выбрать файл
          </GhostButton>
        </div>

        <label
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) void onFile(file);
          }}
        >
          <Upload className="mb-2 text-accent" size={28} />
          <div className="font-semibold">Перетащите .xlsx сюда</div>
          <div className="mt-1 text-sm text-muted">
            {fileName || "Или нажмите, чтобы открыть файл"}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
        </label>

        {busy ? <p className="text-sm text-muted">Читаем файл…</p> : null}
        {error ? <p className="rounded-xl bg-danger-2 px-3 py-2 text-sm text-danger">{error}</p> : null}

        {drafts.length > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-teal-2/70 p-3">
                <div className="text-xs uppercase tracking-wider text-muted">К загрузке</div>
                <div className="num text-xl font-bold">{ready.length}</div>
              </div>
              <div className="rounded-2xl bg-paper-2 p-3">
                <div className="text-xs uppercase tracking-wider text-muted">Литры</div>
                <div className="num text-xl font-bold">{numberRu(litersTotal, 1)}</div>
              </div>
              <div className="rounded-2xl bg-[#f7e6d8] p-3">
                <div className="text-xs uppercase tracking-wider text-muted">Сумма ГСМ</div>
                <div className="num text-xl font-bold">{money(amountTotal)}</div>
              </div>
            </div>
            {blocked > 0 ? (
              <p className="text-sm text-muted">
                {blocked} строк пропущены: ошибки, пустые поля или уже загруженные заправки.
              </p>
            ) : null}

            <div className="max-h-80 overflow-auto rounded-2xl border border-line bg-white">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="sticky top-0 bg-paper-2 text-left text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-3 py-2">Статус</th>
                    <th className="px-3 py-2">Дата</th>
                    <th className="px-3 py-2">ТС</th>
                    <th className="px-3 py-2 text-right">Пробег</th>
                    <th className="px-3 py-2 text-right">Литры</th>
                    <th className="px-3 py-2 text-right">Сумма</th>
                    <th className="px-3 py-2">Расход</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => {
                    const bad = d.errors.length > 0;
                    const skip = d.duplicate;
                    return (
                      <tr key={`${d.row}-${d.importKey}`} className="border-t border-line/70 align-top">
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                              bad
                                ? "bg-danger-2 text-danger"
                                : skip
                                  ? "bg-paper-2 text-muted"
                                  : "bg-teal-2 text-teal"
                            }`}
                          >
                            {bad ? "ошибка" : skip ? "уже есть" : "ок"}
                          </span>
                          <div className="mt-1 text-xs text-muted">
                            {[...d.errors, ...d.warnings].join(". ")}
                          </div>
                        </td>
                        <td className="num px-3 py-2">{d.date ?? "—"}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{d.vehiclePlate ?? (d.plateRaw || "—")}</div>
                          <div className="text-xs text-muted">{d.station}</div>
                        </td>
                        <td className="num px-3 py-2 text-right">
                          {d.odometer != null ? numberRu(d.odometer) : "—"}
                        </td>
                        <td className="num px-3 py-2 text-right">
                          {d.liters != null ? numberRu(d.liters, 1) : "—"}
                        </td>
                        <td className="num px-3 py-2 text-right">
                          {d.amount != null ? money(d.amount) : "—"}
                        </td>
                        <td className="num px-3 py-2">
                          {d.consumption != null ? `${numberRu(d.consumption, 1)} л/100` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {result ? (
          <p className="rounded-xl bg-teal-2 px-3 py-2 text-sm text-teal">
            Загружено {result.added} заправок
            {result.skipped ? `, пропущено ${result.skipped}` : ""}.
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <GhostButton
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Закрыть
          </GhostButton>
          <PrimaryButton
            type="button"
            disabled={ready.length === 0}
            onClick={() => {
              const txs = draftsToTransactions(drafts);
              const next = importTransactions(txs);
              setResult(next);
              setDrafts((prev) =>
                prev.map((d) =>
                  d.errors.length === 0 ? { ...d, duplicate: true } : d,
                ),
              );
            }}
          >
            <span className="inline-flex items-center gap-2">
              <FileSpreadsheet size={16} />
              Загрузить {ready.length ? ready.length : ""} в журнал
            </span>
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
