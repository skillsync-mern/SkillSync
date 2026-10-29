const router = require('express').Router();
const Job = require('../models/Job');
const Company = require('../models/Company');
const Application = require('../models/Application');
const User = require('../models/User');
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');
const { ah, parse, HttpError, escapeRegex, pageParams, paged, z } = require('../utils/http');
const { matchSkills } = require('../utils/skills');
const { notify, companyStaffIds } = require('../utils/notify');

router.param('id', (_req, _res, next, id) => (require('mongoose').isValidObjectId(id) ? next() : next(new HttpError(400, 'Invalid id'))));

const notExpired = { $or: [{ deadline: null }, { deadline: { $gte: new Date() } }] };

// Add match info / applied / saved flags for a signed-in job seeker.
async function decorate(jobs, user) {
  const plain = jobs.map((j) => (j.toObject ? j.toObject() : j));
  if (!user || user.role !== 'jobseeker') return plain;
  const apps = await Application.find({ applicant: user._id, job: { $in: plain.map((j) => j._id) } }).select('job status');
  const byJob = new Map(apps.map((a) => [String(a.job), a.status]));
  const saved = new Set(user.savedJobs.map(String));
  return plain.map((j) => ({
    ...j,
    match: matchSkills(j.skills, user.skills),
    applicationStatus: byJob.get(String(j._id)) || null,
    saved: saved.has(String(j._id)),
  }));
}

// Public numbers for the home page.
router.get(
  '/summary',
  ah(async (_req, res) => {
    const approved = await Company.find({ status: 'approved' }).distinct('_id');
    const openJobs = await Job.countDocuments({ status: 'open', company: { $in: approved }, ...notExpired });
    res.json({ openJobs, companies: approved.length });
  })
);

router.get(
  '/saved',
  authenticate,
  requireRole('jobseeker'),
  ah(async (req, res) => {
    const jobs = await Job.find({ _id: { $in: req.user.savedJobs }, status: { $ne: 'removed' } })
      .populate('company', 'name location industry')
      .sort({ createdAt: -1 });
    res.json({ items: await decorate(jobs, req.user) });
  })
);

router.get(
  '/',
  optionalAuth,
  ah(async (req, res) => {
    const { q, location, type, workMode, skills, minSalary, sort } = req.query;
    const approved = await Company.find({ status: 'approved' }).distinct('_id');
    const and = [{ status: 'open', company: { $in: approved } }, notExpired];

    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      and.push({ $or: [{ title: rx }, { description: rx }, { skills: rx }] });
    }
    if (location) and.push({ location: new RegExp(escapeRegex(location), 'i') });
    if (type) and.push({ type });
    if (workMode) and.push({ workMode });
    if (skills) {
      const list = String(skills).split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length) and.push({ skills: { $in: list.map((s) => new RegExp(`^${escapeRegex(s)}$`, 'i')) } });
    }
    if (minSalary && Number(minSalary) > 0) and.push({ salaryMax: { $gte: Number(minSalary) } });

    const p = pageParams(req.query);
    const order = sort === 'salary' ? { salaryMax: -1, createdAt: -1 } : { createdAt: -1 };
    const [jobs, total] = await Promise.all([
      Job.find({ $and: and }).populate('company', 'name location industry').sort(order).skip(p.skip).limit(p.limit),
      Job.countDocuments({ $and: and }),
    ]);
    res.json(paged(await decorate(jobs, req.user), total, p));
  })
);

router.get(
  '/:id',
  optionalAuth,
  ah(async (req, res) => {
    const job = await Job.findById(req.params.id).populate('company', 'name description website industry size location status');
    if (!job) throw new HttpError(404, 'Job not found');
    const u = req.user;
    const isStaff = u && ['company', 'recruiter'].includes(u.role) && String(u.company) === String(job.company._id);
    const isPublic = job.status === 'open' && job.company.status === 'approved' && (!job.deadline || job.deadline >= new Date());
    if (!isPublic && !isStaff && u?.role !== 'admin') {
      // Job seekers who already applied may still look at the posting.
      const applied = u?.role === 'jobseeker' && (await Application.exists({ job: job._id, applicant: u._id }));
      if (!applied) throw new HttpError(404, 'Job not found');
    }
    const [out] = await decorate([job], u);
    out.acceptingApplications = isPublic;
    res.json({ job: out });
  })
);

router.post(
  '/:id/save',
  authenticate,
  requireRole('jobseeker'),
  ah(async (req, res) => {
    const job = await Job.findById(req.params.id).select('_id');
    if (!job) throw new HttpError(404, 'Job not found');
    const has = req.user.savedJobs.some((id) => String(id) === String(job._id));
    await User.updateOne({ _id: req.user._id }, has ? { $pull: { savedJobs: job._id } } : { $addToSet: { savedJobs: job._id } });
    res.json({ saved: !has });
  })
);

router.post(
  '/:id/apply',
  authenticate,
  requireRole('jobseeker'),
  ah(async (req, res) => {
    const { coverLetter } = parse(z.object({ coverLetter: z.string().max(3000).optional() }), req.body);
    const job = await Job.findById(req.params.id).populate('company', 'name status');
    if (!job) throw new HttpError(404, 'Job not found');
    if (job.status !== 'open' || job.company.status !== 'approved') throw new HttpError(400, 'This job is not accepting applications');
    if (job.deadline && job.deadline < new Date()) throw new HttpError(400, 'The application deadline has passed');

    let application;
    try {
      application = await Application.create({
        job: job._id,
        applicant: req.user._id,
        company: job.company._id,
        coverLetter: coverLetter || '',
        matchScore: matchSkills(job.skills, req.user.skills).score,
        history: [{ status: 'applied', by: req.user._id }],
      });
    } catch (err) {
      if (err.code === 11000) throw new HttpError(409, 'You have already applied to this job');
      throw err;
    }

    await notify(await companyStaffIds(job.company._id), {
      type: 'application_received',
      title: `New application for ${job.title}`,
      message: `${req.user.name} applied (${application.matchScore}% skill match).`,
      link: '/manage/applicants',
    });
    res.status(201).json({ application });
  })
);

module.exports = router;
