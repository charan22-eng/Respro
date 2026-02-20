/**
 * Commit Summarizer Service
 * Generates before/added/impact summaries for playbook entries using Ollama
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'kimi-k2.5:cloud';
const OLLAMA_TIMEOUT = 300000; // 5 minutes for cloud models

/**
 * Call Ollama and parse JSON response (shared pattern)
 */
async function callOllama(systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }),
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const raw = data.message?.content;
  if (!raw) throw new Error('Ollama returned empty content');

  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

  return JSON.parse(cleaned);
}

const SYSTEM_PROMPT = `You are a technical writer embedded in a development team. Your job is to write crisp, jargon-free summaries of code changes for a project health dashboard. You write for both technical and non-technical readers. Be specific, be brief, never use filler words. Always respond with valid JSON only.`;

/**
 * Summarize a single event for the playbook
 * @param {object} eventData - Normalized event data (includes files with patches)
 * @param {object} projectPlaybook - Current project playbook (for context)
 * @returns {Promise<{before, added, impact, keywords}>}
 */
export async function summarizeEvent(eventData, projectPlaybook) {
  const recentContext = (projectPlaybook?.commits || [])
    .slice(-5)
    .map(c => `- ${c.shortId} by ${c.author}: ${c.added}`)
    .join('\n') || 'No prior entries.';

  // Build diff context from actual file patches
  let diffContext = 'No diff available.';
  if (eventData.files && eventData.files.length > 0) {
    diffContext = eventData.files.map(f => 
      `File: ${f.filename} (${f.status}, +${f.additions} -${f.deletions})\n${f.patch || 'No patch'}`
    ).join('\n\n');
  }

  const userPrompt = `Given the following code event and project context, generate a 3-part summary.

Event:
- Author: ${eventData.author}
- Type: ${eventData.eventType}
- Branch: ${eventData.branch}
- Commit message: ${eventData.message}
- Files changed: ${(eventData.filesChanged || []).slice(0, 10).join(', ') || 'unknown'}
- Additions: ${eventData.additions || 0}
- Deletions: ${eventData.deletions || 0}
- Primary area: ${eventData.primaryArea || 'unknown'}

Actual code diff (analyze this to understand what really changed):
${diffContext}

Recent project context (last 5 entries):
${recentContext}

Return exactly this JSON:
{
  "before": "One sentence: what was the state of this area before this change. Max 20 words.",
  "added": "One sentence: what was introduced, fixed, or changed. Name the feature, not the file. Max 20 words.",
  "impact": "One sentence: what this unblocks or enables. Max 20 words.",
  "keywords": ["2-4 keywords: stage + area, e.g. late-stage, auth, bugfix"]
}

Rules:
- IMPORTANT: Base your summary on the ACTUAL CODE DIFF provided, not assumptions.
- If no diff is available, clearly indicate uncertainty in your summary.
- Never start with 'This commit'. Start with the subject directly.
- Never say 'the code'. Say what the feature or fix actually does.
- Return only valid JSON.`;

  try {
    const result = await callOllama(SYSTEM_PROMPT, userPrompt);
    if (!result.before) result.before = 'State unknown.';
    if (!result.added) result.added = eventData.message?.substring(0, 80) || 'Changes made.';
    if (!result.impact) result.impact = 'Impact unclear.';
    if (!Array.isArray(result.keywords)) result.keywords = [];
    return result;
  } catch (error) {
    console.error('Failed to summarize event:', error.message);
    return {
      before: 'State before this change is unknown.',
      added: eventData.message?.substring(0, 80) || 'Changes were made.',
      impact: 'Impact could not be determined by AI.',
      keywords: [eventData.eventType]
    };
  }
}

/**
 * Batch summarize multiple events in a single Ollama call
 * Used for first-time playbook initialization (processes up to 20 commits at once)
 * @param {Array} events - Array of normalized event data objects (with files/patches)
 * @param {object} repoMeta - { name, description, language }
 * @returns {Promise<Array<{before, added, impact, keywords}>>}
 */
export async function batchSummarizeEvents(events, repoMeta) {
  // Build event text with diff info when available
  const eventsText = events.map((e, i) => {
    let diffSummary = '';
    if (e.files && e.files.length > 0) {
      // Include truncated diff for each file
      diffSummary = '\n  Diff:\n' + e.files.slice(0, 3).map(f => 
        `    ${f.filename} (${f.status}): ${f.patch?.substring(0, 200) || 'no patch'}...`
      ).join('\n');
    }
    return `[${i}] ${e.shortId || e.commitId?.substring(0, 7)} by ${e.author} on ${e.branch || 'main'}: "${e.message}" (files: ${(e.filesChanged || []).slice(0, 5).join(', ') || 'unknown'}, +${e.additions || 0} -${e.deletions || 0})${diffSummary}`;
  }).join('\n\n');

  const userPrompt = `You are summarizing ${events.length} commits for a project playbook.

Project: ${repoMeta.name || 'Unknown'} (${repoMeta.language || 'Unknown language'})
Description: ${repoMeta.description || 'No description'}

Commits (oldest to newest) with actual code diffs:
${eventsText}

For EACH commit, generate a before/added/impact summary. Return a JSON array with exactly ${events.length} objects, in the same order as the input:

[
  {
    "before": "One sentence, max 15 words",
    "added": "One sentence, max 15 words",
    "impact": "One sentence, max 15 words",
    "keywords": ["2-3 keywords"]
  }
]

Rules:
- IMPORTANT: Base your summaries on the ACTUAL CODE DIFFS provided, not assumptions.
- Each entry must correspond to the commit at the same index.
- Be specific: name features/fixes based on what the diff shows, not guesses.
- Never say 'This commit' or 'the code'.
- If a diff is missing, indicate uncertainty.
- Return only valid JSON array.`;

  try {
    const result = await callOllama(SYSTEM_PROMPT, userPrompt);
    if (Array.isArray(result) && result.length === events.length) {
      return result.map(r => ({
        before: r.before || 'State unknown.',
        added: r.added || 'Changes made.',
        impact: r.impact || 'Impact unclear.',
        keywords: Array.isArray(r.keywords) ? r.keywords : []
      }));
    }
    // If array length mismatch, pad or trim
    const padded = [];
    for (let i = 0; i < events.length; i++) {
      padded.push(result[i] || {
        before: 'State unknown.',
        added: events[i].message?.substring(0, 60) || 'Changes made.',
        impact: 'Impact unclear.',
        keywords: []
      });
    }
    return padded;
  } catch (error) {
    console.error('Batch summarize failed:', error.message);
    return events.map(e => ({
      before: 'State unknown.',
      added: e.message?.substring(0, 60) || 'Changes made.',
      impact: 'Impact could not be determined.',
      keywords: [e.eventType || 'commit']
    }));
  }
}

/**
 * Regenerate the top-level project summary from recent playbook entries
 */
export async function regenerateProjectSummary(projectPlaybook) {
  const entries = (projectPlaybook.commits || []).slice(-20).map(c =>
    `${c.shortId} by ${c.author}: ${c.added} (${c.impact})`
  ).join('\n');

  const userPrompt = `Based on these recent project entries, write a 2-3 sentence summary of the project's current state. Cover: what the project does, where it stands, and overall momentum.

Return exactly: { "projectSummary": "your summary here", "overallVelocity": "accelerating|steady|slowing|stopped" }

Recent entries:
${entries}`;

  try {
    const result = await callOllama(SYSTEM_PROMPT, userPrompt);
    return {
      projectSummary: result.projectSummary || 'Project summary unavailable.',
      overallVelocity: result.overallVelocity || 'steady'
    };
  } catch (error) {
    console.error('Failed to regenerate project summary:', error.message);
    return null;
  }
}

/**
 * Regenerate a contributor's summary from their playbook entries
 */
export async function regenerateContributorSummary(contributorPlaybook, projectPlaybook) {
  const entries = (contributorPlaybook.commits || []).slice(-15).map(c =>
    `${c.shortId}: ${c.added} (${c.impact})`
  ).join('\n');

  const userPrompt = `Based on this contributor's activity, write a 2-3 sentence summary of their role and contribution. Cover: what area they own, what they shipped, and their momentum.

Return exactly: { "contributorSummary": "your summary here" }

Contributor: ${contributorPlaybook.login}
Project context: ${projectPlaybook?.projectSummary || 'No project summary yet.'}

Their commits:
${entries}`;

  try {
    const result = await callOllama(SYSTEM_PROMPT, userPrompt);
    return result.contributorSummary || null;
  } catch (error) {
    console.error('Failed to regenerate contributor summary:', error.message);
    return null;
  }
}

export default { summarizeEvent, batchSummarizeEvents, regenerateProjectSummary, regenerateContributorSummary };
