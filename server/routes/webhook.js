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
import { moveTaskByPR } from '../services/boardService.js';
import { createCheckRun, updateCheckRun } from '../services/githubService.js';
import { sendChatMessage } from '../services/chatService.js';
import { getWebhookSecret } from './auth.js';

const router = express.Router();

/**
 * Verify GitHub webhook signature
 */
function verifySignature(payload, signature) {
  const secret = getWebhookSecret();
  if (!secret) return true; // Skip verification if no secret configured
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
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
  let commitId = pr.head?.sha || '';
  
  if (payload.action === 'closed' && pr.merged) {
    eventType = 'merge';
    commitId = pr.merge_commit_sha || commitId;
  }

  return {
    eventType,
    prNumber: pr.number,
    commitId,
    author: pr.user?.login || 'unknown',
    timestamp: pr.updated_at,
    message: pr.title,
    branch: pr.head?.ref || '',
    filesChanged: [],
    additions: pr.additions || 0,
    deletions: pr.deletions || 0,
    primaryArea: derivePrimaryArea([], pr.head?.ref || ''),
    merged: pr.merged || false,
    baseBranch: pr.base?.ref || ''
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

  const secret = getWebhookSecret();
  if (secret && !verifySignature(rawBody, signature)) {
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
      
      // Auto-move board tasks based on PR events
      if (eventData.prNumber) {
        try {
          let targetColumn = null;
          
          // PR opened → move linked task to in_review
          if (eventData.eventType === 'pr_opened') {
            targetColumn = 'in_review';
          }
          // PR merged → move linked task to done
          else if (eventData.eventType === 'merge' && eventData.merged) {
            targetColumn = 'done';
          }
          
          if (targetColumn) {
            const movedTask = await moveTaskByPR(owner, repo, eventData.prNumber, targetColumn);
            if (movedTask) {
              console.log(`Auto-moved task "${movedTask.title}" to ${targetColumn} via PR #${eventData.prNumber}`);
              broadcast(owner, repo, 'board_task_moved', {
                taskId: movedTask.id,
                taskTitle: movedTask.title,
                column: targetColumn,
                prNumber: eventData.prNumber,
                auto: true
              });
            }
          }
        } catch (boardError) {
          console.warn(`Could not auto-move board task for PR #${eventData.prNumber}:`, boardError.message);
        }

        // Phase 3: Distribution (GitHub Check Runs)
        if (token && (eventData.eventType === 'pr_opened' || eventData.eventType === 'pr_synchronize')) {
          try {
            console.log(`Running respro analysis for PR #${eventData.prNumber}...`);
            const check = await createCheckRun(
              owner, 
              repo, 
              token, 
              'respro AI Review', 
              eventData.commitId, 
              'in_progress'
            );

            const playbook = await getProjectPlaybook(owner, repo);
            
            const prompt = `Analyze PR #${eventData.prNumber}: "${eventData.message}" 
Branch: ${eventData.branch} -> ${eventData.baseBranch || 'main'}

Please provide a brief impact analysis based on the Project Playbook. Does this align with the overall velocity and tech areas? Are there any potential collisions with recent active branches?`;

            const aiResponse = await sendChatMessage([{ role: 'user', content: prompt }], { meta: { owner, name: repo, fullName: `${owner}/${repo}` }, playbook });

            await updateCheckRun(
              owner, 
              repo, 
              token, 
              check.id, 
              'completed', 
              'success',
              {
                title: 'respro PR Analysis',
                summary: 'AI Analysis complete',
                text: aiResponse
              }
            );
            console.log(`Successfully posted respro Check Run for PR #${eventData.prNumber}`);
          } catch (checkError) {
            console.error(`Failed to run GitHub Check for PR #${eventData.prNumber}:`, checkError.message);
          }
        }
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
