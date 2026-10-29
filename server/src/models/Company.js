const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 3000, default: '' },
    website: { type: String, trim: true, maxlength: 200 },
    industry: { type: String, trim: true, maxlength: 80 },
    size: { type: String, enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'], default: '1-10' },
    location: { type: String, trim: true, maxlength: 80 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    statusReason: { type: String, maxlength: 300 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
