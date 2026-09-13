/**
 * Playbook Service
 * Persistent JSON-based knowledge store for project and contributor playbooks
 */

import { Mutex } from 'async-mutex';
import { getDb } from './db.js';
import { saveCommitEmbedding } from './embeddingService.js';
import { summarizeEvent, batchSummarizeEvents, regenerateProjectSummary, regenerateContributorSummary } from './commitSummarizer.js';
import { fetchCommitDetails } from './githubService.js';

// Map of mutexes per repository to prevent concurrent writes
const repoMutexes = new Map();

function getRepoMutex(owner, repo) {
  const key = `${owner}/${repo}`;
  if (!repoMutexes.has(key)) {
    repoMutexes.set(key, new Mutex());
  }
  return repoMutexes.get(key);
}

// Playbook paths are no longer used for SQLite storage

/**
 * Derive primary area from file paths (most common top-level directory)
 */
function derivePrimaryArea(filesChanged) {
  if (!filesChanged || filesChanged.length === 0) return 'unknown';
  const areas = {};
  filesChanged.forEach(f => {
    const parts = f.split('/');
    const area = parts.length > 1 ? parts[0] : 'root';
    areas[area] = (areas[area] || 0) + 1;
  });
  return Object.entries(areas).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
}

/**
 * Derive tech areas from all commits' file paths
 */
function deriveTechAreas(commits) {
  const areas = new Set();
  commits.forEach(c => {
    (c.filesChanged || []).forEach(f => {
      const parts = f.split('/');
      if (parts.length > 1) areas.add(parts[0]);
    });
  });
  return [...areas].slice(0, 10);
}

/**
 * Initialize a new playbook for a repo
 */
export async function initPlaybook(owner, repo) {
  const db = await getDb();
  const id = `${owner}/${repo}`;
  const row = await db.get('SELECT data FROM projects WHERE id = ?', id);
  if (row) {
    return JSON.parse(row.data);
  }
  
  const playbook = {
    repoFullName: id,
    lastUpdated: new Date().toISOString(),
    totalCommitsTracked: 0,
    projectSummary: '',
    techAreas: [],
    overallVelocity: 'steady',
    commits: []
  };
  await db.run('INSERT INTO projects (id, data) VALUES (?, ?)', id, JSON.stringify(playbook));
  return playbook;
}

/**
 * Read project playbook (returns null if doesn't exist)
 */
export async function getProjectPlaybook(owner, repo) {
  const db = await getDb();
  const row = await db.get('SELECT data FROM projects WHERE id = ?', `${owner}/${repo}`);
  return row ? JSON.parse(row.data) : null;
}

/**
 * Read contributor playbook (returns null if doesn't exist)
 */
export async function getContributorPlaybook(owner, repo, username) {
  const db = await getDb();
  const row = await db.get('SELECT data FROM contributors WHERE id = ?', `${owner}/${repo}/${username}`);
  return row ? JSON.parse(row.data) : null;
}

/**
 * Get all contributor playbooks for a repo
 */
export async function getAllContributorPlaybooks(owner, repo) {
  const db = await getDb();
  const rows = await db.all('SELECT data FROM contributors WHERE id LIKE ?', `${owner}/${repo}/%`);
  const contributors = {};
  for (const row of rows) {
    const playbook = JSON.parse(row.data);
    contributors[playbook.login] = playbook;
  }
  return contributors;
}

/**
 * Write project playbook to disk
 */
export async function writeProjectPlaybook(owner, repo, playbook) {
  const db = await getDb();
  await db.run('INSERT OR REPLACE INTO projects (id, data) VALUES (?, ?)', `${owner}/${repo}`, JSON.stringify(playbook));
}

/**
 * Write contributor playbook to disk
 */
async function writeContributorPlaybook(owner, repo, username, playbook) {
  const db = await getDb();
  await db.run('INSERT OR REPLACE INTO contributors (id, data) VALUES (?, ?)', `${owner}/${repo}/${username}`, JSON.stringify(playbook));
}

/**
 * Update playbook with a single event
 * Called by webhook handler and pulse sync
 */
export async function updatePlaybookWithEvent(owner, repo, eventData) {
  let projectPlaybook = await getProjectPlaybook(owner, repo);
  if (!projectPlaybook) {
    projectPlaybook = await initPlaybook(owner, repo);
  }

  // Check if this commit already exists in the playbook
  if (projectPlaybook.commits.some(c => c.commitId === eventData.commitId)) {
    return { projectPlaybook, updated: false };
  }

  // Generate before/added/impact via AI
  const summary = await summarizeEvent(eventData, projectPlaybook);

  const entry = {
    commitId: eventData.commitId,
    shortId: (eventData.commitId || '').substring(0, 7),
    author: eventData.author,
    timestamp: eventData.timestamp,
    message: eventData.message || '', // Store commit message for re-analysis
    branch: eventData.branch,
    eventType: eventData.eventType,
    filesChanged: eventData.filesChanged || [],
    primaryArea: eventData.primaryArea || derivePrimaryArea(eventData.filesChanged),
    before: summary.before,
    added: summary.added,
    impact: summary.impact,
    keywords: summary.keywords
  };

  // Append to project playbook
  projectPlaybook.commits.push(entry);
  projectPlaybook.totalCommitsTracked = projectPlaybook.commits.length;
  projectPlaybook.lastUpdated = new Date().toISOString();
  projectPlaybook.techAreas = deriveTechAreas(projectPlaybook.commits);

  // Save vector embedding for RAG
  try {
    await saveCommitEmbedding(owner, repo, eventData.commitId, entry);
  } catch (e) {
    console.warn(`Failed to save embedding for commit ${eventData.commitId}:`, e.message);
  }

  // Update/create contributor playbook
  let contributorPlaybook = await getContributorPlaybook(owner, repo, eventData.author);
  if (!contributorPlaybook) {
    contributorPlaybook = {
      login: eventData.author,
      avatarUrl: eventData.authorAvatar || null,
      repoFullName: `${owner}/${repo}`,
      lastUpdated: new Date().toISOString(),
      totalCommits: 0,
      primaryAreas: [],
      contributorSummary: '',
      completionSignals: {
        velocityTrend: 'unknown',
        commitSentiment: 'neutral',
        churnSignal: 'none',
        lastUpdated: new Date().toISOString()
      },
      commits: []
    };
  }

  contributorPlaybook.commits.push(entry);
  contributorPlaybook.totalCommits = contributorPlaybook.commits.length;
  contributorPlaybook.lastUpdated = new Date().toISOString();
  contributorPlaybook.primaryAreas = [...new Set(
    contributorPlaybook.commits.map(c => c.primaryArea).filter(a => a !== 'unknown')
  )].slice(0, 5);

  const mutex = getRepoMutex(owner, repo);
  const release = await mutex.acquire();
  
  try {
    // Regenerate summaries (non-blocking errors)
    try {
      const projSummary = await regenerateProjectSummary(projectPlaybook);
      if (projSummary) {
        projectPlaybook.projectSummary = projSummary.projectSummary;
        projectPlaybook.overallVelocity = projSummary.overallVelocity;
      }
    } catch (e) {
      console.warn('Failed to regenerate project summary:', e.message);
    }

    try {
      const contribSummary = await regenerateContributorSummary(contributorPlaybook, projectPlaybook);
      if (contribSummary) {
        contributorPlaybook.contributorSummary = contribSummary;
      }
    } catch (e) {
      console.warn('Failed to regenerate contributor summary:', e.message);
    }

    // Write to disk
    await writeProjectPlaybook(owner, repo, projectPlaybook);
    await writeContributorPlaybook(owner, repo, eventData.author, contributorPlaybook);

    return { projectPlaybook, contributorPlaybook, updated: true };
  } finally {
    release();
  }
}

/**
 * Build condensed context from playbook for AI consumption
 */
export async function buildContextFromPlaybook(owner, repo) {
  const project = await getProjectPlaybook(owner, repo);
  if (!project) return null;

  const contributors = await getAllContributorPlaybooks(owner, repo);
  const contributorSummaries = Object.entries(contributors).map(([login, pb]) => ({
    login,
    summary: pb.contributorSummary,
    primaryAreas: pb.primaryAreas,
    totalCommits: pb.totalCommits
  }));

  return {
    projectSummary: project.projectSummary,
    overallVelocity: project.overallVelocity,
    techAreas: project.techAreas,
    totalCommitsTracked: project.totalCommitsTracked,
    recentEntries: project.commits.slice(-20).map(c => ({
      shortId: c.shortId,
      author: c.author,
      added: c.added,
      impact: c.impact,
      timestamp: c.timestamp
    })),
    contributorSummaries
  };
}

/**
 * Initialize playbook from existing commits (batch mode for first-time repos)
 * Processes last 20 commits in a single Ollama call
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Array} commits - Array of commit objects
 * @param {object} repoData - Full repo data including meta
 * @param {string} token - GitHub API token for fetching commit details
 */
export async function initializeFromExistingCommits(owner, repo, commits, repoData, token = null) {
  console.log(`Initializing playbook for ${owner}/${repo} from ${commits.length} existing commits...`);

  let projectPlaybook = await initPlaybook(owner, repo);

  // Take last 20 commits, oldest first for chronological order
  const toProcess = commits.slice(0, 20).reverse();

  // Filter out commits already in playbook
  const newCommits = toProcess.filter(c =>
    !projectPlaybook.commits.some(existing => existing.commitId === c.sha)
  );

  if (newCommits.length === 0) {
    console.log('All commits already in playbook, skipping init.');
    return projectPlaybook;
  }

  // Build event data for each commit - fetch details if token available
  const events = [];
  for (const c of newCommits) {
    let commitDetails = { filesChanged: [], additions: 0, deletions: 0, files: [] };
    if (token) {
      // Fetch actual diff for better AI summaries
      commitDetails = await fetchCommitDetails(owner, repo, c.sha, token);
    }
    
    events.push({
      commitId: c.sha,
      shortId: c.sha.substring(0, 7),
      author: c.author,
      timestamp: c.date,
      message: c.message,
      branch: c.branch || 'main',
      eventType: 'commit',
      filesChanged: commitDetails.filesChanged,
      additions: commitDetails.additions,
      deletions: commitDetails.deletions,
      files: commitDetails.files, // Include actual diff patches
      primaryArea: derivePrimaryArea(commitDetails.filesChanged)
    });
  }

  // Batch summarize all at once
  const repoMeta = repoData?.meta || { name: repo, description: '', language: '' };
  const summaries = await batchSummarizeEvents(events, repoMeta);

  // Build entries and append
  for (let i = 0; i < events.length; i++) {
    const entry = {
      commitId: events[i].commitId,
      shortId: events[i].shortId,
      author: events[i].author,
      timestamp: events[i].timestamp,
      message: events[i].message || '', // Store commit message for re-analysis
      branch: events[i].branch,
      eventType: events[i].eventType,
      filesChanged: events[i].filesChanged,
      primaryArea: events[i].primaryArea,
      before: summaries[i].before,
      added: summaries[i].added,
      impact: summaries[i].impact,
      keywords: summaries[i].keywords
    };

    projectPlaybook.commits.push(entry);

    // Save vector embedding
    try {
      await saveCommitEmbedding(owner, repo, entry.commitId, entry);
    } catch (e) {}

    // Also create/update contributor playbook
    let contribPb = await getContributorPlaybook(owner, repo, events[i].author);
    if (!contribPb) {
      const contribData = repoData?.contributors?.find(c => c.login === events[i].author);
      contribPb = {
        login: events[i].author,
        avatarUrl: contribData?.avatarUrl || null,
        repoFullName: `${owner}/${repo}`,
        lastUpdated: new Date().toISOString(),
        totalCommits: 0,
        primaryAreas: [],
        contributorSummary: '',
        completionSignals: { velocityTrend: 'unknown', commitSentiment: 'neutral', churnSignal: 'none', lastUpdated: new Date().toISOString() },
        commits: []
      };
    }
    contribPb.commits.push(entry);
    contribPb.totalCommits = contribPb.commits.length;
    contribPb.lastUpdated = new Date().toISOString();
    contribPb.primaryAreas = [...new Set(contribPb.commits.map(c => c.primaryArea).filter(a => a !== 'unknown'))].slice(0, 5);
    await writeContributorPlaybook(owner, repo, events[i].author, contribPb);
  }

  // Update project metadata
  projectPlaybook.totalCommitsTracked = projectPlaybook.commits.length;
  projectPlaybook.lastUpdated = new Date().toISOString();
  projectPlaybook.techAreas = deriveTechAreas(projectPlaybook.commits);

  const mutex = getRepoMutex(owner, repo);
  const release = await mutex.acquire();
  try {
    // Regenerate project summary
    try {
      const projSummary = await regenerateProjectSummary(projectPlaybook);
      if (projSummary) {
        projectPlaybook.projectSummary = projSummary.projectSummary;
        projectPlaybook.overallVelocity = projSummary.overallVelocity;
      }
    } catch (e) {
      console.warn('Failed to generate project summary during init:', e.message);
    }

    await writeProjectPlaybook(owner, repo, projectPlaybook);
    console.log(`Playbook initialized with ${newCommits.length} commits for ${owner}/${repo}`);

    return projectPlaybook;
  } finally {
    release();
  }
}

/**
 * Sync new commits from repoData into playbook (called on every pulse)
 * Only processes commits not already in the playbook
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Array} commits - Array of commit objects
 * @param {object} repoData - Full repo data including meta
 * @param {string} token - GitHub API token for fetching commit details
 */
export async function syncCommitsToPlaybook(owner, repo, commits, repoData, token = null) {
  let projectPlaybook = await getProjectPlaybook(owner, repo);

  if (!projectPlaybook) {
    // First time — full initialization
    return initializeFromExistingCommits(owner, repo, commits, repoData, token);
  }

  const existingShas = new Set(projectPlaybook.commits.map(c => c.commitId));
  const newCommits = commits.filter(c => !existingShas.has(c.sha));

  if (newCommits.length === 0) {
    return projectPlaybook;
  }

  console.log(`Syncing ${newCommits.length} new commits to playbook for ${owner}/${repo}...`);

  // For small batches (1-3), use individual summarization with full diff
  // For larger batches, use batch mode
  if (newCommits.length <= 3) {
    for (const commit of newCommits.reverse()) {
      // Fetch detailed commit info including actual diff
      let commitDetails = { filesChanged: [], additions: 0, deletions: 0, files: [] };
      if (token) {
        commitDetails = await fetchCommitDetails(owner, repo, commit.sha, token);
      }

      await updatePlaybookWithEvent(owner, repo, {
        commitId: commit.sha,
        author: commit.author,
        timestamp: commit.date,
        message: commit.message,
        branch: commit.branch || 'main',
        eventType: 'commit',
        filesChanged: commitDetails.filesChanged,
        additions: commitDetails.additions,
        deletions: commitDetails.deletions,
        files: commitDetails.files, // Include actual diff patches
        primaryArea: derivePrimaryArea(commitDetails.filesChanged),
        authorAvatar: commit.authorAvatar
      });
    }
  } else {
    // Batch mode for 4+ new commits
    await initializeFromExistingCommits(owner, repo, newCommits, repoData, token);
  }

  return getProjectPlaybook(owner, repo);
}

export default {
  initPlaybook,
  getProjectPlaybook,
  getContributorPlaybook,
  getAllContributorPlaybooks,
  updatePlaybookWithEvent,
  buildContextFromPlaybook,
  initializeFromExistingCommits,
  syncCommitsToPlaybook,
  writeProjectPlaybook
};
