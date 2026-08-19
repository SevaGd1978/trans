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

**Amvera:** https://oporascet-sevagd1978.amvera.io — добавлен `amvera.yml` — создайте приложение на https://amvera.ru и сделайте `git push amvera HEAD:master` (см. [DEPLOY.md](./DEPLOY.md)).

**Сейчас онлайн (ShipStatic):** https://chrome-dust-n7h2f5a.shipstatic.com

```bash
npm run deploy:ship
```


## Структура

- `src/data/catalog.ts` — каталог опор, материалы, нормы
- `src/lib/calc.ts` — формулы себестоимости
- `src/lib/storage.ts` — локальное хранение
- `src/lib/export.ts` — выгрузка в Excel
- `src/views/` — экраны приложения
