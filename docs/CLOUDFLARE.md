# Cloudflare deployment

ELVAR uses one Durable Object (`Lobby`) as the matchmaking, account, reports and groups data layer.

## Routes

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/favorites`
- `POST /api/favorites`
- `GET /api/groups`
- `POST /api/groups`
- `POST /api/groups/:id/join`
- `POST /api/groups/:id/leave`
- `POST /api/feedback`
- `GET /api/admin`
- `POST /api/admin`
- `GET /ws`

## Secrets / bindings

`ADMIN_TOKEN` is a Worker secret and must never be committed to the repository or placed under `public/`.

`ADMIN_EMAIL` defaults to `ptornsaso0@gmail.com` and can be overridden.

For email delivery, configure an Email binding named `EMAIL` and a sender in `SUPPORT_FROM`. When the binding is unavailable, reports and feedback still remain in Durable Object storage.
