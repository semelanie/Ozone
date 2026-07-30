# Ozone Unit Website — Full Stack (Express + Postgres/Supabase)

A working website for the Ozone Unit (MECENR, Seychelles) with a real backend:
authenticated admin login, a Postgres database (via Supabase), and live
API-backed contact forms, feedback, confidential reporting, document
management, and news. Deployable on **Vercel** (serverless) now, and on a
traditional Node host like **IIS (via iisnode)** later — same codebase, no
rewrite needed.

## What's actually working here

- **Public site** (`public/index.html`) — contact form, feedback widget, active
  search, download manager, news carousel, and confidential reporting form all
  talk to real API endpoints and a real database (not mock data).
- **Admin dashboard** (`public/admin.html`) — password-protected login (JWT in
  an HttpOnly cookie), with tabs to review contact submissions, feedback,
  confidential reports (decrypted for authorized viewing only), and to manage
  documents, news posts, and staff accounts.
- **Database** — Postgres via Supabase, schema in `db/schema.sql`, accessed
  through `db/pool.js` (the `pg` driver).
- **Security basics included**: bcrypt password hashing, JWT sessions,
  AES-256-GCM encryption at rest for confidential report contents, rate
  limiting on login/contact/report/feedback endpoints, a honeypot field on the
  contact form, Helmet security headers, and an audit log for admin actions on
  confidential reports.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In your project, go to **Project Settings → Database → Connection string**.
3. Copy the **Connection pooling** string (not the direct connection) —
   it uses port `6543` and includes `?pgbouncer=true`. This is the one built
   for serverless environments like Vercel, which open many short-lived
   connections instead of a few long-lived ones.
4. It looks like:
   `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true`

## 2. Seed the database (run this locally, once)

Create a `.env` file in the project root:

```
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

Then:

```bash
npm install
npm run seed
```

This will:
- create all tables in your Supabase database (safe to re-run — uses `IF NOT EXISTS`)
- generate `REPORTS_ENCRYPTION_KEY` and `JWT_SECRET` into your local `.env`
- create a first admin account and print a **one-time** temporary password —
  copy it immediately, it's not stored anywhere recoverable

**Important:** the same `REPORTS_ENCRYPTION_KEY` and `JWT_SECRET` values must
also be set in Vercel (step 3) — not regenerated there. Both your local seed
script and the deployed app talk to the *same* Supabase database, and
confidential report data is encrypted with whichever key wrote it. If Vercel
uses a different key than the one that encrypted existing rows, those rows
become unreadable.

## 3. Deploy to Vercel

1. Push this project to a Git repo (GitHub/GitLab/Bitbucket) and import it in
   Vercel, or run `vercel` from the project root with the Vercel CLI.
2. In **Project Settings → Environment Variables**, add:
   - `DATABASE_URL` — the same Supabase pooling string from step 1
   - `JWT_SECRET` — copy the value from your local `.env`
   - `REPORTS_ENCRYPTION_KEY` — copy the value from your local `.env`
   - `NODE_ENV` = `production`
3. Deploy. Vercel will pick up `vercel.json`, which routes every request to
   the single serverless function at `api/index.js` (which just re-exports
   the Express `app` from `server.js` — Express apps already have the
   `(req, res)` shape Vercel's Node runtime expects, so no adapter library is
   needed).
4. Visit your `*.vercel.app` URL, and `/admin.html` for the dashboard.

## 4. Moving to IIS later

The same code runs on a traditional Windows/IIS host via
[iisnode](https://github.com/Azure/iisnode) — no rewrite needed:
- `server.js` calls `app.listen()` when run directly (`node server.js`),
  which is what iisnode expects.
- Keep using the same Supabase `DATABASE_URL`, or point it at a different
  Postgres instance (on-prem, Azure, etc.) if the Ministry wants the data
  hosted elsewhere at that point — only the connection string changes, no
  code changes.
- Set the same three environment variables (`DATABASE_URL`, `JWT_SECRET`,
  `REPORTS_ENCRYPTION_KEY`) in IIS's `web.config` or the server's environment
  instead of Vercel's dashboard.

## Environment variables reference

| Variable | Where it's used | Notes |
|---|---|---|
| `DATABASE_URL` | Everywhere the app touches the DB | Supabase connection-pooling string |
| `JWT_SECRET` | Signing admin session tokens | Generated once by `npm run seed`, then copied to Vercel |
| `REPORTS_ENCRYPTION_KEY` | Encrypting confidential report fields | Same as above — **never regenerate independently per environment** |
| `PGSSL_DISABLE` | Local testing only | Set to `true` only if testing against a local Postgres without SSL. Leave unset for Supabase (which requires SSL). |
| `PORT` | Local dev only | Defaults to 3000 |
| `SEED_ADMIN_EMAIL` | `npm run seed` only | Defaults to `admin@databytes.sc` |

**Never commit `.env` to version control.** It's already in `.gitignore`.

## Project structure

```
server.js              Express app — exports `app`; also calls app.listen()
                        when run directly (local dev / IIS), but not on Vercel
api/index.js            Vercel serverless entry point (re-exports server.js)
vercel.json              Routes all requests to api/index.js
db/
  schema.sql             Table definitions (Postgres)
  pool.js                 pg connection pool + schema bootstrap
  crypto.js                AES-256-GCM encrypt/decrypt for confidential reports
  seed.js                   First-run setup: keys, admin account, sample content
middleware/
  requireAuth.js           JWT auth + role-based access guard
routes/
  auth.js                   login / logout / me / change-password / create user
  contact.js                 public submit + admin list/update
  feedback.js                 public submit + admin list
  reports.js                   public submit (encrypted) + admin list/update (decrypted)
  documents.js                  public list/search + admin create/update/delete
  news.js                        public list + admin create/update/delete
public/
  index.html                     the public website (React, no build step, CDN-loaded)
  admin.html                      the admin dashboard (React, same approach)
```

## Roles

- **admin** — everything an editor can do, plus: view/manage confidential
  reports, create staff accounts, delete documents/news.
- **editor** — manage contact submissions, feedback, documents, and news.
  Cannot see confidential reports or manage staff accounts — by design, so
  that report access stays limited to a small, named group as required by
  the RFP's Terms of Reference.

## What this is NOT (yet)

- **No file uploads yet.** Documents are metadata + a URL field. Wiring actual
  PDF/DOCX file uploads (e.g. via `multer` + Supabase Storage or another
  object store) is a small follow-on piece.
- **No outbound email.** Contact form submissions land in the database and
  show up in the admin dashboard, but nothing emails the Ozone Unit inbox yet.
- **Google Analytics 4 / Search Console / Google My Business** from the SEO
  plan aren't wired in here — those are external service configurations, not
  backend code, and need real Ozone Unit-owned Google accounts to set up.
- **CSP is relaxed** (`contentSecurityPolicy: false` in `server.js`) to allow
  the CDN-loaded fonts/React in this demo. Tighten this before a permanent
  production launch.

## Resetting the database

Everything lives in Supabase now — drop and recreate tables via the Supabase
SQL editor (or just drop the whole project) if you want a clean slate, then
re-run `npm run seed`.
