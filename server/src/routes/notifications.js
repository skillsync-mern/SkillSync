const router = require('express').Router();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { authenticate } = require('../middleware/auth');
const { ah, HttpError, pageParams, paged } = require('../utils/http');

router.use(authenticate);

router.get(
  '/',
  ah(async (req, res) => {
    const p = pageParams(req.query, 20, 100);
    const filter = { user: req.user._id };
    const [items, total, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read: false }),
    ]);
    res.json({ ...paged(items, total, p), unread });
  })
);

router.post(
  '/read-all',
  ah(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ ok: true });
  })
);

router.post(
  '/:id/read',
  ah(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid id');
    const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true });
    if (!n) throw new HttpError(404, 'Notification not found');
    res.json({ notification: n });
  })
);

module.exports = router;
