# Deploy on Vercel (frontend + API) with Neon (database)

Everything runs on **Vercel**. The database lives on **Neon** (PostgreSQL). File attachments use **Vercel Blob**.

```
your-app.vercel.app
  ├── /              → React app (static)
  └── /api/*         → FastAPI (serverless Python)
Neon                 → PostgreSQL (DATABASE_URL)
Vercel Blob          → attachment files (BLOB_READ_WRITE_TOKEN)
```

---

## Before you start

- [ ] GitHub repo pushed and up to date
- [ ] [Neon](https://neon.tech) account
- [ ] [Vercel](https://vercel.com) account

**Do not commit `.env` files.** Set secrets in the Vercel dashboard only.

---

## Step 1 — Neon database (~5 min)

1. [console.neon.tech](https://console.neon.tech) → **New project**
2. Copy the **Pooled connection** string (`-pooler` in hostname):
   ```
   postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```
3. Save it — you will paste this as `DATABASE_URL` on Vercel.

---

## Step 2 — Vercel Blob for attachments (~2 min)

1. Vercel dashboard → your project (create in Step 3 first if needed) → **Storage**
2. **Create Database** → **Blob**
3. Link it to the project — Vercel adds `BLOB_READ_WRITE_TOKEN` automatically

Without Blob, tasks work but **file uploads fail** in production.

---

## Step 3 — Deploy on Vercel (~10 min)

1. [vercel.com/new](https://vercel.com/new) → import **`Supershyft-task-tracker`**
2. **Important settings:**

| Setting | Value |
|---------|--------|
| **Root Directory** | `.` (repo root — **not** `frontend`) |
| **Framework Preset** | Other (uses `vercel.json`) |

Leave build/output settings — `vercel.json` at the repo root defines them.

3. **Environment variables** (Production + Preview):

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Neon **pooled** connection string |
| `SECRET_KEY` | Long random string (e.g. `openssl rand -hex 32`) |
| `DEBUG` | `false` |
| `AUTO_SEED` | `true` |
| `CORS_ORIGINS` | `https://YOUR-PROJECT.vercel.app` (update after first deploy) |
| `FRONTEND_URL` | Same as above |

**Do not set `VITE_API_URL`** — the app calls `/api` on the same domain.

`BLOB_READ_WRITE_TOKEN` is added automatically when Blob is linked.

4. Click **Deploy**

5. After deploy, update `CORS_ORIGINS` and `FRONTEND_URL` with your real Vercel URL → **Redeploy**

---

## Step 4 — Verify

Open `https://YOUR-PROJECT.vercel.app`

- [ ] `https://YOUR-PROJECT.vercel.app/api/health` → healthy JSON
- [ ] Login: `admin@company.com` / `admin123`
- [ ] Tasks load, create/edit works
- [ ] Upload an attachment
- [ ] Reports, users (admin)

First API request after idle may take a few seconds (serverless cold start).

---

## Local development (unchanged)

```bash
# Terminal 1 — backend
cd backend
venv\Scripts\activate
copy .env.example .env
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Local dev uses SQLite and `./uploads` on disk. Neon optional locally via `DATABASE_URL` in `backend/.env`.

---

## Troubleshooting

### Build fails on Vercel

- Confirm **Root Directory** is repo root (`.`), not `frontend`
- Check build logs for missing Python or Node deps

### `/api/health` 404 or 500

- Ensure `api/index.py` and root `requirements.txt` exist in the repo
- Redeploy after pushing latest code

### Login / database errors

- Check `DATABASE_URL` is Neon **pooled** URL with `?sslmode=require`
- Neon project must be active

### Upload fails

- Create and link **Vercel Blob** storage
- Confirm `BLOB_READ_WRITE_TOKEN` appears in project env vars

### CORS errors

- Set `CORS_ORIGINS` to your exact Vercel URL (no trailing slash)
- For preview URLs, add them comma-separated

---

## Summary

1. **Neon** — database connection string  
2. **Vercel Blob** — linked to project  
3. **Vercel** — deploy from **repo root**, set `DATABASE_URL` + `SECRET_KEY`  
4. **Test** — health, login, tasks, uploads  

No Render required.
