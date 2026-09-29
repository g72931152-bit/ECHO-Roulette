# Cloudflare — пошагово

## 1. GitHub

Залей весь проект так, чтобы `wrangler.jsonc`, `package.json`, `src/` и `public/` лежали в корне репозитория.

## 2. Cloudflare

Открой Workers & Pages.

Выбери:

`Create application` → `Get started` возле `Import a repository`.

Подключи GitHub, выбери репозиторий и запусти Deploy.

Cloudflare Workers Builds умеет запускать build command и deploy command; для такого проекта отдельная сборка не нужна, а deploy выполняется Wrangler.

## 3. Если Cloudflare просит команды

Build command можно оставить пустым.

Deploy command:

```text
npx wrangler deploy
```

Root directory:

```text
.
```

## 4. Durable Object

Класс `Lobby` и миграция уже указаны в `wrangler.jsonc`. Дополнительно вручную создавать Durable Object не нужно.

## 5. Проверка

После деплоя открой:

```text
https://ТВОЙ-САЙТ.workers.dev/health
```

Должен вернуться JSON с `ok: true`.

Затем открой главную страницу, разреши камеру и микрофон и протестируй минимум двумя устройствами/браузерами.

## 6. Что делать, если WebRTC не соединится

Проверь сначала два разных устройства/сети. Если signaling работает, но `RTCPeerConnection` переходит в `failed`, вероятнее всего нужна TURN-инфраструктура для relay в проблемных сетях.

Не вставляй приватные API-токены в `public/app.js`. Секреты, если они появятся в будущем, должны храниться в Cloudflare Secrets/Variables.
