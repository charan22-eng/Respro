/**
 * Collision Detection Service
 * Detects overlapping work between contributors based on:
 * 1. Line-range overlap (actual code lines modified)
 * 2. Function/block level overlap (same function modified)
 * 3. File-level overlap (same file, different areas - lowest severity)
 * 
 * Features:
 * - Time window: Only considers commits within 7 days of each other as potential collisions
 * - Resolution tracking: Users can dismiss/resolve collisions
 */

import { getProjectPlaybook, writeProjectPlaybook } from './playbookService.js';
import { fetchCommitDetails } from './githubService.js';

/**
 * Time window for considering commits as "concurrent work" (in milliseconds)
 * Default: 3 days
 */
const COLLISION_TIME_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Collision types - from most to least severe
 */
const COLLISION_TYPE = {
  LINE_OVERLAP: 'line_overlap',
  FUNCTION_OVERLAP: 'function_overlap',
  FILE_ONLY: 'file_only'
};

/**
 * Severity levels
 */
const SEVERITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

/**
 * Check if two timestamps are within the collision time window
 */
function isWithinTimeWindow(timestamp1, timestamp2) {
  const date1 = new Date(timestamp1).getTime();
  const date2 = new Date(timestamp2).getTime();
  return Math.abs(date1 - date2) <= COLLISION_TIME_WINDOW_MS;
}

/**
 * Check if any commits from two authors are within the time window
 */
function hasRecentOverlap(commits1, commits2) {
  for (const c1 of commits1) {
    for (const c2 of commits2) {
      if (isWithinTimeWindow(c1.timestamp, c2.timestamp)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get the most recent commit timestamp from a list
 */
function getMostRecentTimestamp(commits) {
  if (!commits || commits.length === 0) return null;
  return commits.reduce((latest, c) => {
    const ts = new Date(c.timestamp).getTime();
    return ts > latest ? ts : latest;
  }, 0);
}

/**
 * Parse line ranges from a git patch/diff
 */
function parseLineRanges(patch) {
  if (!patch) return [];
  
  const ranges = [];
  const hunkRegex = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/g;
  
  let match;
  while ((match = hunkRegex.exec(patch)) !== null) {
    const newStart = parseInt(match[3], 10);
    const newCount = parseInt(match[4] || '1', 10);
    
    ranges.push({
      start: newStart,
      end: newStart + newCount - 1
    });
  }
  
  return ranges;
}

/**
 * Extract function/method names from a patch
 */
function extractFunctions(patch, filename) {
  if (!patch) return [];
  
  const functions = new Set();
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const patterns = [];
  
  // JavaScript/TypeScript
  if (['js', 'jsx', 'ts', 'tsx', 'mjs'].includes(ext)) {
    patterns.push(
      /(?:function|const|let|var)\s+(\w+)\s*[=\(]/g,
      /(\w+)\s*:\s*(?:async\s+)?function/g,
      /(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/g,
      /class\s+(\w+)/g
    );
  }
  
  // Python
  if (['py'].includes(ext)) {
    patterns.push(
      /def\s+(\w+)\s*\(/g,
      /class\s+(\w+)/g,
      /async\s+def\s+(\w+)\s*\(/g
    );
  }
  
  // Java/Kotlin/C#
  if (['java', 'kt', 'cs'].includes(ext)) {
    patterns.push(
      /(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\(/g,
      /class\s+(\w+)/g
    );
  }
  
  // Go
  if (['go'].includes(ext)) {
    patterns.push(
      /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/g,
      /type\s+(\w+)\s+struct/g
    );
  }
  
  // Ruby
  if (['rb'].includes(ext)) {
    patterns.push(
      /def\s+(\w+)/g,
      /class\s+(\w+)/g
    );
  }
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(patch)) !== null) {
      if (match[1] && match[1].length > 1) {
        functions.add(match[1]);
      }
    }
  }
  
  return Array.from(functions);
}

/**
 * Check if two line ranges overlap
 */
function rangesOverlap(range1, range2) {
  return range1.start <= range2.end && range2.start <= range1.end;
}

/**
 * Check if any ranges from two arrays overlap
 */
function anyRangesOverlap(ranges1, ranges2) {
  for (const r1 of ranges1) {
    for (const r2 of ranges2) {
      if (rangesOverlap(r1, r2)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if two function arrays have common functions
 */
function functionsOverlap(funcs1, funcs2) {
  const set1 = new Set(funcs1.map(f => f.toLowerCase()));
  return funcs2.some(f => set1.has(f.toLowerCase()));
}

/**
 * Calculate severity based on collision type and metrics
 */
function calculateSeverity(collisionType, authorCount, totalCommits) {
  if (collisionType === COLLISION_TYPE.LINE_OVERLAP) {
    return SEVERITY.HIGH;
  }
  
  if (collisionType === COLLISION_TYPE.FUNCTION_OVERLAP) {
    return totalCommits >= 4 || authorCount >= 3 ? SEVERITY.HIGH : SEVERITY.MEDIUM;
  }
  
  if (authorCount >= 3 || totalCommits >= 6) return SEVERITY.MEDIUM;
  return SEVERITY.LOW;
}

/**
 * Generate suggestion based on collision type
 */
function generateSuggestion(collisionType, severity, authors, overlapDetails) {
  const authorNames = authors.slice(0, 2).map(a => a.name).join(' and ');
  
  if (collisionType === COLLISION_TYPE.LINE_OVERLAP) {
    return `${authorNames} are editing the same lines! Sync immediately to avoid merge conflicts.`;
  }
  
  if (collisionType === COLLISION_TYPE.FUNCTION_OVERLAP) {
    const funcNames = overlapDetails?.functions?.slice(0, 2).join(', ') || 'shared functions';
    return `${authorNames} are both modifying ${funcNames}. Consider pairing or splitting ownership.`;
  }
  
  if (severity === SEVERITY.MEDIUM) {
    return `Multiple contributors active in this file. A quick sync could prevent issues.`;
  }
  
  return `Different areas of the same file - low risk, but stay aware of each other's changes.`;
}

/**
 * Extract directory/area from file path
 */
function getFileArea(filePath) {
  const parts = filePath.split('/');
  if (parts.length <= 1) return 'root';
  if (parts.length === 2) return parts[0];
  return parts.slice(0, 2).join('/');
}

/**
 * Generate a unique collision ID for tracking resolutions
 */
function generateCollisionId(file, authors) {
  const sortedAuthors = [...authors].sort().join('|');
  return `${file}::${sortedAuthors}`;
}

/**
 * Fetch and parse file details for a commit
 */
async function getCommitFileDetails(owner, repo, commitSha, token) {
  try {
    const details = await fetchCommitDetails(owner, repo, commitSha, token);
    const fileDetails = new Map();
    
    for (const file of (details.files || [])) {
      fileDetails.set(file.filename, {
        lineRanges: parseLineRanges(file.patch),
        functions: extractFunctions(file.patch, file.filename),
        additions: file.additions || 0,
        deletions: file.deletions || 0
      });
    }
    
    return fileDetails;
  } catch (error) {
    console.warn(`Could not fetch details for commit ${commitSha}:`, error.message);
    return new Map();
  }
}

/**
 * Get resolved collisions from playbook
 */
async function getResolvedCollisions(owner, repo) {
  const playbook = await getProjectPlaybook(owner, repo);
  return playbook?.resolvedCollisions || {};
}

/**
 * Resolve (dismiss) a collision
 */
export async function resolveCollision(owner, repo, collisionId, resolvedBy) {
  const playbook = await getProjectPlaybook(owner, repo);
  
  if (!playbook) {
    throw new Error('Playbook not found');
  }
  
  if (!playbook.resolvedCollisions) {
    playbook.resolvedCollisions = {};
  }
  
  playbook.resolvedCollisions[collisionId] = {
    resolvedAt: new Date().toISOString(),
    resolvedBy: resolvedBy || 'unknown'
  };
  
  await writeProjectPlaybook(owner, repo, playbook);
  
  return { success: true, collisionId };
}

/**
 * Unresolve a collision (bring it back)
 */
export async function unresolveCollision(owner, repo, collisionId) {
  const playbook = await getProjectPlaybook(owner, repo);
  
  if (!playbook || !playbook.resolvedCollisions) {
    return { success: true, collisionId };
  }
  
  delete playbook.resolvedCollisions[collisionId];
  
  await writeProjectPlaybook(owner, repo, playbook);
  
  return { success: true, collisionId };
}

/**
 * Detect collisions with proper line/function analysis and time window
 */
async function detectFileCollisions(commits, owner, repo, token, resolvedCollisions) {
  // Group commits by file
  const fileMap = new Map();
  
  for (const commit of commits) {
    const filesChanged = commit.filesChanged || [];
    const author = commit.author;
    
    for (const file of filesChanged) {
      if (!fileMap.has(file)) {
        fileMap.set(file, new Map());
      }
      
      const authorMap = fileMap.get(file);
      if (!authorMap.has(author)) {
        authorMap.set(author, []);
      }
      
      authorMap.get(author).push({
        sha: commit.commitId,
        shortId: commit.shortId,
        message: commit.message || commit.added || 'No message',
        timestamp: commit.timestamp,
        branch: commit.branch
      });
    }
  }
  
  // Filter to files with 2+ authors
  const potentialCollisions = [];
  
  for (const [file, authorMap] of fileMap) {
    if (authorMap.size < 2) continue;
    
    // Check if any authors have commits within the time window
    const authorEntries = Array.from(authorMap.entries());
    let hasTimeOverlap = false;
    
    for (let i = 0; i < authorEntries.length && !hasTimeOverlap; i++) {
      for (let j = i + 1; j < authorEntries.length && !hasTimeOverlap; j++) {
        if (hasRecentOverlap(authorEntries[i][1], authorEntries[j][1])) {
          hasTimeOverlap = true;
        }
      }
    }
    
    // Skip if no recent overlap (commits too far apart in time)
    if (!hasTimeOverlap) continue;
    
    potentialCollisions.push({ file, authorMap });
  }
  
  if (potentialCollisions.length === 0) {
    return [];
  }
  
  // Analyze top potential collisions
  const collisionsToAnalyze = potentialCollisions.slice(0, 20);
  
  // Collect unique commit SHAs
  const commitShasToFetch = new Set();
  for (const { authorMap } of collisionsToAnalyze) {
    for (const commits of authorMap.values()) {
      for (const commit of commits.slice(0, 3)) {
        commitShasToFetch.add(commit.sha);
      }
    }
  }
  
  // Fetch commit details
  const commitDetailsCache = new Map();
  const shasArray = Array.from(commitShasToFetch);
  
  if (token) {
    const batchSize = 10;
    for (let i = 0; i < shasArray.length; i += batchSize) {
      const batch = shasArray.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(sha => getCommitFileDetails(owner, repo, sha, token))
      );
      batch.forEach((sha, idx) => {
        commitDetailsCache.set(sha, results[idx]);
      });
    }
  }
  
  // Analyze each potential collision
  const collisions = [];
  
  for (const { file, authorMap } of collisionsToAnalyze) {
    const authors = [];
    let totalCommits = 0;
    
    const authorRanges = new Map();
    const authorFunctions = new Map();
    
    for (const [authorName, authorCommits] of authorMap) {
      authorCommits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      const allRanges = [];
      const allFunctions = [];
      
      for (const commit of authorCommits.slice(0, 3)) {
        const details = commitDetailsCache.get(commit.sha);
        if (details) {
          const fileDetail = details.get(file);
          if (fileDetail) {
            allRanges.push(...fileDetail.lineRanges);
            allFunctions.push(...fileDetail.functions);
          }
        }
      }
      
      authorRanges.set(authorName, allRanges);
      authorFunctions.set(authorName, [...new Set(allFunctions)]);
      
      authors.push({
        name: authorName,
        commits: authorCommits.length,
        lastCommit: authorCommits[0],
        allCommits: authorCommits.slice(0, 5),
        lineRanges: allRanges,
        functions: [...new Set(allFunctions)]
      });
      
      totalCommits += authorCommits.length;
    }
    
    authors.sort((a, b) => b.commits - a.commits);
    
    // Determine collision type
    let collisionType = COLLISION_TYPE.FILE_ONLY;
    let overlapDetails = {};
    
    const authorNames = Array.from(authorRanges.keys());
    
    // Check line overlap
    for (let i = 0; i < authorNames.length; i++) {
      for (let j = i + 1; j < authorNames.length; j++) {
        const ranges1 = authorRanges.get(authorNames[i]);
        const ranges2 = authorRanges.get(authorNames[j]);
        
        if (ranges1.length > 0 && ranges2.length > 0 && anyRangesOverlap(ranges1, ranges2)) {
          collisionType = COLLISION_TYPE.LINE_OVERLAP;
          overlapDetails.lineOverlap = true;
          overlapDetails.authors = [authorNames[i], authorNames[j]];
          break;
        }
      }
      if (collisionType === COLLISION_TYPE.LINE_OVERLAP) break;
    }
    
    // Check function overlap
    if (collisionType === COLLISION_TYPE.FILE_ONLY) {
      for (let i = 0; i < authorNames.length; i++) {
        for (let j = i + 1; j < authorNames.length; j++) {
          const funcs1 = authorFunctions.get(authorNames[i]);
          const funcs2 = authorFunctions.get(authorNames[j]);
          
          if (funcs1.length > 0 && funcs2.length > 0 && functionsOverlap(funcs1, funcs2)) {
            collisionType = COLLISION_TYPE.FUNCTION_OVERLAP;
            const commonFuncs = funcs1.filter(f => 
              funcs2.some(f2 => f2.toLowerCase() === f.toLowerCase())
            );
            overlapDetails.functions = commonFuncs;
            overlapDetails.authors = [authorNames[i], authorNames[j]];
            break;
          }
        }
        if (collisionType === COLLISION_TYPE.FUNCTION_OVERLAP) break;
      }
    }
    
    const severity = calculateSeverity(collisionType, authors.length, totalCommits);
    const collisionId = generateCollisionId(file, authorNames);
    const isResolved = !!resolvedCollisions[collisionId];
    
    // Calculate time info
    const mostRecentActivity = Math.max(
      ...authors.map(a => getMostRecentTimestamp(a.allCommits) || 0)
    );
    const daysSinceActivity = Math.floor((Date.now() - mostRecentActivity) / (24 * 60 * 60 * 1000));
    
    collisions.push({
      id: collisionId,
      type: collisionType,
      file,
      area: getFileArea(file),
      severity,
      authorCount: authors.length,
      totalCommits,
      authors,
      overlapDetails,
      suggestion: generateSuggestion(collisionType, severity, authors, overlapDetails),
      isResolved,
      resolvedAt: resolvedCollisions[collisionId]?.resolvedAt,
      daysSinceActivity
    });
  }
  
  // Sort: unresolved first, then by type/severity
  const typeOrder = { line_overlap: 0, function_overlap: 1, file_only: 2 };
  const severityOrder = { high: 0, medium: 1, low: 2 };
  
  collisions.sort((a, b) => {
    // Unresolved first
    if (a.isResolved !== b.isResolved) {
      return a.isResolved ? 1 : -1;
    }
    if (typeOrder[a.type] !== typeOrder[b.type]) {
      return typeOrder[a.type] - typeOrder[b.type];
    }
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.totalCommits - a.totalCommits;
  });
  
  return collisions;
}

/**
 * Detect hot zones
 */
function detectHotZones(commits) {
  const areaMap = new Map();
  
  for (const commit of commits) {
    const filesChanged = commit.filesChanged || [];
    const author = commit.author;
    
    for (const file of filesChanged) {
      const area = getFileArea(file);
      
      if (!areaMap.has(area)) {
        areaMap.set(area, {
          authors: new Set(),
          commits: 0,
          files: new Set()
        });
      }
      
      const areaData = areaMap.get(area);
      areaData.authors.add(author);
      areaData.commits++;
      areaData.files.add(file);
    }
  }
  
  const hotZones = [];
  
  for (const [area, data] of areaMap) {
    if (data.authors.size < 2) continue;
    
    hotZones.push({
      area,
      authorCount: data.authors.size,
      authors: Array.from(data.authors),
      commitCount: data.commits,
      fileCount: data.files.size
    });
  }
  
  hotZones.sort((a, b) => b.commitCount - a.commitCount);
  
  return hotZones.slice(0, 10);
}

/**
 * Calculate collision statistics (excluding resolved)
 */
function calculateStats(collisions, hotZones, totalCommits, totalAuthors) {
  // Only count unresolved collisions for stats
  const activeCollisions = collisions.filter(c => !c.isResolved);
  
  const lineOverlaps = activeCollisions.filter(c => c.type === COLLISION_TYPE.LINE_OVERLAP).length;
  const functionOverlaps = activeCollisions.filter(c => c.type === COLLISION_TYPE.FUNCTION_OVERLAP).length;
  const fileOnlyOverlaps = activeCollisions.filter(c => c.type === COLLISION_TYPE.FILE_ONLY).length;
  
  const highSeverity = activeCollisions.filter(c => c.severity === SEVERITY.HIGH).length;
  const mediumSeverity = activeCollisions.filter(c => c.severity === SEVERITY.MEDIUM).length;
  
  // Risk score based on active (unresolved) collisions only
  const riskScore = Math.min(100, Math.round(
    (lineOverlaps * 25) + (functionOverlaps * 15) + (highSeverity * 10) + (mediumSeverity * 3)
  ));
  
  return {
    totalCollisions: activeCollisions.length,
    resolvedCollisions: collisions.length - activeCollisions.length,
    lineOverlaps,
    functionOverlaps,
    fileOnlyOverlaps,
    highSeverity,
    mediumSeverity,
    lowSeverity: activeCollisions.length - highSeverity - mediumSeverity,
    hotZoneCount: hotZones.length,
    riskScore,
    riskLevel: riskScore >= 50 ? 'high' : riskScore >= 20 ? 'medium' : 'low',
    totalCommitsAnalyzed: totalCommits,
    totalAuthors,
    timeWindowDays: 3
  };
}

/**
 * Main function: Detect all collisions for a repository
 */
export async function detectCollisions(owner, repo, token = null) {
  const playbook = await getProjectPlaybook(owner, repo);
  
  if (!playbook || !playbook.commits || playbook.commits.length === 0) {
    return {
      collisions: [],
      hotZones: [],
      stats: {
        totalCollisions: 0,
        resolvedCollisions: 0,
        lineOverlaps: 0,
        functionOverlaps: 0,
        fileOnlyOverlaps: 0,
        highSeverity: 0,
        mediumSeverity: 0,
        lowSeverity: 0,
        hotZoneCount: 0,
        riskScore: 0,
        riskLevel: 'low',
        totalCommitsAnalyzed: 0,
        totalAuthors: 0,
        timeWindowDays: 3
      },
      message: 'No playbook data available. Run a pulse first to analyze commits.'
    };
  }
  
  const commits = playbook.commits;
  const uniqueAuthors = new Set(commits.map(c => c.author));
  const resolvedCollisions = playbook.resolvedCollisions || {};
  
  const fileCollisions = await detectFileCollisions(commits, owner, repo, token, resolvedCollisions);
  const hotZones = detectHotZones(commits);
  const stats = calculateStats(fileCollisions, hotZones, commits.length, uniqueAuthors.size);
  
  return {
    collisions: fileCollisions.slice(0, 20),
    hotZones,
    stats,
    analyzedAt: new Date().toISOString()
  };
}

/**
 * Get collision summary
 */
export async function getCollisionSummary(owner, repo, token = null) {
  const result = await detectCollisions(owner, repo, token);
  
  return {
    hasCollisions: result.collisions.filter(c => !c.isResolved).length > 0,
    topCollisions: result.collisions.filter(c => !c.isResolved).slice(0, 3),
    topHotZones: result.hotZones.slice(0, 3),
    stats: result.stats
  };
}

export default {
  detectCollisions,
  getCollisionSummary,
  resolveCollision,
  unresolveCollision
};
