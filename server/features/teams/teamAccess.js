const mongoose = require('mongoose');

const STAFF_EVENT_ROLES = ['admin_view', 'student_assistant'];

/**
 * Describes how a user relates to a team, so routes can gate team-scoped data
 * (commits, AI reviews, tasks) and actions (manual sync, AI re-runs).
 * AI reviews carry suggested scores and judge questions, so they must never be
 * readable by participants of another team.
 */
async function getTeamAccess(user, team) {
  if (user.isSystemAdmin || user.isStudentAssistant) {
    return { isStaff: true, isJudge: false, isMentor: false, isMember: false };
  }

  const EventRole = mongoose.model('EventRole');
  const TeamMember = mongoose.model('TeamMember');
  const [roles, membership] = await Promise.all([
    EventRole.find({ userId: user._id, eventId: team.eventId, status: 'active' }).select('role').lean(),
    TeamMember.exists({ teamId: team._id, userId: user._id }),
  ]);
  const hasRole = (role) => roles.some((r) => r.role === role);

  return {
    isStaff: roles.some((r) => STAFF_EVENT_ROLES.includes(r.role)),
    // Judge track scoping depends on the round (the final round opens every team),
    // so any active judge of the event may read team data.
    isJudge: hasRole('judge'),
    isMentor: hasRole('mentor') || (!!team.mentorId && team.mentorId.toString() === user._id.toString()),
    isMember: !!membership,
  };
}

/**
 * Loads a team and checks that the user holds at least one of the allowed relations
 * ('staff' | 'judge' | 'mentor' | 'member'). Sends the error response itself and
 * returns null when the team is missing or access is denied.
 */
async function loadTeamForUser(req, res, teamId, allowed) {
  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    res.status(400).json({ message: 'teamId không hợp lệ.' });
    return null;
  }

  const team = await mongoose.model('Team').findById(teamId);
  if (!team) {
    res.status(404).json({ message: 'Không tìm thấy đội thi.' });
    return null;
  }

  const access = await getTeamAccess(req.user, team);
  const granted =
    access.isStaff ||
    (allowed.includes('judge') && access.isJudge) ||
    (allowed.includes('mentor') && access.isMentor) ||
    (allowed.includes('member') && access.isMember);

  if (!granted) {
    res.status(403).json({ message: 'Bạn không có quyền truy cập dữ liệu của đội thi này.' });
    return null;
  }

  return team;
}

/**
 * True when the user is a system admin/CTSV or holds a staff role in the event.
 */
async function isEventStaff(user, eventId) {
  if (user.isSystemAdmin || user.isStudentAssistant) return true;
  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) return false;
  return !!(await mongoose.model('EventRole').exists({
    userId: user._id,
    eventId,
    role: { $in: STAFF_EVENT_ROLES },
    status: 'active',
  }));
}

/**
 * The judge's assignment for one round. A judge holds one EventRole per round
 * (e.g. track A in the qualifier and the final track), so the role must be matched
 * to the round's tracks rather than taken at random. Falls back to a round-wide
 * role (no track); returns null when the judge has nothing in this round.
 */
async function findJudgeRoleForRound(userId, eventId, roundId) {
  const roles = await mongoose.model('EventRole').find({
    userId,
    eventId,
    role: 'judge',
    status: 'active',
  }).lean();
  if (!roundId) return roles.find((r) => !r.trackId) || null;

  const roundTrackIds = (await mongoose.model('Track').find({ roundId }).select('_id').lean())
    .map((t) => t._id.toString());
  return roles.find((r) => r.trackId && roundTrackIds.includes(r.trackId.toString()))
    || roles.find((r) => !r.trackId && (!r.roundId || r.roundId.toString() === roundId.toString()))
    || null;
}

module.exports = {
  getTeamAccess,
  loadTeamForUser,
  isEventStaff,
  findJudgeRoleForRound,
};
