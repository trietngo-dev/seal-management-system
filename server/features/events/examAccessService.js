const mongoose = require('mongoose');

const Track = mongoose.model('Track');
const Team = mongoose.model('Team');
const TeamMember = mongoose.model('TeamMember');
const User = mongoose.model('User');
const Round = mongoose.model('Round');

/**
 * Parse Google Drive URL → file/folder ID.
 */
function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/, // Generically matches document/d, spreadsheets/d, etc.
    /[?&]id=([a-zA-Z0-9_-]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function buildDriveUrl(fileId) {
  if (!fileId) return null;
  return `https://drive.google.com/open?id=${fileId}`;
}

/**
 * Confirmed team members in tracks belonging to this round.
 */
async function getEligibleEmailsForRound(roundId) {
  const tracks = await Track.find({ roundId }).select('_id');
  if (!tracks.length) return [];

  const trackIds = tracks.map((t) => t._id);
  const teams = await Team.find({ trackId: { $in: trackIds }, status: 'confirmed' }).select('_id');
  if (!teams.length) return [];

  const teamIds = teams.map((t) => t._id);
  const members = await TeamMember.find({
    teamId: { $in: teamIds },
    confirmStatus: 'confirmed'
  }).populate('userId', 'email isActive');

  const emails = new Set();
  for (const member of members) {
    if (member.userId?.isActive && member.userId.email) {
      emails.add(member.userId.email.toLowerCase().trim());
    }
  }
  return Array.from(emails);
}

async function getEligibleUserIdsForRound(roundId) {
  const tracks = await Track.find({ roundId }).select('_id');
  const trackIds = tracks.map((t) => t._id);
  const teams = await Team.find({ trackId: { $in: trackIds }, status: 'confirmed' }).select('_id');
  const teamIds = teams.map((t) => t._id);
  const members = await TeamMember.find({
    teamId: { $in: teamIds },
    confirmStatus: 'confirmed'
  }).populate('userId', 'isActive');

  const ids = new Set();
  for (const member of members) {
    if (member.userId?.isActive) ids.add(member.userId._id.toString());
  }
  return Array.from(ids);
}

function isRoundExamOpen(round) {
  // Phòng thi mở khi có link Drive (id hoặc url) và đã đến giờ hoặc được mở thủ công.
  // Chưa cấu hình giờ mở thì đề vẫn khóa cho đến khi admin bấm "Mở vòng & đề bài".
  const hasMaterial = !!(round?.driveFileId || round?.driveFileUrl);
  if (!hasMaterial) return false;
  if (round?.isExamManualOpen || round?.status === 'active') return true;
  if (!round.startTime) return false;
  return new Date() >= new Date(round.startTime);
}

/**
 * Sanitize round for participant API.
 * Chỉ expose driveFileUrl khi đề đã mở — không lộ link khi chưa đến giờ.
 */
function sanitizeRoundForParticipant(round) {
  if (!round) return null;
  const plain = round.toObject ? round.toObject() : { ...round };
  const opened = isRoundExamOpen(plain);

  return {
    _id: plain._id,
    name: plain.name,
    order: plain.order,
    status: plain.status,
    startTime: plain.startTime,
    endTime: plain.endTime,
    gradingEndTime: plain.gradingEndTime,
    hasExamMaterial: !!(plain.driveFileId || plain.driveFileUrl),
    examOpened: opened,
    driveFileName: opened ? plain.driveFileName : null,
    // Chỉ trả về URL khi được mở — frontend sẽ window.open() trực tiếp
    driveFileUrl: opened ? plain.driveFileUrl : null,
    isDriveAccessSynced: plain.isDriveAccessSynced,
    driveSyncedEmailCount: plain.driveSyncedEmailCount,
    isExamManualOpen: plain.isExamManualOpen
  };
}

/**
 * Sanitize round for coordinator admin UI (includes sync status, not raw student access).
 */
function sanitizeRoundForAdmin(round) {
  if (!round) return null;
  const plain = round.toObject ? round.toObject() : { ...round };
  return {
    ...plain,
    hasExamMaterial: !!plain.driveFileId,
    examOpened: isRoundExamOpen(plain)
  };
}

/**
 * Kiểm tra xem user có quyền xem đề bài không.
 * Logic mới: Không cần match email — chỉ cần là thành viên đã xác nhận và đến giờ mở đề.
 */
async function canUserAccessRoundExam(userId, roundId) {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    return { ok: false, reason: 'inactive', message: 'Tài khoản không hợp lệ hoặc đã bị khóa.' };
  }

  const round = await Round.findById(roundId);
  if (!round) {
    return { ok: false, reason: 'not_found', message: 'Không tìm thấy vòng thi.' };
  }

  if (!round.driveFileUrl && !round.driveFileId) {
    return { ok: false, reason: 'no_material', message: 'Vòng thi chưa có đề bài được gắn.' };
  }

  if (!isRoundExamOpen(round)) {
    return { ok: false, reason: 'not_started', message: 'Đề bài chưa đến giờ mở.' };
  }

  // Link Drive được sử dụng trực tiếp, không cần cấp quyền theo email
  const accessUrl = round.driveFileUrl || buildDriveUrl(round.driveFileId);

  return { ok: true, round, user, accessUrl };
}

/**
 * Kiểm tra xem đề của một Track có đang mở không.
 * Logic: có link Drive của track + (đã đến giờ startTime hoặc isExamManualOpen / round active bật).
 * Không có startTime thì đề khóa cho đến khi được mở thủ công.
 */
function isTrackExamOpen(track, round) {
  const hasMaterial = !!(track?.examDriveFileId || track?.examDriveFileUrl);
  if (!hasMaterial) return false;
  if (track?.isExamManualOpen || round?.isExamManualOpen || round?.status === 'active') return true;
  const startTime = track?.startTime || round?.startTime;
  if (!startTime) return false;
  return new Date() >= new Date(startTime);
}

/**
 * Sanitize track exam data for participant — chỉ expose examDriveFileUrl khi đã mở.
 */
function sanitizeTrackExamForParticipant(track, round) {
  if (!track) return null;
  const plain = track.toObject ? track.toObject() : { ...track };
  const opened = isTrackExamOpen(plain, round);

  return {
    hasExamMaterial: !!(plain.examDriveFileId || plain.examDriveFileUrl),
    examOpened: opened,
    examDriveFileName: opened ? plain.examDriveFileName : null,
    examDriveFileUrl: opened ? plain.examDriveFileUrl : null,
  };
}

/**
 * Kiểm tra xem user có quyền xem đề bài của Track (bảng) không.
 * User phải là thành viên đã confirmed của đội trong bảng đó, và đề phải mở.
 */
async function canUserAccessTrackExam(userId, trackId) {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    return { ok: false, reason: 'inactive', message: 'Tài khoản không hợp lệ hoặc đã bị khóa.' };
  }

  let track = await Track.findById(trackId).lean();
  if (!track) {
    return { ok: false, reason: 'not_found', message: 'Không tìm thấy bảng đấu.' };
  }

  // Fallback: If current track has no material (e.g. Bảng Chung Kết), check if team's originalTrackId has material
  if (!track.examDriveFileUrl && !track.examDriveFileId) {
    const Team = mongoose.model('Team');
    const TeamMember = mongoose.model('TeamMember');
    const memberRecord = await TeamMember.findOne({ userId, status: 'confirmed' });
    if (memberRecord) {
      const team = await Team.findById(memberRecord.teamId);
      if (team && team.originalTrackId) {
        const origTrack = await Track.findById(team.originalTrackId).lean();
        if (origTrack && (origTrack.examDriveFileUrl || origTrack.examDriveFileId)) {
          track = origTrack;
        }
      }
    }
  }

  if (!track.examDriveFileUrl && !track.examDriveFileId) {
    return { ok: false, reason: 'no_material', message: 'Bảng đấu này chưa có đề bài được gắn.' };
  }

  // Lấy round để kiểm tra thời gian mở
  const round = track.roundId ? await Round.findById(track.roundId).lean() : null;

  if (!isTrackExamOpen(track, round)) {
    return { ok: false, reason: 'not_started', message: 'Đề bài chưa đến giờ mở.' };
  }

  const accessUrl = track.examDriveFileUrl || buildDriveUrl(track.examDriveFileId);
  return { ok: true, track, round, user, accessUrl };
}

module.exports = {
  extractDriveFileId,
  buildDriveUrl,
  getEligibleEmailsForRound,
  getEligibleUserIdsForRound,
  isRoundExamOpen,
  isTrackExamOpen,
  sanitizeRoundForParticipant,
  sanitizeRoundForAdmin,
  sanitizeTrackExamForParticipant,
  canUserAccessRoundExam,
  canUserAccessTrackExam
};
