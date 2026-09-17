import { FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { money } from "../lib/format";
import {
  collectTripImportKeys,
  downloadTripTemplate,
  draftsToTripImport,
  parseTripTemplateExample,
  parseTripWorkbook,
  tripKey,
  type TripDraft,
} from "../lib/tripImport";
import { useApp } from "../store";
import { GhostButton, Modal, PrimaryButton } from "./ui";

export function TripImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const vehicles = useApp((s) => s.vehicles);
  const routes = useApp((s) => s.routes);
  const transactions = useApp((s) => s.transactions);
  const importTrips = useApp((s) => s.importTrips);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<TripDraft[]>([]);
  const [result, setResult] = useState<{
    routesAdded: number;
    routesUpdated: number;
    tripsAdded: number;
    skipped: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const existingKeys = (() => {
    const keys = collectTripImportKeys(transactions);
    for (const tx of transactions) {
      if (tx.categoryId !== "inc-freight" || tx.importKey?.startsWith("order|")) continue;
      const route = routes.find((r) => r.id === tx.routeId);
      const plate = vehicles.find((v) => v.id === tx.vehicleId)?.plate ?? "";
      keys.add(
        tripKey({
          date: tx.date,
          from: route?.from ?? "",
          to: route?.to ?? "",
          plate,
          amount: tx.amount,
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
  const tripReady = ready.filter((d) => d.date);
  const routeOnly = ready.filter((d) => !d.date);
  const blocked = drafts.length - ready.length;
  const amountTotal = tripReady.reduce((a, d) => a + (d.amount ?? 0), 0);
  const carrierTotal = tripReady.reduce((a, d) => a + (d.carrierAmount ?? 0), 0);
  const dispatchTotal = tripReady.reduce((a, d) => a + (d.dispatchAmount ?? 0), 0);
  const profitTotal = amountTotal - carrierTotal - dispatchTotal;
  const opsCount = tripReady.reduce((a, d) => {
    return a + (d.amount ? 1 : 0) + (d.carrierAmount ? 1 : 0) + (d.dispatchAmount ? 1 : 0);
  }, 0);

  async function onFile(file: File) {
    setResult(null);
    setError("");
    setBusy(true);
    try {
      const data = await file.arrayBuffer();
      const parsed = parseTripWorkbook(data, vehicles, routes, existingKeys);
      const cols = parsed.columns;
      if (!cols.amount && !cols.carrierAmount && !cols.from && !cols.orderNo) {
        setDrafts([]);
        setError(
          "Не найден сводный отчёт 1С. Нужны колонки «№», «Загрузка», «Разгрузка», «Сумма», «Исполнителю», «Диспетчеру».",
        );
        setFileName(file.name);
        return;
      }
      setFileName(file.name);
      setDrafts(parsed.drafts);
      if (parsed.drafts.length === 0) {
        setError("В файле нет строк с заказами.");
      }
    } catch {
      setDrafts([]);
      setError("Не удалось прочитать файл. Нужен CSV (Windows-1251) или Excel со сводным отчётом по заказам.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Импорт сводного отчёта 1С"
      onClose={() => {
        reset();
        onClose();
      }}
      wide
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Файл «Сводный отчет по выбранным заказам»: номер, период, клиент, загрузка / разгрузка,
          исполнитель, водитель, сумма, исполнителю, диспетчеру. Госномер не нужен. Каждый заказ
          даёт выручку и расходы перевозчику и диспетчеру. Повторная загрузка того же № пропускается.
          Строка итогов не импортируется.
        </p>

        <div className="flex flex-wrap gap-2">
          <GhostButton type="button" onClick={downloadTripTemplate}>
            Скачать шаблон
          </GhostButton>
          <GhostButton
            type="button"
            onClick={() => {
              const parsed = parseTripTemplateExample(vehicles, routes, existingKeys);
              setFileName("пример-заказы-1с.xlsx");
              setError("");
              setResult(null);
              setDrafts(parsed.drafts);
            }}
          >
            Пример отчёта
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
          <div className="font-semibold">Перетащите .csv или .xlsx сюда</div>
          <div className="mt-1 text-sm text-muted">
            {fileName || "Или нажмите, чтобы открыть сводный отчёт"}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-teal-2/70 p-3">
                <div className="text-xs uppercase tracking-wider text-muted">Заказов</div>
                <div className="num text-xl font-bold">{tripReady.length}</div>
              </div>
              <div className="rounded-2xl bg-paper-2 p-3">
                <div className="text-xs uppercase tracking-wider text-muted">Сумма</div>
                <div className="num text-xl font-bold">{money(amountTotal)}</div>
              </div>
              <div className="rounded-2xl bg-[#f7e6d8] p-3">
                <div className="text-xs uppercase tracking-wider text-muted">Исполнителям</div>
                <div className="num text-xl font-bold">{money(carrierTotal)}</div>
              </div>
              <div className="rounded-2xl bg-paper-2 p-3">
                <div className="text-xs uppercase tracking-wider text-muted">Прибыль</div>
                <div className="num text-xl font-bold">{money(profitTotal)}</div>
                <div className="text-xs text-muted">Диспетчерам {money(dispatchTotal)}</div>
              </div>
            </div>
            {blocked > 0 ? (
              <p className="text-sm text-muted">
                {blocked} строк пропущены: ошибки или заказ с таким № уже загружен.
              </p>
            ) : null}
            {routeOnly.length > 0 ? (
              <p className="text-sm text-muted">{routeOnly.length} строк только в справочник маршрутов.</p>
            ) : null}

            <div className="max-h-80 overflow-auto rounded-2xl border border-line bg-white">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="sticky top-0 bg-paper-2 text-left text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-3 py-2">Статус</th>
                    <th className="px-3 py-2">№</th>
                    <th className="px-3 py-2">Период</th>
                    <th className="px-3 py-2">Маршрут</th>
                    <th className="px-3 py-2">Клиент / исполнитель</th>
                    <th className="px-3 py-2 text-right">Сумма</th>
                    <th className="px-3 py-2 text-right">Исполнителю</th>
                    <th className="px-3 py-2 text-right">Диспетчеру</th>
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
                            {bad ? "ошибка" : skip ? "уже есть" : d.date ? "заказ" : "маршрут"}
                          </span>
                          <div className="mt-1 text-xs text-muted">
                            {[...d.errors, ...d.warnings].join(". ")}
                          </div>
                        </td>
                        <td className="num px-3 py-2">{d.orderNo || "—"}</td>
                        <td className="num px-3 py-2">{d.date ?? "—"}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{d.routeName || `${d.from} — ${d.to}`}</div>
                          <div className="text-xs text-muted">
                            {d.from} → {d.to}
                            {d.driver ? ` · ${d.driver}` : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div>{d.customer || "—"}</div>
                          <div className="text-xs text-muted">{d.carrier || d.cargo || "—"}</div>
                        </td>
                        <td className="num px-3 py-2 text-right">
                          {d.amount != null ? money(d.amount) : "—"}
                        </td>
                        <td className="num px-3 py-2 text-right">
                          {d.carrierAmount != null ? money(d.carrierAmount) : "—"}
                        </td>
                        <td className="num px-3 py-2 text-right">
                          {d.dispatchAmount != null ? money(d.dispatchAmount) : "—"}
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
            В журнал: {result.tripsAdded} операций. Маршрутов новых: {result.routesAdded}, обновлено:{" "}
            {result.routesUpdated}
            {result.skipped ? `. Пропущено ${result.skipped}` : ""}.
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
              const payload = draftsToTripImport(drafts, routes);
              const next = importTrips(payload);
              setResult(next);
              setDrafts((prev) =>
                prev.map((d) => (d.errors.length === 0 && d.date ? { ...d, duplicate: true } : d)),
              );
            }}
          >
            <span className="inline-flex items-center gap-2">
              <FileSpreadsheet size={16} />
              Загрузить {tripReady.length ? `${tripReady.length} заказов / ${opsCount} оп.` : "заказы"}
            </span>
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
