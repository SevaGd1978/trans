# Публикация ОпораСчёт

## Активный хостинг (ShipStatic) — другой ресурс

**https://chrome-dust-n7h2f5a.shipstatic.com**

Закрепить насовсем (claim):  
https://my.shipstatic.com/claim/b02b928b08426e12c646cdd9d8c42bf9  

Анонимный деплой живёт **3 дня**. Обновить:

```bash
npm run build
npx @shipstatic/ship ./dist
```

## Запасной (Nivii)

**https://gvto3mgl.nivii.app** · истекает ~26.08.2026

```bash
npx nivii share --dir ./dist --no-build --no-open --no-qr --expires 7d
```

## Harvis (предыдущий)

**https://rapid-whistle-278.harvis.page**

```bash
npm run deploy:harvis
```

## Vercel / Netlify (постоянно)

- Vercel: https://vercel.com/new → import `SevaGd1978/trans` → `npm run build` / `dist`
- Netlify: https://app.netlify.com/start → то же

## GitHub Pages

Нужны права Admin: Settings → Pages → Source = GitHub Actions.  
Адрес: `https://sevagd1978.github.io/trans/`
