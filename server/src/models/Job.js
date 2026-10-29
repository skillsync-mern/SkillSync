const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true, maxlength: 8000 },
    location: { type: String, trim: true, maxlength: 80, default: 'Remote' },
    type: { type: String, enum: ['full-time', 'part-time', 'contract', 'internship'], default: 'full-time' },
    workMode: { type: String, enum: ['onsite', 'remote', 'hybrid'], default: 'onsite' },
    skills: [String],
    experienceMin: { type: Number, min: 0, default: 0 },
    salaryMin: { type: Number, min: 0 },
    salaryMax: { type: Number, min: 0 },
    currency: { type: String, default: 'INR', maxlength: 3 },
    deadline: { type: Date },
    // draft: hidden; open: public; closed: no new applications; removed: taken down by an admin
    status: { type: String, enum: ['draft', 'open', 'closed', 'removed'], default: 'open', index: true },
  },
  { timestamps: true }
);

jobSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Job', jobSchema);
