function asArray(value, limit = 30) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).map((item, index) => {
    if (typeof item === 'string') return item;
    if (typeof item === 'number' || typeof item === 'boolean') return String(item);
    if (!item || typeof item !== 'object') return '';

    const priority = item.priority ? `[${item.priority}] ` : '';
    const action = item.action || item.actionable_step || item.recommendation || item.description || item.title;
    if (action) return `${priority}${action}`;

    const testName = item.test_case_name || item.name || `Test case #${index + 1}`;
    const steps = [
      item.given ? `Given: ${item.given}` : '',
      item.when ? `When: ${item.when}` : '',
      item.then ? `Then: ${item.then}` : ''
    ].filter(Boolean);
    if (steps.length) return `${testName} — ${steps.join(' | ')}`;

    return Object.entries(item)
      .filter(([, fieldValue]) => ['string', 'number', 'boolean'].includes(typeof fieldValue))
      .map(([key, fieldValue]) => `${key}: ${fieldValue}`)
      .join(' | ');
  }).filter(Boolean);
}

function pick(source, keys) {
  return Object.fromEntries(keys.filter(key => source?.[key] !== undefined).map(key => [key, source[key]]));
}

function projectTechnicalResult(result = {}) {
  const identity = result.team_system_identity || result.system_identity || {};
  const overall = result.overall_picture || {};
  return {
    summary: {
      projectAbout: identity.project_about || overall.project_about || '',
      detectedTrack: identity.detected_track || '',
      currentFocus: identity.current_focus || overall.current_focus || '',
      primaryUserValue: identity.primary_user_value || '',
      architecturalStyle: result.historical_synthesis?.architectural_style || overall.architectural_style || '',
      pushSummary: overall.push_summary || '',
      evolutionSummary: result.historical_synthesis?.evolution_summary || overall.historical_synthesis || ''
    },
    technology: pick(result.technology_inventory, [
      'llm_models_and_apis', 'agent_frameworks', 'data_sources_and_pipelines', 'external_tools_and_apis',
      'frameworks_and_runtimes', 'storage_and_infrastructure'
    ]),
    architecture: {
      multiAgent: pick(result.multi_agent_architecture, [
        'agent_count_observed', 'agents_and_roles', 'handoff_mechanism', 'shared_context',
        'multi_agent_task_evidence', 'replan_and_conflict_handling', 'is_multi_agent_substantive'
      ]),
      toolsAndVerification: pick(result.tools_and_verification, [
        'read_tools', 'state_changing_tools', 'verification_mechanism', 'idempotency_and_retry'
      ]),
      safetyAndTransparency: pick(result.safety_transparency_and_ux, [
        'human_approval', 'audit_trace', 'progress_and_agent_visibility', 'evidence_explanation', 'secret_and_access_safety'
      ])
    },
    assessment: {
      advantages: result.assessment?.advantages || '',
      disadvantages: result.assessment?.disadvantages || '',
      potentialErrors: result.assessment?.potential_errors || '',
      improvementAreas: result.assessment?.improvement_areas || '',
      security: result.assessment?.security_and_safety || result.assessment?.security || '',
      runtimeResilience: result.assessment?.runtime_resilience || '',
      sourceStructure: result.assessment?.source_structure || ''
    },
    improvements: asArray(result.improvement_priorities),
    suggestedTests: asArray(result.suggested_test_cases),
    questionsForTeam: asArray(result.suggested_questions_for_team),
    capabilitiesAdded: asArray(result.historical_synthesis?.major_capabilities_added),
    unresolvedGaps: asArray(result.historical_synthesis?.regressions_or_unresolved_gaps)
  };
}

function projectAnalysisForMentor(analysis) {
  const record = typeof analysis.toObject === 'function' ? analysis.toObject() : analysis;
  return {
    id: record._id,
    analysisType: record.analysisType,
    status: record.status,
    provider: record.provider,
    model: record.model,
    createdAt: record.createdAt,
    completedAt: record.completedAt,
    commit: record.commitId ? {
      id: record.commitId._id,
      sha: record.commitId.commitSha,
      message: record.commitId.message,
      committedAt: record.commitId.committedAt,
      author: record.commitId.authorGithubUsername || record.commitId.authorName
    } : null,
    technical: projectTechnicalResult(record.result || {})
  };
}

module.exports = { projectTechnicalResult, projectAnalysisForMentor };
