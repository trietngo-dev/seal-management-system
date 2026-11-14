const test = require('node:test');
const assert = require('node:assert/strict');
const { validateScoreSubmissionPolicy, buildScoreChangeSummary } = require('./scorePolicy');

test('allows first-time grading when no existing score exists', () => {
  const result = validateScoreSubmissionPolicy([], 'admin_view');
  assert.equal(result.allowed, true);
  assert.equal(result.reason, undefined);
});

test('allows a judge to resubmit while their score is not locked', () => {
  const result = validateScoreSubmissionPolicy(
    [{ status: 'submitted', judgeId: 'judge-1' }],
    'judge',
    'judge-1',
  );
  assert.equal(result.allowed, true);
  assert.equal(result.isRegrade, true);
});

test('blocks a judge from changing a locked score', () => {
  const result = validateScoreSubmissionPolicy(
    [{ status: 'locked', judgeId: 'judge-1' }],
    'judge',
    'judge-1',
  );
  assert.equal(result.allowed, false);
  assert.match(result.reason, /đã bị khóa/i);
});

test('lets system admin and CTSV adjust a locked score', () => {
  for (const role of ['system_admin', 'student_assistant']) {
    const result = validateScoreSubmissionPolicy([{ status: 'locked', judgeId: 'judge-1' }], role, 'judge-1');
    assert.equal(result.allowed, true);
  }
});

test('another judge scoring the same team is not a regrade', () => {
  const result = validateScoreSubmissionPolicy([{ status: 'submitted', judgeId: 'judge-2' }], 'judge', 'judge-1');
  assert.equal(result.allowed, true);
  assert.equal(result.isRegrade, false);
});

test('builds a detailed change summary for each criterion', () => {
  const summary = buildScoreChangeSummary(
    {
      overallComment: 'old',
      details: [{ criterionId: 'c1', scoreValue: 8 }],
    },
    {
      overallComment: 'new',
      details: [{ criterionId: 'c1', scoreValue: 9 }],
    },
    [{ _id: 'c1', name: 'Tính đúng đắn' }],
  );

  assert.equal(summary.length, 1);
  assert.equal(summary[0].criterionName, 'Tính đúng đắn');
  assert.deepEqual(summary[0].change, { from: 8, to: 9 });
});
