import {
  Calculator,
  Fuel,
  GitCompare,
  LayoutDashboard,
  Route as RouteIcon,
  Settings,
  Truck,
  Wallet,
  Waypoints,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { MONTHS_FULL } from "../types";
import { useApp } from "../store";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Обзор", icon: LayoutDashboard },
  { to: "/budget", label: "Бюджет", icon: Calculator },
  { to: "/ledger", label: "Операции", icon: Wallet },
  { to: "/fuel", label: "Заправки", icon: Fuel },
  { to: "/fleet", label: "Автопарк", icon: Truck },
  { to: "/routes", label: "Маршруты", icon: Waypoints },
  { to: "/variance", label: "План-факт", icon: GitCompare },
  { to: "/scenarios", label: "Сценарии", icon: RouteIcon },
  { to: "/settings", label: "Настройки", icon: Settings },
];

const TITLES: Record<string, string> = {
  "/": "Сводка по автопарку",
  "/budget": "Годовой бюджет",
  "/ledger": "Журнал операций",
  "/fuel": "Заправки и показания",
  "/fleet": "Состав автопарка",
  "/routes": "Маршруты и рентабельность",
  "/variance": "Исполнение плана",
  "/scenarios": "Что если",
  "/settings": "Реквизиты и данные",
};

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const companyName = useApp((s) => s.companyName);
  const year = useApp((s) => s.year);
  const setYear = useApp((s) => s.setYear);
  const fuelPrice = useApp((s) => s.fuelPrice);
  const vehicles = useApp((s) => s.vehicles);
  const budgetStatus = useApp((s) => s.budgetStatus);
  const title = TITLES[location.pathname] ?? "Магистраль";

  return (
    <div className="min-h-screen bg-paper text-ink lg:grid lg:h-screen lg:grid-cols-[260px_1fr] lg:overflow-hidden">
      <aside className="border-b border-white/10 bg-sidebar text-paper lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white shadow-[0_8px_20px_rgb(196,92,38,0.35)]">
            <Truck size={22} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-accent-2">
              Транспорт
            </div>
            <div className="text-lg font-extrabold leading-none">Магистраль</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-6">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-paper/65 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="hidden px-5 pb-6 lg:block">
          <div className="rounded-2xl border border-white/10 bg-sidebar-2 p-4">
            <div className="text-[11px] uppercase tracking-widest text-paper/45">
              Компания
            </div>
            <div className="mt-1 font-semibold">{companyName}</div>
            <div className="mt-3 flex items-center gap-2 text-sm text-paper/70">
              <Fuel size={16} className="text-accent-2" />
              Дизель {fuelPrice.toLocaleString("ru-RU")} ₽/л
            </div>
            <div className="mt-1 text-sm text-paper/70">
              В линии {vehicles.filter((v) => v.status === "active").length} из{" "}
              {vehicles.length}
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:h-screen lg:overflow-y-auto">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 lg:px-8">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
                Маршрутный лист · {MONTHS_FULL[new Date().getMonth()]} {year}
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                  budgetStatus === "approved"
                    ? "bg-teal-2 text-teal"
                    : "bg-paper-2 text-warn"
                }`}
              >
                {budgetStatus === "approved" ? "Бюджет утверждён" : "Черновик"}
              </span>
              <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
                Год
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="bg-transparent font-semibold outline-none"
                >
                  {[2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "bad" | "accent";
}) {
  const tones = {
    default: "border-line bg-white",
    good: "border-teal/20 bg-teal-2/60",
    bad: "border-danger/20 bg-danger-2/70",
    accent: "border-accent/20 bg-[#f7e6d8]",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-[0_1px_0_rgb(28,25,21,0.04)] ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="num mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-sm text-muted">{hint}</div> : null}
    </div>
  );
}
