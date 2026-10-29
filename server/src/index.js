const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');

async function start() {
  await mongoose.connect(config.mongoUri);
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
app.listen(process.env.PORT || config.port, "0.0.0.0", () => {
  console.log(`SkillSync API listening on port ${process.env.PORT || config.port}`);
});}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
