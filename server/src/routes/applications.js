const router = require('express').Router();
const mongoose = require('mongoose');
const Application = require('../models/Application');
const { authenticate, requireRole } = require('../middleware/auth');
const { ah, HttpError } = require('../utils/http');
const { notify, companyStaffIds } = require('../utils/notify');

router.use(authenticate, requireRole('jobseeker'));

router.get(
  '/mine',
  ah(async (req, res) => {
    const items = await Application.find({ applicant: req.user._id })
      .select('-notes')
      .populate('job', 'title location type workMode status')
      .populate('company', 'name')
      .sort({ updatedAt: -1 });
    res.json({ items });
  })
);

router.post(
  '/:id/withdraw',
  ah(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid id');
    const app = await Application.findOne({ _id: req.params.id, applicant: req.user._id }).populate('job', 'title postedBy');
    if (!app) throw new HttpError(404, 'Application not found');
    if (['hired', 'rejected', 'withdrawn'].includes(app.status)) throw new HttpError(400, `This application is already ${app.status}`);
    app.status = 'withdrawn';
    app.history.push({ status: 'withdrawn', by: req.user._id });
    await app.save();
    await notify(await companyStaffIds(app.company), {
      type: 'application_withdrawn',
      title: `Application withdrawn: ${app.job.title}`,
      message: `${req.user.name} withdrew their application.`,
      link: '/manage/applicants',
    });
    res.json({ application: app });
  })
);

module.exports = router;
