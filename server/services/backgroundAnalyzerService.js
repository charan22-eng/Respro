/**
 * Background Analyzer Service
 * Processes unanalyzed commits in the playbook asynchronously
 * Runs in chronological order (oldest commits first)
 */

import { getProjectPlaybook, getContributorPlaybook } from './playbookService.js';
import { fetchCommitDetails } from './githubService.js';
import { summarizeEvent, regenerateProjectSummary, regenerateContributorSummary } from './commitSummarizer.js';
import { broadcast } from './sseService.js';
import fs from 'fs/promises';
import path from 'path';

const PLAYBOOK_DIR = process.env.PLAYBOOK_DIR || path.join(process.cwd(), 'playbooks');

// Track which repos are being processed
const processingRepos = new Map();

// Queue of repos waiting to be processed
const repoQueue = [];

// Max concurrent repos being analyzed
const MAX_CONCURRENT = 2;

// Delay between commits to avoid rate limits (ms)
const COMMIT_DELAY_MS = 2000;

/**
 * Check if a commit entry needs analysis
 * Returns true if before/added/impact are missing or are placeholder values
 */
function needsAnalysis(commit) {
  if (!commit) return false;
  
  // Check for missing or placeholder values
  const placeholders = [
    'State unknown.',
    'State before this change is unknown.',
    'Changes made.',
    'Changes were made.',
    'Impact unclear.',
    'Impact could not be determined.',
    'Impact could not be determined by AI.'
  ];
  
  const hasBefore = commit.before && !placeholders.includes(commit.before);
  const hasAdded = commit.added && !placeholders.includes(commit.added);
  const hasImpact = commit.impact && !placeholders.includes(commit.impact);
  
  // Needs analysis if any field is missing/placeholder
  return !hasBefore || !hasAdded || !hasImpact;
}

/**
 * Get list of commits that need analysis for a repo
 * Returns them in chronological order (oldest first) for proper context building
 */
export async function getUnanalyzedCommits(owner, repo) {
  const playbook = await getProjectPlaybook(owner, repo);
  if (!playbook || !playbook.commits) return [];
  
  // Filter commits needing analysis
  // Playbook commits are stored oldest-first, so no need to reverse
  // This ensures we analyze in chronological order for better AI context
  const unanalyzed = playbook.commits.filter(needsAnalysis);
  
  return unanalyzed;
}

/**
 * Get analysis status for all commits in a repo
 */
export async function getCommitsAnalysisStatus(owner, repo) {
  const playbook = await getProjectPlaybook(owner, repo);
  if (!playbook || !playbook.commits) {
    return { total: 0, analyzed: 0, pending: 0, commits: [] };
  }
  
  const commits = playbook.commits.map(c => ({
    sha: c.commitId,
    shortId: c.shortId,
    author: c.author,
    timestamp: c.timestamp,
    analyzed: !needsAnalysis(c)
  }));
  
  const analyzed = commits.filter(c => c.analyzed).length;
  
  return {
    total: commits.length,
    analyzed,
    pending: commits.length - analyzed,
    commits: commits.reverse() // Newest first
  };
}

/**
 * Write updated playbook to disk
 */
async function writeProjectPlaybook(owner, repo, playbook) {
  const repoDir = path.join(PLAYBOOK_DIR, `${owner}-${repo}`);
  const projectPath = path.join(repoDir, 'project.json');
  await fs.mkdir(repoDir, { recursive: true });
  await fs.writeFile(projectPath, JSON.stringify(playbook, null, 2));
}

async function writeContributorPlaybook(owner, repo, username, playbook) {
  const dir = path.join(PLAYBOOK_DIR, `${owner}-${repo}`, 'contributors');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${username}.json`), JSON.stringify(playbook, null, 2));
}

/**
 * Analyze a single commit and update the playbook
 */
async function analyzeAndUpdateCommit(owner, repo, commitId, token) {
  const playbook = await getProjectPlaybook(owner, repo);
  if (!playbook) return null;
  
  const commitIndex = playbook.commits.findIndex(c => c.commitId === commitId);
  if (commitIndex === -1) return null;
  
  const commit = playbook.commits[commitIndex];
  
  // Fetch full commit details including diff and message
  let commitDetails = { message: '', filesChanged: [], additions: 0, deletions: 0, files: [] };
  if (token) {
    try {
      commitDetails = await fetchCommitDetails(owner, repo, commitId, token);
      console.log(`[BackgroundAnalyzer] Fetched details for ${commitId.substring(0, 7)}: ${commitDetails.filesChanged.length} files, message: "${commitDetails.message?.substring(0, 50)}..."`);
    } catch (err) {
      console.warn(`[BackgroundAnalyzer] Could not fetch details for ${commitId.substring(0, 7)}:`, err.message);
    }
  } else {
    console.warn(`[BackgroundAnalyzer] No token provided for ${commitId.substring(0, 7)}, skipping detail fetch`);
  }
  
  // Use message from playbook if available, otherwise from GitHub
  const message = commit.message || commitDetails.message || '';
  
  // Build event data for summarization
  const eventData = {
    commitId: commit.commitId,
    author: commit.author,
    timestamp: commit.timestamp,
    message: message,
    branch: commit.branch,
    eventType: commit.eventType || 'commit',
    filesChanged: commitDetails.filesChanged.length > 0 ? commitDetails.filesChanged : commit.filesChanged,
    additions: commitDetails.additions,
    deletions: commitDetails.deletions,
    files: commitDetails.files,
    primaryArea: commit.primaryArea
  };
  
  console.log(`[BackgroundAnalyzer] Calling AI for ${commit.shortId} with message: "${message?.substring(0, 50)}..."`);
  
  // Generate AI summary
  const summary = await summarizeEvent(eventData, playbook);
  
  console.log(`[BackgroundAnalyzer] AI returned for ${commit.shortId}: before="${summary.before?.substring(0, 30)}...", impact="${summary.impact?.substring(0, 30)}..."`);
  
  // Update the commit entry (preserve message for future re-analysis)
  playbook.commits[commitIndex] = {
    ...commit,
    message: message, // Store message if we fetched it
    before: summary.before,
    added: summary.added,
    impact: summary.impact,
    keywords: summary.keywords,
    analyzedAt: new Date().toISOString()
  };
  
  playbook.lastUpdated = new Date().toISOString();
  
  // Update contributor playbook too
  try {
    const contribPlaybook = await getContributorPlaybook(owner, repo, commit.author);
    if (contribPlaybook) {
      const contribCommitIndex = contribPlaybook.commits.findIndex(c => c.commitId === commitId);
      if (contribCommitIndex !== -1) {
        contribPlaybook.commits[contribCommitIndex] = {
          ...contribPlaybook.commits[contribCommitIndex],
          message: message, // Store message for future re-analysis
          before: summary.before,
          added: summary.added,
          impact: summary.impact,
          keywords: summary.keywords,
          analyzedAt: new Date().toISOString()
        };
        contribPlaybook.lastUpdated = new Date().toISOString();
        await writeContributorPlaybook(owner, repo, commit.author, contribPlaybook);
      }
    }
  } catch (err) {
    console.warn(`[BackgroundAnalyzer] Could not update contributor playbook:`, err.message);
  }
  
  // Save project playbook
  await writeProjectPlaybook(owner, repo, playbook);
  
  return {
    commitId,
    shortId: commit.shortId,
    author: commit.author,
    before: summary.before,
    added: summary.added,
    impact: summary.impact,
    keywords: summary.keywords
  };
}

/**
 * Process all unanalyzed commits for a repo
 */
async function processRepo(owner, repo, token) {
  const repoKey = `${owner}/${repo}`;
  
  if (processingRepos.get(repoKey)) {
    console.log(`[BackgroundAnalyzer] ${repoKey} is already being processed`);
    return;
  }
  
  processingRepos.set(repoKey, true);
  
  try {
    const unanalyzed = await getUnanalyzedCommits(owner, repo);
    
    if (unanalyzed.length === 0) {
      console.log(`[BackgroundAnalyzer] No unanalyzed commits for ${repoKey}`);
      return;
    }
    
    console.log(`[BackgroundAnalyzer] Processing ${unanalyzed.length} unanalyzed commits for ${repoKey}...`);
    
    // Broadcast start
    broadcast(owner, repo, 'background_analysis_started', {
      total: unanalyzed.length,
      message: `Analyzing ${unanalyzed.length} commits...`
    });
    
    let processed = 0;
    
    for (const commit of unanalyzed) {
      try {
        console.log(`[BackgroundAnalyzer] Analyzing ${commit.shortId} (${processed + 1}/${unanalyzed.length})...`);
        
        const result = await analyzeAndUpdateCommit(owner, repo, commit.commitId, token);
        
        if (result) {
          processed++;
          
          // Broadcast progress
          broadcast(owner, repo, 'commit_analyzed', {
            ...result,
            progress: {
              current: processed,
              total: unanalyzed.length
            }
          });
        }
        
        // Delay between commits to avoid rate limits
        if (processed < unanalyzed.length) {
          await new Promise(resolve => setTimeout(resolve, COMMIT_DELAY_MS));
        }
        
      } catch (err) {
        console.error(`[BackgroundAnalyzer] Failed to analyze ${commit.shortId}:`, err.message);
        // Continue with next commit
      }
    }
    
    // Regenerate project summary after batch processing
    if (processed > 0) {
      try {
        const playbook = await getProjectPlaybook(owner, repo);
        if (playbook) {
          const projSummary = await regenerateProjectSummary(playbook);
          if (projSummary) {
            playbook.projectSummary = projSummary.projectSummary;
            playbook.overallVelocity = projSummary.overallVelocity;
            await writeProjectPlaybook(owner, repo, playbook);
          }
        }
      } catch (err) {
        console.warn(`[BackgroundAnalyzer] Could not regenerate project summary:`, err.message);
      }
    }
    
    console.log(`[BackgroundAnalyzer] Completed ${processed}/${unanalyzed.length} commits for ${repoKey}`);
    
    // Broadcast completion
    broadcast(owner, repo, 'background_analysis_completed', {
      processed,
      total: unanalyzed.length,
      message: `Analysis complete: ${processed} commits processed`
    });
    
  } catch (err) {
    console.error(`[BackgroundAnalyzer] Error processing ${repoKey}:`, err.message);
    broadcast(owner, repo, 'background_analysis_error', {
      error: err.message
    });
  } finally {
    processingRepos.delete(repoKey);
    
    // Process next repo in queue if any
    processNextInQueue();
  }
}

/**
 * Process the next repo in the queue
 */
function processNextInQueue() {
  if (repoQueue.length === 0) return;
  if (processingRepos.size >= MAX_CONCURRENT) return;
  
  const next = repoQueue.shift();
  if (next) {
    processRepo(next.owner, next.repo, next.token);
  }
}

/**
 * Queue a repo for background analysis
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} token - GitHub API token
 * @returns {object} Queue status
 */
export function queueRepoForAnalysis(owner, repo, token) {
  const repoKey = `${owner}/${repo}`;
  
  // Check if already processing
  if (processingRepos.get(repoKey)) {
    return { status: 'processing', message: `${repoKey} is already being analyzed` };
  }
  
  // Check if already in queue
  const inQueue = repoQueue.some(r => `${r.owner}/${r.repo}` === repoKey);
  if (inQueue) {
    return { status: 'queued', message: `${repoKey} is already in the queue` };
  }
  
  // Add to queue
  repoQueue.push({ owner, repo, token });
  
  // Try to start processing if we have capacity
  if (processingRepos.size < MAX_CONCURRENT) {
    processNextInQueue();
    return { status: 'started', message: `Started analyzing ${repoKey}` };
  }
  
  return { 
    status: 'queued', 
    message: `${repoKey} queued for analysis`,
    position: repoQueue.length
  };
}

/**
 * Get the current analysis status
 */
export function getAnalysisQueueStatus() {
  return {
    processing: Array.from(processingRepos.keys()),
    queued: repoQueue.map(r => `${r.owner}/${r.repo}`),
    maxConcurrent: MAX_CONCURRENT
  };
}

/**
 * Check if a repo is currently being analyzed
 */
export function isRepoBeingAnalyzed(owner, repo) {
  return processingRepos.has(`${owner}/${repo}`);
}

export default {
  getUnanalyzedCommits,
  getCommitsAnalysisStatus,
  queueRepoForAnalysis,
  getAnalysisQueueStatus,
  isRepoBeingAnalyzed
};
