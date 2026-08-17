# Как опубликовать ОпораСчёт без GitHub Pages

Страница `Settings → Pages` часто **не открывается**, если:
- вы не вошли в GitHub под владельцем репозитория (`SevaGd1978`);
- нет прав Admin на репозиторий;
- открываете ссылку в режиме инкогнито / с другого аккаунта.

## Вариант 1 — прямо сейчас (уже работает)

Временный публичный URL (Cloudflare Tunnel):

**https://suits-anticipated-color-vampire.trycloudflare.com**

## Вариант 2 — постоянный сайт через Vercel (без Pages)

1. Откройте: https://vercel.com/new  
2. Войдите через GitHub  
3. Import репозитория `SevaGd1978/trans`  
4. Framework Preset: Vite  
5. Build Command: `npm run build`  
6. Output Directory: `dist`  
7. Deploy  

Через 1–2 минуты получите постоянный адрес вида `https://trans-….vercel.app`.

## Вариант 3 — Netlify

1. https://app.netlify.com/start  
2. Import from Git → `SevaGd1978/trans`  
3. Build: `npm run build`, Publish: `dist`

## Вариант 4 — всё же GitHub Pages

1. Войдите на GitHub как **SevaGd1978**  
2. Откройте репозиторий → **Settings** (вкладка сверху)  
3. В левом меню найдите **Pages**  
4. Source = **GitHub Actions** → Save  
5. Смержите PR #1  

Готовый workflow уже есть: `.github/workflows/deploy-pages.yml`  
Ожидаемый адрес: `https://sevagd1978.github.io/trans/`

Статическая сборка также лежит в ветке `deploy` (для CDN/ручной загрузки).
