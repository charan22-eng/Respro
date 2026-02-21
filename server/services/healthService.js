/**
 * Health Check Service
 * Comprehensive repository health analysis based on real metrics
 * 
 * Categories:
 * 1. Code Collaboration - collision risk, contributor overlap, PR patterns
 * 2. Project Velocity - commit frequency, activity trends
 * 3. Bus Factor - knowledge distribution across contributors
 * 4. Overall Health - synthesized score with letter grade
 */

import { getProjectPlaybook, getAllContributorPlaybooks } from './playbookService.js';
import { detectCollisions } from './collisionService.js';

/**
 * Calculate letter grade from percentage
 */
function getLetterGrade(score) {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
}

/**
 * Get grade color for UI
 */
function getGradeColor(grade) {
  if (grade.startsWith('A')) return 'green';
  if (grade.startsWith('B')) return 'blue';
  if (grade.startsWith('C')) return 'yellow';
  if (grade.startsWith('D')) return 'orange';
  return 'red';
}

/**
 * Calculate Code Collaboration Health
 * Based on: collision risk, resolved collisions ratio, contributor interactions
 */
async function calculateCollaborationHealth(owner, repo, token) {
  const collisionData = await detectCollisions(owner, repo, token);
  const { stats, collisions } = collisionData;
  
  let score = 100;
  const findings = [];
  const suggestions = [];
  
  // Collision risk penalty (up to -40 points)
  const activeCollisions = collisions.filter(c => !c.isResolved);
  const lineOverlaps = activeCollisions.filter(c => c.type === 'line_overlap').length;
  const functionOverlaps = activeCollisions.filter(c => c.type === 'function_overlap').length;
  
  if (lineOverlaps > 0) {
    const penalty = Math.min(25, lineOverlaps * 10);
    score -= penalty;
    findings.push({
      type: 'warning',
      message: `${lineOverlaps} active line-level collision${lineOverlaps > 1 ? 's' : ''} detected`,
      detail: 'Multiple contributors editing the same code lines'
    });
    suggestions.push('Schedule a sync meeting between contributors working on overlapping code');
  }
  
  if (functionOverlaps > 0) {
    const penalty = Math.min(15, functionOverlaps * 5);
    score -= penalty;
    findings.push({
      type: 'warning',
      message: `${functionOverlaps} function-level overlap${functionOverlaps > 1 ? 's' : ''} detected`,
      detail: 'Contributors modifying the same functions'
    });
    suggestions.push('Consider code ownership or dividing function responsibilities');
  }
  
  // Resolution rate bonus (up to +10 if actively resolving)
  const totalCollisions = collisions.length;
  const resolvedCollisions = collisions.filter(c => c.isResolved).length;
  if (totalCollisions > 0 && resolvedCollisions > 0) {
    const resolutionRate = resolvedCollisions / totalCollisions;
    if (resolutionRate > 0.5) {
      score = Math.min(100, score + 5);
      findings.push({
        type: 'success',
        message: `${Math.round(resolutionRate * 100)}% of collisions have been resolved`,
        detail: 'Team is actively managing coordination'
      });
    }
  }
  
  // Hot zones consideration
  if (stats.hotZoneCount > 5) {
    score -= 10;
    findings.push({
      type: 'info',
      message: `${stats.hotZoneCount} hot zones identified`,
      detail: 'Multiple areas with concentrated activity from several contributors'
    });
    suggestions.push('Review hot zones to ensure proper code review coverage');
  }
  
  // No collisions bonus
  if (activeCollisions.length === 0 && totalCollisions === 0) {
    findings.push({
      type: 'success',
      message: 'No active collaboration conflicts',
      detail: 'Contributors are working on distinct areas'
    });
  }
  
  score = Math.max(0, Math.min(100, score));
  
  return {
    category: 'Code Collaboration',
    score: Math.round(score),
    grade: getLetterGrade(score),
    color: getGradeColor(getLetterGrade(score)),
    findings,
    suggestions,
    metrics: {
      activeCollisions: activeCollisions.length,
      resolvedCollisions,
      lineOverlaps,
      functionOverlaps,
      hotZones: stats.hotZoneCount
    }
  };
}

/**
 * Calculate Project Velocity Health
 * Based on: commit frequency, activity recency, consistency
 */
async function calculateVelocityHealth(playbook) {
  let score = 100;
  const findings = [];
  const suggestions = [];
  
  const commits = playbook.commits || [];
  
  if (commits.length === 0) {
    return {
      category: 'Project Velocity',
      score: 0,
      grade: 'F',
      color: 'red',
      findings: [{ type: 'warning', message: 'No commit data available', detail: 'Run a pulse to gather commit history' }],
      suggestions: ['Analyze the repository to gather commit data'],
      metrics: {}
    };
  }
  
  // Sort commits by date
  const sortedCommits = [...commits].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  // Calculate activity metrics
  const now = new Date();
  const mostRecentCommit = new Date(sortedCommits[0]?.timestamp);
  const daysSinceLastCommit = Math.floor((now - mostRecentCommit) / (1000 * 60 * 60 * 24));
  
  // Recent activity check (last 30 days)
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const recentCommits = commits.filter(c => new Date(c.timestamp) > thirtyDaysAgo);
  
  // Last 7 days
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const weeklyCommits = commits.filter(c => new Date(c.timestamp) > sevenDaysAgo);
  
  // Staleness penalty
  if (daysSinceLastCommit > 30) {
    score -= 30;
    findings.push({
      type: 'warning',
      message: `No commits in ${daysSinceLastCommit} days`,
      detail: 'Repository appears inactive'
    });
    suggestions.push('Consider reviewing project status and addressing any blockers');
  } else if (daysSinceLastCommit > 14) {
    score -= 15;
    findings.push({
      type: 'info',
      message: `Last commit was ${daysSinceLastCommit} days ago`,
      detail: 'Activity has slowed down'
    });
  } else if (daysSinceLastCommit <= 3) {
    findings.push({
      type: 'success',
      message: 'Repository is actively maintained',
      detail: `Last commit ${daysSinceLastCommit === 0 ? 'today' : daysSinceLastCommit + ' day(s) ago'}`
    });
  }
  
  // Commit frequency analysis
  const commitsPerWeek = recentCommits.length / 4; // Last 30 days = ~4 weeks
  
  if (commitsPerWeek < 1 && recentCommits.length > 0) {
    score -= 15;
    findings.push({
      type: 'info',
      message: `Low commit frequency: ${recentCommits.length} commits in last 30 days`,
      detail: 'Less than 1 commit per week on average'
    });
    suggestions.push('Encourage more frequent, smaller commits for better tracking');
  } else if (commitsPerWeek >= 5) {
    findings.push({
      type: 'success',
      message: `Strong velocity: ${recentCommits.length} commits in last 30 days`,
      detail: `Averaging ${commitsPerWeek.toFixed(1)} commits per week`
    });
  }
  
  // Calculate commit consistency (standard deviation of daily commits)
  const commitsByDay = {};
  recentCommits.forEach(c => {
    const day = new Date(c.timestamp).toISOString().split('T')[0];
    commitsByDay[day] = (commitsByDay[day] || 0) + 1;
  });
  
  const daysWithCommits = Object.keys(commitsByDay).length;
  const consistencyRatio = daysWithCommits / 30;
  
  if (consistencyRatio > 0.4) {
    findings.push({
      type: 'success',
      message: 'Consistent commit pattern',
      detail: `Activity on ${daysWithCommits} of last 30 days`
    });
  } else if (consistencyRatio < 0.15 && recentCommits.length > 0) {
    score -= 10;
    findings.push({
      type: 'info',
      message: 'Sporadic commit pattern',
      detail: 'Commits are clustered rather than spread out'
    });
  }
  
  score = Math.max(0, Math.min(100, score));
  
  return {
    category: 'Project Velocity',
    score: Math.round(score),
    grade: getLetterGrade(score),
    color: getGradeColor(getLetterGrade(score)),
    findings,
    suggestions,
    metrics: {
      totalCommits: commits.length,
      recentCommits: recentCommits.length,
      weeklyCommits: weeklyCommits.length,
      daysSinceLastCommit,
      commitsPerWeek: Math.round(commitsPerWeek * 10) / 10,
      daysWithActivity: daysWithCommits
    }
  };
}

/**
 * Calculate Bus Factor / Knowledge Distribution Health
 * Based on: contributor count, commit distribution, area ownership
 */
async function calculateBusFactorHealth(playbook, contributorPlaybooks) {
  let score = 100;
  const findings = [];
  const suggestions = [];
  
  const commits = playbook.commits || [];
  const contributors = Object.keys(contributorPlaybooks);
  const contributorCount = contributors.length;
  
  if (contributorCount === 0 || commits.length === 0) {
    return {
      category: 'Bus Factor',
      score: 50,
      grade: 'C',
      color: 'yellow',
      findings: [{ type: 'info', message: 'Insufficient data for bus factor analysis', detail: 'Need more commit history' }],
      suggestions: [],
      metrics: {}
    };
  }
  
  // Calculate commit distribution per contributor
  const commitsByContributor = {};
  commits.forEach(c => {
    commitsByContributor[c.author] = (commitsByContributor[c.author] || 0) + 1;
  });
  
  const sortedContributors = Object.entries(commitsByContributor)
    .sort((a, b) => b[1] - a[1]);
  
  const topContributor = sortedContributors[0];
  const topContributorShare = topContributor ? (topContributor[1] / commits.length) * 100 : 0;
  
  // Bus factor calculation
  // How many contributors needed to account for 50% of commits?
  let cumulativeCommits = 0;
  let busFactor = 0;
  for (const [, count] of sortedContributors) {
    cumulativeCommits += count;
    busFactor++;
    if (cumulativeCommits >= commits.length * 0.5) break;
  }
  
  // Single contributor dominance check
  if (topContributorShare > 80) {
    score -= 35;
    findings.push({
      type: 'warning',
      message: `Single contributor dominance: ${topContributor[0]} has ${Math.round(topContributorShare)}% of commits`,
      detail: 'High risk if this contributor becomes unavailable'
    });
    suggestions.push('Encourage knowledge sharing and pair programming');
    suggestions.push('Document critical systems and processes');
  } else if (topContributorShare > 60) {
    score -= 20;
    findings.push({
      type: 'info',
      message: `Top contributor (${topContributor[0]}) has ${Math.round(topContributorShare)}% of commits`,
      detail: 'Moderate concentration of knowledge'
    });
    suggestions.push('Consider cross-training on critical areas');
  } else if (contributorCount >= 3) {
    findings.push({
      type: 'success',
      message: 'Healthy commit distribution',
      detail: `No single contributor exceeds 60% of commits`
    });
  }
  
  // Bus factor score
  if (busFactor === 1) {
    score -= 25;
    findings.push({
      type: 'warning',
      message: 'Bus factor is 1',
      detail: 'One person accounts for majority of work'
    });
  } else if (busFactor >= 3) {
    findings.push({
      type: 'success',
      message: `Bus factor is ${busFactor}`,
      detail: `${busFactor} contributors needed to cover 50% of commits`
    });
  }
  
  // Contributor count assessment
  if (contributorCount === 1) {
    score -= 15;
    findings.push({
      type: 'info',
      message: 'Solo project',
      detail: 'Only one contributor detected'
    });
    suggestions.push('Consider adding contributors for sustainability');
  } else if (contributorCount >= 5) {
    findings.push({
      type: 'success',
      message: `Healthy team size: ${contributorCount} contributors`,
      detail: 'Good distribution of project knowledge'
    });
  }
  
  // Area coverage analysis
  const techAreas = playbook.techAreas || [];
  const areasByContributor = {};
  
  Object.entries(contributorPlaybooks).forEach(([login, pb]) => {
    areasByContributor[login] = pb.primaryAreas || [];
  });
  
  // Check if areas have multiple contributors
  const areasWithMultipleOwners = techAreas.filter(area => {
    const ownersCount = Object.values(areasByContributor)
      .filter(areas => areas.includes(area)).length;
    return ownersCount >= 2;
  });
  
  const areaCoverage = techAreas.length > 0 
    ? (areasWithMultipleOwners.length / techAreas.length) * 100 
    : 0;
  
  if (areaCoverage > 60) {
    findings.push({
      type: 'success',
      message: `${Math.round(areaCoverage)}% of code areas have multiple contributors`,
      detail: 'Good knowledge redundancy'
    });
  } else if (areaCoverage < 30 && techAreas.length > 2) {
    score -= 10;
    findings.push({
      type: 'info',
      message: 'Limited area overlap between contributors',
      detail: 'Most areas are owned by single contributors'
    });
    suggestions.push('Rotate contributors across different areas periodically');
  }
  
  score = Math.max(0, Math.min(100, score));
  
  return {
    category: 'Bus Factor',
    score: Math.round(score),
    grade: getLetterGrade(score),
    color: getGradeColor(getLetterGrade(score)),
    findings,
    suggestions,
    metrics: {
      contributorCount,
      busFactor,
      topContributorShare: Math.round(topContributorShare),
      topContributor: topContributor ? topContributor[0] : null,
      techAreas: techAreas.length,
      areasWithRedundancy: areasWithMultipleOwners.length
    }
  };
}

/**
 * Calculate overall health score from category scores
 */
function calculateOverallHealth(categories) {
  // Weighted average
  const weights = {
    'Code Collaboration': 0.35,
    'Project Velocity': 0.35,
    'Bus Factor': 0.30
  };
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  categories.forEach(cat => {
    const weight = weights[cat.category] || 0.33;
    weightedSum += cat.score * weight;
    totalWeight += weight;
  });
  
  const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const roundedScore = Math.round(overallScore);
  const grade = getLetterGrade(roundedScore);
  
  // Generate overall summary
  let summary = '';
  if (roundedScore >= 90) {
    summary = 'Excellent repository health! The project shows strong collaboration patterns, active development, and good knowledge distribution.';
  } else if (roundedScore >= 80) {
    summary = 'Good repository health with some areas for improvement. The project is well-maintained with minor concerns to address.';
  } else if (roundedScore >= 70) {
    summary = 'Moderate repository health. Several areas need attention to improve project sustainability and collaboration.';
  } else if (roundedScore >= 60) {
    summary = 'Below average repository health. Significant improvements needed in collaboration, velocity, or knowledge distribution.';
  } else {
    summary = 'Repository health needs immediate attention. Critical issues detected that may impact project sustainability.';
  }
  
  // Collect all suggestions, prioritized
  const allSuggestions = [];
  categories.forEach(cat => {
    cat.suggestions.forEach(s => {
      if (!allSuggestions.includes(s)) {
        allSuggestions.push(s);
      }
    });
  });
  
  return {
    score: roundedScore,
    grade,
    color: getGradeColor(grade),
    summary,
    topSuggestions: allSuggestions.slice(0, 5)
  };
}

/**
 * Main function: Run complete health checkup
 */
export async function runHealthCheckup(owner, repo, token = null) {
  const playbook = await getProjectPlaybook(owner, repo);
  
  if (!playbook) {
    return {
      error: 'No playbook data available. Run a pulse first to analyze the repository.',
      overall: {
        score: 0,
        grade: 'N/A',
        color: 'gray',
        summary: 'Unable to calculate health score without repository data.',
        topSuggestions: ['Run a pulse to analyze the repository']
      },
      categories: [],
      analyzedAt: new Date().toISOString()
    };
  }
  
  const contributorPlaybooks = await getAllContributorPlaybooks(owner, repo);
  
  // Calculate all category scores in parallel
  const [collaboration, velocity, busFactor] = await Promise.all([
    calculateCollaborationHealth(owner, repo, token),
    calculateVelocityHealth(playbook),
    calculateBusFactorHealth(playbook, contributorPlaybooks)
  ]);
  
  const categories = [collaboration, velocity, busFactor];
  const overall = calculateOverallHealth(categories);
  
  return {
    overall,
    categories,
    repoInfo: {
      name: playbook.repoFullName,
      totalCommits: playbook.totalCommitsTracked,
      techAreas: playbook.techAreas,
      lastUpdated: playbook.lastUpdated
    },
    analyzedAt: new Date().toISOString()
  };
}

export default {
  runHealthCheckup
};
