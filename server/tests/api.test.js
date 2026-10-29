const request = require('supertest');
const mongoose = require('mongoose');
const config = require('../src/config');
const app = require('../src/app');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const { seed, DEMO_PASSWORD } = require('../src/seed');

const api = () => request(app);
const login = async (email, password = DEMO_PASSWORD) => {
  const res = await api().post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token;
};
const auth = (t) => ({ Authorization: `Bearer ${t}` });

let t = {}; // tokens

beforeAll(async () => {
  expect(config.env).toBe('test');
  expect(mongoose.connection.readyState).toBe(0);
  await mongoose.connect(config.mongoUri);
  await seed();
  t.admin = await login(config.adminEmail, config.adminPassword);
  t.company = await login('priya@northwind.example');
  t.recruiter = await login('arjun@northwind.example');
  t.otherCompany = await login('meera@greenleaf.example');
  t.pendingCompany = await login('sana@paperkite.example');
  t.seeker = await login('naga@skillsync.dev');
  t.seeker2 = await login('rohit@skillsync.dev');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('auth', () => {
  test('registers a job seeker and returns a token', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'Test Seeker', email: 'New@Example.com', password: 'longenough1', role: 'jobseeker' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.user.password).toBeUndefined();
    const me = await api().get('/api/auth/me').set(auth(res.body.token));
    expect(me.body.user.role).toBe('jobseeker');
  });

  test('registering a company creates a pending company and notifies admins', async () => {
    const before = await Notification.countDocuments({ type: 'company_registered' });
    const res = await api().post('/api/auth/register').send({ name: 'Owner', email: 'owner@acme.example', password: 'longenough1', role: 'company', companyName: 'Acme' });
    expect(res.status).toBe(201);
    const me = await api().get('/api/auth/me').set(auth(res.body.token));
    expect(me.body.user.company.name).toBe('Acme');
    expect(me.body.user.company.status).toBe('pending');
    expect(await Notification.countDocuments({ type: 'company_registered' })).toBe(before + 1);
  });

  test('rejects duplicate emails, weak passwords, and company without a name', async () => {
    expect((await api().post('/api/auth/register').send({ name: 'Dup', email: 'naga@skillsync.dev', password: 'longenough1', role: 'jobseeker' })).status).toBe(409);
    expect((await api().post('/api/auth/register').send({ name: 'Weak', email: 'weak@example.com', password: 'short', role: 'jobseeker' })).status).toBe(400);
    expect((await api().post('/api/auth/register').send({ name: 'No Co', email: 'noco@example.com', password: 'longenough1', role: 'company' })).status).toBe(400);
  });

  test('users cannot register themselves as admin or recruiter', async () => {
    for (const role of ['admin', 'recruiter']) {
      const res = await api().post('/api/auth/register').send({ name: 'Sneaky', email: `${role}@sneaky.example`, password: 'longenough1', role });
      expect(res.status).toBe(400);
    }
  });

  test('login fails with wrong password and for deactivated users', async () => {
    expect((await api().post('/api/auth/login').send({ email: 'naga@skillsync.dev', password: 'wrong-password' })).status).toBe(401);
    await User.updateOne({ email: 'divya@skillsync.dev' }, { active: false });
    expect((await api().post('/api/auth/login').send({ email: 'divya@skillsync.dev', password: DEMO_PASSWORD })).status).toBe(403);
    await User.updateOne({ email: 'divya@skillsync.dev' }, { active: true });
  });

  test('protected routes need a valid token', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set(auth('garbage'))).status).toBe(401);
  });
});

describe('role-based access', () => {
  test('each role is blocked from the other portals', async () => {
    expect((await api().get('/api/manage/stats').set(auth(t.seeker))).status).toBe(403);
    expect((await api().get('/api/admin/stats').set(auth(t.company))).status).toBe(403);
    expect((await api().get('/api/applications/mine').set(auth(t.recruiter))).status).toBe(403);
    expect((await api().post('/api/manage/recruiters').set(auth(t.recruiter)).send({ name: 'X Y', email: 'x@y.example', password: 'longenough1' })).status).toBe(403);
  });
});

describe('public jobs', () => {
  test('lists only open jobs from approved companies', async () => {
    const res = await api().get('/api/jobs?limit=50');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(9); // 10 open seeded, 1 belongs to the pending company, 1 closed
    expect(res.body.items.every((j) => j.status === 'open' && j.company.name !== 'Paperkite Studio')).toBe(true);
  });

  test('searches and filters', async () => {
    expect((await api().get('/api/jobs?q=machine')).body.items.length).toBeGreaterThan(0);
    const remote = await api().get('/api/jobs?workMode=remote');
    expect(remote.body.items.every((j) => j.workMode === 'remote')).toBe(true);
    const bySkill = await api().get('/api/jobs?skills=docker,KUBERNETES');
    expect(bySkill.body.items.length).toBeGreaterThan(0);
    const pay = await api().get('/api/jobs?minSalary=3000000');
    expect(pay.body.items.every((j) => j.salaryMax >= 3000000)).toBe(true);
    const page = await api().get('/api/jobs?limit=3&page=2');
    expect(page.body.items).toHaveLength(3);
    expect(page.body.pages).toBe(3);
  });

  test('regex characters in search do not break the query', async () => {
    const res = await api().get('/api/jobs?q=' + encodeURIComponent('c++ (.*'));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  test('signed-in seekers get a skill match for every job', async () => {
    const res = await api().get('/api/jobs?q=MERN').set(auth(t.seeker));
    const job = res.body.items[0];
    expect(job.match.score).toBe(80); // 4 of 5 required skills
    expect(job.match.missing).toEqual(['REST']);
    const anon = await api().get('/api/jobs?q=MERN');
    expect(anon.body.items[0].match).toBeUndefined();
  });

  test('pending-company jobs are hidden from the public but visible to their company', async () => {
    const mine = await api().get('/api/manage/jobs').set(auth(t.pendingCompany));
    expect(mine.body.items).toHaveLength(1);
    const id = mine.body.items[0]._id;
    expect((await api().get(`/api/jobs/${id}`)).status).toBe(404);
    expect((await api().get(`/api/jobs/${id}`).set(auth(t.pendingCompany))).status).toBe(200);
    expect((await api().post(`/api/jobs/${id}/apply`).set(auth(t.seeker)).send({})).status).toBe(400);
  });

  test('bad ids return 400, unknown ids 404', async () => {
    expect((await api().get('/api/jobs/not-an-id')).status).toBe(400);
    expect((await api().get(`/api/jobs/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
  });

  test('summary counts open jobs and approved companies', async () => {
    const res = await api().get('/api/jobs/summary');
    expect(res.body).toEqual({ openJobs: 9, companies: 2 });
  });
});

describe('job seeker profile, saved jobs', () => {
  test('updates profile and normalises skills', async () => {
    const res = await api().patch('/api/profile').set(auth(t.seeker2)).send({ headline: 'DevOps lead', skills: ['Docker', ' docker ', 'Terraform', ''], experienceYears: 6 });
    expect(res.status).toBe(200);
    expect(res.body.user.skills).toEqual(['Docker', 'Terraform']);
    expect((await api().patch('/api/profile').set(auth(t.seeker2)).send({ resumeUrl: 'not a url' })).status).toBe(400);
  });

  test('company users cannot write candidate fields on their account', async () => {
    const res = await api().patch('/api/profile').set(auth(t.company)).send({ name: 'Priya N.', skills: ['Hacking'] });
    expect(res.body.user.name).toBe('Priya N.');
    expect(res.body.user.skills).toEqual([]);
  });

  test('saves and unsaves a job', async () => {
    const job = (await api().get('/api/jobs?q=Frontend')).body.items[0];
    expect((await api().post(`/api/jobs/${job._id}/save`).set(auth(t.seeker))).body.saved).toBe(true);
    const saved = await api().get('/api/jobs/saved').set(auth(t.seeker));
    expect(saved.body.items.map((j) => j._id)).toContain(job._id);
    expect((await api().post(`/api/jobs/${job._id}/save`).set(auth(t.seeker))).body.saved).toBe(false);
  });

  test('changes password only with the right current password', async () => {
    expect((await api().patch('/api/profile/password').set(auth(t.seeker2)).send({ current: 'nope-nope', next: 'brandnewpass1' })).status).toBe(400);
    expect((await api().patch('/api/profile/password').set(auth(t.seeker2)).send({ current: DEMO_PASSWORD, next: 'brandnewpass1' })).status).toBe(200);
    expect((await api().post('/api/auth/login').send({ email: 'rohit@skillsync.dev', password: 'brandnewpass1' })).status).toBe(200);
  });
});

describe('applications and the hiring pipeline', () => {
  let job;
  let applicationId;

  beforeAll(async () => {
    job = (await api().get('/api/jobs?q=Backend intern')).body.items[0];
  });

  test('seeker applies once; duplicates are rejected; staff are notified', async () => {
    const before = await Notification.countDocuments({ type: 'application_received' });
    const res = await api().post(`/api/jobs/${job._id}/apply`).set(auth(t.seeker2)).send({ coverLetter: 'Hello' });
    expect(res.status).toBe(201);
    applicationId = res.body.application._id;
    expect(res.body.application.status).toBe('applied');
    expect((await api().post(`/api/jobs/${job._id}/apply`).set(auth(t.seeker2)).send({})).status).toBe(409);
    // company owner + recruiter of Northwind
    expect(await Notification.countDocuments({ type: 'application_received' })).toBe(before + 2);
  });

  test('company staff see the applicant; other companies do not', async () => {
    const list = await api().get(`/api/manage/applications?job=${job._id}`).set(auth(t.recruiter));
    expect(list.body.items.map((a) => a._id)).toContain(applicationId);
    const other = await api().get(`/api/manage/applications?job=${job._id}`).set(auth(t.otherCompany));
    expect(other.body.total).toBe(0);
    expect((await api().get(`/api/manage/applications/${applicationId}`).set(auth(t.otherCompany))).status).toBe(404);
    expect((await api().patch(`/api/manage/applications/${applicationId}/status`).set(auth(t.otherCompany)).send({ status: 'reviewing' })).status).toBe(404);
  });

  test('status follows allowed transitions and notifies the applicant', async () => {
    const set = (body) => api().patch(`/api/manage/applications/${applicationId}/status`).set(auth(t.recruiter)).send(body);
    expect((await set({ status: 'hired' })).status).toBe(400); // cannot skip ahead
    expect((await set({ status: 'reviewing' })).status).toBe(200);
    expect((await set({ status: 'interview' })).status).toBe(400); // needs a date
    expect((await set({ status: 'interview', interviewAt: '2020-01-01T10:00:00Z' })).status).toBe(400); // past
    const future = new Date(Date.now() + 3 * 86400000).toISOString();
    const iv = await set({ status: 'interview', interviewAt: future });
    expect(iv.status).toBe(200);
    expect(iv.body.application.history.map((h) => h.status)).toEqual(['applied', 'reviewing', 'interview']);
    const seeker = await User.findOne({ email: 'rohit@skillsync.dev' });
    const n = await Notification.findOne({ user: seeker._id, title: 'Interview scheduled' });
    expect(n).toBeTruthy();
    expect((await set({ status: 'rejected', note: 'Went with another candidate' })).status).toBe(200);
    expect((await set({ status: 'reviewing' })).status).toBe(400); // rejected is final
  });

  test('internal notes are hidden from candidates', async () => {
    const note = await api().post(`/api/manage/applications/${applicationId}/notes`).set(auth(t.company)).send({ text: 'Strong DevOps background' });
    expect(note.status).toBe(201);
    expect(note.body.notes.at(-1).author.name).toBe('Priya N.');
    const mine = await api().get('/api/applications/mine').set(auth(t.seeker2));
    const app = mine.body.items.find((a) => a._id === applicationId);
    expect(app.status).toBe('rejected');
    expect(app.notes).toBeUndefined();
  });

  test('seeker withdraws an active application but not a finished one', async () => {
    const mine = await api().get('/api/applications/mine').set(auth(t.seeker));
    const active = mine.body.items.find((a) => a.status === 'applied');
    const res = await api().post(`/api/applications/${active._id}/withdraw`).set(auth(t.seeker));
    expect(res.body.application.status).toBe('withdrawn');
    expect((await api().post(`/api/applications/${active._id}/withdraw`).set(auth(t.seeker))).status).toBe(400);
    expect((await api().post(`/api/applications/${applicationId}/withdraw`).set(auth(t.seeker))).status).toBe(404); // not theirs
  });

  test('stats reflect the pipeline', async () => {
    const s = await api().get('/api/manage/stats').set(auth(t.company));
    expect(s.body.applications.total).toBeGreaterThan(0);
    expect(s.body.jobs.open).toBeGreaterThan(0);
    expect(s.body.recentApplications.length).toBeGreaterThan(0);
  });
});

describe('job management', () => {
  let jobId;
  const payload = { title: 'Site reliability engineer', description: 'Keep our services fast and available for thousands of users.', skills: ['Linux', 'linux', 'Go'], salaryMin: 100, salaryMax: 200 };

  test('recruiter creates a job for their company and it goes public', async () => {
    const res = await api().post('/api/manage/jobs').set(auth(t.recruiter)).send(payload);
    expect(res.status).toBe(201);
    jobId = res.body.job._id;
    expect(res.body.job.skills).toEqual(['Linux', 'Go']);
    expect((await api().get(`/api/jobs/${jobId}`)).status).toBe(200);
  });

  test('validates input', async () => {
    expect((await api().post('/api/manage/jobs').set(auth(t.company)).send({ title: 'x' })).status).toBe(400);
    expect((await api().post('/api/manage/jobs').set(auth(t.company)).send({ ...payload, salaryMin: 500, salaryMax: 100 })).status).toBe(400);
  });

  test('another company cannot edit or delete it', async () => {
    expect((await api().patch(`/api/manage/jobs/${jobId}`).set(auth(t.otherCompany)).send({ title: 'Hijacked' })).status).toBe(404);
    expect((await api().delete(`/api/manage/jobs/${jobId}`).set(auth(t.otherCompany))).status).toBe(404);
  });

  test('closing a job removes it from public listings and blocks applications', async () => {
    expect((await api().patch(`/api/manage/jobs/${jobId}`).set(auth(t.company)).send({ status: 'closed' })).status).toBe(200);
    expect((await api().get(`/api/jobs/${jobId}`)).status).toBe(404);
    expect((await api().post(`/api/jobs/${jobId}/apply`).set(auth(t.seeker)).send({})).status).toBe(400);
  });

  test('expired deadlines hide a job', async () => {
    await api().patch(`/api/manage/jobs/${jobId}`).set(auth(t.company)).send({ status: 'open', deadline: '2020-01-01' });
    expect((await api().get(`/api/jobs/${jobId}`)).status).toBe(404);
    await api().patch(`/api/manage/jobs/${jobId}`).set(auth(t.company)).send({ deadline: '' });
    expect((await api().get(`/api/jobs/${jobId}`)).status).toBe(200);
  });

  test('jobs without applications can be deleted; with applications they cannot', async () => {
    expect((await api().delete(`/api/manage/jobs/${jobId}`).set(auth(t.company))).status).toBe(200);
    const withApps = (await api().get('/api/manage/jobs').set(auth(t.company))).body.items.find((j) => j.applicantCount > 0);
    expect((await api().delete(`/api/manage/jobs/${withApps._id}`).set(auth(t.company))).status).toBe(409);
  });
});

describe('company and recruiter management', () => {
  test('company creates a recruiter who can sign in and deactivates them', async () => {
    const res = await api().post('/api/manage/recruiters').set(auth(t.company)).send({ name: 'New Hire', email: 'newhire@northwind.example', password: 'longenough1' });
    expect(res.status).toBe(201);
    expect(res.body.recruiter.company).toBeTruthy();
    const token = await login('newhire@northwind.example', 'longenough1');
    expect((await api().get('/api/manage/stats').set(auth(token))).status).toBe(200);
    expect((await api().patch(`/api/manage/recruiters/${res.body.recruiter._id}`).set(auth(t.company)).send({ active: false })).status).toBe(200);
    expect((await api().get('/api/manage/stats').set(auth(token))).status).toBe(401); // existing token dies with the account
    expect((await api().post('/api/manage/recruiters').set(auth(t.company)).send({ name: 'Dup', email: 'newhire@northwind.example', password: 'longenough1' })).status).toBe(409);
  });

  test('company edits its profile; recruiters cannot', async () => {
    expect((await api().patch('/api/manage/company').set(auth(t.company)).send({ description: 'Updated description' })).body.company.description).toBe('Updated description');
    expect((await api().patch('/api/manage/company').set(auth(t.recruiter)).send({ description: 'Nope' })).status).toBe(403);
    expect((await api().get('/api/manage/company').set(auth(t.recruiter))).status).toBe(200);
  });
});

describe('admin', () => {
  test('overview stats', async () => {
    const res = await api().get('/api/admin/stats').set(auth(t.admin));
    expect(res.body.users.jobseeker).toBeGreaterThanOrEqual(6);
    expect(res.body.companies.pending).toBeGreaterThanOrEqual(1);
    expect(res.body.jobs.open).toBeGreaterThan(0);
  });

  test('approving a company publishes its jobs and notifies the owner', async () => {
    const list = await api().get('/api/admin/companies?status=pending&q=paperkite').set(auth(t.admin));
    const company = list.body.items.find((c) => c.name === 'Paperkite Studio');
    expect(company.jobCount).toBe(1);
    expect((await api().patch(`/api/admin/companies/${company._id}/status`).set(auth(t.admin)).send({ status: 'approved' })).status).toBe(200);
    expect((await api().get('/api/jobs?q=Web designer')).body.total).toBe(1);
    const owner = await User.findOne({ email: 'sana@paperkite.example' });
    expect(await Notification.findOne({ user: owner._id, title: 'Your company is approved' })).toBeTruthy();
  });

  test('rejecting a company hides its jobs again; owner can resubmit', async () => {
    const company = (await api().get('/api/admin/companies?q=paperkite').set(auth(t.admin))).body.items[0];
    await api().patch(`/api/admin/companies/${company._id}/status`).set(auth(t.admin)).send({ status: 'rejected', reason: 'Missing website' });
    expect((await api().get('/api/jobs?q=Web designer')).body.total).toBe(0);
    expect((await api().post('/api/manage/company/resubmit').set(auth(t.pendingCompany))).body.company.status).toBe('pending');
    expect((await api().post('/api/manage/company/resubmit').set(auth(t.pendingCompany))).status).toBe(400);
  });

  test('removing a job takes it down and tells the poster; poster cannot revive it', async () => {
    const job = (await api().get('/api/jobs?q=Frontend developer')).body.items[0];
    expect((await api().patch(`/api/admin/jobs/${job._id}/status`).set(auth(t.admin)).send({ status: 'removed', reason: 'Duplicate posting' })).status).toBe(200);
    expect((await api().get(`/api/jobs/${job._id}`)).status).toBe(404);
    expect(await Notification.findOne({ type: 'job_removed', user: job.postedBy })).toBeTruthy();
    expect((await api().patch(`/api/manage/jobs/${job._id}`).set(auth(t.company)).send({ status: 'open' })).status).toBe(403);
  });

  test('deactivating a user locks them out; admins cannot be deactivated', async () => {
    const users = await api().get('/api/admin/users?q=ananya').set(auth(t.admin));
    const ananya = users.body.items[0];
    const token = await login('ananya@skillsync.dev');
    expect((await api().patch(`/api/admin/users/${ananya._id}`).set(auth(t.admin)).send({ active: false })).status).toBe(200);
    expect((await api().get('/api/auth/me').set(auth(token))).status).toBe(401);
    const admin = (await api().get('/api/admin/users?role=admin').set(auth(t.admin))).body.items[0];
    expect((await api().patch(`/api/admin/users/${admin._id}`).set(auth(t.admin)).send({ active: false })).status).toBe(400);
  });
});

describe('notifications', () => {
  test('lists, counts unread, and marks read', async () => {
    const list = await api().get('/api/notifications').set(auth(t.seeker));
    expect(list.body.unread).toBeGreaterThan(0);
    const first = list.body.items[0];
    await api().post(`/api/notifications/${first._id}/read`).set(auth(t.seeker));
    const after = await api().get('/api/notifications').set(auth(t.seeker));
    expect(after.body.unread).toBe(list.body.unread - 1);
    await api().post('/api/notifications/read-all').set(auth(t.seeker));
    expect((await api().get('/api/notifications').set(auth(t.seeker))).body.unread).toBe(0);
  });

  test("a user cannot read someone else's notification", async () => {
    const adminList = await api().get('/api/notifications').set(auth(t.admin));
    expect((await api().post(`/api/notifications/${adminList.body.items[0]._id}/read`).set(auth(t.seeker))).status).toBe(404);
  });
});
