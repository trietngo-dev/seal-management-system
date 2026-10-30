const mongoose = require('mongoose');

/**
 * Filter for exactly one rubric scope: a specific track of the round, or the
 * round-wide rubric when trackId is empty ({ trackId: null } also matches docs without the field).
 */
function rubricScopeFilter(roundId, trackId) {
  return { roundId, trackId: trackId || null };
}

/**
 * Active rubric that applies to a team on a track: the track's own rubric if one
 * exists, otherwise the round-wide rubric.
 */
async function findActiveRubric(roundId, trackId) {
  const Rubric = mongoose.model('Rubric');
  if (trackId) {
    const trackRubric = await Rubric.findOne({ ...rubricScopeFilter(roundId, trackId), isActive: true });
    if (trackRubric) return trackRubric;
  }
  return Rubric.findOne({ ...rubricScopeFilter(roundId, null), isActive: true });
}

module.exports = {
  rubricScopeFilter,
  findActiveRubric
};
