import { FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { money, numberRu } from "../lib/format";
import {
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
    const keys = new Set<string>();
    for (const tx of transactions) {
      if (tx.importKey) keys.add(tx.importKey);
      if (tx.categoryId !== "inc-freight") continue;
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
  const tripReady = ready.filter((d) => d.date && d.amount != null);
  const routeOnly = ready.filter((d) => !d.date);
  const blocked = drafts.length - ready.length;
  const amountTotal = tripReady.reduce((a, d) => a + (d.amount ?? 0), 0);

  async function onFile(file: File) {
    setResult(null);
    setError("");
    setBusy(true);
    try {
      const data = await file.arrayBuffer();
      const parsed = parseTripWorkbook(data, vehicles, routes, existingKeys);
      if (!parsed.columns.amount && !parsed.columns.route && !parsed.columns.from) {
        setDrafts([]);
        setError(
          "Не найдены колонки маршрута и стоимости. Нужны «Откуда»/«Куда» или «Маршрут» и «Стоимость». Скачайте шаблон.",
        );
        setFileName(file.name);
        return;
      }
      setFileName(file.name);
      setDrafts(parsed.drafts);
      if (parsed.drafts.length === 0) {
        setError("В файле нет строк с перевозками.");
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
      title="Импорт перевозок из Excel"
      onClose={() => {
        reset();
        onClose();
      }}
      wide
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Таблица рейсов: дата, маршрут (или откуда/куда), госномер, километраж, стоимость, заказчик.
          Строка с датой попадает в журнал как выручка «Грузоперевозки». Без даты — только справочник
          маршрутов.
        </p>

        <div className="flex flex-wrap gap-2">
          <GhostButton type="button" onClick={downloadTripTemplate}>
            Скачать шаблон
          </GhostButton>
          <GhostButton
            type="button"
            onClick={() => {
              const parsed = parseTripTemplateExample(vehicles, routes, existingKeys);
              setFileName("пример-перевозки.xlsx");
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
                <div className="text-xs uppercase tracking-wider text-muted">Рейсов в журнал</div>
                <div className="num text-xl font-bold">{tripReady.length}</div>
              </div>
              <div className="rounded-2xl bg-paper-2 p-3">
                <div className="text-xs uppercase tracking-wider text-muted">Стоимость</div>
                <div className="num text-xl font-bold">{money(amountTotal)}</div>
              </div>
              <div className="rounded-2xl bg-[#f7e6d8] p-3">
                <div className="text-xs uppercase tracking-wider text-muted">Только маршруты</div>
                <div className="num text-xl font-bold">{routeOnly.length}</div>
              </div>
            </div>
            {blocked > 0 ? (
              <p className="text-sm text-muted">
                {blocked} строк пропущены: ошибки, нет пунктов маршрута или рейс уже загружен.
              </p>
            ) : null}

            <div className="max-h-80 overflow-auto rounded-2xl border border-line bg-white">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="sticky top-0 bg-paper-2 text-left text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-3 py-2">Статус</th>
                    <th className="px-3 py-2">Дата</th>
                    <th className="px-3 py-2">Маршрут</th>
                    <th className="px-3 py-2">ТС</th>
                    <th className="px-3 py-2 text-right">Км</th>
                    <th className="px-3 py-2 text-right">Стоимость</th>
                    <th className="px-3 py-2">Заказчик</th>
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
                            {bad ? "ошибка" : skip ? "уже есть" : d.date ? "рейс" : "маршрут"}
                          </span>
                          <div className="mt-1 text-xs text-muted">
                            {[...d.errors, ...d.warnings].join(". ")}
                          </div>
                        </td>
                        <td className="num px-3 py-2">{d.date ?? "—"}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{d.routeName || `${d.from} — ${d.to}`}</div>
                          <div className="text-xs text-muted">
                            {d.from} → {d.to}
                          </div>
                        </td>
                        <td className="px-3 py-2">{d.vehiclePlate ?? (d.plateRaw || "—")}</td>
                        <td className="num px-3 py-2 text-right">
                          {d.distanceKm != null ? numberRu(d.distanceKm) : "—"}
                        </td>
                        <td className="num px-3 py-2 text-right">
                          {d.amount != null ? money(d.amount) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div>{d.customer || "—"}</div>
                          {d.cargo ? <div className="text-xs text-muted">{d.cargo}</div> : null}
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
            В журнал: {result.tripsAdded} рейсов. Маршрутов новых: {result.routesAdded}, обновлено:{" "}
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
              Загрузить {ready.length ? ready.length : ""} строк
            </span>
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
