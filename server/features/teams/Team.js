const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TeamSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  trackId: { type: Schema.Types.ObjectId, ref: 'Track' },
  originalTrackId: { type: Schema.Types.ObjectId, ref: 'Track' },
  leaderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  currentRoundId: { type: Schema.Types.ObjectId, ref: 'Round' },
  name: { type: String, required: true },
  status: { type: String, enum: ['pending_confirm', 'confirmed', 'disqualified'], default: 'pending_confirm' },
  disqualifyReason: { type: String },
  topicSubmission: { type: Schema.Types.Mixed, default: {} },
  mentorId: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

TeamSchema.index({ eventId: 1, trackId: 1, name: 1 }, { unique: true });
TeamSchema.index({ leaderId: 1 });
TeamSchema.index({ status: 1 });

module.exports = mongoose.model('Team', TeamSchema);