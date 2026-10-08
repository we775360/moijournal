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

   Optional overrides — these have working defaults in `server/index.js`:

   | Name                | Default          | Purpose                        |
   | ------------------- | ---------------- | ------------------------------ |
   | `UPI_ID`            | `8108096229@fam` | Where Premium is paid          |
   | `UPI_NAME`          | `MoiJournal`     | Payee label in the deep link   |
   | `SUPPORT_INSTAGRAM` | `moijournal26`   | Support handle shown in the UI |

5. After deploy, open `https://<your-api>.onrender.com/health` — you should see `{"ok":true}`.

Generate secrets locally with `openssl rand -base64 48`, or from a password manager. Never
put them in code, chat or the repository.

## 3. Website — Vercel

1. **Add New → Project** → import the same GitHub repo (repository root).
2. Framework preset: **Other**. Build command: `npm run build`.
3. Environment variables:

   | Name            | Value                                         |
   | --------------- | --------------------------------------------- |
   | `NITRO_PRESET`  | `vercel`                                      |
   | `API_ORIGIN`    | `https://<your-api>.onrender.com`             |
   | `PROXY_SECRET`  | the **same** value as on Render               |
   | `VITE_SITE_URL` | optional — the public URL, if not the default |

4. Deploy, then sign up on your Vercel URL to check the whole path end to end.

## 3b. Premium, UPI payments and the admin dashboard

Premium is ₹99/month and paid by hand. A signed-in user picks how many months, pays the
MoiJournal UPI ID in any UPI app (the page opens a `upi://` deep link that pre-fills the
amount), then files a claim with the UPI ID they paid **from**. Nothing auto-charges and no
card data is stored anywhere; `payments` holds only that UPI ID and an optional UTR.

### Adding your own UPI QR code

The upgrade page does **not** generate a QR code — a generated one encodes the payee name from
this repo rather than the one your bank has registered. To show your real FamPay QR instead:

1. Put the image in `public/`, e.g. `public/fampay-qr.png`.
2. Set `FAMPAY_QR_IMAGE = "/fampay-qr.png"` near the top of `src/routes/app.upgrade.tsx`.
3. Redeploy the website.

The QR is a convenience only — the UPI ID and the deep-link button work without it, and the
payee is always `UPI_ID` (`8108096229@fam` by default).

Approving a claim extends Premium from whichever is later — today, or the end of any Premium
they already have — so paying a few days early never loses leftover days. When the time runs
out the plan reads as Free again on its own, with no cron job.

### Make yourself an admin

The dashboard is at `/admin`. It refuses anyone without the flag, and the page is `noindex`.
Grant it to your own account once, from the Render Postgres shell:

```sql
UPDATE users SET is_admin = true WHERE username = 'your.username';
```

Reload the app and an **Admin** link appears in the top bar. From there you can approve or
reject payments, grant Premium manually, revoke it, and search accounts by username. You will
never see a diary page or cover: those are ciphertext and the keys live on the user's device.

Schema changes look after themselves — the API runs `server/schema.sql` on every start, and
every statement in it is idempotent.

## 4. If every `/api` request answers "403 Forbidden"

Every route except `/health` requires the website and the API to present the **same**
`PROXY_SECRET`. A mismatch is the most common deploy mistake, and it looks like a plain
`{"error":"Forbidden"}` — it is not a code problem and it is not the database.

The API publishes both sides as short SHA-256 fingerprints, so you can compare the two
values without copying the secret anywhere:

- `https://<your-api>.onrender.com/health` → `proxySecretFingerprint` is what the API expects.
- Any other request's 403 body → `expectedFingerprint` vs `sentFingerprint` (or the `x-mj-error:
proxy-secret-mismatch` response header) says whether the website sent the right value.
- The API also logs `[proxy] PROXY_SECRET mismatch: ...` under **Logs** on Render.

If the fingerprints differ, put one value in both dashboards — Render → _Environment_ and
Vercel → _Settings → Environment Variables_ — then **redeploy both**. Vercel bakes variables
into a deployment, so a value added after the last deploy does nothing until you redeploy.

Paste the value straight from `openssl rand -base64 48`. Retyping tends to add a trailing
space or a surrounding pair of quotes, and either one changes the hash.

## 5. Search engines

- Set the production URL once in `src/lib/site.ts` (or with `VITE_SITE_URL` on Vercel). It
  drives the canonical links, Open Graph tags and the sitemap.
- On Google Search Console, add `https://moijournal.vercel.app` as a URL-prefix property and
  paste `https://moijournal.vercel.app/sitemap.xml` under **Sitemaps**. Listing the domain
  through a DNS provider also works if you move to a custom domain.
- `/app`, `/api/*` and `/recover` are kept out of the index in their own markup; the landing
  page carries the keywords and FAQ structured data.

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
