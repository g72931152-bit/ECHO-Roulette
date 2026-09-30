# ELVAR admin access

Админ-доступ разделён на два слоя.

1. На сайте открой скрытую форму комбинацией `Ctrl + Shift + Alt + E` или последовательностью `ELVARX`.
2. Введи серверный `ADMIN_TOKEN`. Браузер хранит его только в `sessionStorage` текущей вкладки.

Секрет не должен находиться в `public/`, `app.js` или HTML. Для локального запуска:

```text
npm run admin:generate
npm run dev
```

Скрипт создаёт `.dev.vars`, если его ещё нет. Для продакшена тот же секрет нужно задать как Cloudflare Worker secret `ADMIN_TOKEN`.

Почта владельца по умолчанию: `ptornsaso0@gmail.com`. Для реальной доставки нужен настроенный Cloudflare Email binding `EMAIL` и адрес отправителя `SUPPORT_FROM`.
