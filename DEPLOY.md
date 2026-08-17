# Публикация ОпораСчёт

## Активный хостинг (Harvis)

**https://rapid-whistle-278.harvis.page**

Обновить сайт:

```bash
npm run build
npx harvis ./dist
```

Чтобы сайт не истёк через 24 часа, откройте claim-ссылку из вывода `harvis` и войдите в аккаунт.

## Cloudflare Tunnel (временный)

**https://suits-anticipated-color-vampire.trycloudflare.com**

Работает, пока запущен агент/туннель.

## Vercel / Netlify (постоянно)

- Vercel: https://vercel.com/new → import `SevaGd1978/trans` → `npm run build` / `dist`
- Netlify: https://app.netlify.com/start → то же

## GitHub Pages

Нужны права Admin: Settings → Pages → Source = GitHub Actions.  
Workflow: `.github/workflows/deploy-pages.yml`  
Адрес: `https://sevagd1978.github.io/trans/`
