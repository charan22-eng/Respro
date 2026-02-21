const API_BASE = '/api';

/**
 * Subscribe to real-time updates for a repository via SSE
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {function} onEvent - Callback for events: (eventType, data) => void
 * @returns {function} Cleanup function to close connection
 */
export function subscribeToUpdates(owner, repo, onEvent) {
  const eventSource = new EventSource(`${API_BASE}/events/${owner}/${repo}`);

  const eventTypes = [
    'connected',
    'summary',
    'playbook',
    'webhook_received',
    'new_event',
    'event_processed',
    'playbook_updated',
    'event_error',
    // Background analysis events
    'background_analysis_started',
    'commit_analyzed',
    'background_analysis_completed',
    'background_analysis_error'
  ];

  eventTypes.forEach(type => {
    eventSource.addEventListener(type, (e) => {
      try {
        onEvent(type, JSON.parse(e.data));
      } catch (err) {
        console.error(`Failed to parse SSE event ${type}:`, err);
      }
    });
  });

  eventSource.onerror = () => {
    onEvent('error', { message: 'Connection lost' });
  };

  return () => eventSource.close();
}

/**
 * Fetch repository pulse data
 * @param {string} repoUrl - GitHub repository URL or owner/repo format
 * @param {boolean} forceRefresh - Skip cache and fetch fresh data
 * @returns {Promise<object>} Repository data
 */
export async function fetchPulseData(repoUrl, forceRefresh = false) {
  const response = await fetch(`${API_BASE}/pulse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ repoUrl, forceRefresh }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || 'Failed to fetch repository data');
    error.response = { data };
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Send a chat message and receive a streamed SSE response
 * @param {Array} messages - Chat messages array [{role, content}]
 * @param {object} repoContext - Full repoData object
 * @param {function} onChunk - Called with (chunk, accumulatedText) as tokens arrive
 * @returns {Promise<string>} The complete response text
 */
export async function sendChatMessage(messages, repoContext, onChunk) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, repoContext }),
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      throw new Error(data.error || 'Chat request failed');
    }
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    const lines = text.split('\n');

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6);

      try {
        const data = JSON.parse(jsonStr);

        if (data.error) {
          throw new Error(data.error);
        }

        if (data.chunk) {
          fullResponse += data.chunk;
          if (onChunk) onChunk(data.chunk, fullResponse);
        }

        if (data.done) {
          return data.fullResponse || fullResponse;
        }
      } catch (e) {
        if (e.message && !e.message.includes('JSON')) throw e;
      }
    }
  }

  return fullResponse;
}

/**
 * Analyze a specific commit using AI
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} sha - Commit SHA
 * @returns {Promise<object>} Analysis result
 */
export async function analyzeCommit(owner, repo, sha) {
  const response = await fetch(`${API_BASE}/commit/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo, sha }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || 'Failed to analyze commit');
    error.response = { data };
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Fetch latest 5 commits by a specific contributor
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} username - Contributor's GitHub username
 * @returns {Promise<Array>} Array of { sha, message, date, author }
 */
export async function fetchContributorCommits(owner, repo, username) {
  const response = await fetch(`${API_BASE}/repos/${owner}/${repo}/contributors/${username}/commits`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch contributor commits');
  }

  return data;
}

/**
 * Fetch playbook data for a repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<{project: object, contributors: object}>}
 */
export async function fetchPlaybook(owner, repo) {
  const response = await fetch(`${API_BASE}/playbook/${owner}/${repo}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch playbook');
  }

  return data;
}

/**
 * Get commit summary from playbook (if already analyzed)
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} sha - Commit SHA
 * @returns {Promise<{found: boolean, commit: object|null}>}
 */
export async function getPlaybookCommit(owner, repo, sha) {
  const response = await fetch(`${API_BASE}/playbook/${owner}/${repo}/commit/${sha}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch commit from playbook');
  }

  return data;
}

/**
 * Get analysis status for all commits in playbook
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<{total, analyzed, pending, commits, isProcessing, analyzedCommits}>}
 */
export async function getCommitsAnalysisStatus(owner, repo) {
  const response = await fetch(`${API_BASE}/playbook/${owner}/${repo}/commits/status`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch commits status');
  }

  return data;
}

/**
 * Start background analysis for unanalyzed commits
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<{status: string, message: string}>}
 */
export async function startBackgroundAnalysis(owner, repo) {
  const response = await fetch(`${API_BASE}/playbook/${owner}/${repo}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to start background analysis');
  }

  return data;
}

/**
 * Get the background analysis queue status
 * @returns {Promise<{processing: Array, queued: Array, maxConcurrent: number}>}
 */
export async function getAnalysisQueueStatus() {
  const response = await fetch(`${API_BASE}/playbook/analysis/queue`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch queue status');
  }

  return data;
}

/**
 * Get the currently authenticated user
 * @returns {Promise<{user: object|null, authenticated: boolean}>}
 */
export async function getAuthUser() {
  const response = await fetch(`${API_BASE}/auth/user`, { credentials: 'include' });
  return response.json();
}

/**
 * Get the authenticated user's repositories
 * @returns {Promise<Array>} List of repos
 */
export async function getAuthRepos() {
  const response = await fetch(`${API_BASE}/auth/repos`, { credentials: 'include' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch repos');
  return data;
}

/**
 * Create a webhook on a repository
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<object>}
 */
export async function createWebhook(owner, repo) {
  const response = await fetch(`${API_BASE}/auth/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ owner, repo }),
  });
  return response.json();
}

/**
 * Logout the current user
 * @returns {Promise<object>}
 */
export async function logout() {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  return response.json();
}

/**
 * Check API health
 * @returns {Promise<object>} Health status
 */
export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}

/**
 * Get collision detection report for a repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<{collisions, hotZones, stats}>}
 */
export async function getCollisions(owner, repo) {
  const response = await fetch(`${API_BASE}/collisions/${owner}/${repo}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch collisions');
  }

  return data;
}

/**
 * Get collision summary for dashboard
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<{hasCollisions, topCollisions, topHotZones, stats}>}
 */
export async function getCollisionSummary(owner, repo) {
  const response = await fetch(`${API_BASE}/collisions/${owner}/${repo}/summary`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch collision summary');
  }

  return data;
}

/**
 * Resolve (dismiss) a collision
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} collisionId - Unique collision identifier
 * @returns {Promise<{success, collisionId}>}
 */
export async function resolveCollision(owner, repo, collisionId) {
  const response = await fetch(`${API_BASE}/collisions/${owner}/${repo}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collisionId })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to resolve collision');
  }

  return data;
}

/**
 * Unresolve (bring back) a collision
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} collisionId - Unique collision identifier
 * @returns {Promise<{success, collisionId}>}
 */
export async function unresolveCollision(owner, repo, collisionId) {
  const response = await fetch(`${API_BASE}/collisions/${owner}/${repo}/unresolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collisionId })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to unresolve collision');
  }

  return data;
}
