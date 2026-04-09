const mongoose = require('mongoose');

const otpSessionSchema = new mongoose.Schema({
  request_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  mobile_no: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'failed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 900 // Auto-delete document after 15 minutes (900 seconds)
  }
});

module.exports = mongoose.model('OtpSession', otpSessionSchema);
