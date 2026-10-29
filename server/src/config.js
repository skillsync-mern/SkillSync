require('dotenv').config({ quiet: true });

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  port: Number(process.env.PORT) || 5000,
  mongoUri:
    env === 'test'
      ? process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/skillsync_test'
      : process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/skillsync',
  jwtSecret: process.env.JWT_SECRET || (env === 'production' ? null : 'dev-only-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@skillsync.dev',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin123!',
};

if (!config.jwtSecret) throw new Error('JWT_SECRET must be set in production');

module.exports = config;
