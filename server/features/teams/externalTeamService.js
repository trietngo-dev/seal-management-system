const crypto = require('crypto');
const mongoose = require('mongoose');
const BASE_URL = 'https://api-hackathon.lexatek.vn/api';

/**
 * Helper to get authorization headers.
 */
function getHeaders() {
  const serviceKey = process.env.SERVICE_API_KEY;
  if (!serviceKey) {
    console.warn('[MQTT SERVICE] Warning: SERVICE_API_KEY is not defined in environment variables.');
  }
  return {
    'Content-Type': 'application/json',
    'X-Service-Key': serviceKey || ''
  };
}

/**
 * Register a team on the external simulator API.
 * @param {string} code - Uppercase team code.
 * @param {string} name - Team name.
 * @param {string} environmentId - UUID of the environment.
 * @returns {Promise<object>} The API result containing credentials.
 */
async function createExternalTeam(code, name, environmentId) {
  const url = `${BASE_URL}/external/teams`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ code, name, environmentId })
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || `HTTP error ${response.status}`;
    const err = new Error(errorMsg);
    err.code = data.code;
    err.status = response.status;
    throw err;
  }

  return data.result;
}

/**
 * Fetch credentials (keys) of an existing team from the external API.
 * @param {string} code - Team code.
 * @returns {Promise<object>} The API result containing keys and topics.
 */
async function fetchExternalKeys(code) {
  const url = `${BASE_URL}/external/teams/${encodeURIComponent(code)}/keys`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders()
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || `HTTP error ${response.status}`;
    const err = new Error(errorMsg);
    err.code = data.code;
    err.status = response.status;
    throw err;
  }

  return data.result;
}

let cachedToken = null;

/**
 * Log in to the simulator backend as admin to retrieve a JWT token.
 * Caches the token for subsequent requests.
 */
async function getAdminToken() {
  if (cachedToken) {
    return cachedToken;
  }

  const email = process.env.SIMULATOR_ADMIN_EMAIL || 'admin@hackathon.com';
  const password = process.env.SIMULATOR_ADMIN_PASSWORD || 'Admin@123456';

  const url = `${BASE_URL}/auth/login`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data.message || `Failed to login to simulator: ${response.statusText}`;
    throw new Error(errorMsg);
  }

  cachedToken = data.result.accessToken;
  return cachedToken;
}

/**
 * Call the simulator admin REST API with bearer token authentication.
 * Automatically handles token expiry/refresh.
 */
async function callSimulatorAdmin(endpoint, method, body = null) {
  let token = await getAdminToken();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  let response = await fetch(`${BASE_URL}${endpoint}`, options);

  if (response.status === 401) {
    // Token might have expired, clear cache and retry once
    cachedToken = null;
    token = await getAdminToken();
    options.headers['Authorization'] = `Bearer ${token}`;
    response = await fetch(`${BASE_URL}${endpoint}`, options);
  }

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data.message || `HTTP error ${response.status}`;
    const err = new Error(errorMsg);
    err.code = data.code;
    err.status = response.status;
    throw err;
  }

  return data.result;
}

/**
 * Toggle the active status of the judge environment for a team on the simulator.
 */
async function toggleJudgeActive(externalTeamId, active) {
  return callSimulatorAdmin(`/team/${externalTeamId}/judge`, 'PATCH', { active });
}

/**
 * Update the judge scenario for a team on the simulator.
 */
async function updateJudgeScenario(externalTeamId, scenario) {
  return callSimulatorAdmin(`/team/${externalTeamId}/judge-scenario`, 'PATCH', { scenario });
}

/**
 * Fetch all available judge scenarios grouped by environment code.
 */
async function getJudgeScenarios() {
  return callSimulatorAdmin('/team/judge-scenarios', 'GET');
}

async function getJudgeLive(externalTeamId) {
  const url = externalTeamId ? `/team/judge-live?teamId=${externalTeamId}` : '/team/judge-live';
  return callSimulatorAdmin(url, 'GET');
}

/**
 * Fetch details of the currently active judge team.
 */
async function getJudgeActive() {
  return callSimulatorAdmin('/team/judge-active', 'GET');
}

/**
 * Fetch details of a specific environment.
 */
async function getEnvironment(environmentId) {
  return callSimulatorAdmin(`/environment/${environmentId}`, 'GET');
}

/**
 * Derives the simulator team code from a team name (ASCII, uppercase, underscores).
 */
function generateTeamCode(teamName) {
  return teamName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function syncTeamToExternalSimulator(team) {
  try {
    if (team.externalTeamId || team.testApiKey) {
      console.log(
        `[MQTT SERVICE] Team "${team.name}" is already synced to external API.`,
      );
      return;
    }

    if (!team.trackId) {
      console.warn(
        `[MQTT SERVICE] Team "${team.name}" has no trackId assigned. Skipping external sync.`,
      );
      return;
    }

    const targetTrackId = team.originalTrackId || team.trackId;
    const track = await mongoose.model('Track').findById(targetTrackId);
    if (!track || !track.environmentId) {
      console.warn(
        `[MQTT SERVICE] Track not found or environmentId is empty for track "${targetTrackId}". Skipping external sync.`,
      );
      return;
    }

    let baseCode = generateTeamCode(team.name);
    if (!baseCode) {
      baseCode = `TEAM_${team._id.toString().substring(18).toUpperCase()}`;
    }

    let code = baseCode;
    let syncSuccess = false;
    let result = null;
    let attempts = 0;

    while (!syncSuccess && attempts < 3) {
      try {
        attempts++;
        result = await createExternalTeam(code, team.name, track.environmentId);
        syncSuccess = true;
      } catch (err) {
        if (err.code === "TEAM_CODE_EXISTS" && attempts < 3) {
          const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
          code = `${baseCode}_${suffix}`;
          console.log(
            `[MQTT SERVICE] Team code conflicted. Retrying with new code: ${code}`,
          );
        } else {
          throw err;
        }
      }
    }

    if (result) {
      team.externalTeamId = result.team?.id || "";
      team.externalTeamCode = code;
      team.accessCode = result.accessCode || "";
      team.testApiKey = result.testApiKey || "";
      team.judgeApiKey = result.judgeApiKey || "";
      team.mqttUsername = result.mqttUsername || "";
      team.mqttPassword = result.mqttPassword || "";
      team.testTopic = `hackathon/${code.toLowerCase()}/test/telemetry`;
      team.judgeTopic = `hackathon/${code.toLowerCase()}/judge/telemetry`;
      await team.save();

      console.log(
        `[MQTT SERVICE] Successfully synchronized team "${team.name}" to simulator. Code: ${code}`,
      );
    }
  } catch (error) {
    console.error(
      `[MQTT SERVICE] Failed to sync team "${team.name}" to external API:`,
      error.message,
    );
  }
}

module.exports = {
  createExternalTeam,
  generateTeamCode,
  syncTeamToExternalSimulator,
  fetchExternalKeys,
  toggleJudgeActive,
  updateJudgeScenario,
  getJudgeScenarios,
  getJudgeLive,
  getJudgeActive,
  getEnvironment
};
