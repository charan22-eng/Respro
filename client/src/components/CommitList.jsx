import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * CommitList Component
 * Displays a searchable, filterable list of recent commits
 * with an "Analyze" button per commit to trigger deep analysis.
 */
function CommitList({ commits, owner, repo, onAnalyze }) {
  const [search, setSearch] = useState('');
  const [expandedSha, setExpandedSha] = useState(null);

  const filtered = useMemo(() => {
    if (!commits || commits.length === 0) return [];
    const q = search.toLowerCase().trim();
    if (!q) return commits;
    return commits.filter(
      (c) =>
        (c.message || '').toLowerCase().includes(q) ||
        (c.author || '').toLowerCase().includes(q) ||
        (c.sha || '').toLowerCase().startsWith(q) ||
        (c.branch || '').toLowerCase().includes(q)
    );
  }, [commits, search]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!commits || commits.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg className="w-8 h-8 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-surface-500 text-sm">No commits found</p>
        <p className="text-surface-400 text-xs mt-1">Commits will appear here after fetching repository data</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by message, author, SHA, or branch..."
          className="input-primary pl-10 w-full text-sm"
        />
      </div>

      {/* Results count */}
      {search && (
        <p className="text-xs text-surface-400">
          {filtered.length} of {commits.length} commits match &quot;{search}&quot;
        </p>
      )}

      {/* Commit list */}
      <div className="divide-y divide-surface-100 border border-surface-200 rounded-xl overflow-hidden">
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-surface-400">
            No commits match your search
          </div>
        )}

        {filtered.map((commit) => {
          const isExpanded = expandedSha === commit.sha;
          const shortSha = (commit.sha || '').substring(0, 7);

          return (
            <div
              key={commit.sha}
              className="group hover:bg-surface-50 transition-colors duration-150"
            >
              <div className="flex items-start gap-3 px-4 py-3">
                {/* Avatar */}
                <div className="flex-shrink-0 mt-0.5">
                  {commit.authorAvatar ? (
                    <img
                      src={commit.authorAvatar}
                      alt={commit.author}
                      className="avatar w-8 h-8"
                    />
                  ) : (
                    <div className="avatar w-8 h-8 bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
                      {(commit.author || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Message */}
                      <button
                        onClick={() => setExpandedSha(isExpanded ? null : commit.sha)}
                        className="text-sm font-medium text-surface-900 hover:text-brand-600 transition-colors text-left truncate block w-full"
                        title={commit.message}
                      >
                        {commit.message || 'No commit message'}
                      </button>

                      {/* Meta line */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <code className="text-xs font-mono text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                          {shortSha}
                        </code>
                        <span className="text-xs text-surface-500">
                          {commit.author || 'Unknown'}
                        </span>
                        {commit.date && (
                          <span className="text-xs text-surface-400">
                            {formatDate(commit.date)}
                          </span>
                        )}
                        {commit.branch && (
                          <span className="chip text-xs">
                            {commit.branch}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Analyze button */}
                    <button
                      onClick={() => onAnalyze && onAnalyze(commit.sha)}
                      className="btn-ghost text-xs px-3 py-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                      title={`Analyze commit ${shortSha}`}
                    >
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      Analyze
                    </button>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 p-3 bg-surface-50 rounded-lg text-sm animate-fade-in">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-surface-500 w-14">SHA</span>
                          <code className="text-xs font-mono text-surface-700">{commit.sha}</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-surface-500 w-14">Author</span>
                          <span className="text-xs text-surface-700">{commit.author || 'Unknown'}</span>
                        </div>
                        {commit.branch && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-surface-500 w-14">Branch</span>
                            <span className="text-xs text-surface-700">{commit.branch}</span>
                          </div>
                        )}
                        {commit.date && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-surface-500 w-14">Date</span>
                            <span className="text-xs text-surface-700">
                              {new Date(commit.date).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div className="pt-2">
                          <span className="text-xs font-medium text-surface-500 block mb-1">Message</span>
                          <p className="text-xs text-surface-700 whitespace-pre-wrap">{commit.message}</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-surface-200">
                        <button
                          onClick={() => onAnalyze && onAnalyze(commit.sha)}
                          className="btn-brand text-xs px-4 py-1.5"
                        >
                          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          Analyze this commit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

CommitList.propTypes = {
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
  owner: PropTypes.string,
  repo: PropTypes.string,
  onAnalyze: PropTypes.func,
};

export default CommitList;
