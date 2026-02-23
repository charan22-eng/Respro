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

// Fixed event badges with standard Tailwind colors
const eventBadge = {
  commit: 'bg-blue-100 text-blue-700',
  merge: 'bg-purple-100 text-purple-700',
  pr_open: 'bg-emerald-100 text-emerald-700',
  pr_close: 'bg-slate-100 text-slate-600',
  branch_create: 'bg-yellow-100 text-yellow-700',
};

function PlaybookPanel({ owner, repo, refreshKey = 0 }) {
  const [isExpanded, setIsExpanded] = useState(true); // Start expanded by default
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-slate-50 transition-all duration-200"
        style={{ color: '#0f172a' }}
      >
        <div className="flex items-center space-x-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold" style={{ color: '#0f172a' }}>Project Playbook</h3>
            {project && (
              <span className="text-xs" style={{ color: '#64748b' }}>
                {project.totalCommitsTracked} events tracked
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {project?.lastUpdated && (
            <span className="flex items-center space-x-1.5 text-xs" style={{ color: '#64748b' }}>
              {isLive && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
              <span>{isLive ? 'Live' : `Updated ${timeAgo(project.lastUpdated)}`}</span>
            </span>
          )}
          <svg 
            className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            style={{ color: '#94a3b8' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-100">
          {loading && !data && (
            <div className="px-6 py-12 text-center" style={{ color: '#94a3b8' }}>
              <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
              <span className="text-sm">Loading playbook...</span>
            </div>
          )}

          {error && (
            <div className="px-6 py-4">
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            </div>
          )}

          {!project && !loading && (
            <div className="px-6 py-12 text-center" style={{ color: '#94a3b8' }}>
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm">No playbook yet. Analyze a repository to initialize the playbook.</p>
            </div>
          )}

          {project && (
            <div className="px-6 py-5 space-y-6">
              {/* Project Summary */}
              {project.projectSummary && (
                <div 
                  className="rounded-xl p-5 border"
                  style={{ 
                    background: 'linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)',
                    borderColor: '#bfdbfe'
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span 
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: '#1d4ed8' }}
                    >
                      Project Narrative
                    </span>
                    {project.overallVelocity && (
                      <span 
                        className="px-2.5 py-1 text-xs font-medium rounded-lg"
                        style={{ background: '#dbeafe', color: '#1d4ed8' }}
                      >
                        {project.overallVelocity}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#334155' }}>
                    {project.projectSummary}
                  </p>
                  {project.techAreas?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {project.techAreas.map(area => (
                        <span 
                          key={area} 
                          className="px-2.5 py-1 text-xs font-medium rounded-lg"
                          style={{ background: '#e0e7ff', color: '#4338ca' }}
                        >
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
                  <h4 
                    className="text-sm font-semibold uppercase tracking-wider mb-4"
                    style={{ color: '#64748b' }}
                  >
                    Recent Activity
                  </h4>
                  <div className="space-y-3">
                    {commits.map((commit) => (
                      <div 
                        key={commit.commitId} 
                        className="border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition-all duration-200"
                      >
                        {/* Meta row */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <code 
                              className="text-xs font-mono px-2 py-0.5 rounded"
                              style={{ background: '#f1f5f9', color: '#64748b' }}
                            >
                              {commit.shortId}
                            </code>
                            <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${eventBadge[commit.eventType] || eventBadge.commit}`}>
                              {commit.eventType.replace('_', ' ')}
                            </span>
                            <span className="text-xs font-medium" style={{ color: '#334155' }}>
                              {commit.author}
                            </span>
                          </div>
                          <span className="text-xs" style={{ color: '#94a3b8' }}>
                            {timeAgo(commit.timestamp)}
                          </span>
                        </div>
                        {/* Before / Added / Impact */}
                        <div className="space-y-2 text-sm">
                          <div className="flex">
                            <span 
                              className="w-16 flex-shrink-0 text-xs font-semibold"
                              style={{ color: '#94a3b8' }}
                            >
                              Before
                            </span>
                            <span style={{ color: '#64748b' }}>{commit.before}</span>
                          </div>
                          <div className="flex">
                            <span 
                              className="w-16 flex-shrink-0 text-xs font-semibold"
                              style={{ color: '#059669' }}
                            >
                              Added
                            </span>
                            <span className="font-medium" style={{ color: '#0f172a' }}>{commit.added}</span>
                          </div>
                          <div className="flex">
                            <span 
                              className="w-16 flex-shrink-0 text-xs font-semibold"
                              style={{ color: '#2563eb' }}
                            >
                              Impact
                            </span>
                            <span style={{ color: '#475569' }}>{commit.impact}</span>
                          </div>
                        </div>
                        {/* Keywords */}
                        {commit.keywords?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
                            {commit.keywords.map((kw, i) => (
                              <span 
                                key={i} 
                                className="px-2 py-0.5 text-xs font-medium rounded-md"
                                style={{ background: '#dbeafe', color: '#1d4ed8' }}
                              >
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
                  <h4 
                    className="text-sm font-semibold uppercase tracking-wider mb-4"
                    style={{ color: '#64748b' }}
                  >
                    Contributor Playbooks
                  </h4>
                  <div className="grid gap-3">
                    {Object.entries(contributors).map(([login, contrib]) => (
                      <div 
                        key={login} 
                        className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:border-slate-300 transition-all"
                      >
                        <button
                          onClick={() => setExpandedContributor(expandedContributor === login ? null : login)}
                          className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition-all duration-200"
                        >
                          <div className="flex items-center space-x-3">
                            {contrib.avatarUrl ? (
                              <img 
                                src={contrib.avatarUrl} 
                                alt={login} 
                                className="w-9 h-9 rounded-full ring-2 ring-slate-100" 
                              />
                            ) : (
                              <div 
                                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold"
                                style={{ background: '#e0e7ff', color: '#4338ca' }}
                              >
                                {login.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-semibold" style={{ color: '#0f172a' }}>
                                  {login}
                                </span>
                                <span 
                                  className="px-2 py-0.5 text-xs font-medium rounded-full"
                                  style={{ background: '#f1f5f9', color: '#64748b' }}
                                >
                                  {contrib.totalCommits} commits
                                </span>
                              </div>
                              {contrib.primaryAreas?.length > 0 && (
                                <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                                  {contrib.primaryAreas.slice(0, 3).join(' • ')}
                                </p>
                              )}
                            </div>
                          </div>
                          <svg 
                            className={`w-4 h-4 transition-transform duration-200 ${expandedContributor === login ? 'rotate-180' : ''}`}
                            style={{ color: '#94a3b8' }}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {expandedContributor === login && (
                          <div className="px-4 pb-4 border-t border-slate-100">
                            {contrib.contributorSummary && (
                              <div 
                                className="mt-3 mb-4 rounded-xl p-4"
                                style={{ background: '#f8fafc', borderLeft: '3px solid #3b82f6' }}
                              >
                                <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
                                  {contrib.contributorSummary}
                                </p>
                              </div>
                            )}
                            <div className="space-y-2">
                              {(contrib.commits || []).slice().reverse().slice(0, 10).map(c => (
                                <div 
                                  key={c.commitId} 
                                  className="text-xs pl-3 py-2 rounded-lg hover:bg-slate-50"
                                  style={{ borderLeft: '2px solid #e2e8f0' }}
                                >
                                  <div className="flex items-center space-x-2 mb-1">
                                    <code 
                                      className="px-1.5 py-0.5 rounded"
                                      style={{ background: '#f1f5f9', color: '#64748b' }}
                                    >
                                      {c.shortId}
                                    </code>
                                    <span style={{ color: '#94a3b8' }}>{timeAgo(c.timestamp)}</span>
                                  </div>
                                  <div className="font-medium" style={{ color: '#334155' }}>{c.added}</div>
                                  <div style={{ color: '#64748b' }}>{c.impact}</div>
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
