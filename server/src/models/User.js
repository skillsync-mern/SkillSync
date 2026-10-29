const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['jobseeker', 'company', 'recruiter', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    active: { type: Boolean, default: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    // job seeker profile
    headline: { type: String, trim: true, maxlength: 120 },
    location: { type: String, trim: true, maxlength: 80 },
    bio: { type: String, maxlength: 2000 },
    skills: [String],
    experienceYears: { type: Number, min: 0, max: 60, default: 0 },
    resumeUrl: { type: String, trim: true, maxlength: 300 },
    savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }],
  },
  { timestamps: true }
);

userSchema.pre('save', async function hash() {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
