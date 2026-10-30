const isMock = process.env.GEMINI_SERVICE_MOCK === 'true';

// Import Global System-Level Harness Layers
const promptsManager = require('../../harness/boundaries/promptsManager');
const schemaValidator = require('../../harness/guardrails/schemaValidator');
const contextStore = require('../../harness/memory/contextStore');
const resilienceEngine = require('../../harness/feedback/resilienceEngine');
const hitlManager = require('../../harness/telemetry/hitlManager');

// Local tools for database saving
const dbTools = require('./tools/dbTools');

const ALLOWED_QUALITATIVE_GRADES = new Set(['Xuất sắc', 'Tốt', 'Khá', 'Trung bình', 'Yếu']);
// Grades map to a fraction of the criterion's maxScore so any rubric scale works
// (on a 5-point scale: 5/4/3/2/1, thresholds 4.5/3.5/2.5/1.5).
const GRADE_TO_SCORE_RATIO = {
  'Xuất sắc': 1,
  'Tốt': 0.8,
  'Khá': 0.6,
  'Trung bình': 0.4,
  'Yếu': 0.2
};

function qualitativeGradeForScore(score, maxScore = 5) {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.9) return 'Xuất sắc';
  if (ratio >= 0.7) return 'Tốt';
  if (ratio >= 0.5) return 'Khá';
  if (ratio >= 0.3) return 'Trung bình';
  return 'Yếu';
}

/**
 * Normalizes and validates Agent 1 (Per-Push Evidence Auditor) output conforming to Schema 2.0
 */
function normalizeCommitReviewV2(result) {
  const normalized = { ...result };
  normalized.schema_version = '2.0';
  normalized.analysis_type = 'commit_review';

  // System identity
  normalized.system_identity = normalized.system_identity || {
    project_about: normalized.overall_picture?.project_about || '',
    detected_track: 'Unknown',
    target_personas: [],
    primary_user_value: '',
    current_focus: normalized.overall_picture?.current_focus || ''
  };

  // Technology inventory (detailed) & legacy tech_stack/inventory_exhaustive sync
  normalized.technology_inventory = normalized.technology_inventory || {
    llm_models_and_apis: normalized.inventory_exhaustive?.llm_models_and_apis || normalized.tech_stack?.llm_models || [],
    agent_frameworks: normalized.tech_stack?.agent_frameworks || normalized.inventory_exhaustive?.agent_orchestration || [],
    data_sources_and_pipelines: [],
    external_tools_and_apis: normalized.inventory_exhaustive?.third_party_integrations || normalized.tech_stack?.third_party_tools || [],
    frameworks_and_runtimes: normalized.inventory_exhaustive?.frameworks_and_runtimes || normalized.tech_stack?.frameworks || [],
    storage_and_infrastructure: normalized.tech_stack?.vector_db || normalized.inventory_exhaustive?.vector_databases || []
  };

  // Ensure legacy compatibility fields exist for existing UI
  normalized.tech_stack = normalized.tech_stack || {
    frameworks: normalized.technology_inventory.frameworks_and_runtimes || [],
    llm_models: normalized.technology_inventory.llm_models_and_apis || [],
    vector_db: normalized.technology_inventory.storage_and_infrastructure || [],
    agent_frameworks: normalized.technology_inventory.agent_frameworks || [],
    third_party_tools: normalized.technology_inventory.external_tools_and_apis || []
  };

  normalized.inventory_exhaustive = normalized.inventory_exhaustive || {
    llm_models_and_apis: normalized.technology_inventory.llm_models_and_apis || [],
    frameworks_and_runtimes: normalized.technology_inventory.frameworks_and_runtimes || [],
    vector_databases: normalized.technology_inventory.storage_and_infrastructure || [],
    agent_orchestration: normalized.technology_inventory.agent_frameworks || [],
    third_party_integrations: normalized.technology_inventory.external_tools_and_apis || []
  };

  normalized.agent_intelligence = normalized.agent_intelligence || {
    detected_skills: [],
    tool_definitions: [],
    reasoning_pattern: 'None',
    has_agent_config_files: false
  };

  normalized.rag_maturity = normalized.rag_maturity || {
    level: 'Not applicable',
    features_detected: []
  };

  normalized.multi_agent_architecture = normalized.multi_agent_architecture || {
    agent_count_observed: 0,
    agents_and_roles: [],
    handoff_mechanism: 'Không quan sát được trong diff',
    shared_context: 'Không quan sát được trong diff',
    multi_agent_task_evidence: 'Không quan sát được trong diff',
    replan_and_conflict_handling: 'Không quan sát được trong diff',
    is_multi_agent_substantive: false
  };

  normalized.tools_and_verification = normalized.tools_and_verification || {
    read_tools: [],
    state_changing_tools: [],
    verification_mechanism: 'Không quan sát được trong diff',
    idempotency_and_retry: 'Không quan sát được trong diff'
  };

  normalized.safety_transparency_and_ux = normalized.safety_transparency_and_ux || {
    human_approval: 'Không quan sát được trong diff',
    audit_trace: 'Không quan sát được trong diff',
    progress_and_agent_visibility: 'Không quan sát được trong diff',
    evidence_explanation: 'Không quan sát được trong diff',
    secret_and_access_safety: 'Không quan sát được trong diff'
  };

  normalized.minimum_acceptance_check = Array.isArray(normalized.minimum_acceptance_check)
    ? normalized.minimum_acceptance_check
    : [];

  normalized.deliverable_readiness = normalized.deliverable_readiness || {};
  normalized.disqualification_risks = Array.isArray(normalized.disqualification_risks)
    ? normalized.disqualification_risks
    : [];

  normalized.rubric_evidence = normalized.rubric_evidence || {};

  normalized.overall_picture = normalized.overall_picture || {
    project_about: normalized.system_identity.project_about || '',
    tools_plain_bullets: '',
    current_focus: normalized.system_identity.current_focus || '',
    architectural_style: '',
    significant_change: false,
    push_summary: ''
  };

  normalized.assessment = normalized.assessment || {
    advantages: '',
    disadvantages: '',
    potential_errors: '',
    improvement_areas: '',
    context_and_fit: '',
    completeness: '',
    security: '',
    security_and_safety: '',
    runtime_resilience: '',
    source_structure: ''
  };

  normalized.improvement_priorities = Array.isArray(normalized.improvement_priorities)
    ? normalized.improvement_priorities
    : [];
  normalized.suggested_test_cases = Array.isArray(normalized.suggested_test_cases)
    ? normalized.suggested_test_cases
    : [];
  normalized.suggested_questions_for_team = Array.isArray(normalized.suggested_questions_for_team)
    ? normalized.suggested_questions_for_team
    : [];

  return normalized;
}

/**
 * Normalizes and validates Agent 2 (Team Aggregate Judge) output conforming to Schema 2.0
 */
function normalizeAggregateReviewV2(result, criteria = []) {
  const normalized = { ...result };
  normalized.schema_version = '2.0';
  normalized.analysis_type = 'repository_review';

  // Ensure criteria_comments and overall_picture exist
  normalized.criteria_comments = (normalized.criteria_comments && typeof normalized.criteria_comments === 'object')
    ? { ...normalized.criteria_comments }
    : {};
  normalized.overall_picture = (normalized.overall_picture && typeof normalized.overall_picture === 'object')
    ? { ...normalized.overall_picture }
    : {};

  const gradeAliasMap = {
    'excellent': 'Xuất sắc',
    'xuat sac': 'Xuất sắc',
    'xuất sắc': 'Xuất sắc',
    'good': 'Tốt',
    'tot': 'Tốt',
    'tốt': 'Tốt',
    'fair': 'Khá',
    'average': 'Khá',
    'kha': 'Khá',
    'khá': 'Khá',
    'poor': 'Trung bình',
    'trung binh': 'Trung bình',
    'trung bình': 'Trung bình',
    'weak': 'Yếu',
    'yeu': 'Yếu',
    'yếu': 'Yếu',
    'pass': 'Tốt',
    'passed': 'Tốt',
    'dat': 'Tốt',
    'đạt': 'Tốt'
  };

  const comments = {};
  const suggestedScores = {};

  for (const criterion of criteria) {
    // Try matching criterion code exact, case-insensitive, or alphanumeric match
    let entry = normalized.criteria_comments[criterion.code];
    if (!entry) {
      const codeKey = Object.keys(normalized.criteria_comments).find(
        k => k.toLowerCase() === criterion.code.toLowerCase() ||
             k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === criterion.code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      );
      if (codeKey) entry = normalized.criteria_comments[codeKey];
    }

    // A criterion the AI skipped stays unassessed; never invent a score for it.
    if (!entry || typeof entry !== 'object') continue;

    let grade = entry.grade;
    if (typeof grade === 'string') {
      const cleanGrade = grade.trim().toLowerCase();
      if (gradeAliasMap[cleanGrade]) {
        grade = gradeAliasMap[cleanGrade];
      }
    }

    const rubricMinimums = (criterion.gradingLevels || [])
      .map(level => Number(level.minScore))
      .filter(Number.isFinite);
    const rubricMinimum = rubricMinimums.length > 0 ? Math.min(...rubricMinimums) : 0;
    const maxScore = Number(criterion.maxScore) || 5;

    let suggestedScore = Number(entry.suggested_score);
    if (!Number.isFinite(suggestedScore) || suggestedScore < rubricMinimum || suggestedScore > maxScore) {
      // Out-of-range score: fall back to the grade the AI gave, if it gave a valid one.
      if (!ALLOWED_QUALITATIVE_GRADES.has(grade)) continue;
      suggestedScore = Math.min(maxScore, Math.max(rubricMinimum, GRADE_TO_SCORE_RATIO[grade] * maxScore));
    }

    suggestedScore = Math.round(suggestedScore * 100) / 100;
    grade = qualitativeGradeForScore(suggestedScore, maxScore);

    suggestedScores[criterion.code] = suggestedScore;
    comments[criterion.code] = {
      grade,
      suggested_score: suggestedScore,
      comment: entry.comment || (Array.isArray(entry.evidence) ? entry.evidence.join('; ') : `Đánh giá tiêu chí ${criterion.code}`)
    };
  }

  normalized.criteria_comments = comments;

  // Preserve LLM rubric_scores details (evidence, gaps, demo_checks, confidence) while securing backend-computed constraints
  normalized.rubric_scores = Object.fromEntries(criteria.map(criterion => {
    const rawScoreObj = normalized.rubric_scores?.[criterion.code] || {};
    return [criterion.code, {
      criterion_id: criterion._id,
      suggested_score: suggestedScores[criterion.code] ?? null,
      max_score: criterion.maxScore,
      weight: criterion.weight || null,
      weighted_points: null,
      calculation_source: 'backend',
      confidence: rawScoreObj.confidence || 'medium',
      evidence: Array.isArray(rawScoreObj.evidence) ? rawScoreObj.evidence : [],
      gaps: Array.isArray(rawScoreObj.gaps) ? rawScoreObj.gaps : [],
      demo_checks: Array.isArray(rawScoreObj.demo_checks) ? rawScoreObj.demo_checks : []
    }];
  }));

  // Preserve schema 2.0 sections
  normalized.team_system_identity = normalized.team_system_identity || {};
  normalized.technology_inventory = normalized.technology_inventory || {};
  normalized.historical_synthesis = normalized.historical_synthesis || {
    evolution_summary: normalized.overall_picture?.historical_synthesis || '',
    major_capabilities_added: [],
    regressions_or_unresolved_gaps: [],
    current_focus: '',
    architectural_style: ''
  };

  normalized.overall_picture = normalized.overall_picture || {
    historical_synthesis: typeof normalized.historical_synthesis === 'string'
      ? normalized.historical_synthesis
      : normalized.historical_synthesis.evolution_summary || '',
    evolution_notes: '',
    project_about: normalized.team_system_identity?.project_about || ''
  };

  normalized.minimum_acceptance = Array.isArray(normalized.minimum_acceptance) ? normalized.minimum_acceptance : [];
  normalized.disqualification_risks = Array.isArray(normalized.disqualification_risks) ? normalized.disqualification_risks : [];

  normalized.round_totals = {
    suggested_total_raw_score: null,
    suggested_total_weighted_score: null,
    calculation_source: 'backend',
    calculation_check: 'AI không tự tính tổng điểm; backend tính từ active_rubric'
  };

  normalized.smb_scale_advisory = normalized.smb_scale_advisory || {
    system_identity_recap: normalized.team_system_identity?.project_about || '',
    summary: 'Hệ thống hoàn thành đánh giá tổng quan.',
    tech_and_architecture: '',
    cost_for_smb: '',
    throughput_and_reliability: '',
    observability_and_operations: '',
    data_and_integrations: ''
  };

  normalized.assessment = normalized.assessment || {};
  normalized.improvement_priorities = Array.isArray(normalized.improvement_priorities) ? normalized.improvement_priorities : [];
  normalized.suggested_test_cases = Array.isArray(normalized.suggested_test_cases) ? normalized.suggested_test_cases : [];
  normalized.suggested_questions_for_team = Array.isArray(normalized.suggested_questions_for_team) ? normalized.suggested_questions_for_team : [];
  normalized.final_summary = normalized.final_summary || '';

  return normalized;
}

/**
 * Filter criteria comments to keep only the active ones for the round
 */
function filterCriteriaComments(result, roundCriteria) {
  if (!result) return result;
  
  if (roundCriteria && roundCriteria.length > 0) {
    const activeCodes = new Set(roundCriteria.map(c => c.code.toUpperCase()));
    
    if (result.criteria_comments) {
      const filtered = {};
      Object.keys(result.criteria_comments).forEach(key => {
        if (activeCodes.has(key.toUpperCase())) {
          filtered[key] = result.criteria_comments[key];
        }
      });
      result.criteria_comments = filtered;
    }
  }
  return result;
}

/**
 * Call n8n webhook workflow asynchronously or synchronously with retry support.
 */
async function callN8nWebhook(payload, maxRetries = 2) {
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  if (!n8nUrl) return null;

  const timeoutMs = process.env.N8N_TIMEOUT_MS ? parseInt(process.env.N8N_TIMEOUT_MS, 10) : 180000;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const startTime = Date.now();
    console.log(`[N8N] Calling n8n webhook (Attempt ${attempt}/${maxRetries + 1}): ${n8nUrl} for ${payload.analysisType}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Retry on 429 Rate Limit, 502/503/504 Gateway errors if attempts remain
        const retryableStatuses = [429, 502, 503, 504];
        if (retryableStatuses.includes(response.status) && attempt <= maxRetries) {
          const backoffDelay = attempt * 5000;
          console.warn(`[N8N] Received status ${response.status} from n8n. Retrying in ${backoffDelay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }
        throw new Error(`n8n returned status ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      let resultJson = resilienceEngine.autoFixJsonString(text);
      if (!resultJson) {
        throw new Error(`Failed to parse/fix n8n response as JSON: ${text.substring(0, 200)}`);
      }
      
      // Normalize response if wrapped in array
      if (Array.isArray(resultJson)) {
        resultJson = resultJson[0];
      }
      
      // Extract nested data if n8n returns standard wrappers
      if (resultJson && typeof resultJson === 'object') {
        if (resultJson.structured_output) {
          resultJson = typeof resultJson.structured_output === 'string'
            ? resilienceEngine.autoFixJsonString(resultJson.structured_output) || resultJson.structured_output
            : resultJson.structured_output;
        } else if (resultJson.output) {
          resultJson = typeof resultJson.output === 'string'
            ? resilienceEngine.autoFixJsonString(resultJson.output) || resultJson.output
            : resultJson.output;
        } else if (resultJson.result && typeof resultJson.result === 'object') {
          resultJson = resultJson.result;
        } else if (resultJson.data && typeof resultJson.data === 'object') {
          resultJson = resultJson.data;
        } else if (resultJson.json && typeof resultJson.json === 'object') {
          resultJson = resultJson.json;
        } else if (resultJson.body && typeof resultJson.body === 'object') {
          resultJson = resultJson.body;
        }
      }
      
      const latency = Date.now() - startTime;
      hitlManager.recordTelemetry(latency, 0, true);
      console.log(`[N8N] Received successful response from n8n in ${(latency / 1000).toFixed(1)}s.`);
      return schemaValidator.parseAiResult(resultJson);
    } catch (error) {
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      hitlManager.recordTelemetry(latency, 0, false);
      
      if (error.name === 'AbortError') {
        console.error(`[N8N] Webhook call timed out after ${timeoutMs / 1000}s.`);
      } else {
        console.error(`[N8N] Webhook call failed (Attempt ${attempt}/${maxRetries + 1}):`, error.message);
      }

      if (attempt <= maxRetries && error.name !== 'AbortError') {
        const backoffDelay = attempt * 5000;
        console.log(`[N8N] Retrying webhook in ${backoffDelay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      } else {
        return null;
      }
    }
  }

  return null;
}

/**
 * Agent 1: Analyzes a batch of commits (per-push) using Gemini AI or n8n webhook.
 */
async function analyzeCommit(commit, files, extraContext = {}) {
  const activeFiles = files.filter(f => !promptsManager.shouldIgnoreFile(f.filename));
  const fileSummaries = activeFiles.map(f => {
    const patch = promptsManager.enforceFilePatchBoundary(f.patch);
    return `File: ${f.filename}\nStatus: ${f.status}\nAdditions: ${f.additions}, Deletions: ${f.deletions}\nDiff:\n${patch}`;
  }).join('\n\n');
  
  const rubricContext = extraContext.teamId
    ? await contextStore.loadTeamRubricContext(extraContext.teamId)
    : {};

  const runtimeInput = {
    team_id: extraContext.teamId || 'N/A',
    team_code: extraContext.teamCode || rubricContext.teamCode || 'N/A',
    repo_name: extraContext.repoName || 'N/A',
    repository_id: extraContext.repositoryId || 'N/A',
    round_id: extraContext.roundId || rubricContext.roundId || 'N/A',
    track_id: extraContext.trackId || rubricContext.trackId || 'N/A',
    declared_track: extraContext.declaredTrack || rubricContext.trackName || 'Chưa xác định',
    contest_brief: rubricContext.contestBrief || '',
    active_rubric: rubricContext.criteriaPrompt || '',
    commit_sha: commit.commitSha,
    commit_count: extraContext.commitCount || 1,
    cron_batch_review: extraContext.cronBatchReview || false,
    batched_commit_shas: extraContext.batchedCommitShas || commit.commitSha,
    activity_log: `Commit ${commit.commitSha ? commit.commitSha.substring(0, 7) : ''} bởi ${commit.authorName || 'N/A'} (@${commit.authorGithubUsername || 'N/A'}): "${commit.message}"`,
    files: fileSummaries,
    repository_context: extraContext.repositoryContext || 'Không có README/config bổ sung.',
    limits: `Max file diff patch: ${promptsManager.GLOBAL_SCOPE_CONFIG.MAX_SINGLE_FILE_PATCH_SIZE} chars/file`
  };

  const prompt = promptsManager.promptsRegistry.commit_review(runtimeInput);

  // 1. Try n8n webhook first if configured
  const n8nResult = await callN8nWebhook({
    analysisType: 'commit_review',
    runtimeInput,
    commit: {
      commitSha: commit.commitSha,
      message: commit.message,
      authorName: commit.authorName,
      authorGithubUsername: commit.authorGithubUsername,
      committedAt: commit.committedAt
    },
    files: activeFiles.map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: promptsManager.enforceFilePatchBoundary(f.patch)
    })),
    prompt
  });
  
  if (n8nResult) {
    n8nResult._provider = 'n8n-gemini';
    n8nResult._model = 'gemini-2.5-flash (via n8n)';
    
    // Check if HITL human approval is required
    if (hitlManager.requiresHumanApproval(n8nResult)) {
      n8nResult._requires_approval = true;
    }
    return normalizeCommitReviewV2(n8nResult);
  }

  // 2. Mock service, only when explicitly enabled for local development
  if (isMock) {
    console.log(`[GEMINI MOCK] Running Agent 1 per-push evidence analysis for: ${commit.commitSha ? commit.commitSha.substring(0, 7) : 'latest'}`);
    await new Promise(resolve => setTimeout(resolve, 600));

    // Neutral placeholder output for local development; every text is tagged [MOCK].
    const mockResult = {
      system_identity: {
        project_about: '[MOCK] Mô tả hệ thống giả lập.',
        detected_track: runtimeInput.declared_track,
        target_personas: [],
        primary_user_value: '',
        current_focus: '[MOCK] Tiêu điểm giả lập.'
      },
      rubric_evidence: {},
      assessment: {
        advantages: '[MOCK] Điểm mạnh giả lập.',
        disadvantages: '[MOCK] Điểm yếu giả lập.',
        potential_errors: '[MOCK] Lỗi tiềm ẩn giả lập.',
        improvement_areas: ''
      },
      suggested_questions_for_team: ['[MOCK] Câu hỏi giả lập cho đội thi?'],
      overall_picture: {
        project_about: '[MOCK] Mô tả hệ thống giả lập.',
        current_focus: '',
        significant_change: false,
        push_summary: `Đợt này gồm ${extraContext.commitCount || 1} commit: [MOCK] tóm tắt giả lập.`
      },
      _provider: 'Mock Service',
      _model: 'mock'
    };

    if (hitlManager.requiresHumanApproval(mockResult)) {
      mockResult._requires_approval = true;
    }
    return normalizeCommitReviewV2(mockResult);
  }

  throw new Error("Gọi webhook n8n thất bại hoặc hết hạn phản hồi (timeout). Vui lòng kiểm tra lại dịch vụ n8n và quota của API Gemini.");
}

/**
 * Agent 2: Performs a deep historical aggregate analysis for the team (Team Aggregate Judge).
 */
async function analyzeTeamAggregate(teamId, commits, priorReviews, options = {}) {
  // Load State Context from Global Context Store
  const context = await contextStore.loadTeamAggregateContext(teamId);
  const activeCriteria = Array.isArray(options.criteria) && options.criteria.length > 0
    ? options.criteria
    : context.roundCriteria;

  if (!activeCriteria || activeCriteria.length === 0) {
    // Agent 2 scores against the rubric; without one there is nothing valid to score.
    throw new Error('Vòng thi chưa có rubric active, không thể phân tích tổng hợp.');
  }
  const criteriaPrompt = contextStore.formatCriteriaPrompt(activeCriteria);

  const runtimeInput = {
    team_id: teamId,
    team_code: context.teamCode,
    repo_name: context.repoName,
    repository_id: context.repositoryId,
    round_id: options.roundId || context.roundId,
    track_id: options.trackId || context.trackId,
    declared_track: context.trackName,
    contest_brief: context.contestBrief,
    latest_commit_sha: commits.length > 0 ? commits[commits.length - 1].commitSha : (options.latestCommitSha || 'N/A'),
    active_rubric: criteriaPrompt,
    aggregate_context: context.aggregateContext,
    current_push_review: options.currentPushReview || (priorReviews.length > 0 ? priorReviews[0].result : null),
    demo_evidence: options.demoEvidence || 'Không có bằng chứng demo bổ sung.'
  };

  const prompt = promptsManager.promptsRegistry.repository_review(runtimeInput);

  // 1. Try n8n webhook first if configured
  const n8nResult = await callN8nWebhook({
    analysisType: 'repository_review',
    runtimeInput,
    teamId,
    roundId: options.roundId || context.roundId,
    rubricId: options.rubricId,
    activeRubric: activeCriteria.map(c => ({
      criterionId: c._id,
      code: c.code,
      name: c.name,
      description: c.description,
      weight: c.weight,
      maxScore: c.maxScore,
      gradingLevels: c.gradingLevels || []
    })),
    commits: commits.map(c => ({
      commitSha: c.commitSha,
      message: c.message,
      committedAt: c.committedAt
    })),
    priorReviews: priorReviews.map(r => ({
      analysisType: r.analysisType,
      result: r.result
    })),
    prompt
  });
  
  if (n8nResult) {
    try {
      n8nResult._provider = 'n8n-gemini';
      n8nResult._model = 'gemini-2.5-flash (via n8n)';
      return normalizeAggregateReviewV2(filterCriteriaComments(n8nResult, activeCriteria), activeCriteria);
    } catch (normErr) {
      // Never substitute mock data for a real review: judges would see fabricated scores.
      throw new Error(`Kết quả AI từ n8n không đúng định dạng: ${normErr.message}`);
    }
  }

  // 2. Mock service, only when explicitly enabled for local development
  if (isMock) {
    console.log(`[GEMINI MOCK] Running Agent 2 Team Aggregate Judge analysis for team: ${teamId}`);
    await new Promise(resolve => setTimeout(resolve, 800));

    // Neutral placeholder output for local development; every text is tagged [MOCK].
    const criteriaComments = {};
    const rubricScores = {};
    activeCriteria.forEach(c => {
      const maxScore = Number(c.maxScore) || 5;
      const score = Math.round(maxScore * 0.7 * 100) / 100;
      criteriaComments[c.code] = { grade: 'Tốt', suggested_score: score, comment: `[MOCK] Nhận xét giả lập cho tiêu chí ${c.code}.` };
      rubricScores[c.code] = {
        criterion_id: c._id,
        suggested_score: score,
        confidence: 'low',
        evidence: ['[MOCK] Bằng chứng giả lập'],
        gaps: ['[MOCK] Khoảng trống giả lập'],
        demo_checks: ['[MOCK] Hạng mục cần kiểm chứng khi demo']
      };
    });

    const mockAggregate = {
      team_system_identity: {
        project_about: '[MOCK] Mô tả hệ thống giả lập.',
        detected_track: context.trackName || 'Unknown',
        target_personas: [],
        primary_user_value: '',
        system_boundary: ''
      },
      technology_inventory: {
        llm_models_and_apis: [],
        agent_frameworks: [],
        data_sources_and_pipelines: [],
        external_tools_and_apis: [],
        frameworks_and_runtimes: [],
        storage_and_infrastructure: []
      },
      historical_synthesis: {
        evolution_summary: '[MOCK] Tóm tắt quá trình phát triển giả lập.',
        major_capabilities_added: [],
        regressions_or_unresolved_gaps: [],
        current_focus: '',
        architectural_style: ''
      },
      minimum_acceptance: [
        { requirement: '[MOCK] Yêu cầu tối thiểu giả lập', status: 'unverified', evidence: '' }
      ],
      disqualification_risks: [],
      rubric_scores: rubricScores,
      criteria_comments: criteriaComments,
      assessment: {
        advantages: '[MOCK] Điểm mạnh giả lập.',
        disadvantages: '[MOCK] Điểm yếu giả lập.',
        potential_errors: '[MOCK] Lỗi tiềm ẩn giả lập.'
      },
      improvement_priorities: ['P0: [MOCK] Hành động giả lập.'],
      suggested_test_cases: ['[MOCK] Given ..., When ..., Then ...'],
      suggested_questions_for_team: ['[MOCK] Câu hỏi giả lập cho đội thi?'],
      final_summary: '[MOCK] Kết luận giả lập — không phải kết quả AI thật.',
      _provider: 'Mock Service',
      _model: 'mock'
    };

    return normalizeAggregateReviewV2(mockAggregate, activeCriteria);
  }

  throw new Error("Gọi webhook n8n thất bại hoặc hết hạn phản hồi (timeout). Vui lòng kiểm tra lại dịch vụ n8n và quota của API Gemini.");
}

/**
 * Suggests grades for a team's submission snapshot against a list of Rubric criteria.
 */
async function generateScoringSuggestion(repositorySnapshot, commits, criteria) {
  const AiAnalysis = require('mongoose').model('AiAnalysis');
  const latestAggReview = await AiAnalysis.findOne({
    teamId: repositorySnapshot.teamId,
    roundId: repositorySnapshot.roundId,
    repositorySnapshotId: repositorySnapshot._id,
    analysisType: 'repository_review',
    status: { $in: ['completed', 'approved'] }
  }).sort({ createdAt: -1 });

  const cleanResult = latestAggReview && latestAggReview.result
    ? schemaValidator.parseAiResult(latestAggReview.result)
    : null;
  if (!cleanResult) {
    throw new Error('Chưa có kết quả phân tích AI cho đội thi này.');
  }

  return criteria.map(c => {
    const agentComment = cleanResult.criteria_comments?.[c.code];
    const agentScore = Number(cleanResult.rubric_scores?.[c.code]?.suggested_score ?? agentComment?.suggested_score);
    const hasScore = Number.isFinite(agentScore) && agentScore >= 0 && agentScore <= c.maxScore;

    // A criterion the AI did not assess gets no suggestion, so the judge must score it manually.
    if (!agentComment && !hasScore) {
      return {
        criterionCode: c.code,
        suggestedScore: null,
        comment: '[AI chưa có nhận xét cho tiêu chí này — giám khảo tự chấm]'
      };
    }

    const grade = agentComment?.grade || (hasScore ? qualitativeGradeForScore(agentScore, c.maxScore) : 'Chưa xếp hạng');
    return {
      criterionCode: c.code,
      suggestedScore: hasScore ? agentScore : null,
      comment: `[Gợi ý của AI - Xếp hạng: ${grade}]: ${agentComment?.comment || 'Không có nhận xét chi tiết.'}`
    };
  });
}

module.exports = {
  analyzeCommit,
  analyzeTeamAggregate,
  generateScoringSuggestion,
  parseAiResult: schemaValidator.parseAiResult
};
