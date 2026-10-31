# Supershyft Task Tracker

An internal task platform where **tasks are the product**. Everything else—projects, reports, analytics—exists to support getting work done.

Built for startup teams (~15–100 employees) with full review workflows, dependencies, multi-assignee support, and role-based access.

## Product Philosophy

- **Homepage = Task Workspace** — not a dashboard. Users land on a Notion-style database table.
- **Work over analytics** — charts live on the Reports page for managers only.
- **Side peek drawer** — click any task to edit without leaving the list.
- **Keyboard-first** — `C` to create, `⌘K` / `Ctrl+K` to search, arrow keys to navigate rows.

## Tech Stack

| Layer | Stack |
|-------|--------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy, SQLite, JWT |
| Frontend | React 18, Vite, TypeScript, TailwindCSS, TanStack Query, DND Kit |

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
# pip install -r requirements.txt
# copy .env.example .env   # edit .env locally — never commit it
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
# npm install
copy .env.example .env   # optional for local dev; Vite proxies /api by default
npm run dev
```

Open http://localhost:5173

## Sign in

Users sign in with a **one-time email code** (OTP). SMTP must be configured in `backend/.env` (`EMAIL_ENABLED=true` and Gmail/SMTP credentials).

## Local demo data

Set `AUTO_SEED=true` in `backend/.env` (SQLite only) to load sample users. This never runs against Neon or Vercel. Production uses real accounts and OTP email login.

## Key Pages

| Route | Purpose |
|-------|---------|
| `/` | Task Workspace — full database with table/kanban views |
| `/my-tasks` | Personal tasks grouped by urgency |
| `/projects` | Project containers with embedded task databases |
| `/reports` | Analytics for managers (health, trends, exports) |
| `/weekly-updates` | Person-wise weekly reports, commitments, and deadline history |

## Features

- Notion-inspired dark database table with resizable columns
- Inline status changes, filters, sort, group, bulk actions
- Task drawer: overview, checklist, comments, attachments, dependencies, review, testing, activity
- Kanban board with drag-and-drop
- Review and testing workflows, bug tracking, block/unblock, reopen
- JWT auth, RBAC, email notifications, global search
- Telegram bot (`@supershyftbot`) for tasks, attendance, daily notes (`/dailyupdates`), and weekly updates (`/weeklyupdates`)

## Deploy to production (Vercel + Neon)

**Full checklist:** **[DEPLOY.md](./DEPLOY.md)**

| Service | Role |
|---------|------|
| **Vercel** | React UI + FastAPI API (serverless) |
| **Neon** | PostgreSQL database |
| **Vercel Blob** | Task attachment files |

1. Create **Neon** project → copy pooled `DATABASE_URL`  
2. On **Vercel**, import repo with **Root Directory = repo root** (not `frontend`)  
3. Link **Vercel Blob** storage to the project  
4. Set env vars: `DATABASE_URL`, `SECRET_KEY`, `AUTO_SEED=false`, `CORS_ORIGINS`, `EMAIL_ENABLED=true`  
5. Deploy → sign in with an existing user email and the one-time code

Local dev still uses SQLite by default (`backend/.env`).
