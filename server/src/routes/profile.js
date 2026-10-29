const router = require('express').Router();
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { ah, parse, HttpError, z } = require('../utils/http');
const { normalizeSkills } = require('../utils/skills');

router.use(authenticate);

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  headline: z.string().trim().max(120).optional(),
  location: z.string().trim().max(80).optional(),
  bio: z.string().max(2000).optional(),
  skills: z.array(z.string().trim().max(40)).max(40).optional(),
  experienceYears: z.number().min(0).max(60).optional(),
  resumeUrl: z.union([z.string().trim().url().max(300), z.literal('')]).optional(),
});

router.patch(
  '/',
  ah(async (req, res) => {
    const data = parse(profileSchema, req.body);
    if (data.skills) data.skills = normalizeSkills(data.skills);
    // Only job seekers have a public candidate profile; everyone may rename themselves.
    if (req.user.role !== 'jobseeker') Object.keys(data).forEach((k) => k !== 'name' && delete data[k]);
    Object.assign(req.user, data);
    await req.user.save();
    res.json({ user: req.user });
  })
);

router.patch(
  '/password',
  ah(async (req, res) => {
    const { current, next } = parse(z.object({ current: z.string(), next: z.string().min(8).max(100) }), req.body);
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.checkPassword(current))) throw new HttpError(400, 'Current password is incorrect');
    user.password = next;
    await user.save();
    res.json({ ok: true });
  })
);

module.exports = router;
