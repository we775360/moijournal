# Deploying MoiJournal (Render + Vercel)

```text
Browser ──► Vercel (website + /api proxy) ──► Render Web Service (API) ──► Render Postgres
            holds PROXY_SECRET                 checks PROXY_SECRET          stores ciphertext only
```

The website and the API share one secret, so the API is only ever reachable through the
website. Set it to the same value in both places.

## 1. Database — Render Postgres

1. Render dashboard → **New → PostgreSQL** → Free plan, region e.g. Singapore.
2. Copy the **Internal Database URL**. The API creates its tables on first start
   (`server/schema.sql` is applied automatically).

## 2. API — Render Web Service

1. **New → Web Service** → connect your GitHub repo.
2. **Root Directory:** `server` · **Build:** `npm install` · **Start:** `npm start` · Node 20+.
3. Same region as the database.
4. Environment variables:

   | Name           | Value                             |
   | -------------- | --------------------------------- |
   | `DATABASE_URL` | Internal Database URL from step 1 |
   | `DATABASE_SSL` | `false` (internal URL)            |
   | `JWT_SECRET`   | 64 random characters              |
   | `PROXY_SECRET` | 48 random characters              |
   | `NODE_ENV`     | `production`                      |

5. After deploy, open `https://<your-api>.onrender.com/health` — you should see `{"ok":true}`.

Generate secrets locally with `openssl rand -base64 48`, or from a password manager. Never
put them in code, chat or the repository.

## 3. Website — Vercel

1. **Add New → Project** → import the same GitHub repo (repository root).
2. Framework preset: **Other**. Build command: `npm run build`.
3. Environment variables:

   | Name           | Value                             |
   | -------------- | --------------------------------- |
   | `NITRO_PRESET` | `vercel`                          |
   | `API_ORIGIN`   | `https://<your-api>.onrender.com` |
   | `PROXY_SECRET` | the **same** value as on Render   |

4. Deploy, then sign up on your Vercel URL to check the whole path end to end.

## Notes

- Render's free web service sleeps after ~15 minutes idle; the first request then takes
  ~30–50 s. The app shows "Our server is waking up" in that case.
- Render's free Postgres tier has a limited lifetime — check their current policy and keep
  a backup.
- To grant Premium before payments exist:
  `UPDATE users SET plan='premium' WHERE username='their.name';`
- Pointing the dev server at a local API is covered in the README. Set `INSECURE_COOKIES=true`
  on the API when testing over plain HTTP, or the session cookie will not be stored.
- Content is end-to-end encrypted. If a user loses both their password and their recovery
  code, their diary cannot be recovered — by design.
