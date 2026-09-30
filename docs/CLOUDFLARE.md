# Cloudflare setup for ELVAR

## 1. GitHub

Upload the whole repository with `wrangler.jsonc`, `src`, `public`, `tests` and `package.json` at the repository root.

## 2. Workers & Pages

Open Workers & Pages → `echo-roulette` → Deployments / Edit code. Keep:

- Root directory: `/`
- Build command: empty
- Deploy command: `npx wrangler deploy`

The repository already contains the Worker/Assets/Durable Object configuration.

## 3. Durable Object

Do not manually create a second Lobby namespace. The project declares:

```json
"exports": {
  "Lobby": {
    "type": "durable-object",
    "storage": "sqlite"
  }
}
```

The existing `echo-roulette_Lobby` namespace can stay in place. The declarative `exports` flow is compatible with an existing namespace when the storage backend is SQLite.

## 4. Admin secret

In Worker Settings → Variables and Secrets, create a secret named:

```text
ADMIN_TOKEN
```

Use a long random value. Optional variable:

```text
ADMIN_EMAIL
```

The default owner email in the source is `ptornsaso0@gmail.com`, but you can replace it with the environment variable later without editing the client.

## 5. Email (optional)

For true server-side email delivery, use Cloudflare Email Service. Configure an onboarded sending domain and add a `send_email` binding in the Worker. The code will use `env.EMAIL` and `env.SUPPORT_FROM` when both exist.

The current Email Service API supports sending through a Workers binding with `env.EMAIL.send(...)`. See Cloudflare Email Service documentation for domain onboarding and sender verification.

## 6. First test

Open:

```text
https://YOUR_WORKER.workers.dev/health
```

You should get JSON with `ok: true`.

Then open the main page in two browsers/devices, create different local profiles and start the session.

## 7. If one user hears the other but not the reverse

The new client uses explicit audio tracks, `replaceTrack`, `max-bundle`, and a direct remote-video playback call after receiving a track. Test again with two separate browsers. If ICE fails only across particular networks, add TURN rather than routing media through the Worker.
