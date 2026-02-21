/**
 * Chat Service
 * Handles conversational AI about repository data using Ollama cloud models
 * Enhanced with playbook context and collision detection data
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'kimi-k2.5:cloud';
const CHAT_TIMEOUT = 180000; // 3 minutes for cloud model

/**
 * Format relative time from date
 */
function formatRelativeTime(dateStr) {
  if (!dateStr) return 'unknown';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

/**
 * Build the enhanced system prompt with all available data
 */
function buildSystemPrompt(repoContext) {
  const { 
    meta, 
    commits = [], 
    branches = [], 
    pullRequests = [], 
    issues = [], 
    contributors = [], 
    blockers = [],
    playbook,
    collisions
  } = repoContext;

  // Get active contributors from recent commits
  const recentCommitters = [...new Set(commits.slice(0, 20).map(c => c.author))];
  
  // Build contributor activity summary
  const contributorStats = contributors.slice(0, 10).map(c => {
    const recentCommits = commits.filter(commit => commit.author === c.login).length;
    return `• ${c.login}: ${c.totalCommits} total, ${recentCommits} recent`;
  }).join('\n');

  // Build playbook context if available
  let playbookContext = '';
  if (playbook) {
    playbookContext = `
=== PROJECT PLAYBOOK (AI-analyzed history) ===
Project Summary: ${playbook.projectSummary || 'Not yet generated'}
Velocity: ${playbook.overallVelocity || 'unknown'}
Tech Areas: ${(playbook.techAreas || []).join(', ') || 'Not analyzed'}
Total Commits Tracked: ${playbook.totalCommitsTracked || 0}

Recent Commit Analysis:
${(playbook.recentEntries || playbook.commits?.slice(-10) || []).map(c => 
  `• [${c.shortId}] ${c.author}: ${c.added || c.message?.substring(0, 60) || 'No description'}`
).join('\n') || 'No recent entries'}

Contributor Insights:
${(playbook.contributorSummaries || []).slice(0, 5).map(cs => 
  `• ${cs.login}: ${cs.summary || 'No summary'} (Areas: ${(cs.primaryAreas || []).join(', ') || 'various'})`
).join('\n') || 'No contributor insights yet'}
`;
  }

  // Build collision context if available
  let collisionContext = '';
  if (collisions) {
    const activeCollisions = (collisions.collisions || []).filter(c => c.status === 'active');
    const hotZones = (collisions.hotZones || []).slice(0, 5);
    
    if (activeCollisions.length > 0 || hotZones.length > 0) {
      collisionContext = `
=== COLLISION RADAR (Work Overlap Detection) ===
Active Collisions: ${activeCollisions.length}
${activeCollisions.slice(0, 5).map(c => 
  `• ${c.contributor1} ↔ ${c.contributor2}: ${c.type} in ${c.file} [${c.severity}]`
).join('\n') || 'No active collisions'}

Hot Zones (frequently modified files):
${hotZones.map(hz => 
  `• ${hz.file}: ${hz.contributors?.length || 0} contributors, ${hz.totalModifications || 0} modifications`
).join('\n') || 'No hot zones detected'}
`;
    }
  }

  // Build PR summary
  const prSummary = pullRequests.slice(0, 8).map(pr => {
    const age = formatRelativeTime(pr.createdAt);
    const status = pr.isDraft ? 'DRAFT' : (pr.reviewDecision || 'pending');
    return `• PR #${pr.number}: "${pr.title}" by ${pr.author} (${age}) [${status}]`;
  }).join('\n') || 'No open PRs';

  // Build issue summary
  const issueSummary = issues.slice(0, 8).map(issue => {
    const labels = issue.labels?.map(l => l.name).join(', ') || 'no labels';
    const age = formatRelativeTime(issue.createdAt);
    return `• Issue #${issue.number}: "${issue.title}" [${labels}] (${age})`;
  }).join('\n') || 'No open issues';

  // Build branch summary
  const branchSummary = branches.slice(0, 10).map(b => {
    const status = [];
    if (b.isStale) status.push('STALE');
    if (b.hasOpenPR) status.push('HAS PR');
    if (b.behindDefault > 0) status.push(`${b.behindDefault} behind`);
    const statusStr = status.length > 0 ? ` [${status.join(', ')}]` : '';
    return `• ${b.name}: last commit ${b.daysSinceLastCommit ?? '?'} days ago by ${b.lastCommitAuthor || 'unknown'}${statusStr}`;
  }).join('\n') || 'No branches';

  // Build blockers summary
  const blockerSummary = (blockers || []).length === 0 
    ? 'No blockers detected - development flow is healthy!'
    : blockers.map(b => `• [${b.severity.toUpperCase()}] ${b.title}: ${b.description}`).join('\n');

  return `You are ProjectPulse AI, an intelligent assistant for analyzing the GitHub repository "${meta.fullName}".

You have comprehensive access to:
- Real-time repository metrics and activity
- AI-analyzed commit history (Project Playbook)
- Collision detection (overlapping work between contributors)
- PR/Issue status and contributor statistics

RESPONSE GUIDELINES:
1. Be direct and specific - cite actual data, names, numbers, and dates
2. Use structured formatting when helpful (lists, sections)
3. For recommendations, explain the reasoning based on data
4. If data is missing or unclear, say so explicitly
5. Keep responses focused and actionable (2-4 paragraphs unless detail requested)
6. When discussing contributors, reference their actual activity patterns

=== REPOSITORY OVERVIEW ===
Repository: ${meta.fullName}
Description: ${meta.description || 'No description'}
Language: ${meta.language || 'Not specified'}
Stars: ${meta.stars} | Forks: ${meta.forks} | Watchers: ${meta.watchers || 0}
Default Branch: ${meta.defaultBranch}
Created: ${formatRelativeTime(meta.createdAt)}
Last Push: ${formatRelativeTime(meta.pushedAt)}

=== ACTIVITY SUMMARY ===
Recent Commits: ${commits.length}
Active Contributors: ${recentCommitters.length} (${recentCommitters.slice(0, 5).join(', ')}${recentCommitters.length > 5 ? '...' : ''})
Open PRs: ${pullRequests.length}
Open Issues: ${issues.length}
Active Branches: ${branches.length}

=== CONTRIBUTOR STATS ===
${contributorStats || 'No contributor data'}

=== BRANCHES ===
${branchSummary}

=== PULL REQUESTS ===
${prSummary}

=== ISSUES ===
${issueSummary}

=== BLOCKERS ===
${blockerSummary}
${playbookContext}${collisionContext}
=== END CONTEXT ===

Now respond to the user's question using the data above. Be helpful, specific, and data-driven.`;
}

/**
 * Strip think tags from model responses
 */
function cleanResponse(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/**
 * Send a chat message and stream the response
 * @param {Array} messages - [{role: 'user'|'assistant', content: string}]
 * @param {object} repoContext - Full repoData object with optional playbook/collision data
 * @param {function} onChunk - Callback for each streamed chunk
 * @returns {Promise<string>} Complete response text
 */
export async function streamChatResponse(messages, repoContext, onChunk) {
  const systemPrompt = buildSystemPrompt(repoContext);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT);

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ]
    }),
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat model error: ${response.status} - ${errorText}`);
  }

  let fullResponse = '';
  let inThinkBlock = false;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(l => l.trim());

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) {
          fullResponse += parsed.message.content;

          // Track think blocks to avoid streaming them
          if (parsed.message.content.includes('<think>')) inThinkBlock = true;
          if (parsed.message.content.includes('</think>')) {
            inThinkBlock = false;
            continue;
          }
          if (!inThinkBlock) {
            onChunk(parsed.message.content);
          }
        }
      } catch (e) {
        // Skip malformed lines
      }
    }
  }

  return cleanResponse(fullResponse);
}

/**
 * Non-streaming version (fallback)
 */
export async function sendChatMessage(messages, repoContext) {
  const systemPrompt = buildSystemPrompt(repoContext);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT);

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ]
    }),
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`Chat model error: ${response.status}`);
  }

  const data = await response.json();
  return cleanResponse(data.message?.content || '');
}

export default { streamChatResponse, sendChatMessage };
