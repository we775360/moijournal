# MoiJournal

A cosy, private online diary. Write the sweet days and the harsh days — MoiJournal keeps
every page end-to-end encrypted, lets you scribble in the margins and sign a page off, and
exports a whole book as a print-ready PDF.

## What it does

- **Landing page** with the full pitch, how-it-works, privacy and pricing.
- **Signup, login and recovery.** Pick a name, a vibe and a theme; you get a one-time
  recovery code that is the only way back in if you forget your password.
- **Bookshelf dashboard** showing your books and how much of your plan you've used.
- **Writing page** with auto-filled date and time (both editable), a mood picker, a
  finger/mouse/pen scribble pad and a signature pad.
- **Custom covers** — any photo, shrunk and encrypted on your device before upload.
- **PDF export** of a whole book, cover page and all, generated in your browser.
- **Personal themes** (Blush, Sage, Sky, Butter, Midnight) chosen at signup.
- **Search-ready** marketing page: canonical URLs, Open Graph image, FAQ and app
  structured data, plus `robots.txt` and `sitemap.xml`.

## Plans

|                     | Books | Pages |
| ------------------- | ----- | ----- |
| Free                | 2     | 10    |
| Premium (₹99/month) | 10    | 50    |

Payments are not wired up yet; Premium is granted from the database for now. See DEPLOY.md.

## Architecture

```text
Browser ──► Vercel (TanStack Start SSR, /api proxy) ──► Render (Express API) ──► Postgres
              holds PROXY_SECRET                          checks PROXY_SECRET    ciphertext only
```

- **Website** — TanStack Start (React 19) on Vite 8, styled with Tailwind CSS v4. It
  server-renders the marketing and auth pages, and proxies `/api/*` to the API so the
  session cookie stays first-party.
- **API** — a small Express service in `server/`. It exposes accounts, books, pages and
  covers, and refuses any request that did not arrive through the website proxy.
- **Database** — Postgres, holding bcrypt-hashed auth keys, wrapped encryption keys, and
  journal content as opaque ciphertext in `bytea` columns.

## Security model

Everything you write is encrypted before it leaves your device, so a database leak exposes
nothing readable.

- Your password never reaches the server. The browser derives an **auth key** from
  `PBKDF2(password, "moijournal/auth/v1/" + username)` (SHA-256, 310,000 iterations) and
  sends only that. The server stores its bcrypt hash (cost 12).
- Journal content is encrypted with a random **AES-256-GCM data key**. That key is wrapped
  twice — once with a key derived from your password and once with a key derived from your
  recovery code — so either can unlock the diary and neither alone can.
- Pages are stored as `[version][iv][AES-GCM(gzip(json))]`. Wrapped keys and ciphertext are
  all the server ever sees.
- Sessions are a signed JWT in an `httpOnly`, `Secure`, `SameSite=Lax` cookie. Changing your
  password bumps a `token_version` column, which signs every other device out immediately.
- Sign-in is rate limited per IP, and an account pauses for 15 minutes after 8 wrong tries.
- The API additionally requires a shared `PROXY_SECRET` that only the website holds, plus a
  custom `X-MJ` header that a cross-site form post cannot set.
- PDFs are built in the browser from decrypted pages, so plaintext is never uploaded.

Password minimum is 10 characters (`src/lib/password.ts`). If you lose both your password
and your recovery code, the diary cannot be recovered — by design.

One caveat worth knowing: unlocking stores the (non-extractable) data key in IndexedDB so a
page reload does not ask for your password again. "Lock" clears it. Anyone with access to an
unlocked device can read the diary.

## Local development

Requires Node 20+.

```sh
npm install
npm run dev          # http://localhost:8080
```

The website runs on its own; only the `/api/*` routes need the API. To run those locally,
start the API and point the dev server at it:

```sh
# terminal 1 — API (needs a Postgres DATABASE_URL)
cd server && npm install && npm start

# terminal 2 — website
API_ORIGIN=http://localhost:4000 PROXY_SECRET=<32+ char secret> npm run dev
```

## Environment variables

**Website (Vercel)**

| Name            | Purpose                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `API_ORIGIN`    | Base URL of the Render API, e.g. `https://moijournal.onrender.com`     |
| `PROXY_SECRET`  | Shared secret; must match the API's value exactly                      |
| `NITRO_PRESET`  | `vercel`                                                               |
| `VITE_SITE_URL` | Optional: public URL used for canonical links, OG tags and the sitemap |

If the two `PROXY_SECRET` values ever drift apart, every `/api` call answers `403 Forbidden`.
The API's `/health` endpoint and its 403 bodies print short SHA-256 fingerprints of both
values so the difference is obvious — see DEPLOY.md step 4.

**API (Render)**

| Name               | Purpose                                                 |
| ------------------ | ------------------------------------------------------- |
| `DATABASE_URL`     | Postgres connection string                              |
| `DATABASE_SSL`     | `false` for Render's internal URL                       |
| `JWT_SECRET`       | 32+ random characters                                   |
| `PROXY_SECRET`     | 32+ random characters; must match the website's value   |
| `INSECURE_COOKIES` | Set to `true` only when testing over plain HTTP locally |

## Project layout

```text
src/
  routes/       file-based routes — landing, login, signup, recover, and the /app shell
  components/   shared UI (mj.tsx), book cover, book form, scribble pad
  lib/          crypto, api client, session, journal queries, PDF export, themes
  server.ts     SSR entry that turns thrown errors into a readable error page
server/         the Render API (Express, Postgres)
tools/          one-off asset generator for the brand icon
public/         favicon and robots.txt
```

## Scripts

| Command             | What it does                       |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Dev server on port 8080            |
| `npm run build`     | Production build into `.output/`   |
| `npm run preview`   | Serve the production build locally |
| `npm run lint`      | ESLint (also checks formatting)    |
| `npm run typecheck` | `tsc --noEmit`                     |
| `npm run format`    | Prettier write                     |
| `npm test`          | Vitest                             |

The brand icon is generated from one geometry definition:

```sh
node tools/generate-favicon.mjs   # rewrites public/favicon.{svg,ico} and apple-touch-icon.png
```

## Deployment

See [DEPLOY.md](./DEPLOY.md).
