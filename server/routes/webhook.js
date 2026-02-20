/**
 * Webhook Routes
 * Receives GitHub webhook events and updates playbooks in real-time
 */

import express from 'express';
import crypto from 'crypto';
import { updatePlaybookWithEvent, getProjectPlaybook } from '../services/playbookService.js';
import { fetchCommitDetails } from '../services/githubService.js';
import { broadcast } from '../services/sseService.js';
import { invalidateCache } from '../services/cacheService.js';

const router = express.Router();

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

/**
 * Verify GitHub webhook signature
 */
function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET) return true; // Skip verification if no secret configured
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Derive primary area from file paths or branch name
 */
function derivePrimaryArea(filesChanged, branch) {
  if (filesChanged && filesChanged.length > 0) {
    const parts = filesChanged[0].split('/');
    return parts.length > 1 ? parts[0] : 'root';
  }
  if (branch) {
    const parts = branch.split('/');
    return parts.length > 1 ? parts[1] : parts[0];
  }
  return 'unknown';
}

/**
 * Normalize push event commits to eventData objects
 */
function normalizePushEvent(payload) {
  const branch = (payload.ref || '').replace('refs/heads/', '');
  return (payload.commits || []).map(commit => ({
    eventType: 'commit',
    commitId: commit.id,
    author: commit.author?.username || commit.author?.name || 'unknown',
    timestamp: commit.timestamp,
    message: (commit.message || '').split('\n')[0],
    branch,
    filesChanged: [...(commit.added || []), ...(commit.modified || []), ...(commit.removed || [])],
    additions: 0,
    deletions: 0,
    primaryArea: derivePrimaryArea(
      [...(commit.added || []), ...(commit.modified || [])],
      branch
    )
  }));
}

/**
 * Normalize pull_request event to eventData
 */
function normalizePREvent(payload) {
  const pr = payload.pull_request;
  if (!pr) return null;

  let eventType = 'pr_' + payload.action;
  if (payload.action === 'closed' && pr.merged) {
    eventType = 'merge';
  }

  return {
    eventType,
    commitId: pr.merge_commit_sha || pr.head?.sha || '',
    author: pr.user?.login || 'unknown',
    timestamp: pr.updated_at,
    message: pr.title,
    branch: pr.head?.ref || '',
    filesChanged: [],
    additions: pr.additions || 0,
    deletions: pr.deletions || 0,
    primaryArea: derivePrimaryArea([], pr.head?.ref || '')
  };
}

/**
 * Normalize create event (branch creation)
 */
function normalizeCreateEvent(payload) {
  if (payload.ref_type !== 'branch') return null;
  return {
    eventType: 'branch_create',
    commitId: payload.master_branch || '',
    author: payload.sender?.login || 'unknown',
    timestamp: new Date().toISOString(),
    message: `Created branch: ${payload.ref}`,
    branch: payload.ref,
    filesChanged: [],
    additions: 0,
    deletions: 0,
    primaryArea: derivePrimaryArea([], payload.ref)
  };
}

/**
 * POST /api/webhook/:owner/:repo
 * GitHub webhook endpoint — responds immediately, processes async
 */
router.post('/webhook/:owner/:repo', express.raw({ type: 'application/json' }), async (req, res) => {
  const { owner, repo } = req.params;
  const signature = req.headers['x-hub-signature-256'];
  const eventType = req.headers['x-github-event'];

  // Get raw body for signature verification
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  if (WEBHOOK_SECRET && !verifySignature(rawBody, signature)) {
    console.warn(`Webhook signature verification failed for ${owner}/${repo}`);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Respond immediately — don't make GitHub wait for Ollama
  res.status(200).json({ received: true });

  // Parse payload
  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    console.error('Failed to parse webhook payload');
    return;
  }

  // Normalize events based on type
  let events = [];
  try {
    if (eventType === 'push') {
      events = normalizePushEvent(payload);
    } else if (eventType === 'pull_request') {
      const event = normalizePREvent(payload);
      if (event) events = [event];
    } else if (eventType === 'create') {
      const event = normalizeCreateEvent(payload);
      if (event) events = [event];
    } else {
      console.log(`Ignoring webhook event type: ${eventType}`);
      return;
    }
  } catch (error) {
    console.error('Failed to normalize webhook event:', error.message);
    return;
  }

  // Process each event (async, after response already sent)
  const token = process.env.GITHUB_TOKEN;
  
  // Invalidate cache so next request gets fresh data
  await invalidateCache(`${owner}/${repo}`);
  
  // Broadcast that new events are incoming
  broadcast(owner, repo, 'webhook_received', { 
    type: eventType, 
    count: events.length,
    timestamp: new Date().toISOString()
  });
  
  for (const eventData of events) {
    try {
      console.log(`Processing webhook event: ${eventData.eventType} by ${eventData.author} on ${owner}/${repo}`);
      
      // Broadcast immediate event (before AI processing)
      broadcast(owner, repo, 'new_event', {
        type: eventData.eventType,
        commitId: eventData.commitId,
        shortId: eventData.commitId?.substring(0, 7),
        author: eventData.author,
        message: eventData.message,
        branch: eventData.branch,
        timestamp: eventData.timestamp,
        processing: true
      });
      
      // Fetch commit details including diff if we have a commit ID and token
      if (token && eventData.commitId && eventData.eventType === 'commit') {
        try {
          const details = await fetchCommitDetails(owner, repo, eventData.commitId, token);
          eventData.filesChanged = details.filesChanged;
          eventData.additions = details.additions;
          eventData.deletions = details.deletions;
          eventData.files = details.files;
        } catch (fetchError) {
          console.warn(`Could not fetch commit details for ${eventData.commitId}:`, fetchError.message);
        }
      }
      
      // Update playbook (includes AI summarization)
      const result = await updatePlaybookWithEvent(owner, repo, eventData);
      
      // Broadcast completed event with AI summary
      if (result.updated) {
        const latestCommit = result.projectPlaybook?.commits?.slice(-1)[0];
        broadcast(owner, repo, 'event_processed', {
          type: eventData.eventType,
          commitId: eventData.commitId,
          shortId: eventData.commitId?.substring(0, 7),
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
        
        // Also broadcast updated playbook summary
        broadcast(owner, repo, 'playbook_updated', {
          projectSummary: result.projectPlaybook?.projectSummary,
          overallVelocity: result.projectPlaybook?.overallVelocity,
          totalCommits: result.projectPlaybook?.totalCommitsTracked
        });
      }
    } catch (error) {
      console.error(`Failed to process webhook event ${eventData.commitId}:`, error.message);
      broadcast(owner, repo, 'event_error', {
        commitId: eventData.commitId,
        error: error.message
      });
    }
  }
});

export default router;
