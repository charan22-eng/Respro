/**
 * Playbook Service
 * Persistent JSON-based knowledge store for project and contributor playbooks
 */

import fs from 'fs/promises';
import path from 'path';
import { summarizeEvent, batchSummarizeEvents, regenerateProjectSummary, regenerateContributorSummary } from './commitSummarizer.js';
import { fetchCommitDetails } from './githubService.js';

const PLAYBOOK_DIR = process.env.PLAYBOOK_DIR || path.join(process.cwd(), 'playbooks');

function getRepoDir(owner, repo) {
  return path.join(PLAYBOOK_DIR, `${owner}-${repo}`);
}

function getProjectPath(owner, repo) {
  return path.join(getRepoDir(owner, repo), 'project.json');
}

function getContributorPath(owner, repo, username) {
  return path.join(getRepoDir(owner, repo), 'contributors', `${username}.json`);
}

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
 * Initialize a new playbook for a repo (creates dirs + empty project.json)
 */
export async function initPlaybook(owner, repo) {
  const repoDir = getRepoDir(owner, repo);
  const contributorsDir = path.join(repoDir, 'contributors');

  await fs.mkdir(contributorsDir, { recursive: true });

  const projectPath = getProjectPath(owner, repo);
  try {
    await fs.access(projectPath);
    // Already exists, return it
    const data = await fs.readFile(projectPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    // Doesn't exist, create empty
    const playbook = {
      repoFullName: `${owner}/${repo}`,
      lastUpdated: new Date().toISOString(),
      totalCommitsTracked: 0,
      projectSummary: '',
      techAreas: [],
      overallVelocity: 'steady',
      commits: []
    };
    await fs.writeFile(projectPath, JSON.stringify(playbook, null, 2));
    return playbook;
  }
}

/**
 * Read project playbook (returns null if doesn't exist)
 */
export async function getProjectPlaybook(owner, repo) {
  try {
    const data = await fs.readFile(getProjectPath(owner, repo), 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Read contributor playbook (returns null if doesn't exist)
 */
export async function getContributorPlaybook(owner, repo, username) {
  try {
    const data = await fs.readFile(getContributorPath(owner, repo, username), 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Get all contributor playbooks for a repo
 */
export async function getAllContributorPlaybooks(owner, repo) {
  const contributorsDir = path.join(getRepoDir(owner, repo), 'contributors');
  try {
    const files = await fs.readdir(contributorsDir);
    const contributors = {};
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const data = await fs.readFile(path.join(contributorsDir, file), 'utf-8');
      const playbook = JSON.parse(data);
      contributors[playbook.login] = playbook;
    }
    return contributors;
  } catch {
    return {};
  }
}

/**
 * Write project playbook to disk
 */
async function writeProjectPlaybook(owner, repo, playbook) {
  await fs.mkdir(getRepoDir(owner, repo), { recursive: true });
  await fs.writeFile(getProjectPath(owner, repo), JSON.stringify(playbook, null, 2));
}

/**
 * Write contributor playbook to disk
 */
async function writeContributorPlaybook(owner, repo, username, playbook) {
  const dir = path.join(getRepoDir(owner, repo), 'contributors');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(getContributorPath(owner, repo, username), JSON.stringify(playbook, null, 2));
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
  syncCommitsToPlaybook
};
