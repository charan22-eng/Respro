/**
 * Polling Service
 * Background service that polls GitHub for changes and broadcasts updates via SSE
 * Works alongside webhooks - polling is fallback when webhooks aren't configured
 */

import { fetchLatestCommitSha, fetchFullCommitInfo } from './githubService.js';
import { broadcast, getActiveRepos } from './sseService.js';
import { updatePlaybookWithEvent, getProjectPlaybook } from './playbookService.js';
import { invalidateCache } from './cacheService.js';

// Track last known commit SHA for each repo
const repoVersions = new Map();

// Polling interval (default 30 seconds)
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 30000;

// GitHub token for API calls
const getToken = () => process.env.GITHUB_TOKEN;

let pollingInterval = null;
let isPolling = false;

/**
 * Check a single repo for new commits
 */
async function checkRepoForUpdates(owner, repo) {
  const repoKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const token = getToken();
  
  try {
    // Fetch latest commit SHA
    const latestSha = await fetchLatestCommitSha(owner, repo, token);
    if (!latestSha) return;
    
    const previousSha = repoVersions.get(repoKey);
    
    // First time seeing this repo - just store the SHA
    if (!previousSha) {
      repoVersions.set(repoKey, latestSha);
      console.log(`[Polling] Tracking ${repoKey} at ${latestSha.substring(0, 7)}`);
      return;
    }
    
    // No change
    if (previousSha === latestSha) {
      return;
    }
    
    // New commit detected!
    console.log(`[Polling] New commit detected on ${repoKey}: ${previousSha.substring(0, 7)} → ${latestSha.substring(0, 7)}`);
    repoVersions.set(repoKey, latestSha);
    
    // Invalidate cache
    await invalidateCache(repoKey);
    
    // Fetch full commit details (including author, message, diff)
    let commitInfo = null;
    try {
      commitInfo = await fetchFullCommitInfo(owner, repo, latestSha, token);
    } catch (err) {
      console.warn(`[Polling] Could not fetch commit info: ${err.message}`);
    }
    
    // Broadcast new event immediately
    broadcast(owner, repo, 'new_event', {
      type: 'commit',
      commitId: latestSha,
      shortId: latestSha.substring(0, 7),
      author: commitInfo?.author || 'unknown',
      message: commitInfo?.message || 'New commit',
      branch: commitInfo?.branch || 'main',
      timestamp: commitInfo?.timestamp || new Date().toISOString(),
      processing: true
    });
    
    // Process with AI (async)
    processNewCommit(owner, repo, latestSha, commitInfo, token);
    
  } catch (error) {
    console.error(`[Polling] Error checking ${repoKey}:`, error.message);
  }
}

/**
 * Process a new commit - update playbook and broadcast result
 */
async function processNewCommit(owner, repo, sha, commitInfo, token) {
  try {
    const eventData = {
      eventType: 'commit',
      commitId: sha,
      author: commitInfo?.author || 'unknown',
      timestamp: commitInfo?.timestamp || new Date().toISOString(),
      message: commitInfo?.message || '',
      branch: commitInfo?.branch || 'main',
      filesChanged: commitInfo?.filesChanged || [],
      additions: commitInfo?.additions || 0,
      deletions: commitInfo?.deletions || 0,
      files: commitInfo?.files || [],
      primaryArea: commitInfo?.filesChanged?.[0]?.split('/')[0] || 'root'
    };
    
    // Update playbook with AI summary
    const result = await updatePlaybookWithEvent(owner, repo, eventData);
    
    if (result.updated) {
      const latestCommit = result.projectPlaybook?.commits?.slice(-1)[0];
      
      // Broadcast processed event with AI summary
      broadcast(owner, repo, 'event_processed', {
        type: 'commit',
        commitId: sha,
        shortId: sha.substring(0, 7),
        author: eventData.author,
        message: eventData.message,
        branch: eventData.branch,
        timestamp: eventData.timestamp,
        before: latestCommit?.before,
        added: latestCommit?.added,
        impact: latestCommit?.impact,
        keywords: latestCommit?.keywords,
        processing: false
      });
      
      // Broadcast playbook update
      broadcast(owner, repo, 'playbook_updated', {
        projectSummary: result.projectPlaybook?.projectSummary,
        overallVelocity: result.projectPlaybook?.overallVelocity,
        totalCommits: result.projectPlaybook?.totalCommitsTracked
      });
    }
  } catch (error) {
    console.error(`[Polling] Error processing commit ${sha}:`, error.message);
    broadcast(owner, repo, 'event_error', {
      commitId: sha,
      error: error.message
    });
  }
}

/**
 * Poll all active repos
 */
async function pollActiveRepos() {
  if (isPolling) return; // Prevent overlapping polls
  isPolling = true;
  
  try {
    const activeRepos = getActiveRepos();
    
    if (activeRepos.length === 0) {
      return;
    }
    
    console.log(`[Polling] Checking ${activeRepos.length} active repo(s)...`);
    
    // Check all repos in parallel
    await Promise.all(
      activeRepos.map(({ owner, repo }) => checkRepoForUpdates(owner, repo))
    );
  } catch (error) {
    console.error('[Polling] Error in poll cycle:', error.message);
  } finally {
    isPolling = false;
  }
}

/**
 * Start the polling service
 */
export function startPolling() {
  if (pollingInterval) {
    console.log('[Polling] Already running');
    return;
  }
  
  console.log(`[Polling] Starting background polling (interval: ${POLL_INTERVAL_MS / 1000}s)`);
  
  // Initial poll after 5 seconds
  setTimeout(pollActiveRepos, 5000);
  
  // Then poll at regular intervals
  pollingInterval = setInterval(pollActiveRepos, POLL_INTERVAL_MS);
}

/**
 * Stop the polling service
 */
export function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('[Polling] Stopped');
  }
}

/**
 * Manually trigger a poll for a specific repo
 */
export async function pollRepo(owner, repo) {
  await checkRepoForUpdates(owner, repo);
}

/**
 * Set the known version for a repo (used when initial data is loaded)
 */
export function setRepoVersion(owner, repo, sha) {
  if (sha) {
    const repoKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
    repoVersions.set(repoKey, sha);
  }
}

export default { startPolling, stopPolling, pollRepo, setRepoVersion };
