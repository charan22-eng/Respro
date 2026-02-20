/**
 * Playbook Routes
 * API endpoints for reading playbook data and background analysis
 */

import express from 'express';
import { getProjectPlaybook, getAllContributorPlaybooks } from '../services/playbookService.js';
import { 
  getCommitsAnalysisStatus, 
  queueRepoForAnalysis, 
  getAnalysisQueueStatus,
  isRepoBeingAnalyzed
} from '../services/backgroundAnalyzerService.js';

const router = express.Router();

/**
 * GET /api/playbook/:owner/:repo
 * Returns the full project playbook + all contributor playbooks
 * Note: No caching here - playbook files are the source of truth
 * and update in real-time via webhooks
 */
router.get('/playbook/:owner/:repo', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;

    const project = await getProjectPlaybook(owner, repo);
    if (!project) {
      return res.json({ project: null, contributors: {} });
    }

    const contributors = await getAllContributorPlaybooks(owner, repo);

    res.json({ project, contributors });
  } catch (error) {
    console.error('Error fetching playbook:', error.message);
    next(error);
  }
});

/**
 * GET /api/playbook/:owner/:repo/commit/:sha
 * Returns commit summary from playbook if available
 * This avoids unnecessary LLM calls when summary already exists
 */
router.get('/playbook/:owner/:repo/commit/:sha', async (req, res, next) => {
  try {
    const { owner, repo, sha } = req.params;

    const project = await getProjectPlaybook(owner, repo);
    if (!project) {
      return res.json({ found: false, commit: null });
    }

    // Find commit in playbook (check both full SHA and short SHA)
    const commit = project.commits.find(c => 
      c.commitId === sha || 
      c.commitId?.startsWith(sha) || 
      c.shortId === sha.substring(0, 7)
    );

    if (!commit) {
      return res.json({ found: false, commit: null });
    }

    res.json({ 
      found: true, 
      commit: {
        sha: commit.commitId,
        shortId: commit.shortId,
        author: commit.author,
        timestamp: commit.timestamp,
        branch: commit.branch,
        eventType: commit.eventType,
        filesChanged: commit.filesChanged,
        primaryArea: commit.primaryArea,
        before: commit.before,
        added: commit.added,
        impact: commit.impact,
        keywords: commit.keywords
      }
    });
  } catch (error) {
    console.error('Error fetching commit from playbook:', error.message);
    next(error);
  }
});

/**
 * GET /api/playbook/:owner/:repo/commits/status
 * Returns which commits have been analyzed (for UI indicators)
 */
router.get('/playbook/:owner/:repo/commits/status', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;

    const status = await getCommitsAnalysisStatus(owner, repo);
    const isProcessing = isRepoBeingAnalyzed(owner, repo);

    res.json({ 
      ...status,
      isProcessing,
      // Legacy field for backwards compatibility
      analyzedCommits: status.commits.filter(c => c.analyzed).map(c => ({
        sha: c.sha,
        shortId: c.shortId,
        hasAnalysis: true
      }))
    });
  } catch (error) {
    console.error('Error fetching commit status:', error.message);
    next(error);
  }
});

/**
 * POST /api/playbook/:owner/:repo/analyze
 * Queue background analysis for unanalyzed commits
 */
router.post('/playbook/:owner/:repo/analyze', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const token = process.env.GITHUB_TOKEN;

    const result = queueRepoForAnalysis(owner, repo, token);
    
    res.json(result);
  } catch (error) {
    console.error('Error starting background analysis:', error.message);
    next(error);
  }
});

/**
 * GET /api/playbook/analysis/queue
 * Returns the current analysis queue status
 */
router.get('/playbook/analysis/queue', async (req, res, next) => {
  try {
    const status = getAnalysisQueueStatus();
    res.json(status);
  } catch (error) {
    console.error('Error fetching queue status:', error.message);
    next(error);
  }
});

export default router;
