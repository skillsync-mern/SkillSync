const Notification = require('../models/Notification');
const User = require('../models/User');

// Create one notification per distinct recipient. Never throws: a failed
// notification must not fail the action that triggered it.
async function notify(userIds, { type, title, message = '', link }) {
  try {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String))];
    if (!ids.length) return;
    await Notification.insertMany(ids.map((user) => ({ user, type, title, message, link })));
  } catch (err) {
    console.error('notify failed:', err.message);
  }
}

// Active company owner + recruiters of a company.
async function companyStaffIds(companyId) {
  const users = await User.find({ company: companyId, role: { $in: ['company', 'recruiter'] }, active: true }).select('_id');
  return users.map((u) => u._id);
}

async function adminIds() {
  const users = await User.find({ role: 'admin', active: true }).select('_id');
  return users.map((u) => u._id);
}

module.exports = { notify, companyStaffIds, adminIds };
