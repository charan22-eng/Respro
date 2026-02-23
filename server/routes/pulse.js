/**
 * Pulse Routes
 * API endpoints for fetching repository health data
 */

import express from 'express';
import { fetchRepoData, parseRepoUrl, fetchLatestCommitSha } from '../services/githubService.js';
import { getCachedData, setCachedData, invalidateCache } from '../services/cacheService.js';
import { generatePulseSummary } from '../services/ollamaService.js';
import { streamChatResponse } from '../services/chatService.js';
import { analyzeCommit } from '../services/commitAnalyzerService.js';
import { getProjectPlaybook, buildContextFromPlaybook, syncCommitsToPlaybook, getAllContributorPlaybooks } from '../services/playbookService.js';
import { detectCollisions } from '../services/collisionService.js';
import { broadcast, addConnection, removeConnection } from '../services/sseService.js';
import { setRepoVersion } from '../services/pollingService.js';

const router = express.Router();

/**
 * POST /api/pulse
 * Fetch repository health data with AI-generated summary
 * Uses version-based caching (invalidates when latest commit SHA changes)
 * Returns data immediately, processes AI summary in background
 * Body: { repoUrl: "https://github.com/owner/repo", forceRefresh?: boolean }
 */
router.post('/pulse', async (req, res, next) => {
  try {
    const { repoUrl, forceRefresh } = req.body;

    // Validate input
    if (!repoUrl || typeof repoUrl !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid repoUrl parameter',
        code: 'INVALID_INPUT'
      });
    }

    // Validate URL format
    let owner, repo;
    try {
      ({ owner, repo } = parseRepoUrl(repoUrl));
    } catch (error) {
      return res.status(400).json({
        error: error.message,
        code: 'INVALID_URL'
      });
    }

    // Get auth token
    const token = req.session?.githubToken || process.env.GITHUB_TOKEN;

    // Fetch latest commit SHA (lightweight API call for version check)
    const latestSha = await fetchLatestCommitSha(owner, repo, token);
    
    // Check cache with version validation (skip if forceRefresh)
    if (!forceRefresh) {
      const cachedData = await getCachedData(repoUrl, latestSha);
      if (cachedData) {
        console.log(`Returning cached data for ${owner}/${repo} (version: ${latestSha?.substring(0, 7)})`);
        // Set repo version for polling service to track
        setRepoVersion(owner, repo, latestSha);
        return res.json({
          ...cachedData,
          cached: true,
          cacheVersion: latestSha?.substring(0, 7)
        });
      }
    } else {
      // Force refresh - invalidate cache first
      console.log(`Force refresh requested for ${owner}/${repo}`);
      await invalidateCache(repoUrl);
    }

    // Cache miss or version changed - fetch fresh data
    console.log(`Fetching fresh data for ${owner}/${repo} (new version: ${latestSha?.substring(0, 7)})`);
    const repoData = await fetchRepoData(repoUrl, token);
    
    // Set repo version for polling service to track
    setRepoVersion(owner, repo, latestSha);

    // Return GitHub data immediately with pending AI status
    const initialResponse = {
      repoData,
      summary: null,
      summaryError: null,
      playbookAvailable: false,
      aiPending: true,
      cached: false
    };

    res.json(initialResponse);

    // Process AI in background (non-blocking)
    processAIInBackground(owner, repo, repoUrl, repoData, token, latestSha);

  } catch (error) {
    console.error('Error in /api/pulse:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message, code: 'REPO_NOT_FOUND' });
    }
    if (error.message.includes('rate limit')) {
      return res.status(429).json({ error: error.message, code: 'RATE_LIMITED' });
    }
    if (error.message.includes('private') || error.message.includes('forbidden')) {
      return res.status(403).json({ error: error.message, code: 'ACCESS_DENIED' });
    }
    next(error);
  }
});

/**
 * Background AI processing - runs after response is sent
 * @param {string} owner - Repo owner
 * @param {string} repo - Repo name
 * @param {string} repoUrl - Full repo URL for caching
 * @param {object} repoData - GitHub data
 * @param {string} token - GitHub token
 * @param {string} version - Latest commit SHA for cache versioning
 */
async function processAIInBackground(owner, repo, repoUrl, repoData, token, version) {
  let playbookContext = null;
  let playbookAvailable = false;
  let summary = null;
  let summaryError = null;

  try {
    // Sync commits to playbook
    await syncCommitsToPlaybook(owner, repo, repoData.commits, repoData, token);
    playbookContext = await buildContextFromPlaybook(owner, repo);
    playbookAvailable = !!(playbookContext && playbookContext.projectSummary);
    
    // Broadcast playbook update
    broadcast(owner, repo, 'playbook', { 
      available: playbookAvailable,
      context: playbookContext 
    });
  } catch (pbError) {
    console.warn('Playbook sync failed:', pbError.message);
  }

  try {
    console.log(`Generating AI summary for ${owner}/${repo}...`);
    const startTime = Date.now();
    summary = await generatePulseSummary(repoData, playbookContext);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (summary) {
      console.log(`AI summary generated in ${duration}s`);
    } else {
      summaryError = 'AI returned malformed response';
    }
  } catch (aiError) {
    console.error('AI summary failed:', aiError.message);
    summaryError = aiError.message;
  }

  // Cache the complete response with version (SHA)
  const completeData = {
    repoData,
    summary,
    summaryError,
    playbookAvailable
  };
  await setCachedData(repoUrl, completeData, version);

  // Broadcast AI completion to connected clients
  broadcast(owner, repo, 'summary', { summary, summaryError, playbookAvailable });
}

/**
 * POST /api/chat
 * Chat with AI about the repository using SSE streaming
 * Body: { messages: [{role, content}], repoContext: object }
 */
router.post('/chat', async (req, res) => {
  try {
    const { messages, repoContext } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid messages array',
        code: 'INVALID_INPUT'
      });
    }

    if (!repoContext || !repoContext.meta) {
      return res.status(400).json({
        error: 'Missing repoContext — run a pulse first',
        code: 'MISSING_CONTEXT'
      });
    }

    // Limit conversation to last 20 messages
    const trimmedMessages = messages.slice(-20);

    // Enrich context with playbook and collision data (server-side fetch)
    const { owner, name: repo } = repoContext.meta;
    let enrichedContext = { ...repoContext };
    
    try {
      // Fetch playbook context
      const playbookContext = await buildContextFromPlaybook(owner, repo);
      if (playbookContext) {
        enrichedContext.playbook = playbookContext;
      }
      
      // Fetch collision data
      const collisionData = await detectCollisions(owner, repo);
      if (collisionData) {
        enrichedContext.collisions = collisionData;
      }
    } catch (enrichError) {
      console.warn('Failed to enrich chat context:', enrichError.message);
      // Continue without enriched data
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    let fullResponse = '';

    try {
      fullResponse = await streamChatResponse(
        trimmedMessages,
        enrichedContext,
        (chunk) => {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }
      );

      res.write(`data: ${JSON.stringify({ done: true, fullResponse })}\n\n`);
    } catch (streamError) {
      console.error('Chat stream error:', streamError.message);
      res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
    }

    res.end();

  } catch (error) {
    console.error('Error in /api/chat:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: error.message || 'Chat service error',
        code: 'CHAT_ERROR'
      });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

/**
 * POST /api/commit/analyze
 * Analyze a specific commit using AI
 * Body: { owner: string, repo: string, sha: string }
 */
router.post('/commit/analyze', async (req, res, next) => {
  try {
    const { owner, repo, sha } = req.body;

    if (!owner || typeof owner !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid owner parameter', code: 'INVALID_INPUT' });
    }
    if (!repo || typeof repo !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid repo parameter', code: 'INVALID_INPUT' });
    }
    if (!sha || typeof sha !== 'string' || sha.trim().length < 7) {
      return res.status(400).json({ error: 'Missing or invalid sha parameter (min 7 characters)', code: 'INVALID_INPUT' });
    }

    // Cache check — commit SHAs are immutable so caching is safe
    const cacheKey = `commit:${owner.toLowerCase()}/${repo.toLowerCase()}/${sha.toLowerCase()}`;
    const cached = await getCachedData(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const token = process.env.GITHUB_TOKEN;
    const result = await analyzeCommit(owner, repo, sha.trim(), token);

    await setCachedData(cacheKey, result);

    res.json({ ...result, cached: false });

  } catch (error) {
    console.error('Error in /api/commit/analyze:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message, code: 'COMMIT_NOT_FOUND' });
    }
    if (error.message.includes('rate limit')) {
      return res.status(429).json({ error: error.message, code: 'RATE_LIMITED' });
    }
    if (error.message.includes('private') || error.message.includes('forbidden')) {
      return res.status(403).json({ error: error.message, code: 'ACCESS_DENIED' });
    }
    next(error);
  }
});

/**
 * GET /api/repos/:owner/:repo/contributors/:username/commits
 * Fetch latest 5 commits by a specific contributor
 */
router.get('/repos/:owner/:repo/contributors/:username/commits', async (req, res, next) => {
  try {
    const { owner, repo, username } = req.params;

    const cacheKey = `contributor-commits:${owner.toLowerCase()}/${repo.toLowerCase()}/${username.toLowerCase()}`;
    const cached = await getCachedData(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const token = process.env.GITHUB_TOKEN;
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?author=${username}&per_page=5`;
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitSage'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'Repository not found', code: 'REPO_NOT_FOUND' });
      }
      if (response.status === 403) {
        return res.status(429).json({ error: 'Rate limited', code: 'RATE_LIMITED' });
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    const commits = data.map(c => ({
      sha: c.sha,
      message: c.commit.message.split('\n')[0],
      date: c.commit.author?.date || c.commit.committer?.date,
      author: c.author?.login || c.commit.author?.name || username
    }));

    await setCachedData(cacheKey, commits);
    res.json(commits);

  } catch (error) {
    console.error('Error fetching contributor commits:', error.message);
    next(error);
  }
});

/**
 * GET /api/events/:owner/:repo
 * SSE endpoint for real-time updates
 */
router.get('/events/:owner/:repo', (req, res) => {
  const { owner, repo } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Send initial connection confirmation
  res.write(`event: connected\ndata: {"repo":"${owner}/${repo}"}\n\n`);

  // Register connection
  addConnection(owner, repo, res);

  // Keep-alive ping every 30 seconds
  const pingInterval = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(pingInterval);
    removeConnection(owner, repo, res);
  });
});

export default router;
