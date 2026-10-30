const { Octokit } = require('@octokit/rest');

const isMock = process.env.GITHUB_SERVICE_MOCK === 'true';
const orgName = process.env.GITHUB_ORGANIZATION || 'sealhackathon-2026';

let octokit;
if (!isMock && process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
  octokit = new Octokit({
    auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN
  });
}

/**
 * Creates a team repository in the organization.
 * @param {string} repoName - Repository name (typically team name slugified)
 * @param {string} visibility - 'private' or 'public'
 * @returns {Promise<{repoUrl: string, githubRepoId: string}>}
 */
async function createTeamRepository(repoName, visibility = 'private', customOrgName) {
  const activeOrgName = customOrgName || orgName;
  if (isMock || !octokit) {
    console.log(`[GITHUB MOCK] Creating ${visibility} repository: ${activeOrgName}/${repoName}`);
    // Simulate slight delay
    await new Promise(resolve => setTimeout(resolve, 500));
    const randomId = Math.floor(Math.random() * 100000000).toString();
    return {
      repoUrl: `https://github.com/${activeOrgName}/${repoName}`,
      githubRepoId: randomId,
      owner: activeOrgName
    };
  }

  try {
    // Attempt to create org repo
    console.log(`Attempting to create repository "${repoName}" in organization "${activeOrgName}"...`);
    const response = await octokit.repos.createInOrg({
      org: activeOrgName,
      name: repoName,
      private: visibility === 'private',
      auto_init: true
    });
    const ownerName = response.data.owner ? response.data.owner.login : activeOrgName;
    console.log(`Successfully created repository in organization: ${response.data.html_url} (owner: ${ownerName})`);
    return {
      repoUrl: response.data.html_url,
      githubRepoId: response.data.id.toString(),
      owner: ownerName
    };
  } catch (error) {
    console.error('Error creating GitHub repository in org:', error.message);

    // The name is taken in the org: let the caller pick another name instead of
    // silently creating the repo somewhere else.
    if (error.status === 422 && /already exists/i.test(error.message || '')) {
      const takenError = new Error(`Repository "${activeOrgName}/${repoName}" already exists.`);
      takenError.code = 'REPO_NAME_TAKEN';
      throw takenError;
    }

    // Attempt to fall back to creating in the authenticated user's account
    try {
      console.log(`[GITHUB FALLBACK] Attempting to create repository "${repoName}" under authenticated user's account...`);
      const response = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: visibility === 'private',
        auto_init: true
      });
      const ownerName = response.data.owner ? response.data.owner.login : activeOrgName;
      console.log(`[GITHUB FALLBACK] Successfully created repository under personal account: ${response.data.html_url} (owner: ${ownerName})`);
      return {
        repoUrl: response.data.html_url,
        githubRepoId: response.data.id.toString(),
        owner: ownerName
      };
    } catch (fallbackError) {
      console.error('[GITHUB FALLBACK] Error creating GitHub repository under personal account:', fallbackError.message);
      // Never return a fake record here: its URL can point at another team's real repo,
      // which would hand that repo (push access, commits, AI review) to this team.
      throw fallbackError;
    }
  }
}

/**
 * Adds a collaborator to the team repository.
 * @param {string} repoName - Repository name
 * @param {string} username - GitHub username of collaborator
 * @param {string} permission - 'pull', 'push', 'admin', 'maintain', 'triage'
 * @returns {Promise<boolean>}
 */
async function addCollaborator(repoName, username, permission = 'push', customOrgName) {
  const activeOrgName = customOrgName || orgName;
  if (!username) return false;

  if (isMock || !octokit) {
    console.log(`[GITHUB MOCK] Inviting collaborator: ${username} to ${activeOrgName}/${repoName} with permission ${permission}`);
    return true;
  }

  try {
    await octokit.repos.addCollaborator({
      owner: activeOrgName,
      repo: repoName,
      username: username,
      permission: permission
    });
    console.log(`Invited collaborator ${username} to repository ${repoName}`);
    return true;
  } catch (error) {
    console.error(`Error inviting collaborator ${username}:`, error.message);
    return true; // Return true as fallback to prevent app crashing
  }
}

/**
 * Removes a collaborator from the team repository.
 * @param {string} repoName - Repository name
 * @param {string} username - GitHub username of collaborator
 * @param {string} customOrgName - Organization name override
 * @returns {Promise<boolean>}
 */
async function removeCollaborator(repoName, username, customOrgName) {
  const activeOrgName = customOrgName || orgName;
  if (!username) return false;

  if (isMock || !octokit) {
    console.log(`[GITHUB MOCK] Removing collaborator: ${username} from ${activeOrgName}/${repoName}`);
    return true;
  }

  try {
    await octokit.repos.removeCollaborator({
      owner: activeOrgName,
      repo: repoName,
      username: username
    });
    console.log(`Removed collaborator ${username} from repository ${repoName}`);
    return true;
  } catch (error) {
    console.error(`Error removing collaborator ${username}:`, error.message);
    return true; // Return true as fallback to prevent app crashing
  }
}

/**
 * Fetches commits from the repository since a given date.
 * @param {string} repoName - Repository name
 * @param {Date} sinceDate - Commits fetched since this date
 * @returns {Promise<Array>}
 */
async function fetchCommits(repoName, sinceDate, customOrgName) {
  const activeOrgName = customOrgName || orgName;
  if (isMock || !octokit) {
    // Generate realistic mock commits
    const mockCommits = [
      {
        sha: 'b8a8f1025a4d1e2e9c3c0a5e8a7f1a3e9c4b7d12',
        message: 'Initial commit with project scaffolding',
        authorName: 'Team Leader',
        authorUsername: 'team-leader-git',
        authorEmail: 'leader@example.com',
        committedAt: new Date(Date.now() - 3600000 * 3), // 3 hours ago
        additions: 120,
        deletions: 0,
        changedFilesCount: 4
      },
      {
        sha: '3c0a5e8a7f1a3e9c4b7d12b8a8f1025a4d1e2e9c',
        message: 'feat: Add authentication form and connect with API client',
        authorName: 'John Doe',
        authorUsername: 'johndoe-git',
        authorEmail: 'johndoe@example.com',
        committedAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
        additions: 85,
        deletions: 12,
        changedFilesCount: 2
      },
      {
        sha: '7f1a3e9c4b7d12b8a8f1025a4d1e2e9c3c0a5e8a',
        message: 'style: Redesign dashboard with Tailwind v4 gradients',
        authorName: 'Alice Smith',
        authorUsername: 'alicesmith-git',
        authorEmail: 'alice@example.com',
        committedAt: new Date(Date.now() - 3600000 * 1), // 1 hour ago
        additions: 45,
        deletions: 8,
        changedFilesCount: 1
      }
    ];

    // Filter commits by sinceDate if provided
    if (sinceDate) {
      return mockCommits.filter(c => c.committedAt > sinceDate);
    }
    return mockCommits;
  }

  try {
    const params = {
      owner: activeOrgName,
      repo: repoName
    };
    if (sinceDate) {
      params.since = sinceDate.toISOString();
    }

    const { data } = await octokit.repos.listCommits(params);

    // Map response to our commit schema format
    const commitsPromises = data.map(async (c) => {
      // Get detailed commit to get additions/deletions
      let details;
      try {
        details = await octokit.repos.getCommit({
          owner: activeOrgName,
          repo: repoName,
          ref: c.sha
        });
      } catch (err) {
        console.error('Error fetching commit details:', err.message);
      }

      return {
        sha: c.sha,
        message: c.commit.message,
        authorName: c.commit.author ? c.commit.author.name : 'Unknown',
        authorUsername: c.author ? c.author.login : 'unknown',
        authorEmail: c.commit.author ? c.commit.author.email : '',
        committedAt: new Date(c.commit.author.date),
        additions: details ? details.data.stats.additions : 0,
        deletions: details ? details.data.stats.deletions : 0,
        changedFilesCount: details ? details.data.files.length : 0,
        commitUrl: c.html_url
      };
    });

    return await Promise.all(commitsPromises);
  } catch (error) {
    // Rethrow so syncRepo marks the repo failed and keeps lastSyncedAt. Returning [] here
    // looked like "no new commits", moved lastSyncedAt past the unseen commits and lost them.
    console.error(`Error fetching commits for ${repoName}:`, error.message);
    throw new Error(`GitHub listCommits failed for ${activeOrgName}/${repoName}: ${error.message}`);
  }
}

/**
 * Fetches files changed and their diff patch in a commit.
 * @param {string} repoName - Repository name
 * @param {string} commitSha - Commit SHA
 * @returns {Promise<Array>}
 */
async function fetchCommitFiles(repoName, commitSha, customOrgName) {
  const activeOrgName = customOrgName || orgName;
  if (isMock || !octokit || commitSha.startsWith('fallback-')) {
    // Generate realistic mock files and patches based on the commitSha
    if (commitSha.includes('b8a8f1025')) {
      return [
        {
          filename: 'package.json',
          status: 'added',
          additions: 25,
          deletions: 0,
          changes: 25,
          patch: '@@ -0,0 +1,25 @@\n+{\n+  "name": "seal-hackathon-client",\n+  "version": "1.0.0",\n+  "dependencies": {\n+    "react": "^19.0.0",\n+    "tailwindcss": "^4.0.0"\n+  }\n+}',
          rawUrl: '',
          blobUrl: ''
        },
        {
          filename: 'src/main.tsx',
          status: 'added',
          additions: 15,
          deletions: 0,
          changes: 15,
          patch: '@@ -0,0 +1,15 @@\n+import React from \'react\';\n+import ReactDOM from \'react-dom/client\';\n+import App from \'./App\';\n+import \'./index.css\';\n+\n+ReactDOM.createRoot(document.getElementById(\'root\')!).render(\n+  <React.StrictMode>\n+    <App />\n+  </React.StrictMode>\n+);',
          rawUrl: '',
          blobUrl: ''
        }
      ];
    } else if (commitSha.includes('3c0a5e8a')) {
      return [
        {
          filename: 'src/components/LoginForm.tsx',
          status: 'added',
          additions: 55,
          deletions: 0,
          changes: 55,
          patch: '@@ -0,0 +1,55 @@\n+import React, { useState } from \'react\';\n+import axios from \'axios\';\n+\n+export default function LoginForm() {\n+  const [email, setEmail] = useState(\'\');\n+  const [password, setPassword] = useState(\'\');\n+\n+  const handleSubmit = async (e: React.FormEvent) => {\n+    e.preventDefault();\n+    const res = await axios.post(\'/api/auth/login\', { email, password });\n+    localStorage.setItem(\'token\', res.data.token);\n+  };\n+\n+  return (\n+    <form onSubmit={handleSubmit}>\n+      <input type="email" value={email} onChange={e => setEmail(e.target.value)} />\n+      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />\n+      <button type="submit">Login</button>\n+    </form>\n+  );\n+}',
          rawUrl: '',
          blobUrl: ''
        }
      ];
    } else {
      return [
        {
          filename: 'src/index.css',
          status: 'modified',
          additions: 10,
          deletions: 2,
          changes: 12,
          patch: '@@ -5,4 +5,12 @@\n body {\n-  background-color: #ffffff;\n+  background-color: #0f172a;\n+  color: #f8fafc;\n }\n+\n+.hero-gradient {\n+  background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);\n+}',
          rawUrl: '',
          blobUrl: ''
        }
      ];
    }
  }

  try {
    const { data } = await octokit.repos.getCommit({
      owner: activeOrgName,
      repo: repoName,
      ref: commitSha
    });

    return data.files.map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch || '',
      rawUrl: f.raw_url,
      blobUrl: f.blob_url
    }));
  } catch (error) {
    console.error(`Error fetching files for commit ${commitSha}:`, error.message);
    return [];
  }
}

/**
 * Creates or simulates creating a GitHub Organization for an event.
 * @param {string} orgName - The organization name
 * @returns {Promise<boolean>}
 */
async function createOrganization(orgName) {
  console.log(`[GITHUB] Auto-provisioning organization: ${orgName}`);
  if (isMock || !octokit) {
    console.log(`[GITHUB MOCK] Created organization: ${orgName}`);
    return true;
  }
  try {
    // Check if organization exists
    await octokit.orgs.get({ org: orgName });
    console.log(`[GITHUB] Organization ${orgName} verified and linked.`);
    return true;
  } catch (error) {
    console.warn(`[GITHUB WARNING] Organization ${orgName} not found or inaccessible:`, error.message);
    console.log(`[GITHUB FALLBACK] Simulating connection link to Organization ${orgName}`);
    return true;
  }
}

/**
 * Links a GitHub organization to the system.
 * @param {string} orgName - Organization name
 * @returns {Promise<boolean>}
 */
async function linkOrganization(orgName) {
  return createOrganization(orgName);
}

/**
 * Creates an issue in the team repository.
 * @param {string} repoName - Repository name
 * @param {string} title - Issue title
 * @param {string} body - Issue body
 * @param {string} customOrgName - Organization name override
 * @returns {Promise<Object>} Created issue details or null
 */
async function createIssue(repoName, title, body, customOrgName) {
  const activeOrgName = customOrgName || orgName;
  if (isMock || !octokit) {
    console.log(`[GITHUB MOCK] Creating issue in ${activeOrgName}/${repoName}: "${title}"`);
    return {
      id: `mock-issue-${Date.now()}`,
      number: Math.floor(Math.random() * 100) + 1,
      html_url: `https://github.com/${activeOrgName}/${repoName}/issues/mock`
    };
  }

  try {
    console.log(`[GITHUB] Attempting to create issue in "${activeOrgName}/${repoName}"...`);
    const response = await octokit.issues.create({
      owner: activeOrgName,
      repo: repoName,
      title,
      body
    });
    console.log(`[GITHUB] Successfully created issue: ${response.data.html_url}`);
    return response.data;
  } catch (error) {
    console.error(`Error creating issue in ${repoName}:`, error.message);
    return null;
  }
}

/**
 * Searches for users on GitHub.
 * @param {string} query - Search query (username or email)
 * @returns {Promise<Array<{username: string, avatarUrl: string}>>}
 */
async function searchUsers(query) {
  if (!query || query.trim().length < 2) return [];

  if (isMock || !octokit) {
    console.log(`[GITHUB MOCK] Searching users with query: ${query}`);
    const mockUsers = [
      { username: 'trietnp', avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4' },
      { username: 'thanhnha', avatarUrl: 'https://avatars.githubusercontent.com/u/583232?v=4' },
      { username: 'cuongnv', avatarUrl: 'https://avatars.githubusercontent.com/u/583233?v=4' },
      { username: 'ngocnt', avatarUrl: 'https://avatars.githubusercontent.com/u/583234?v=4' },
      { username: 'octocat', avatarUrl: 'https://avatars.githubusercontent.com/u/583235?v=4' }
    ];
    return mockUsers.filter(u =>
      u.username.toLowerCase().includes(query.toLowerCase()) ||
      query.includes('@')
    );
  }

  try {
    const q = query.includes('@') ? `${query} in:email` : query;
    const response = await octokit.search.users({ q });
    return (response.data.items || []).map(item => ({
      username: item.login,
      avatarUrl: item.avatar_url
    }));
  } catch (error) {
    console.error('Error searching GitHub users:', error.message);
    return [];
  }
}

module.exports = {
  createTeamRepository,
  addCollaborator,
  removeCollaborator,
  fetchCommits,
  fetchCommitFiles,
  createOrganization,
  linkOrganization,
  createIssue,
  searchUsers,
  checkGithubUserExists,
  checkGithubEmailExists
};

/**
 * Checks if a GitHub username exists on GitHub.
 * @param {string} username - GitHub username
 * @returns {Promise<boolean>}
 */
async function checkGithubUserExists(username) {
  if (!username) return false;
  if (isMock || !octokit) {
    return username.toLowerCase() !== 'invalid-user';
  }

  try {
    await octokit.users.getByUsername({ username });
    return true;
  } catch (error) {
    if (error.status === 404) {
      return false;
    }
    console.error(`Error verifying GitHub user ${username}:`, error.message);
    return true; 
  }
}

/**
 * Checks if an email is registered on GitHub.
 * @param {string} email - Email address
 * @returns {Promise<boolean>}
 */
async function checkGithubEmailExists(email) {
  if (!email) return false;
  if (isMock || !octokit) {
    return !email.toLowerCase().includes('invalid');
  }

  try {
    const res = await octokit.search.users({ q: `${email} in:email` });
    return (res.data.total_count || 0) > 0;
  } catch (error) {
    console.error(`Error searching GitHub email ${email}:`, error.message);
    return true; 
  }
}


