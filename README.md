# ОпораСчёт

Web-приложение для просчёта себестоимости скользящих опор трубопроводов.

## Возможности (MVP)

- Каталог типоразмеров ОСТ 34 / ТУ 36
- Мастер расчёта: параметры → BOM → трудозатраты → итог
- Справочник материалов с редактированием цен
- Цеховые и накладные, покрытие, упаковка
- Сохранение расчётов в `localStorage`
- Экспорт калькуляции в Excel (`.xlsx`)

## Запуск

```bash
npm install
npm run dev
```

Сборка:

```bash
npm run build
npm run preview
```

## Публикация

### Временно (Cloudflare Quick Tunnel)

```bash
npm run build
npx serve -s dist -l 4173
npx cloudflared tunnel --url http://127.0.0.1:4173
```

### Постоянно (GitHub Pages)

1. В репозитории: **Settings → Pages → Source = GitHub Actions**
2. Workflow `.github/workflows/deploy-pages.yml` соберёт сайт
3. Адрес: `https://sevagd1978.github.io/trans/`

## Структура

- `src/data/catalog.ts` — каталог опор, материалы, нормы
- `src/lib/calc.ts` — формулы себестоимости
- `src/lib/storage.ts` — локальное хранение
- `src/lib/export.ts` — выгрузка в Excel
- `src/views/` — экраны приложения
