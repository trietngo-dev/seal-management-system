const mongoose = require('mongoose');
const githubService = require('./githubService');

const MAX_NAME_ATTEMPTS = 5;

function getSemesterSuffix(event) {
  if (!event || !event.semester || !event.year) return '';
  const semLower = event.semester.toLowerCase();
  let semCode = '';
  if (semLower === 'spring') semCode = 'sp';
  else if (semLower === 'summer') semCode = 'su';
  else if (semLower === 'fall') semCode = 'fa';
  return semCode ? `_${semCode}${event.year}` : '';
}

/**
 * Converts Vietnamese text (with diacritical marks) to a GitHub-safe ASCII slug.
 * Example: "Đội Sáng Tạo" → "doi-sang-tao"
 */
function vietnameseSlug(text) {
  if (!text) return '';
  let slug = text;
  slug = slug.normalize('NFD').replace(/[̀-ͯ]/g, '');
  slug = slug.replace(/đ/g, 'd').replace(/Đ/g, 'D');
  slug = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug;
}

/**
 * Ensures a team has exactly one GitHub repository of its own.
 * - Reuses the team's existing repository (only refreshing its trackId).
 * - Otherwise picks a name no other team uses ("Beyond 8" and "Beyond-8" share a slug),
 *   creates the repo and invites the team's members.
 * Throws when GitHub refuses: a team without a repository cannot be scored,
 * so callers must surface or log the failure.
 */
async function provisionTeamRepository(team, { trackId, createdBy } = {}) {
  const GithubRepository = mongoose.model('GithubRepository');
  const targetTrackId = trackId || team.trackId;

  const existing = await GithubRepository.findOne({ teamId: team._id });
  if (existing) {
    if (targetTrackId && String(existing.trackId) !== String(targetTrackId)) {
      existing.trackId = targetTrackId;
      await existing.save();
    }
    return { repository: existing, created: false };
  }

  const event = await mongoose.model('Event').findById(team.eventId);
  const orgName = event ? event.githubOrgName : undefined;
  const slug = vietnameseSlug(team.name) || `team-${team._id.toString().slice(-6)}`;
  const baseName = slug + getSemesterSuffix(event);

  let gitResult = null;
  let repoName = null;
  for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS && !gitResult; attempt++) {
    const candidate = attempt === 1 ? baseName : `${baseName}-${attempt}`;
    if (await GithubRepository.exists({ repoName: candidate })) continue;
    try {
      gitResult = await githubService.createTeamRepository(candidate, 'private', orgName);
      repoName = candidate;
    } catch (err) {
      if (err.code !== 'REPO_NAME_TAKEN') throw err;
    }
  }
  if (!gitResult) {
    throw new Error(`Không tìm được tên repository còn trống cho đội "${team.name}".`);
  }

  const ownerName = gitResult.owner || orgName;
  const repository = await GithubRepository.create({
    eventId: team.eventId,
    trackId: targetTrackId,
    teamId: team._id,
    orgName: ownerName,
    repoName,
    repoUrl: gitResult.repoUrl,
    githubRepoId: gitResult.githubRepoId,
    createdBySystem: true,
    createdBy,
    syncStatus: 'not_synced',
  });

  const members = await mongoose.model('TeamMember')
    .find({ teamId: team._id, confirmStatus: { $ne: 'rejected' } })
    .populate('userId');
  for (const tm of members) {
    if (tm.userId && tm.userId.githubUsername) {
      await githubService.addCollaborator(repoName, tm.userId.githubUsername, 'push', ownerName);
    }
  }

  return { repository, created: true };
}

module.exports = {
  getSemesterSuffix,
  vietnameseSlug,
  provisionTeamRepository,
};
