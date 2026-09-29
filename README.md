# ECHO — минималистичная WebRTC чат-рулетка

Это готовый MVP под Cloudflare Workers + Durable Objects. GitHub можно подключить к Cloudflare Workers Builds, чтобы каждый push в production-ветку автоматически деплоил новый Worker.

## Что уже есть

- адаптивный минималистичный интерфейс в стиле Google: светлая и тёмная тема по настройкам системы, Material-анимации, поддержка `prefers-reduced-motion`;
- запрос камеры и микрофона через браузер;
- локальное видео;
- WebSocket-сигналинг через Durable Object;
- случайное matchmaking двух пользователей;
- WebRTC offer/answer/ICE;
- кнопки микрофона, камеры, Next и «Завершить разговор»;
- смена камеры и микрофона;
- базовая Web Audio настройка уровня голоса;
- Report;
- reconnect;
- health endpoint `/health`;
- рекламный слот-заглушка (скрыт по умолчанию: чтобы показать, убери атрибут `hidden` у `#adSlot` в `public/index.html`);
- режим «Поддержать» как заглушка под будущую ссылку;
- отдельный стресс-тест алгоритма matchmaking.

## Важно про V1

Видео и звук не проксируются через Worker. Worker и Durable Object используются для matchmaking и WebRTC signaling. В клиенте используются два STUN-сервера. Для сложных сетей production-версия обычно требует TURN relay, поэтому отсутствие TURN не гарантирует соединение между любыми двумя сетями.

Голосовой эффект в этой V1 — только базовая Web Audio обработка громкости. Настоящий pitch-shift/voice-changer лучше делать отдельным AudioWorklet-модулем в следующей версии.

## Локальная проверка

```bash
npm install
npm run check
```

`npm run check` выполняет синтаксические проверки и стресс-тест matchmaking.

Для локального запуска Cloudflare Worker:

```bash
npm run dev
```

После запуска открой адрес Wrangler в браузере. Для проверки камеры браузер должен считать origin безопасным. HTTPS на продакшене обязателен для `getUserMedia()`.

## Cloudflare через GitHub

1. Залей папку в GitHub-репозиторий.
2. В Cloudflare открой Workers & Pages → Create application → Get started рядом с Import a repository.
3. Подключи GitHub и выбери репозиторий.
4. Оставь `wrangler.jsonc` в корне проекта.
5. Deploy.
6. Cloudflare выдаст `workers.dev` адрес.
7. Последующие push в production-ветку смогут автоматически деплоить новую версию через Workers Builds.

Не создавай отдельный обычный Pages-проект поверх этого репозитория: этот проект уже является Worker с Assets.

## Где менять название и будущую рекламу

Название ECHO находится в `public/index.html`.

Рекламный слот находится в `public/index.html` и стилизуется в `public/style.css`.

Цвета, скругления и анимации собраны в переменных `:root` в начале `public/style.css`. Шрифт Roboto подгружается с Google Fonts; если внешний запрос не нужен, удали три `<link>` со шрифтом в `public/index.html` — интерфейс перейдёт на системный шрифт.

Кнопка поддержки пока безопасно остаётся заглушкой. Когда выберешь платёжный/донат-сервис, URL можно вынести в одну константу в `public/app.js`.
