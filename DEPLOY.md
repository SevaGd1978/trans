# Публикация ОпораСчёт

## Amvera Cloud

В репозитории уже есть `amvera.yml` (Node.js Browser → сборка Vite → `dist`).

### Как задеплоить

1. Зарегистрируйтесь / войдите: https://amvera.ru  
2. Создайте приложение → окружение **Node.js** → toolchain **Browser**  
3. Скопируйте git-URL проекта (вид `https://git.amvera.ru/<user>/<app>`)  
4. Из корня проекта:

```bash
git remote add amvera https://git.amvera.ru/<user>/<app>
git push amvera HEAD:master
```

Либо передайте агенту секреты `AMVERA_USERNAME` + `AMVERA_PASSWORD` (или токен) и git-URL — запушу сам.

После успешной сборки сайт будет на адресе вида  
`https://<app>-<user>.amvera.io`

Запасной вариант без yaml: `amvera/Dockerfile` (nginx + dist).

## Активный хостинг (ShipStatic)

**https://chrome-dust-n7h2f5a.shipstatic.com**

Claim: https://my.shipstatic.com/claim/b02b928b08426e12c646cdd9d8c42bf9  

```bash
npm run deploy:ship
```

## Запасные

- Nivii: https://gvto3mgl.nivii.app  
- Harvis: https://rapid-whistle-278.harvis.page → `npm run deploy:harvis`

## Vercel / Netlify

- Vercel: https://vercel.com/new → import `SevaGd1978/trans` → `npm run build` / `dist`
- Netlify: https://app.netlify.com/start → то же

## GitHub Pages

Settings → Pages → GitHub Actions → `https://sevagd1978.github.io/trans/`
