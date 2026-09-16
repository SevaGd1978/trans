import { useState } from "react";
import { Field, GhostButton, PrimaryButton, inputClass } from "../components/ui";
import { useApp } from "../store";

export function SettingsPage() {
  const companyName = useApp((s) => s.companyName);
  const inn = useApp((s) => s.inn);
  const fuelPrice = useApp((s) => s.fuelPrice);
  const setCompany = useApp((s) => s.setCompany);
  const setFuelPrice = useApp((s) => s.setFuelPrice);
  const resetDemo = useApp((s) => s.resetDemo);
  const [name, setName] = useState(companyName);
  const [innValue, setInnValue] = useState(inn);
  const [fuel, setFuel] = useState(String(fuelPrice));
  const [saved, setSaved] = useState(false);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="rounded-3xl border border-line bg-white p-6">
        <h2 className="text-lg font-bold">Реквизиты</h2>
        <p className="mb-4 text-sm text-muted">
          Данные хранятся в браузере. Демо-компания «СеверТранс» уже заполнена, её можно заменить на
          свою.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setCompany(name, innValue);
            setFuelPrice(Number(fuel) || 0);
            setSaved(true);
            setTimeout(() => setSaved(false), 1800);
          }}
        >
          <Field label="Название компании">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="ИНН">
            <input className={inputClass} value={innValue} onChange={(e) => setInnValue(e.target.value)} />
          </Field>
          <Field label="Цена дизеля, ₽/л">
            <input
              className={inputClass}
              value={fuel}
              onChange={(e) => setFuel(e.target.value)}
              inputMode="decimal"
            />
          </Field>
          <div className="flex items-center gap-3">
            <PrimaryButton type="submit">Сохранить</PrimaryButton>
            {saved ? <span className="text-sm text-teal">Сохранено</span> : null}
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-danger/20 bg-white p-6">
        <h2 className="text-lg font-bold">Демо-данные</h2>
        <p className="mb-4 text-sm text-muted">
          Сброс возвращает автопарк, маршруты, бюджет 2026 и журнал операций «СеверТранс» к исходному
          состоянию.
        </p>
        <GhostButton
          onClick={() => {
            if (confirm("Сбросить все данные к демонстрационным?")) {
              resetDemo();
              const seedName = "ООО «СеверТранс»";
              setName(seedName);
              setInnValue("7701234567");
              setFuel("75.4");
            }
          }}
        >
          Сбросить к демо
        </GhostButton>
      </div>
    </div>
  );
}
