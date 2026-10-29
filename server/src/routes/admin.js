const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const Job = require('../models/Job');
const Application = require('../models/Application');
const { authenticate, requireRole } = require('../middleware/auth');
const { ah, parse, HttpError, escapeRegex, pageParams, paged, z } = require('../utils/http');
const { notify } = require('../utils/notify');

router.use(authenticate, requireRole('admin'));
router.param('id', (_req, _res, next, id) => (mongoose.isValidObjectId(id) ? next() : next(new HttpError(400, 'Invalid id'))));

const group = async (Model, field) => {
  const rows = await Model.aggregate([{ $group: { _id: `$${field}`, n: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
};

router.get(
  '/stats',
  ah(async (_req, res) => {
    const [users, companies, jobs, applications] = await Promise.all([
      group(User, 'role'),
      group(Company, 'status'),
      group(Job, 'status'),
      group(Application, 'status'),
    ]);
    const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    res.json({
      users: { ...users, total: sum(users) },
      companies: { ...companies, total: sum(companies) },
      jobs: { ...jobs, total: sum(jobs) },
      applications: { ...applications, total: sum(applications) },
    });
  })
);

/* ----------------------------- companies ----------------------------- */
router.get(
  '/companies',
  ah(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) filter.name = new RegExp(escapeRegex(req.query.q), 'i');
    const p = pageParams(req.query, 20);
    const [companies, total] = await Promise.all([
      Company.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('owner', 'name email'),
      Company.countDocuments(filter),
    ]);
    const counts = await Job.aggregate([{ $match: { company: { $in: companies.map((c) => c._id) } } }, { $group: { _id: '$company', n: { $sum: 1 } } }]);
    const byCompany = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json(paged(companies.map((c) => ({ ...c.toObject(), jobCount: byCompany.get(String(c._id)) || 0 })), total, p));
  })
);

router.patch(
  '/companies/:id/status',
  ah(async (req, res) => {
    const { status, reason } = parse(z.object({ status: z.enum(['approved', 'rejected', 'pending']), reason: z.string().max(300).optional() }), req.body);
    const company = await Company.findById(req.params.id);
    if (!company) throw new HttpError(404, 'Company not found');
    company.status = status;
    company.statusReason = status === 'rejected' ? reason : undefined;
    await company.save();
    if (status !== 'pending') {
      await notify(company.owner, {
        type: 'company_review',
        title: status === 'approved' ? 'Your company is approved' : 'Your company was not approved',
        message:
          status === 'approved'
            ? `${company.name} can now publish jobs that candidates can see.`
            : `${company.name} was rejected${reason ? `: ${reason}` : '.'} Update your profile and resubmit.`,
        link: '/manage/company',
      });
    }
    res.json({ company });
  })
);

/* ------------------------------- users ------------------------------- */
router.get(
  '/users',
  ah(async (req, res) => {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(req.query.q), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const p = pageParams(req.query, 20);
    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('company', 'name'),
      User.countDocuments(filter),
    ]);
    res.json(paged(items, total, p));
  })
);

router.patch(
  '/users/:id',
  ah(async (req, res) => {
    const { active } = parse(z.object({ active: z.boolean() }), req.body);
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    if (user.role === 'admin') throw new HttpError(400, 'Administrator accounts cannot be deactivated here');
    user.active = active;
    await user.save();
    res.json({ user });
  })
);

/* -------------------------------- jobs -------------------------------- */
router.get(
  '/jobs',
  ah(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) filter.title = new RegExp(escapeRegex(req.query.q), 'i');
    const p = pageParams(req.query, 20);
    const [items, total] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('company', 'name status'),
      Job.countDocuments(filter),
    ]);
    res.json(paged(items, total, p));
  })
);

router.patch(
  '/jobs/:id/status',
  ah(async (req, res) => {
    const { status, reason } = parse(z.object({ status: z.enum(['open', 'closed', 'removed']), reason: z.string().max(300).optional() }), req.body);
    const job = await Job.findById(req.params.id);
    if (!job) throw new HttpError(404, 'Job not found');
    job.status = status;
    await job.save();
    if (status === 'removed') {
      await notify(job.postedBy, {
        type: 'job_removed',
        title: `Job removed: ${job.title}`,
        message: reason ? `An administrator removed this job: ${reason}` : 'An administrator removed this job.',
        link: '/manage/jobs',
      });
    }
    res.json({ job });
  })
);

module.exports = router;
