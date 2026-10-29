// Hiring workspace shared by company owners and recruiters.
// Everything is scoped to req.user.company, so recruiters of one company can never see another's data.
const router = require('express').Router();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const Company = require('../models/Company');
const User = require('../models/User');
const Application = require('../models/Application');
const { TRANSITIONS } = require('../models/Application');
const { authenticate, requireRole } = require('../middleware/auth');
const { ah, parse, HttpError, escapeRegex, pageParams, paged, z } = require('../utils/http');
const { matchSkills, normalizeSkills } = require('../utils/skills');
const { notify, adminIds } = require('../utils/notify');

router.use(authenticate, requireRole('company', 'recruiter'), (req, _res, next) => {
  if (!req.user.company) return next(new HttpError(403, 'Your account is not linked to a company'));
  req.companyId = req.user.company;
  next();
});

router.param('id', (_req, _res, next, id) => (mongoose.isValidObjectId(id) ? next() : next(new HttpError(400, 'Invalid id'))));

const applicantFields = 'name email headline skills location experienceYears resumeUrl';

/* ------------------------------ overview ------------------------------ */
router.get(
  '/stats',
  ah(async (req, res) => {
    const company = new mongoose.Types.ObjectId(req.companyId);
    const [jobRows, appRows, recent, companyDoc] = await Promise.all([
      Job.aggregate([{ $match: { company } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      Application.aggregate([{ $match: { company } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      Application.find({ company }).select('-notes').sort({ createdAt: -1 }).limit(5).populate('applicant', 'name headline').populate('job', 'title'),
      Company.findById(company).select('name status statusReason'),
    ]);
    const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
    const jobs = toMap(jobRows);
    const byStatus = toMap(appRows);
    res.json({
      company: companyDoc,
      jobs: { ...jobs, total: Object.values(jobs).reduce((a, b) => a + b, 0) },
      applications: { byStatus, total: Object.values(byStatus).reduce((a, b) => a + b, 0) },
      recentApplications: recent,
    });
  })
);

/* -------------------------------- jobs -------------------------------- */
const jobBase = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20, 'must be at least 20 characters').max(8000),
  location: z.string().trim().max(80).optional(),
  type: z.enum(['full-time', 'part-time', 'contract', 'internship']).optional(),
  workMode: z.enum(['onsite', 'remote', 'hybrid']).optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(25).optional(),
  experienceMin: z.number().min(0).max(50).optional(),
  salaryMin: z.number().min(0).nullable().optional(),
  salaryMax: z.number().min(0).nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  deadline: z.union([z.coerce.date(), z.null(), z.literal('')]).optional(),
  status: z.enum(['draft', 'open', 'closed']).optional(),
});
const salaryOk = (d) => d.salaryMin == null || d.salaryMax == null || d.salaryMax >= d.salaryMin;
const createJobSchema = jobBase.refine(salaryOk, { message: 'Maximum salary must be at least the minimum', path: ['salaryMax'] });
const updateJobSchema = jobBase.partial().refine(salaryOk, { message: 'Maximum salary must be at least the minimum', path: ['salaryMax'] });

function cleanJobData(d) {
  const out = { ...d };
  if (out.skills) out.skills = normalizeSkills(out.skills);
  if (out.deadline === '') out.deadline = null;
  return out;
}

router.get(
  '/jobs',
  ah(async (req, res) => {
    const filter = { company: req.companyId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) filter.title = new RegExp(escapeRegex(req.query.q), 'i');
    const jobs = await Job.find(filter).sort({ createdAt: -1 }).populate('postedBy', 'name');
    const counts = await Application.aggregate([
      { $match: { job: { $in: jobs.map((j) => j._id) } } },
      { $group: { _id: '$job', n: { $sum: 1 } } },
    ]);
    const byJob = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json({ items: jobs.map((j) => ({ ...j.toObject(), applicantCount: byJob.get(String(j._id)) || 0 })) });
  })
);

router.post(
  '/jobs',
  ah(async (req, res) => {
    const data = cleanJobData(parse(createJobSchema, req.body));
    const job = await Job.create({ ...data, company: req.companyId, postedBy: req.user._id });
    res.status(201).json({ job });
  })
);

async function ownJob(req) {
  const job = await Job.findOne({ _id: req.params.id, company: req.companyId });
  if (!job) throw new HttpError(404, 'Job not found');
  return job;
}

router.patch(
  '/jobs/:id',
  ah(async (req, res) => {
    const job = await ownJob(req);
    if (job.status === 'removed') throw new HttpError(403, 'This job was removed by an administrator');
    Object.assign(job, cleanJobData(parse(updateJobSchema, req.body)));
    if (!salaryOk(job)) throw new HttpError(400, 'salaryMax: Maximum salary must be at least the minimum');
    await job.save();
    res.json({ job });
  })
);

router.delete(
  '/jobs/:id',
  ah(async (req, res) => {
    const job = await ownJob(req);
    if (await Application.exists({ job: job._id })) throw new HttpError(409, 'This job has applications. Close it instead of deleting it.');
    await job.deleteOne();
    res.json({ ok: true });
  })
);

/* ---------------------------- applications ---------------------------- */
router.get(
  '/applications',
  ah(async (req, res) => {
    const { job, status, q } = req.query;
    const filter = { company: req.companyId };
    if (job) {
      if (!mongoose.isValidObjectId(job)) throw new HttpError(400, 'Invalid job');
      filter.job = job;
    }
    if (status) filter.status = status;
    if (q) {
      const ids = await User.find({ role: 'jobseeker', name: new RegExp(escapeRegex(q), 'i') }).distinct('_id');
      filter.applicant = { $in: ids };
    }
    const p = pageParams(req.query, 12);
    const [items, total] = await Promise.all([
      Application.find(filter)
        .select('-notes -history')
        .sort({ createdAt: -1 })
        .skip(p.skip)
        .limit(p.limit)
        .populate('applicant', applicantFields)
        .populate('job', 'title'),
      Application.countDocuments(filter),
    ]);
    res.json(paged(items, total, p));
  })
);

async function ownApplication(req) {
  const app = await Application.findOne({ _id: req.params.id, company: req.companyId })
    .populate('applicant', `${applicantFields} bio`)
    .populate('job', 'title skills')
    .populate('company', 'name')
    .populate('notes.author', 'name role')
    .populate('history.by', 'name role');
  if (!app) throw new HttpError(404, 'Application not found');
  return app;
}

router.get(
  '/applications/:id',
  ah(async (req, res) => {
    const app = await ownApplication(req);
    res.json({ application: app, match: matchSkills(app.job.skills, app.applicant.skills) });
  })
);

const STATUS_MESSAGES = {
  reviewing: 'Your application is being reviewed',
  shortlisted: 'You have been shortlisted',
  interview: 'Interview scheduled',
  offered: 'You have received an offer',
  hired: 'Congratulations, you are hired',
  rejected: 'Update on your application',
};

router.patch(
  '/applications/:id/status',
  ah(async (req, res) => {
    const { status, note, interviewAt } = parse(
      z.object({
        status: z.enum(['reviewing', 'shortlisted', 'interview', 'offered', 'hired', 'rejected']),
        note: z.string().max(500).optional(),
        interviewAt: z.coerce.date().optional(),
      }),
      req.body
    );
    const app = await ownApplication(req);
    if (!TRANSITIONS[app.status].includes(status)) {
      throw new HttpError(400, `An application that is ${app.status} cannot move to ${status}`);
    }
    if (status === 'interview') {
      if (!interviewAt) throw new HttpError(400, 'interviewAt: choose a date and time for the interview');
      if (interviewAt < new Date()) throw new HttpError(400, 'interviewAt: the interview must be in the future');
      app.interviewAt = interviewAt;
    }
    app.status = status;
    app.history.push({ status, by: req.user._id, note });
    await app.save();

    const when = status === 'interview' ? ` on ${app.interviewAt.toUTCString()}` : '';
    await notify(app.applicant._id, {
      type: 'application_status',
      title: STATUS_MESSAGES[status],
      message: `${app.job.title} at ${app.company.name}${when}.${note ? ` Note: ${note}` : ''}`,
      link: '/dashboard',
    });
    res.json({ application: app });
  })
);

router.post(
  '/applications/:id/notes',
  ah(async (req, res) => {
    const { text } = parse(z.object({ text: z.string().trim().min(1).max(1000) }), req.body);
    const app = await ownApplication(req);
    app.notes.push({ author: req.user._id, text });
    await app.save();
    await app.populate('notes.author', 'name role');
    res.status(201).json({ notes: app.notes });
  })
);

/* ------------------------------- company ------------------------------- */
router.get(
  '/company',
  ah(async (req, res) => {
    res.json({ company: await Company.findById(req.companyId) });
  })
);

router.patch(
  '/company',
  requireRole('company'),
  ah(async (req, res) => {
    const data = parse(
      z.object({
        name: z.string().trim().min(2).max(100).optional(),
        description: z.string().max(3000).optional(),
        website: z.union([z.string().trim().url().max(200), z.literal('')]).optional(),
        industry: z.string().trim().max(80).optional(),
        size: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).optional(),
        location: z.string().trim().max(80).optional(),
      }),
      req.body
    );
    const company = await Company.findByIdAndUpdate(req.companyId, data, { new: true });
    res.json({ company });
  })
);

router.post(
  '/company/resubmit',
  requireRole('company'),
  ah(async (req, res) => {
    const company = await Company.findById(req.companyId);
    if (company.status !== 'rejected') throw new HttpError(400, 'Only rejected companies can be resubmitted');
    company.status = 'pending';
    company.statusReason = undefined;
    await company.save();
    await notify(await adminIds(), {
      type: 'company_registered',
      title: 'Company resubmitted for approval',
      message: `${company.name} updated its profile and asked for another review.`,
      link: '/admin/companies',
    });
    res.json({ company });
  })
);

/* ------------------------------ recruiters ------------------------------ */
router.get(
  '/recruiters',
  requireRole('company'),
  ah(async (req, res) => {
    res.json({ items: await User.find({ company: req.companyId, role: 'recruiter' }).sort({ createdAt: -1 }) });
  })
);

router.post(
  '/recruiters',
  requireRole('company'),
  ah(async (req, res) => {
    const data = parse(
      z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email(), password: z.string().min(8).max(100) }),
      req.body
    );
    if (await User.exists({ email: data.email.toLowerCase() })) throw new HttpError(409, 'An account with this email already exists');
    const recruiter = await User.create({ ...data, role: 'recruiter', company: req.companyId });
    await notify(recruiter._id, {
      type: 'welcome',
      title: 'Welcome to SkillSync',
      message: `${req.user.name} added you as a recruiter.`,
      link: '/manage',
    });
    res.status(201).json({ recruiter });
  })
);

router.patch(
  '/recruiters/:id',
  requireRole('company'),
  ah(async (req, res) => {
    const { active } = parse(z.object({ active: z.boolean() }), req.body);
    const recruiter = await User.findOneAndUpdate({ _id: req.params.id, company: req.companyId, role: 'recruiter' }, { active }, { new: true });
    if (!recruiter) throw new HttpError(404, 'Recruiter not found');
    res.json({ recruiter });
  })
);

module.exports = router;
