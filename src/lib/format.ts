export function money(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function moneyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млрд ₽`;
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽`;
  }
  if (abs >= 10_000) {
    return `${Math.round(value / 1000).toLocaleString("ru-RU")} тыс. ₽`;
  }
  return money(value);
}

export function numberRu(value: number, digits = 0): string {
  return value.toLocaleString("ru-RU", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function percent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
}

export function signedMoney(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${money(value)}`;
}

export const VEHICLE_TYPE_LABEL: Record<string, string> = {
  tractor: "Тягач",
  truck: "Грузовик",
  van: "Фургон",
  bus: "Автобус",
};

export const VEHICLE_STATUS_LABEL: Record<string, string> = {
  active: "В линии",
  repair: "Ремонт",
  idle: "Простой",
};

export function uid(prefix = "id"): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
