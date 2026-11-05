# SkillSync – Skill-Based Job Matching Platform

SkillSync is a MERN stack-based job portal designed to connect job seekers with suitable job opportunities based on their skills. Instead of relying only on keywords, the platform compares the skills required for a job with the skills available in a candidate's profile.

It displays matched skills using filled chips, missing skills using dashed chips, and provides a match percentage from 0–100%.

## User Roles and Features

SkillSync supports four different user roles, all connected through a common MongoDB database and API.

| Role | Features |
|---|---|
| **Job Seeker** | Browse and filter jobs, check skill matches, save jobs, apply with cover letters, track application progress, view interview schedules, withdraw applications, and update profiles. |
| **Company** | Manage company information, add or deactivate recruiters, manage hiring activities, and resubmit company details after rejection. |
| **Recruiter** | Create and manage job posts, review applications, shortlist candidates, update application status, schedule interviews, and add internal notes. |
| **Admin** | Approve or reject companies, manage job listings, activate or deactivate users, and monitor platform statistics. |

Company owners and recruiters use the same hiring dashboard. Their access is controlled according to their company and account permissions.

## Technology Stack

- **Frontend:** React 19, Vite, React Router
- **Backend:** Node.js 18+, Express 4
- **Database:** MongoDB with Mongoose 8
- **Authentication:** JWT and bcrypt
- **Validation:** Zod
- **Testing:** Jest, Supertest, Vitest, Testing Library

## Installation and Setup

### Requirements

- Node.js 18 or above
- MongoDB installed locally, Docker, or MongoDB Atlas

### Step 1: Install Dependencies

```bash
npm run install:all
```

### Step 2: Configure Environment Variables

```bash
cp server/.env.example server/.env
```

Update the MongoDB connection URL and JWT secret in the `.env` file.

### Step 3: Add Demo Data

```bash
npm run seed
```

This command creates sample users, companies, jobs, and applications in the database. It will clear existing data in the target database.

### Step 4: Start the Application

```bash
npm run dev
```

- Backend API: http://localhost:5000
- Frontend: http://localhost:5173

Open http://localhost:5173 in your browser.

## Production Setup

To run the application using a single server:

```bash
npm run build
```

Then start the server:

```bash
NODE_ENV=production JWT_SECRET=<your-secret> MONGO_URI=<your-uri> npm start
```

The Express server serves both the React frontend and API through the same port.

## Demo Login Credentials

After running the seed command, the following demo accounts are available:

| Role | Email | Password |
|---|---|---|
| Admin | admin@skillsync.dev | Admin123! |
| Company | priya@northwind.example | Password123! |
| Pending Company | sana@paperkite.example | Password123! |
| Recruiter | arjun@northwind.example | Password123! |
| Job Seeker | naga@skillsync.dev | Password123! |

The database also contains additional sample job seekers, 11 job listings, and 11 applications at different recruitment stages.

## Main Features and Workflow

### 1. Company Verification

When a company registers, its account is initially marked as pending. An administrator reviews the company details and either approves or rejects the registration.

Jobs posted by unapproved companies are not visible to job seekers. Rejected companies can update their information and submit it again for approval.

### 2. Application Management

Applications move through the following stages:

`Applied → Reviewing → Shortlisted → Interview → Offered → Hired`

Applications can also be rejected or withdrawn.

The system maintains application history, including status changes, timestamps, messages, and the person responsible for each update.

### 3. Skill Matching System

SkillSync compares the skills listed in a candidate's profile with the skills required for a job.

- Matched skills are displayed as filled chips.
- Missing skills are displayed as dashed chips.
- A percentage score indicates how closely the candidate matches the job requirements.

The match score is calculated when the candidate applies and saved with the application.

### 4. Notification System

Users receive notifications for important activities, such as:

- New job applications
- Application status updates
- Interview scheduling
- Company approval or rejection
- Recruiter registration
- Job removal and application withdrawal

Notifications are refreshed automatically every 30 seconds.

## API Endpoints

All API routes are available under `/api`.

Authentication uses a JWT Bearer token.

| Module | Main Endpoints |
|---|---|
| Authentication | `/auth/register`, `/auth/login`, `/auth/me` |
| Profile | `/profile`, `/profile/password` |
| Jobs | `/jobs`, `/jobs/:id`, `/jobs/summary` |
| Applications | `/jobs/:id/apply`, `/applications/mine` |
| Saved Jobs | `/jobs/:id/save`, `/jobs/saved` |
| Hiring Management | `/manage/jobs`, `/manage/applications`, `/manage/company` |
| Recruiters | `/manage/recruiters` |
| Administration | `/admin/stats`, `/admin/companies`, `/admin/users`, `/admin/jobs` |
| Notifications | `/notifications`, `/notifications/read-all` |

## Project Structure

```text
SkillSync/
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── utils/
│   │   ├── seed.js
│   │   ├── app.js
│   │   └── index.js
│   │
│   └── tests/
│       └── api.test.js
│
├── client/
│   └── src/
│       ├── pages/
│       ├── ui.jsx
│       ├── auth.jsx
│       ├── api.js
│       └── utils.js
│
└── package.json
```

## Running Tests

To execute all test suites:

```bash
npm test
```

For backend tests:

```bash
npm test --prefix server
```

For frontend tests:

```bash
npm test --prefix client
```

The backend tests check authentication, permissions, job searches, application workflows, company access restrictions, notifications, and administrative operations.

MongoDB must be running before executing the backend tests.

## Current Limitations

- Resume information is stored as links rather than uploaded files.
- Notifications use periodic polling instead of WebSockets.
- Email notifications are not implemented.
- Recruiters can access all jobs and applicants belonging to their company.
- Authentication tokens are stored in localStorage.
- Password reset emails and refresh tokens are not currently supported.
- Rate limiting is applied only to authentication routes.
- Google Fonts requires an internet connection; system fonts are used as a fallback.

## Conclusion

SkillSync provides a centralized job recruitment platform where candidates can discover opportunities based on their actual skills. By combining skill-based matching, application tracking, company verification, recruiter management, and administrative controls, the platform makes the recruitment process more organized and transparent.