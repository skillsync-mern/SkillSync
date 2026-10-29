# SkillSync

A MERN job platform that matches candidates and roles on **skills**. Every job lists required skills, every job seeker lists the skills they have, and SkillSync shows the overlap: matched skills as filled chips, missing ones as dashed chips, plus a 0 to 100% match meter.

Four portals share one MongoDB database and one API:

| Role | What they can do |
| --- | --- |
| **Job seeker** | Search and filter jobs, see skill match, save jobs, apply with a cover letter, track each application's history and interview time, withdraw, edit profile and skills |
| **Company** | Everything a recruiter can do, plus edit the company profile, add/deactivate recruiters, resubmit after a rejection |
| **Recruiter** | Post and manage the company's jobs, review applicants, move them through the pipeline, schedule interviews, leave internal notes |
| **Admin** | Approve or reject companies, moderate and remove jobs, activate or deactivate users, platform stats |

Recruiters and company owners share one hiring workspace (`/api/manage/*`, `Manage.jsx`). There is no separate copy for each role; the API scopes everything to the signed-in user's company.

## Stack

MongoDB + Mongoose 8, Express 4, React 19 (Vite, React Router), Node 18+. Auth is JWT (Bearer token) with bcrypt-hashed passwords. Validation uses zod. Tests use Jest + Supertest (API, against a real MongoDB) and Vitest + Testing Library (client).

## Setup

You need Node 18 or newer and a running MongoDB (local install, Docker `docker run -p 27017:27017 mongo:7`, or an Atlas URI).

```bash
npm run install:all          # installs root, server and client dependencies
cp server/.env.example server/.env   # then edit JWT_SECRET and MONGO_URI
npm run seed                 # loads demo data (wipes the target database)
npm run dev                  # API on :5000, React dev server on :5173
```

Open http://localhost:5173.

### Production-style run (one server, one port)

```bash
npm run build                # builds client/dist
NODE_ENV=production JWT_SECRET=<long random string> MONGO_URI=<uri> npm start
```

The Express server serves the built React app and the API together on `PORT` (default 5000). In production `JWT_SECRET` is mandatory and the server refuses to start without it, and `npm run seed` refuses to run unless you add `--force`.

### Environment variables (`server/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | API port |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/skillsync` | Database |
| `MONGO_URI_TEST` | `mongodb://127.0.0.1:27017/skillsync_test` | Database used by tests (it is dropped afterwards) |
| `JWT_SECRET` | dev-only value | Token signing key; required in production |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `CLIENT_URL` | `http://localhost:5173` | CORS origin for the dev server |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@skillsync.dev` / `Admin123!` | Admin created by the seed |

## Demo accounts (after `npm run seed`)

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@skillsync.dev | Admin123! |
| Company (approved) | priya@northwind.example | Password123! |
| Company (pending approval) | sana@paperkite.example | Password123! |
| Recruiter | arjun@northwind.example | Password123! |
| Job seeker | naga@skillsync.dev | Password123! |

The seed also creates 5 more job seekers, 11 jobs and 11 applications at different pipeline stages, so every screen has real data.

## Tests

```bash
npm test                 # server then client
npm test --prefix server # 39 API tests against a real MongoDB
npm test --prefix client # 10 client tests
```

The API suite seeds `MONGO_URI_TEST`, then exercises auth, role guards, company isolation, search and filters, applications, pipeline rules, notifications and admin actions. It needs MongoDB running. It will never touch `MONGO_URI`.

## How it works

**Company approval.** A company registers as `pending`. Its jobs exist but are hidden from candidates until an admin approves it. A rejected company can fix its profile and resubmit. Admins and company owners get notifications at each step.

**Application pipeline.** `applied → reviewing → shortlisted → interview → offered → hired`, with `rejected` reachable from any active stage and `withdrawn` set by the candidate. The server enforces the allowed moves (`models/Application.js`), requires a future date for interviews, and records every change (who, when, optional message) in the application history. Internal notes are never returned to candidates.

**Notifications.** Created by the server on: new application, withdrawal, status changes (including interview time), company approved/rejected, new company registered (to admins), job removed by an admin, and recruiter added. The bell in the header polls every 30 seconds and refreshes immediately after you read one.

**Skill match.** `utils/skills.js`: share of a job's required skills present on the candidate's profile (case-insensitive). The score is stored on each application at apply time so recruiters see it without recomputing.

### API overview

All routes are under `/api`; send `Authorization: Bearer <token>`.

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`; `PATCH /profile`, `PATCH /profile/password`
- Public: `GET /jobs` (q, location, type, workMode, skills, minSalary, sort, page, limit), `GET /jobs/:id`, `GET /jobs/summary`
- Job seeker: `POST /jobs/:id/apply`, `POST /jobs/:id/save`, `GET /jobs/saved`, `GET /applications/mine`, `POST /applications/:id/withdraw`
- Company and recruiter: `/manage/stats`, `/manage/jobs` (CRUD), `/manage/applications` (list, detail, `PATCH .../status`, `POST .../notes`), `/manage/company`
- Company only: `/manage/recruiters`, `/manage/company/resubmit`
- Admin: `/admin/stats`, `/admin/companies`, `/admin/users`, `/admin/jobs`
- `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`

## Project layout

```
server/src   config, models/, routes/, middleware/, utils/, seed.js, app.js, index.js
server/tests api.test.js
client/src   pages/ (Home, Jobs, JobDetail, Auth, Seeker, Manage, Admin, Notifications), ui.jsx, auth.jsx, api.js, utils.js
```

## Known limits

- Resumes are links, not file uploads. Notifications are polled, not pushed (no websockets), and there is no email delivery.
- Recruiters see all of their company's jobs and applicants, not only their own.
- Tokens are kept in `localStorage` and there are no refresh tokens or password-reset emails. Rate limiting applies to `/api/auth` only.
- Mongoose is pinned to v8. In the environment this was built in, Mongoose 9's newer driver failed its connection handshake under Jest while working in plain Node, so v8 was used for a reliable test run.
- Fonts load from Google Fonts. Offline, the UI falls back to system fonts.
