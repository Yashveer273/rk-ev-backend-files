const mongoose = require('mongoose');

const privacyFeedbackSchema = new mongoose.Schema(
  {
    investorId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    submittedDate: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PrivacyFeedback', privacyFeedbackSchema);