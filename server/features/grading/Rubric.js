const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const RubricSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    trackId: { type: Schema.Types.ObjectId, ref: "Track" },
    roundId: { type: Schema.Types.ObjectId, ref: "Round", required: true },
    name: { type: String, required: true },
    description: { type: String },
    totalWeight: { type: Number, default: 100 },
    maxCriterionScore: { type: Number, default: 10 },
    version: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    isLocked: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    lockedBy: { type: Schema.Types.ObjectId, ref: "User" },
    lockedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

// One active rubric per scope: round-wide (no trackId) or per track within the round.
RubricSchema.index(
  { roundId: 1, trackId: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  },
);

RubricSchema.index({ eventId: 1, trackId: 1, roundId: 1 });

module.exports = mongoose.model("Rubric", RubricSchema);
