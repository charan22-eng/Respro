import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { fetchPlaybook } from '../utils/api';

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

const eventBadge = {
  commit: 'bg-blue-100 text-blue-700',
  merge: 'bg-purple-100 text-purple-700',
  pr_open: 'bg-green-100 text-green-700',
  pr_close: 'bg-gray-100 text-gray-600',
  branch_create: 'bg-yellow-100 text-yellow-700',
};

function PlaybookPanel({ owner, repo, refreshKey = 0 }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedContributor, setExpandedContributor] = useState(null);

  const loadPlaybook = useCallback(async () => {
    if (!owner || !repo) return;
    try {
      setLoading(true);
      const result = await fetchPlaybook(owner, repo);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [owner, repo]);

  // Load on first expand
  useEffect(() => {
    if (isExpanded && !data && !loading) {
      loadPlaybook();
    }
  }, [isExpanded, data, loading, loadPlaybook]);

  // Refresh when refreshKey changes (triggered by SSE playbook_updated events)
  useEffect(() => {
    if (refreshKey > 0 && isExpanded) {
      loadPlaybook();
    }
  }, [refreshKey, isExpanded, loadPlaybook]);

  // Auto-refresh every 60 seconds when expanded
  useEffect(() => {
    if (!isExpanded) return;
    const interval = setInterval(loadPlaybook, 60000);
    return () => clearInterval(interval);
  }, [isExpanded, loadPlaybook]);

  const project = data?.project;
  const contributors = data?.contributors || {};
  const commits = (project?.commits || []).slice().reverse().slice(0, 20);
  const isLive = project?.lastUpdated &&
    (Date.now() - new Date(project.lastUpdated).getTime()) < 2 * 60 * 1000;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      {/* Header — always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <span className="text-lg">📖</span>
          <h3 className="text-lg font-semibold text-gray-900">Project Playbook</h3>
          {project && (
            <span className="text-xs text-gray-400">
              {project.totalCommitsTracked} events tracked
            </span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {project?.lastUpdated && (
            <span className="flex items-center space-x-1.5 text-xs text-gray-400">
              {isLive && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
              <span>{isLive ? 'Live' : `Updated ${timeAgo(project.lastUpdated)}`}</span>
            </span>
          )}
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
               fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {loading && !data && (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              Loading playbook...
            </div>
          )}

          {error && (
            <div className="px-6 py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            </div>
          )}

          {!project && !loading && (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              No playbook yet. Run a pulse analysis to initialize the playbook.
            </div>
          )}

          {project && (
            <div className="px-6 py-5 space-y-6">
              {/* Project Summary */}
              {project.projectSummary && (
                <div className="bg-gradient-to-r from-pulse-50 to-indigo-50 border border-pulse-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-pulse-700 uppercase tracking-wide">Project Narrative</span>
                    {project.overallVelocity && (
                      <span className="text-xs text-pulse-600 bg-pulse-100 px-2 py-0.5 rounded-full">
                        {project.overallVelocity}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed">{project.projectSummary}</p>
                  {project.techAreas?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {project.techAreas.map(area => (
                        <span key={area} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded">
                          {area}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Commit Timeline */}
              {commits.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                    Recent Activity
                  </h4>
                  <div className="space-y-3">
                    {commits.map((commit) => (
                      <div key={commit.commitId} className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50">
                        {/* Meta row */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <code className="text-xs font-mono text-gray-400">{commit.shortId}</code>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${eventBadge[commit.eventType] || eventBadge.commit}`}>
                              {commit.eventType.replace('_', ' ')}
                            </span>
                            <span className="text-xs font-medium text-gray-700">{commit.author}</span>
                          </div>
                          <span className="text-xs text-gray-400">{timeAgo(commit.timestamp)}</span>
                        </div>
                        {/* Before / Added / Impact */}
                        <div className="space-y-1 text-sm">
                          <div className="flex">
                            <span className="w-14 flex-shrink-0 text-xs font-medium text-gray-400">Before</span>
                            <span className="text-gray-600">{commit.before}</span>
                          </div>
                          <div className="flex">
                            <span className="w-14 flex-shrink-0 text-xs font-medium text-green-600">Added</span>
                            <span className="text-gray-800 font-medium">{commit.added}</span>
                          </div>
                          <div className="flex">
                            <span className="w-14 flex-shrink-0 text-xs font-medium text-blue-600">Impact</span>
                            <span className="text-gray-600">{commit.impact}</span>
                          </div>
                        </div>
                        {/* Keywords */}
                        {commit.keywords?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {commit.keywords.map((kw, i) => (
                              <span key={i} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contributor Playbooks */}
              {Object.keys(contributors).length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                    Contributor Playbooks
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(contributors).map(([login, contrib]) => (
                      <div key={login} className="border border-gray-100 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedContributor(expandedContributor === login ? null : login)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
                        >
                          <div className="flex items-center space-x-2">
                            {contrib.avatarUrl && (
                              <img src={contrib.avatarUrl} alt={login} className="w-6 h-6 rounded-full" />
                            )}
                            <span className="text-sm font-medium text-gray-900">{login}</span>
                            <span className="text-xs text-gray-400">{contrib.totalCommits} commits</span>
                            {contrib.primaryAreas?.length > 0 && (
                              <span className="text-xs text-gray-400">
                                · {contrib.primaryAreas.slice(0, 2).join(', ')}
                              </span>
                            )}
                          </div>
                          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedContributor === login ? 'rotate-180' : ''}`}
                               fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {expandedContributor === login && (
                          <div className="px-4 pb-4 border-t border-gray-50">
                            {contrib.contributorSummary && (
                              <p className="text-sm text-gray-600 mt-3 mb-3 bg-gray-50 rounded p-3">
                                {contrib.contributorSummary}
                              </p>
                            )}
                            <div className="space-y-2">
                              {(contrib.commits || []).slice().reverse().slice(0, 10).map(c => (
                                <div key={c.commitId} className="text-xs space-y-0.5 pl-3 border-l-2 border-gray-200">
                                  <div className="flex items-center space-x-2 text-gray-400">
                                    <code>{c.shortId}</code>
                                    <span>{timeAgo(c.timestamp)}</span>
                                  </div>
                                  <div className="text-gray-700">{c.added}</div>
                                  <div className="text-gray-500">{c.impact}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

PlaybookPanel.propTypes = {
  owner: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  refreshKey: PropTypes.number,
};

export default PlaybookPanel;
