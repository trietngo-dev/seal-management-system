const test = require('node:test');
const assert = require('node:assert/strict');
const { projectTechnicalResult } = require('./mentorAiProjection');

test('mentor projection keeps technical data and removes judging data', () => {
  const projected = projectTechnicalResult({
    team_system_identity: { project_about: 'System', detected_track: 'Track 1' },
    assessment: { potential_errors: 'Race condition', source_structure: 'Layered' },
    suggested_test_cases: [{ test_case_name: 'Retry test', given: 'Tool fails', when: 'Agent retries', then: 'No duplicate action' }],
    improvement_priorities: [{ priority: 'P0', action: 'Validate every tool input' }],
    suggested_questions_for_team: ['How do agents hand off?'],
    technology_inventory: { frameworks_and_runtimes: ['Node.js'], suggested_score: 5 },
    rubric_scores: { T1: { suggested_score: 5 } },
    criteria_comments: { T1: { grade: 'Excellent' } },
    disqualification_risks: ['Hidden judge data']
  });
  assert.equal(projected.summary.projectAbout, 'System');
  assert.equal(projected.assessment.potentialErrors, 'Race condition');
  assert.equal(projected.rubric_scores, undefined);
  assert.equal(projected.criteria_comments, undefined);
  assert.equal(projected.disqualification_risks, undefined);
  assert.equal(JSON.stringify(projected).includes('suggested_score'), false);
  assert.deepEqual(projected.technology, { frameworks_and_runtimes: ['Node.js'] });
  assert.deepEqual(projected.improvements, ['[P0] Validate every tool input']);
  assert.deepEqual(projected.suggestedTests, ['Retry test — Given: Tool fails | When: Agent retries | Then: No duplicate action']);
});
