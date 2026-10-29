const router = require('express').Router();
const User = require('../models/User');
const Company = require('../models/Company');
const { authenticate, sign } = require('../middleware/auth');
const { ah, parse, HttpError, z } = require('../utils/http');
const { notify, adminIds } = require('../utils/notify');

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    password: z.string().min(8, 'must be at least 8 characters').max(100),
    role: z.enum(['jobseeker', 'company']),
    companyName: z.string().trim().min(2).max(100).optional(),
    industry: z.string().trim().max(80).optional(),
    location: z.string().trim().max(80).optional(),
  })
  .refine((d) => d.role !== 'company' || d.companyName, { message: 'Company name is required', path: ['companyName'] });

router.post(
  '/register',
  ah(async (req, res) => {
    const data = parse(registerSchema, req.body);
    if (await User.exists({ email: data.email.toLowerCase() })) throw new HttpError(409, 'An account with this email already exists');

    const user = await User.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      location: data.role === 'jobseeker' ? data.location : undefined,
    });

    if (data.role === 'company') {
      const company = await Company.create({
        name: data.companyName,
        industry: data.industry,
        location: data.location,
        owner: user._id,
      });
      user.company = company._id;
      await user.save();
      await notify(await adminIds(), {
        type: 'company_registered',
        title: 'New company awaiting approval',
        message: `${company.name} has registered and needs review.`,
        link: '/admin/companies',
      });
    }

    res.status(201).json({ token: sign(user), user });
  })
);

router.post(
  '/login',
  ah(async (req, res) => {
    const { email, password } = parse(z.object({ email: z.string().trim().email(), password: z.string().min(1) }), req.body);
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.checkPassword(password))) throw new HttpError(401, 'Incorrect email or password');
    if (!user.active) throw new HttpError(403, 'This account has been deactivated');
    res.json({ token: sign(user), user });
  })
);

router.get(
  '/me',
  authenticate,
  ah(async (req, res) => {
    await req.user.populate('company', 'name status statusReason');
    res.json({ user: req.user });
  })
);

module.exports = router;
