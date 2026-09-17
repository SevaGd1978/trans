import { useState } from "react";
import { PasswordModal } from "../components/PasswordModal";
import { Field, GhostButton, PrimaryButton, inputClass } from "../components/ui";
import { DEFAULT_ACCESS_PASSWORD } from "../data/seed";
import { useApp } from "../store";

export function SettingsPage() {
  const companyName = useApp((s) => s.companyName);
  const inn = useApp((s) => s.inn);
  const fuelPrice = useApp((s) => s.fuelPrice);
  const accessPassword = useApp((s) => s.accessPassword);
  const setCompany = useApp((s) => s.setCompany);
  const setFuelPrice = useApp((s) => s.setFuelPrice);
  const changeAccessPassword = useApp((s) => s.changeAccessPassword);
  const resetDemo = useApp((s) => s.resetDemo);
  const clearAll = useApp((s) => s.clearAll);
  const [name, setName] = useState(companyName);
  const [innValue, setInnValue] = useState(inn);
  const [fuel, setFuel] = useState(String(fuelPrice || ""));
  const [saved, setSaved] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [nextPwd, setNextPwd] = useState("");
  const [nextPwd2, setNextPwd2] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [lock, setLock] = useState<"clear" | "seed" | null>(null);

  function syncCompanyFields(nextName: string, nextInn: string, nextFuel: number) {
    setName(nextName);
    setInnValue(nextInn);
    setFuel(nextFuel ? String(nextFuel) : "");
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="rounded-3xl border border-line bg-white p-6">
        <h2 className="text-lg font-bold">Реквизиты</h2>
        <p className="mb-4 text-sm text-muted">
          Данные хранятся в браузере. Загрузите сводный отчёт 1С в журнале или на маршрутах. Учебную
          компанию «СеверТранс» можно заменить на свою.
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

      <div className="rounded-3xl border border-line bg-white p-6">
        <h2 className="text-lg font-bold">Пароль защиты</h2>
        <p className="mb-4 text-sm text-muted">
          Им закрыты очистка базы и загрузка учебных записей. По умолчанию пароль{" "}
          <span className="font-semibold text-ink">{DEFAULT_ACCESS_PASSWORD}</span>.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setPwdMsg("");
            setPwdError("");
            if (currentPwd.trim() !== accessPassword) {
              setPwdError("Текущий пароль неверный");
              return;
            }
            if (nextPwd.trim().length < 4) {
              setPwdError("Новый пароль — не короче 4 символов");
              return;
            }
            if (nextPwd.trim() !== nextPwd2.trim()) {
              setPwdError("Новый пароль и подтверждение не совпадают");
              return;
            }
            changeAccessPassword(nextPwd);
            setCurrentPwd("");
            setNextPwd("");
            setNextPwd2("");
            setPwdMsg("Пароль обновлён");
            setTimeout(() => setPwdMsg(""), 1800);
          }}
        >
          <Field label="Текущий пароль">
            <input
              className={inputClass}
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
            />
          </Field>
          <Field label="Новый пароль">
            <input
              className={inputClass}
              type="password"
              value={nextPwd}
              onChange={(e) => setNextPwd(e.target.value)}
            />
          </Field>
          <Field label="Повторите новый пароль">
            <input
              className={inputClass}
              type="password"
              value={nextPwd2}
              onChange={(e) => setNextPwd2(e.target.value)}
            />
          </Field>
          {pwdError ? <p className="text-sm text-danger">{pwdError}</p> : null}
          <div className="flex items-center gap-3">
            <GhostButton type="submit">Сменить пароль</GhostButton>
            {pwdMsg ? <span className="text-sm text-teal">{pwdMsg}</span> : null}
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-line bg-white p-6">
        <h2 className="text-lg font-bold">Учебные записи</h2>
        <p className="mb-4 text-sm text-muted">
          Создаёт демонстрационный автопарк, маршруты, бюджет 2026 и журнал операций ООО
          «СеверТранс». Текущие данные будут заменены.
        </p>
        <PrimaryButton type="button" onClick={() => setLock("seed")}>
          Создать учебные записи
        </PrimaryButton>
      </div>

      <div className="rounded-3xl border border-danger/20 bg-white p-6">
        <h2 className="text-lg font-bold">Очистка данных</h2>
        <p className="mb-4 text-sm text-muted">
          Удаляет автопарк, маршруты, бюджет и журнал. Статьи расходов остаются пустыми. Пароль
          защиты не сбрасывается.
        </p>
        <button
          type="button"
          className="rounded-xl border border-danger/40 bg-white px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger-2"
          onClick={() => setLock("clear")}
        >
          Очистить все данные
        </button>
      </div>

      <PasswordModal
        open={lock === "seed"}
        title="Учебные записи"
        description="Введите пароль, чтобы заменить текущую базу учебным примером «СеверТранс»."
        confirmLabel="Создать записи"
        onClose={() => setLock(null)}
        onConfirm={() => {
          resetDemo();
          syncCompanyFields("ООО «СеверТранс»", "7701234567", 75.4);
          setLock(null);
        }}
      />
      <PasswordModal
        open={lock === "clear"}
        title="Очистить все данные"
        description="Действие необратимо: парк, маршруты, операции и цифры бюджета будут удалены."
        confirmLabel="Удалить всё"
        onClose={() => setLock(null)}
        onConfirm={() => {
          clearAll();
          syncCompanyFields("", "", 0);
          setLock(null);
        }}
      />
    </div>
  );
}
