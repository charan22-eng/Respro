import { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getCommitsAnalysisStatus } from '../utils/api';

// Branch color palette - distinct colors for each branch
const BRANCH_COLORS = [
  { fill: '#3b82f6', stroke: '#1d4ed8', glow: 'rgba(59, 130, 246, 0.3)' },   // Blue (main/master)
  { fill: '#10b981', stroke: '#059669', glow: 'rgba(16, 185, 129, 0.3)' },   // Green
  { fill: '#8b5cf6', stroke: '#6d28d9', glow: 'rgba(139, 92, 246, 0.3)' },   // Purple
  { fill: '#ef4444', stroke: '#dc2626', glow: 'rgba(239, 68, 68, 0.3)' },    // Red
  { fill: '#f97316', stroke: '#ea580c', glow: 'rgba(249, 115, 22, 0.3)' },   // Orange
  { fill: '#06b6d4', stroke: '#0891b2', glow: 'rgba(6, 182, 212, 0.3)' },    // Cyan
  { fill: '#ec4899', stroke: '#db2777', glow: 'rgba(236, 72, 153, 0.3)' },   // Pink
  { fill: '#f59e0b', stroke: '#d97706', glow: 'rgba(245, 158, 11, 0.3)' },   // Amber
  { fill: '#14b8a6', stroke: '#0d9488', glow: 'rgba(20, 184, 166, 0.3)' },   // Teal
  { fill: '#a855f7', stroke: '#9333ea', glow: 'rgba(168, 85, 247, 0.3)' },   // Violet
  { fill: '#64748b', stroke: '#475569', glow: 'rgba(100, 116, 139, 0.3)' },  // Slate
  { fill: '#84cc16', stroke: '#65a30d', glow: 'rgba(132, 204, 22, 0.3)' },   // Lime
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getBranchColor(branchIndex) {
  return BRANCH_COLORS[branchIndex % BRANCH_COLORS.length];
}

function GitGraph({ commits, branches, onSelectCommit, selectedSha, owner, repo }) {
  const [hoveredCommit, setHoveredCommit] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [analyzedShas, setAnalyzedShas] = useState(new Set());

  // Fetch analysis status
  useEffect(() => {
    if (!owner || !repo) return;
    
    getCommitsAnalysisStatus(owner, repo)
      .then(status => {
        const analyzed = new Set(
          status.commits?.filter(c => c.analyzed).map(c => c.sha) || []
        );
        setAnalyzedShas(analyzed);
      })
      .catch(err => console.warn('Could not fetch analysis status:', err));
  }, [owner, repo, commits]);

  // Build branch structure and assign columns (lanes)
  const { branchColors, branchColumns, activeBranches, branchCommitCounts } = useMemo(() => {
    const colors = {};
    const columns = {};
    const commitCounts = {};
    
    // Count commits per branch to prioritize
    (commits || []).forEach(commit => {
      const branch = commit.branch || 'main';
      commitCounts[branch] = (commitCounts[branch] || 0) + 1;
    });
    
    // Sort branches: main/master first, then by commit count
    const sortedBranches = Object.keys(commitCounts).sort((a, b) => {
      // main/master always first (column 0)
      if (a === 'main' || a === 'master') return -1;
      if (b === 'main' || b === 'master') return 1;
      // Then by commit count (most active first)
      return commitCounts[b] - commitCounts[a];
    });
    
    // Assign columns and colors to each branch
    sortedBranches.forEach((branch, idx) => {
      columns[branch] = idx;
      colors[branch] = getBranchColor(idx);
    });
    
    return { 
      branchColors: colors, 
      branchColumns: columns, 
      activeBranches: sortedBranches,
      branchCommitCounts: commitCounts
    };
  }, [commits]);

  // Calculate graph layout with proper lane positioning by branch
  const { nodes, paths, svgWidth, svgHeight } = useMemo(() => {
    if (!commits || commits.length === 0) {
      return { nodes: [], paths: [], svgWidth: 300, svgHeight: 400 };
    }

    const nodeRadius = 10;
    const rowHeight = 80;  // Increased spacing between rows
    const colWidth = 60;   // Increased spacing between lanes
    const startX = 60;
    const startY = 50;

    // Create nodes with positions based on branch lanes
    const graphNodes = commits.map((commit, idx) => {
      const branch = commit.branch || 'main';
      const col = branchColumns[branch] ?? 0;
      const colors = branchColors[branch] || BRANCH_COLORS[0];
      const isAnalyzed = analyzedShas.has(commit.sha);
      
      return {
        commit,
        x: startX + col * colWidth,
        y: startY + idx * rowHeight,
        colors,
        author: commit.author || 'Unknown',
        branch,
        isAnalyzed,
        col,
      };
    });

    // Build paths between commits
    const graphPaths = [];
    
    // Group commits by branch to draw branch lanes
    const branchCommits = {};
    graphNodes.forEach((node, idx) => {
      if (!branchCommits[node.branch]) {
        branchCommits[node.branch] = [];
      }
      branchCommits[node.branch].push({ node, idx });
    });

    // Draw vertical lines for each branch's commits
    Object.entries(branchCommits).forEach(([branch, commits]) => {
      if (commits.length < 2) return;
      
      const colors = branchColors[branch] || BRANCH_COLORS[0];
      
      for (let i = 0; i < commits.length - 1; i++) {
        const current = commits[i].node;
        const next = commits[i + 1].node;
        
        // Check if there are other commits between these on the timeline
        const currentIdx = commits[i].idx;
        const nextIdx = commits[i + 1].idx;
        
        if (nextIdx - currentIdx === 1) {
          // Consecutive commits on same branch - straight line
          graphPaths.push({
            type: 'line',
            x1: current.x,
            y1: current.y + nodeRadius,
            x2: next.x,
            y2: next.y - nodeRadius,
            color: colors.fill,
          });
        } else {
          // Non-consecutive - draw a curved bypass on the outside
          const offsetX = current.col === 0 ? -25 : 25; // Bypass to the outside
          graphPaths.push({
            type: 'bypass',
            x1: current.x,
            y1: current.y + nodeRadius,
            x2: next.x,
            y2: next.y - nodeRadius,
            offsetX,
            color: colors.fill,
          });
        }
      }
    });

    // Add merge/branch-off curves between different branches (sequential commits)
    for (let i = 0; i < graphNodes.length - 1; i++) {
      const current = graphNodes[i];
      const next = graphNodes[i + 1];
      
      if (current.branch !== next.branch) {
        // Different branches - draw transition curve
        const midY = (current.y + next.y) / 2;
        
        graphPaths.push({
          type: 'curve',
          d: `M ${current.x} ${current.y + nodeRadius} 
              Q ${current.x} ${midY}, ${(current.x + next.x) / 2} ${midY}
              Q ${next.x} ${midY}, ${next.x} ${next.y - nodeRadius}`,
          color: `url(#gradient-${i})`,
          gradient: {
            id: `gradient-${i}`,
            start: current.colors.fill,
            end: next.colors.fill,
          },
        });
      }
    }

    const numCols = Object.keys(branchColumns).length;
    const width = Math.max(500, startX + numCols * colWidth + 350);
    const height = Math.max(400, graphNodes.length * rowHeight + 80);

    return { nodes: graphNodes, paths: graphPaths, svgWidth: width, svgHeight: height };
  }, [commits, branchColumns, branchColors, analyzedShas]);

  const handleMouseEnter = (node, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const containerRect = event.currentTarget.closest('svg').parentElement.getBoundingClientRect();
    setTooltipPos({
      x: rect.right - containerRect.left + 10,
      y: rect.top - containerRect.top,
    });
    setHoveredCommit(node);
  };

  const handleMouseLeave = () => {
    setHoveredCommit(null);
  };

  const handleClick = (node) => {
    onSelectCommit(node.commit);
  };

  if (!commits || commits.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-surface-400">
        No commits to display
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-auto bg-gradient-to-b from-surface-50 to-white rounded-xl">
      {/* Branch legend */}
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-surface-200 px-4 py-3 z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">Branches</span>
          <div className="flex items-center gap-3 text-xs text-surface-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent-500"></span>
              Analyzed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full border-2 border-surface-300"></span>
              Pending
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeBranches.map((branch) => {
            const colors = branchColors[branch];
            const count = branchCommitCounts[branch] || 0;
            return (
              <div key={branch} className="flex items-center space-x-1.5 group">
                <div 
                  className="w-3.5 h-3.5 rounded-full shadow-sm transition-transform group-hover:scale-110" 
                  style={{ 
                    backgroundColor: colors.fill,
                    boxShadow: `0 0 0 2px ${colors.glow}`,
                  }}
                />
                <span className="text-xs text-surface-600 truncate max-w-[150px]">
                  {branch}
                </span>
                <span className="text-[10px] text-surface-400">
                  ({count})
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <svg 
        width={svgWidth} 
        height={svgHeight}
        className="min-w-full"
      >
        {/* Define gradients for merge lines */}
        <defs>
          {paths.filter(p => p.gradient).map(path => (
            <linearGradient key={path.gradient.id} id={path.gradient.id} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={path.gradient.start} />
              <stop offset="100%" stopColor={path.gradient.end} />
            </linearGradient>
          ))}
          
          {/* Glow filter for selected node */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Branch lane backgrounds */}
        {activeBranches.map((branch) => {
          const col = branchColumns[branch];
          const colors = branchColors[branch];
          const x = 60 + col * 60;
          return (
            <rect
              key={`lane-${branch}`}
              x={x - 20}
              y={0}
              width={40}
              height={svgHeight}
              fill={colors.glow}
              opacity={0.12}
            />
          );
        })}

        {/* Connecting paths */}
        {paths.map((path, idx) => {
          if (path.type === 'line') {
            return (
              <line
                key={`path-${idx}`}
                x1={path.x1}
                y1={path.y1}
                x2={path.x2}
                y2={path.y2}
                stroke={path.color}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.7}
              />
            );
          }
          if (path.type === 'bypass') {
            // Draw a curved line that bypasses other commits
            const midX = path.x1 + path.offsetX;
            return (
              <path
                key={`path-${idx}`}
                d={`M ${path.x1} ${path.y1} 
                    C ${midX} ${path.y1 + 40}, ${midX} ${path.y2 - 40}, ${path.x2} ${path.y2}`}
                stroke={path.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
                opacity={0.4}
                strokeDasharray="6,4"
              />
            );
          }
          if (path.type === 'curve') {
            return (
              <path
                key={`path-${idx}`}
                d={path.d}
                stroke={path.color}
                strokeWidth={3}
                strokeLinecap="round"
                fill="none"
                opacity={0.6}
              />
            );
          }
          return null;
        })}

        {/* Commit nodes */}
        {nodes.map((node) => {
          const isSelected = selectedSha === node.commit.sha;
          const isHovered = hoveredCommit?.commit.sha === node.commit.sha;
          const baseRadius = 10;
          const radius = isSelected ? 13 : isHovered ? 12 : baseRadius;
          
          return (
            <g key={node.commit.sha}>
              {/* Outer glow for selected/hovered */}
              {(isSelected || isHovered) && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius + 5}
                  fill={node.colors.glow}
                  opacity={0.6}
                />
              )}
              
              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={node.isAnalyzed ? node.colors.fill : 'white'}
                stroke={node.colors.stroke}
                strokeWidth={node.isAnalyzed ? 3 : 2.5}
                className="cursor-pointer transition-all duration-150"
                style={{ filter: isSelected ? 'url(#glow)' : 'none' }}
                onMouseEnter={(e) => handleMouseEnter(node, e)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleClick(node)}
              />
              
              {/* Analysis status indicator */}
              {node.isAnalyzed && (
                <circle
                  cx={node.x + 8}
                  cy={node.y - 8}
                  r={4}
                  fill="#10b981"
                  stroke="white"
                  strokeWidth={1.5}
                />
              )}
              
              {/* Commit info labels */}
              <g 
                className="cursor-pointer"
                onClick={() => handleClick(node)}
              >
                <text
                  x={node.x + 30}
                  y={node.y - 14}
                  className="text-[10px] font-mono"
                  fill="#94a3b8"
                >
                  {node.commit.sha.substring(0, 7)}
                  <tspan fill="#cbd5e1" dx="8">|</tspan>
                  <tspan 
                    fill={node.colors.fill} 
                    dx="8" 
                    fontWeight="500"
                  >
                    {node.branch}
                  </tspan>
                </text>
                <text
                  x={node.x + 30}
                  y={node.y + 4}
                  className="text-sm font-medium"
                  fill="#0f172a"
                >
                  {(node.commit.message || '').substring(0, 50)}
                  {(node.commit.message || '').length > 50 ? '...' : ''}
                </text>
                <text
                  x={node.x + 30}
                  y={node.y + 22}
                  className="text-xs"
                  fill="#64748b"
                >
                  {node.author}
                  <tspan fill="#cbd5e1" dx="8">|</tspan>
                  <tspan fill="#94a3b8" dx="8">{timeAgo(node.commit.date)}</tspan>
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredCommit && (
        <div
          className="absolute bg-surface-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-elevated z-20 pointer-events-none max-w-xs border border-surface-700"
          style={{
            left: Math.min(tooltipPos.x, svgWidth - 200),
            top: tooltipPos.y,
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-brand-300">{hoveredCommit.commit.sha.substring(0, 7)}</span>
            <span 
              className="px-1.5 py-0.5 rounded-lg text-[10px] font-medium"
              style={{ 
                backgroundColor: hoveredCommit.colors.fill,
                color: 'white',
              }}
            >
              {hoveredCommit.branch}
            </span>
          </div>
          <div className="font-medium mb-1.5 leading-tight">
            {hoveredCommit.commit.message || 'No message'}
          </div>
          <div className="flex items-center justify-between text-surface-400">
            <span>{hoveredCommit.author}</span>
            <span>{timeAgo(hoveredCommit.commit.date)}</span>
          </div>
          {hoveredCommit.isAnalyzed && (
            <div className="mt-2 pt-2 border-t border-surface-700 text-accent-400 text-[10px] flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              AI analysis available
            </div>
          )}
          {!hoveredCommit.isAnalyzed && (
            <div className="mt-2 pt-2 border-t border-surface-700 text-surface-500 text-[10px]">
              Click to analyze with AI
            </div>
          )}
        </div>
      )}
    </div>
  );
}

GitGraph.propTypes = {
  commits: PropTypes.arrayOf(
    PropTypes.shape({
      sha: PropTypes.string.isRequired,
      author: PropTypes.string,
      authorAvatar: PropTypes.string,
      date: PropTypes.string,
      message: PropTypes.string,
      branch: PropTypes.string,
    })
  ),
  branches: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      lastCommitDate: PropTypes.string,
      isStale: PropTypes.bool,
      hasOpenPR: PropTypes.bool,
    })
  ),
  onSelectCommit: PropTypes.func.isRequired,
  selectedSha: PropTypes.string,
  owner: PropTypes.string,
  repo: PropTypes.string,
};

export default GitGraph;
