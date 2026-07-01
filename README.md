# Work OS — Notion-Inspired Internal Task Platform

An internal Work Operating System where **tasks are the product**. Everything else—projects, reports, analytics—exists to support getting work done.

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
pip install -r requirements.txt
copy .env.example .env   # edit .env locally — never commit it
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env   # optional for local dev; Vite proxies /api by default
npm run dev
```

Open http://localhost:5173

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@company.com | admin123 |
| Manager | james@company.com | manager123 |
| Employee | alex@company.com | employee123 |

## Key Pages

| Route | Purpose |
|-------|---------|
| `/` | Task Workspace — full database with table/kanban views |
| `/my-tasks` | Personal tasks grouped by urgency |
| `/projects` | Project containers with embedded task databases |
| `/reports` | Analytics for managers (health, trends, exports) |

## Features

- Notion-inspired dark database table with resizable columns
- Inline status changes, filters, sort, group, bulk actions
- Task drawer: overview, checklist, comments, attachments, dependencies, review, testing, activity
- Kanban board with drag-and-drop
- Review and testing workflows, bug tracking, block/unblock, reopen
- JWT auth, RBAC, email notifications, global search

## Deploy to production (Vercel + Render)

**Full step-by-step checklist:** see **[DEPLOY.md](./DEPLOY.md)**

Vercel hosts the React app; the FastAPI API runs on Render (free tier works for demos). You cannot run SQLite + file uploads on Vercel alone without rewriting the backend.

Quick summary:

1. Push repo to GitHub  
2. **Render** — New → Blueprint → set `CORS_ORIGINS` and `FRONTEND_URL` to your Vercel URL  
3. **Vercel** — import repo, **Root Directory = `frontend`**, set `VITE_API_URL` to your Render API URL  
4. Test login: `admin@company.com` / `admin123` (auto-seeded on first API start)
