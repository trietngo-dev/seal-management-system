const LOCKED_SCORE_EDITORS = ['system_admin', 'student_assistant'];

function validateScoreSubmissionPolicy(existingScores, actorRole, targetJudgeId) {
  if (!Array.isArray(existingScores) || existingScores.length === 0) {
    return { allowed: true };
  }

  if (!targetJudgeId) {
    return {
      allowed: false,
      reason: 'Thiếu judgeId để xác định quyền chấm điểm.',
    };
  }

  const targetJudgeScore = existingScores.find((score) => {
    const judgeId = score.judgeId || score.judge?._id || score.judge?._id?.toString();
    return judgeId && judgeId.toString() === targetJudgeId.toString();
  });

  // A judge may revise their own sheet until the round's scores are locked; the submit
  // route records every revision as a regrade_score audit with before/after values.
  if (targetJudgeScore && targetJudgeScore.status === 'locked' && !LOCKED_SCORE_EDITORS.includes(actorRole)) {
    return {
      allowed: false,
      reason: 'Điểm của giám khảo cho đội này đã bị khóa. Liên hệ Ban tổ chức nếu cần điều chỉnh.',
      existingScoreStatus: targetJudgeScore.status,
    };
  }

  return { allowed: true, isRegrade: !!targetJudgeScore };
}

function buildScoreChangeSummary(previousScore, nextScore, criteriaList = []) {
  const criteriaById = new Map(criteriaList.map((criterion) => [criterion._id.toString(), criterion]));
  const previousDetails = Array.isArray(previousScore?.details) ? previousScore.details : [];
  const nextDetails = Array.isArray(nextScore?.details) ? nextScore.details : [];
  const detailsById = new Map(nextDetails.map((detail) => [detail.criterionId?.toString() || detail.criterionId, detail]));

  const changes = [];
  const previousById = new Map(previousDetails.map((detail) => [detail.criterionId?.toString() || detail.criterionId, detail]));

  for (const [criterionId, detail] of detailsById.entries()) {
    const prev = previousById.get(criterionId);
    if (!prev) {
      continue;
    }

    if (prev.scoreValue !== detail.scoreValue) {
      const criterion = criteriaById.get(criterionId);
      changes.push({
        criterionId,
        criterionName: criterion?.name || 'Không xác định',
        change: { from: prev.scoreValue, to: detail.scoreValue },
      });
    }
  }

  return changes;
}

module.exports = {
  validateScoreSubmissionPolicy,
  buildScoreChangeSummary,
};
