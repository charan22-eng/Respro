import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import ContributorList from '../components/ContributorList';
import ContributorHeatmap from '../components/ContributorHeatmap';
import { getCollisions } from '../utils/api';

/**
 * Collaboration Page - Team analysis, collision detection, contributor insights
 */
function CollaborationPage({ repoData, onAnalyzeCommit }) {
  const [activeTab, setActiveTab] = useState('contributors');
  const [collisions, setCollisions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { meta, commits, contributors } = repoData;

  const fetchCollisions = useCallback(() => {
    if (!meta?.owner || !meta?.name) return;

    setLoading(true);
    setError(null);

    getCollisions(meta.owner, meta.name)
      .then(result => {
        // API returns { collisions, hotZones, stats }, extract collisions array
        setCollisions(result.collisions || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch collisions:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [meta?.owner, meta?.name]);

  useEffect(() => {
    if (activeTab === 'collisions') {
      fetchCollisions();
    }
  }, [activeTab, fetchCollisions]);

  const tabs = [
    { id: 'contributors', label: 'Contributors', description: 'Team member analysis' },
    { id: 'collisions', label: 'Collision Radar', description: 'Detect overlapping work' },
    { id: 'heatmap', label: 'Activity Map', description: 'Contribution patterns' },
  ];

  // Calculate some team stats
  const teamStats = {
    totalContributors: contributors?.length || 0,
    activeContributors: contributors?.filter(c => {
      const recentCommits = commits?.filter(commit => {
        const isAuthor = commit.author === c.login || commit.author?.login === c.login;
        const commitDate = new Date(commit.date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return isAuthor && commitDate >= weekAgo;
      });
      return recentCommits?.length > 0;
    }).length || 0,
    totalCollisions: collisions?.length || 0,
    highRiskCollisions: collisions?.filter(c => c.severity === 'high' || c.riskScore > 70).length || 0,
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Collaboration</h1>
          <p className="mt-1" style={{ color: '#64748b' }}>Team analysis and collision detection</p>
        </div>
        {activeTab === 'collisions' && (
          <button
            onClick={fetchCollisions}
            disabled={loading}
            className="btn-ghost"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        )}
      </div>

      {/* Team Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#dbeafe' }}
            >
              <svg className="w-5 h-5" style={{ color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#0f172a' }}>{teamStats.totalContributors}</p>
              <p className="text-xs" style={{ color: '#64748b' }}>Total Contributors</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#d1fae5' }}
            >
              <svg className="w-5 h-5" style={{ color: '#059669' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#0f172a' }}>{teamStats.activeContributors}</p>
              <p className="text-xs" style={{ color: '#64748b' }}>Active This Week</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#fef3c7' }}
            >
              <svg className="w-5 h-5" style={{ color: '#d97706' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#0f172a' }}>{teamStats.totalCollisions}</p>
              <p className="text-xs" style={{ color: '#64748b' }}>Work Overlaps</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#fee2e2' }}
            >
              <svg className="w-5 h-5" style={{ color: '#dc2626' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#0f172a' }}>{teamStats.highRiskCollisions}</p>
              <p className="text-xs" style={{ color: '#64748b' }}>High Risk</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative py-4 px-1 text-sm font-medium transition-colors"
              style={{ 
                color: activeTab === tab.id ? '#2563eb' : '#64748b'
              }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div 
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: '#2563eb' }}
                />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {/* Contributors Tab */}
        {activeTab === 'contributors' && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <ContributorList
                contributors={contributors}
                commits={commits}
                owner={meta.owner}
                repo={meta.name}
                onAnalyzeCommit={onAnalyzeCommit}
              />
            </div>
          </div>
        )}

        {/* Collisions Tab */}
        {activeTab === 'collisions' && (
          <div className="animate-fade-in">
            {loading && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                <p style={{ color: '#64748b' }}>Scanning for work collisions...</p>
              </div>
            )}

            {error && !loading && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#0f172a' }}>Failed to Load Collisions</h3>
                <p className="mb-4" style={{ color: '#64748b' }}>{error}</p>
                <button onClick={fetchCollisions} className="btn-primary">
                  Try Again
                </button>
              </div>
            )}

            {!loading && !error && collisions && (
              <div className="space-y-6">
                {collisions.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold mb-2" style={{ color: '#0f172a' }}>No Collisions Detected</h3>
                    <p style={{ color: '#64748b' }}>Great news! No overlapping work has been detected between team members.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {collisions.map((collision, idx) => (
                      <div 
                        key={collision.id || idx} 
                        className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 border-l-4 ${
                          collision.severity === 'high'
                            ? 'border-l-red-500'
                            : collision.severity === 'medium'
                            ? 'border-l-amber-500'
                            : 'border-l-blue-500'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                collision.severity === 'high'
                                  ? 'bg-red-100 text-red-700'
                                  : collision.severity === 'medium'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {collision.severity}
                              </span>
                              <span 
                                className="px-2 py-1 text-xs font-medium rounded-full"
                                style={{ background: '#f1f5f9', color: '#475569' }}
                              >
                                {collision.type === 'line_overlap' ? 'Line Overlap' : 
                                 collision.type === 'function_overlap' ? 'Function Overlap' : 'File Overlap'}
                              </span>
                              {collision.isResolved && (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                                  Resolved
                                </span>
                              )}
                            </div>
                            
                            {/* File path */}
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <code 
                                className="text-sm font-mono truncate"
                                style={{ color: '#334155' }}
                              >
                                {collision.file}
                              </code>
                            </div>
                            
                            {/* Suggestion */}
                            <p className="text-sm mb-3" style={{ color: '#475569' }}>{collision.suggestion}</p>
                            
                            {/* Authors */}
                            {collision.authors && collision.authors.length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs" style={{ color: '#64748b' }}>Contributors:</span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {collision.authors.slice(0, 5).map((author, authorIdx) => (
                                    <div 
                                      key={authorIdx} 
                                      className="flex items-center gap-1.5 rounded-full px-2 py-1"
                                      style={{ background: '#f1f5f9' }}
                                    >
                                      <div 
                                        className="w-5 h-5 rounded-full flex items-center justify-center"
                                        style={{ background: '#3b82f6' }}
                                      >
                                        <span className="text-xs font-medium text-white">
                                          {(author.name || author).charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                      <span className="text-xs" style={{ color: '#334155' }}>{author.name || author}</span>
                                      <span className="text-xs" style={{ color: '#94a3b8' }}>({author.commits || 0})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Overlap details */}
                            {collision.overlapDetails?.functions && collision.overlapDetails.functions.length > 0 && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs" style={{ color: '#64748b' }}>Shared functions:</span>
                                <div className="flex gap-1 flex-wrap">
                                  {collision.overlapDetails.functions.slice(0, 3).map((func, funcIdx) => (
                                    <code 
                                      key={funcIdx} 
                                      className="text-xs px-1.5 py-0.5 rounded"
                                      style={{ background: '#fef3c7', color: '#b45309' }}
                                    >
                                      {func}()
                                    </code>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Stats on right side */}
                          <div className="text-right ml-4 flex-shrink-0">
                            <div className="text-2xl font-bold" style={{ color: '#0f172a' }}>{collision.totalCommits}</div>
                            <div className="text-xs" style={{ color: '#64748b' }}>Commits</div>
                            {collision.daysSinceActivity !== undefined && (
                              <div className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                                {collision.daysSinceActivity === 0 ? 'Today' : `${collision.daysSinceActivity}d ago`}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Heatmap Tab */}
        {activeTab === 'heatmap' && (
          <div className="animate-fade-in">
            <ContributorHeatmap contributors={contributors} />
          </div>
        )}
      </div>
    </div>
  );
}

CollaborationPage.propTypes = {
  repoData: PropTypes.shape({
    meta: PropTypes.shape({
      owner: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }).isRequired,
    commits: PropTypes.array,
    contributors: PropTypes.array,
  }).isRequired,
  onAnalyzeCommit: PropTypes.func,
};

export default CollaborationPage;
