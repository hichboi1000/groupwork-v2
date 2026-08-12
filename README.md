# GroupWork

> Accountability for university group work — who's doing what, proof it happened, and one place a lecturer or class rep can check instead of scrolling a WhatsApp group.

---

## What's in the box

| Layer | Tech | Purpose |
|-------|------|---------|
| Backend | Django 5 + Django REST Framework | API, database, business rules |
| Real-time | Django Channels (WebSockets) | Live notifications, no polling |
| Auth | JWT (djangorestframework-simplejwt) | Access + refresh tokens |
| Frontend | React 19 + Vite | Web UI, route-level code splitting |
| Styling | Tailwind CSS v4 | Utility-first styling, custom design tokens |
| Database | SQLite (built-in) | No separate DB install needed for local dev |

---

## Roles

The app has four roles, each with a distinct home screen and its own reason to use it:

- **Student** — sees their next task and joins a group by code.
- **Leader** — sees group progress at a glance (who's behind), creates tasks, submits finished work.
- **Rep** — attaches their class to a unit, manages class membership.
- **Lecturer** — posts assignments, reviews submitted work.

---

## Quick Start (Your Laptop)

### Step 1 — Set up the backend

**Mac / Linux:**
```bash
cd backend
chmod +x setup.sh
./setup.sh
```

**Windows:**
```
Double-click backend/setup.bat
```

This creates a virtual environment, installs dependencies, runs migrations, and creates a Django admin account (`admin` / `admin1234`).

### Step 2 — Seed demo data (optional but recommended)

```bash
cd backend/Groupwork
source venv/bin/activate   # Windows: venv\Scripts\activate
python manage.py shell < seed.py
```

This creates demo accounts across all four roles — see [Demo accounts](#demo-accounts) below.

### Step 3 — Start the backend server

```bash
cd backend/Groupwork
source venv/bin/activate   # Windows: venv\Scripts\activate
python manage.py runserver
```

Django Channels is installed, so `runserver` transparently handles the notifications WebSocket in development too — no separate process needed locally. (For production, run it behind Daphne/an ASGI server instead — plain `runserver` is dev-only.)

The API runs at `http://localhost:8000/api/`, Django admin at `http://localhost:8000/admin/`.

### Step 4 — Set up and start the frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

---

## Testing from your phone (same wifi)

By default the frontend talks to `localhost`, which only works from the same machine. To test from a phone on the same network:

1. Find your computer's LAN IP (e.g. `192.168.1.42`) — `ipconfig` (Windows) or `ifconfig`/`ip addr` (Mac/Linux).
2. Edit `frontend/.env`:
   ```
   VITE_API_BASE_URL=http://192.168.1.42:8000/api
   VITE_WS_BASE_URL=ws://192.168.1.42:8000
   ```
3. Restart `npm run dev` (Vite needs a restart to pick up `.env` changes), then visit `http://192.168.1.42:5173` on your phone.

`ALLOWED_HOSTS` and CORS are wide open in `settings.py` for local development — tighten both before deploying anywhere public (see [Before deploying](#before-deploying)).

---

## Demo accounts

All seeded accounts use the password `demo1234`.

| Username | Role | Notes |
|---|---|---|
| `dr_kamau` | Lecturer | Teaches multiple units |
| `dr_njoroge` | Lecturer | |
| `dr_mwangi` | Lecturer | |
| `class_rep` | Rep | Manages a class, attaches it to units |
| `rep_kibet` | Rep | |
| `team_leader` | Leader | Has an existing group with tasks |
| `mary_w` | Student | |
| `jane_k` | Student | |
| `peter_m` | Student | |

Django admin: `admin` / `admin1234`.

---

## Project structure

```
backend/Groupwork/
  users/         custom User model (role: student/leader/rep/lecturer)
  classes/       Class model, class codes
  groups/        Group model, group codes, membership
  assignments/   Unit, UnitOffering, Assignment, GroupAssignment, Submission
  tasks/         Task model (per-member, with optional evidence file)
  notifications/ Notification model + WebSocket consumer
  api/           all REST endpoints, serializers, permissions, protected
                 file-download views

frontend/src/
  pages/                  one file per route
  components/ui/          shared design-system components (Button, Card,
                           Badge, CodeChip, etc.) — the design tokens live
                           in src/index.css
  components/layout/      Sidebar, Topbar, AppLayout
  components/dashboard/   role-specific home screen heroes
  contexts/                AuthContext (JWT), NotificationsContext (WS)
  api/client.js            all API calls, JWT refresh interceptor,
                            authenticated file downloads
```

---

## File uploads & downloads

There are two distinct kinds of file in this app, deliberately kept as separate models with separate access rules:

- **Shared Files** (internal) — a group's own collaboration space: drafts, references, working files. Visible and downloadable only to that group's own members (including the leader). Nobody outside the group — not even that group's lecturer or rep — has any access path to these.
- **Submissions** (external) — the group's final, formal handoff of an assignment to the lecturer/rep for review. Visible to the group and to the scoped lecturer/rep.

Task evidence, group files, and submissions are **not** served as public static files — `/media/` is not publicly mounted. All three go through authenticated, permission-checked endpoints instead:

- `GET /api/files/task-evidence/<task_id>/`
- `GET /api/files/submission/<submission_id>/`
- `GET /api/files/group-file/<file_id>/`

Each checks the requester's actual relationship to the file (group membership, leadership, or scoped lecturer/rep access) before streaming it. The frontend downloads these via an authenticated fetch (`downloadFile()` in `api/client.js`), not a plain link, since the endpoint requires a JWT header a browser-native download can't send.

Uploads are capped at 15MB with an extension allowlist (`Groupwork/validators.py`) — enforced server-side, not just in the UI.

---

## Real-time notifications

Notifications push over a WebSocket (`/ws/notifications/`) rather than polling. If the socket disconnects, the frontend falls back to periodic polling until it reconnects — see `NotificationsContext.jsx`.

---

## Backend tests

```bash
cd backend/Groupwork
source venv/bin/activate   # Windows: venv\Scripts\activate
python manage.py test api
```

Covers authorization scoping across all four roles (a student/leader/rep/lecturer should never reach another group's/class's/unit's data), the auto-status/`ready_to_submit` transition logic, notification recipient isolation, file upload validation (size/type limits), deadline enforcement, and the internal-vs-external file access split described above.

---

## Before deploying

This is currently configured for local development. Before putting it anywhere public:

- [ ] Set a real `SECRET_KEY` (currently a placeholder in `settings.py`) via an environment variable
- [ ] Set `DEBUG = False`
- [ ] Set `ALLOWED_HOSTS` to your actual domain(s)
- [ ] Restrict `CORS_ALLOW_ALL_ORIGINS` to your actual frontend origin
- [ ] Move to a real database (Postgres) instead of SQLite
- [ ] Run behind an ASGI server (Daphne/Uvicorn) rather than `runserver`
- [ ] Set `VITE_API_BASE_URL` / `VITE_WS_BASE_URL` to your production domain (`https://` / `wss://`)
- [ ] Serve `MEDIA_ROOT` from persistent storage, not local disk, if deploying somewhere ephemeral
