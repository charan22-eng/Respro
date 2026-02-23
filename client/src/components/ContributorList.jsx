import { useState } from 'react';
import PropTypes from 'prop-types';
import { fetchContributorCommits } from '../utils/api';

/**
 * Relative time helper
 */
function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function ContributorList({ contributors, commits, owner, repo, onAnalyzeCommit }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [fetchedCommits, setFetchedCommits] = useState({});
  const [loadingUser, setLoadingUser] = useState(null);

  // Sort by recent activity then total commits
  const sortedContributors = [...contributors].sort((a, b) => {
    const aActive = Object.values(a.commitsByDay || {}).reduce((s, c) => s + c, 0);
    const bActive = Object.values(b.commitsByDay || {}).reduce((s, c) => s + c, 0);
    if (aActive !== bActive) return bActive - aActive;
    return b.totalCommits - a.totalCommits;
  });

  // Filter by search
  const filtered = searchQuery
    ? sortedContributors.filter(c => c.login.toLowerCase().includes(searchQuery.toLowerCase()))
    : sortedContributors;

  const displayList = filtered.slice(0, 10);

  // Merge local + fetched commits, dedupe by SHA, take 5
  function getCommitsForUser(username) {
    const local = (commits || []).filter(c => c.author === username);
    const fetched = fetchedCommits[username] || [];
    const merged = new Map();
    [...local, ...fetched].forEach(c => {
      if (!merged.has(c.sha)) merged.set(c.sha, c);
    });
    return Array.from(merged.values())
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }

  async function handleExpand(username) {
    if (expandedUser === username) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(username);

    const local = (commits || []).filter(c => c.author === username);
    if (local.length < 5 && !fetchedCommits[username] && owner && repo) {
      setLoadingUser(username);
      try {
        const data = await fetchContributorCommits(owner, repo, username);
        setFetchedCommits(prev => ({ ...prev, [username]: data }));
      } catch (err) {
        console.warn('Failed to fetch commits for', username, err.message);
      } finally {
        setLoadingUser(null);
      }
    }
  }

  const handleSummarize = (sha) => {
    if (onAnalyzeCommit) {
      onAnalyzeCommit(sha);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: '#0f172a' }}>Contributors</h3>
        <span className="text-sm" style={{ color: '#64748b' }}>{contributors.length} total</span>
      </div>

      {/* Search */}
      {contributors.length > 3 && (
        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contributors..."
            className="input-primary text-sm py-2"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm" style={{ color: '#64748b' }}>
          {searchQuery ? 'No contributors match your search' : 'No contributors found'}
        </p>
      ) : (
        <div className="space-y-2">
          {displayList.map((contributor) => {
            const recentCommits = Object.values(contributor.commitsByDay || {}).reduce(
              (sum, count) => sum + count, 0
            );
            const isActive = recentCommits > 0;
            const isExpanded = expandedUser === contributor.login;
            const userCommits = isExpanded ? getCommitsForUser(contributor.login) : [];
            const isLoading = loadingUser === contributor.login;

            return (
              <div key={contributor.login} className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Clickable contributor row */}
                <button
                  onClick={() => handleExpand(contributor.login)}
                  className={`w-full flex items-center justify-between p-3 text-left transition-all duration-200 ${
                    isExpanded ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative flex-shrink-0">
                      {contributor.avatarUrl ? (
                        <img 
                          src={contributor.avatarUrl} 
                          alt={contributor.login}
                          className="w-9 h-9 rounded-full ring-2 ring-slate-100" 
                        />
                      ) : (
                        <div 
                          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold"
                          style={{ background: '#e0e7ff', color: '#4338ca' }}
                        >
                          {contributor.login[0].toUpperCase()}
                        </div>
                      )}
                      {isActive && (
                        <div 
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                          style={{ background: '#10b981' }}
                        />
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-sm" style={{ color: '#0f172a' }}>
                        {contributor.login}
                      </span>
                      {isActive && (
                        <span 
                          className="ml-2 text-xs font-medium"
                          style={{ color: '#059669' }}
                        >
                          {recentCommits} this week
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span 
                      className="text-sm px-2 py-0.5 rounded-full"
                      style={{ background: '#f1f5f9', color: '#64748b' }}
                    >
                      {contributor.totalCommits} commits
                    </span>
                    <svg 
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      style={{ color: '#94a3b8' }}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Commit dropdown */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    {isLoading && userCommits.length === 0 ? (
                      <div className="px-4 py-4 flex items-center justify-center space-x-2" style={{ color: '#94a3b8' }}>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-sm">Loading commits...</span>
                      </div>
                    ) : userCommits.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-center" style={{ color: '#94a3b8' }}>
                        No recent commits found
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {userCommits.map((commit) => (
                          <div 
                            key={commit.sha}
                            className="px-4 py-3 hover:bg-white transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <code 
                                    className="text-xs font-mono px-1.5 py-0.5 rounded"
                                    style={{ background: '#e2e8f0', color: '#475569' }}
                                  >
                                    {commit.sha.substring(0, 7)}
                                  </code>
                                  <span className="text-xs" style={{ color: '#94a3b8' }}>
                                    {timeAgo(commit.date)}
                                  </span>
                                </div>
                                <p 
                                  className="text-sm truncate"
                                  style={{ color: '#334155' }}
                                  title={commit.message}
                                >
                                  {commit.message.length > 60
                                    ? commit.message.substring(0, 60) + '...'
                                    : commit.message}
                                </p>
                              </div>
                              
                              {/* Summarize Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSummarize(commit.sha);
                                }}
                                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:shadow-sm"
                                style={{ 
                                  background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                                  color: 'white'
                                }}
                                title="Analyze this commit"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                Summarize
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 10 && (
        <p className="text-sm text-center" style={{ color: '#64748b' }}>
          +{filtered.length - 10} more contributors
        </p>
      )}
    </div>
  );
}

ContributorList.propTypes = {
  contributors: PropTypes.array.isRequired,
  commits: PropTypes.array,
  owner: PropTypes.string,
  repo: PropTypes.string,
  onAnalyzeCommit: PropTypes.func,
};

export default ContributorList;
