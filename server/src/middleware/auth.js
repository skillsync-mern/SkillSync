const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { HttpError, ah } = require('../utils/http');

const sign = (user) => jwt.sign({ id: user._id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

async function userFromRequest(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const { id } = jwt.verify(header.slice(7), config.jwtSecret);
    const user = await User.findById(id);
    return user && user.active ? user : null;
  } catch {
    return null;
  }
}

const authenticate = ah(async (req, _res, next) => {
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, 'Please sign in to continue');
  req.user = user;
  next();
});

const optionalAuth = ah(async (req, _res, next) => {
  req.user = await userFromRequest(req);
  next();
});

const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'You do not have access to this'));

module.exports = { sign, authenticate, optionalAuth, requireRole };
