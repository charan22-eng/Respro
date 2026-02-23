import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { getCollisions, resolveCollision, unresolveCollision } from '../utils/api';

/**
 * Friendly status indicator
 */
function StatusIndicator({ level, score }) {
  const configs = {
    low: {
      color: 'text-accent-600',
      bgColor: 'bg-accent-50',
      borderColor: 'border-accent-200',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Looking Good!',
      subtitle: 'Minimal coordination needed'
    },
    medium: {
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      title: 'Some Overlap',
      subtitle: 'A few areas need attention'
    },
    high: {
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Needs Attention',
      subtitle: 'Consider a team sync'
    }
  };

  const config = configs[level] || configs.low;

  return (
    <div className={`${config.bgColor} ${config.borderColor} border rounded-2xl p-6 text-center transition-all duration-200`}>
      <div className={`${config.color} inline-flex mb-3`}>{config.icon}</div>
      <div className={`text-4xl font-bold ${config.color} mb-1`}>{score}</div>
      <div className="text-sm text-surface-500 mb-2">Overlap Score</div>
      <div className={`font-semibold ${config.color}`}>{config.title}</div>
      <div className="text-xs text-surface-500">{config.subtitle}</div>
    </div>
  );
}

StatusIndicator.propTypes = {
  level: PropTypes.string.isRequired,
  score: PropTypes.number.isRequired
};

/**
 * Simple stat card
 */
function StatCard({ label, value, color = 'gray' }) {
  const colorClasses = {
    gray: 'text-surface-900',
    red: 'text-red-600',
    amber: 'text-amber-600',
    green: 'text-accent-600'
  };

  return (
    <div className="premium-card p-4">
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</div>
      <div className="text-xs text-surface-500 mt-1">{label}</div>
    </div>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  color: PropTypes.string
};

/**
 * File overlap item - simplified and friendly
 */
function OverlapItem({ collision, isExpanded, onToggle, onResolve, onUnresolve, isResolving }) {
  const severityConfig = {
    high: { dot: 'bg-red-500', bg: 'bg-red-50 hover:bg-red-100', border: 'border-red-200' },
    medium: { dot: 'bg-amber-500', bg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200' },
    low: { dot: 'bg-accent-500', bg: 'bg-accent-50 hover:bg-accent-100', border: 'border-accent-200' }
  };

  // Collision type labels and icons
  const typeConfig = {
    line_overlap: { 
      label: 'Same Lines', 
      icon: '🎯',
      description: 'Editing the exact same code lines'
    },
    function_overlap: { 
      label: 'Same Function', 
      icon: '⚡',
      description: 'Modifying the same function/method'
    },
    file_only: { 
      label: 'Same File', 
      icon: '📄',
      description: 'Working in different parts of the file'
    }
  };

  const config = collision.isResolved 
    ? { dot: 'bg-surface-400', bg: 'bg-surface-50 hover:bg-surface-100', border: 'border-surface-200' }
    : severityConfig[collision.severity] || severityConfig.low;
  const typeInfo = typeConfig[collision.type] || typeConfig.file_only;
  
  // Get filename from path
  const fileName = collision.file.split('/').pop();
  const filePath = collision.file.split('/').slice(0, -1).join('/');

  return (
    <div className={`rounded-2xl border ${config.border} overflow-hidden transition-all duration-200 ${collision.isResolved ? 'opacity-60' : ''}`}>
      <button
        onClick={onToggle}
        className={`w-full ${config.bg} p-4 text-left transition-colors`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`w-2 h-2 rounded-full ${config.dot} flex-shrink-0`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-medium truncate ${collision.isResolved ? 'text-surface-500 line-through' : 'text-surface-900'}`}>
                  {fileName}
                </span>
                <span className="chip whitespace-nowrap">
                  {typeInfo.icon} {typeInfo.label}
                </span>
                {collision.isResolved && (
                  <span className="status-badge bg-accent-100 text-accent-700 whitespace-nowrap">
                    Resolved
                  </span>
                )}
              </div>
              {filePath && (
                <div className="text-xs text-surface-500 truncate">{filePath}/</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-right">
              <div className="text-sm font-medium text-surface-700">
                {collision.authorCount} {collision.authorCount === 1 ? 'person' : 'people'}
              </div>
              <div className="text-xs text-surface-500">{collision.totalCommits} changes</div>
            </div>
            <svg 
              className={`w-5 h-5 text-surface-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="bg-white p-4 border-t border-surface-100">
          {/* Collision type explanation */}
          <div className="text-xs text-surface-500 mb-3 flex items-center gap-1">
            <span>{typeInfo.icon}</span>
            <span>{typeInfo.description}</span>
            {collision.daysSinceActivity !== undefined && (
              <span className="ml-2 text-surface-400">
                · Last activity {collision.daysSinceActivity === 0 ? 'today' : `${collision.daysSinceActivity}d ago`}
              </span>
            )}
          </div>

          {/* Show overlapping functions if available */}
          {collision.overlapDetails?.functions?.length > 0 && (
            <div className="mb-3 p-2 bg-purple-50 rounded-xl">
              <div className="text-xs font-medium text-purple-700 mb-1">Overlapping functions:</div>
              <div className="flex flex-wrap gap-1">
                {collision.overlapDetails.functions.map(func => (
                  <code key={func} className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-lg">
                    {func}()
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Contributors */}
          <div className="flex flex-wrap gap-3 mb-4">
            {collision.authors.map((author, idx) => (
              <div key={author.name} className="flex items-center gap-2 bg-surface-50 rounded-xl px-3 py-2">
                <div 
                  className="avatar w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: `hsl(${(idx * 137.5) % 360}, 65%, 50%)` }}
                >
                  {author.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-surface-900">{author.name}</div>
                  <div className="text-xs text-surface-500">{author.commits} commits</div>
                </div>
              </div>
            ))}
          </div>

          {/* Suggestion */}
          {collision.suggestion && !collision.isResolved && (
            <div className="flex items-start gap-3 p-3 bg-brand-50 rounded-xl mb-4">
              <svg className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-sm text-brand-700">{collision.suggestion}</p>
            </div>
          )}

          {/* Resolve/Unresolve button */}
          <div className="flex justify-end">
            {collision.isResolved ? (
              <button
                onClick={(e) => { e.stopPropagation(); onUnresolve(collision.id); }}
                disabled={isResolving}
                className="btn-secondary disabled:opacity-50"
              >
                {isResolving ? 'Processing...' : 'Bring Back'}
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onResolve(collision.id); }}
                disabled={isResolving}
                className="px-4 py-2 text-sm font-medium text-white bg-accent-600 hover:bg-accent-700 rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
              >
                {isResolving ? (
                  'Resolving...'
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Mark as Resolved
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

OverlapItem.propTypes = {
  collision: PropTypes.object.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onResolve: PropTypes.func.isRequired,
  onUnresolve: PropTypes.func.isRequired,
  isResolving: PropTypes.bool
};

/**
 * Hot zone item - simplified
 */
function HotZoneItem({ zone, maxCommits, rank }) {
  const percentage = Math.round((zone.commitCount / maxCommits) * 100);

  return (
    <div className="flex items-center gap-4 p-3 premium-card">
      <div className="w-6 h-6 bg-surface-100 rounded-full flex items-center justify-center text-xs font-bold text-surface-500">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-surface-900 truncate text-sm">{zone.area}</div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs text-surface-500 whitespace-nowrap">
            {zone.authorCount} contributors
          </span>
        </div>
      </div>
    </div>
  );
}

HotZoneItem.propTypes = {
  zone: PropTypes.object.isRequired,
  maxCommits: PropTypes.number.isRequired,
  rank: PropTypes.number.isRequired
};

/**
 * Empty state - friendly message
 */
function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon bg-accent-100">
        <svg className="w-10 h-10 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-surface-900 mb-2">No Overlaps Detected</h3>
      <p className="text-surface-500 max-w-sm mx-auto">
        Great news! Your team is working on different areas of the codebase. 
        No coordination issues found.
      </p>
    </div>
  );
}

/**
 * Main CollisionRadarPanel component - Full screen modal
 */
function CollisionRadarPanel({ owner, repo, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [activeTab, setActiveTab] = useState('overlaps');
  const [resolvingId, setResolvingId] = useState(null);
  const [showResolved, setShowResolved] = useState(false);

  // Fetch collision data
  const fetchData = useCallback(() => {
    if (!owner || !repo) return;

    setLoading(true);
    setError(null);

    getCollisions(owner, repo)
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch collisions:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [owner, repo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleExpanded = (index) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Handle resolve collision
  const handleResolve = useCallback(async (collisionId) => {
    setResolvingId(collisionId);
    try {
      await resolveCollision(owner, repo, collisionId);
      setData(prev => ({
        ...prev,
        collisions: prev.collisions.map(c => 
          c.id === collisionId ? { ...c, isResolved: true, resolvedAt: new Date().toISOString() } : c
        ),
        stats: {
          ...prev.stats,
          totalCollisions: prev.stats.totalCollisions - 1,
          resolvedCollisions: (prev.stats.resolvedCollisions || 0) + 1
        }
      }));
    } catch (err) {
      console.error('Failed to resolve collision:', err);
    } finally {
      setResolvingId(null);
    }
  }, [owner, repo]);

  // Handle unresolve collision
  const handleUnresolve = useCallback(async (collisionId) => {
    setResolvingId(collisionId);
    try {
      await unresolveCollision(owner, repo, collisionId);
      setData(prev => ({
        ...prev,
        collisions: prev.collisions.map(c => 
          c.id === collisionId ? { ...c, isResolved: false, resolvedAt: null } : c
        ),
        stats: {
          ...prev.stats,
          totalCollisions: prev.stats.totalCollisions + 1,
          resolvedCollisions: Math.max(0, (prev.stats.resolvedCollisions || 0) - 1)
        }
      }));
    } catch (err) {
      console.error('Failed to unresolve collision:', err);
    } finally {
      setResolvingId(null);
    }
  }, [owner, repo]);

  const { collisions = [], hotZones = [], stats = {} } = data || {};
  const maxHotZoneCommits = hotZones[0]?.commitCount || 1;
  
  // Filter collisions based on showResolved toggle
  const activeCollisions = collisions.filter(c => !c.isResolved);
  const resolvedCollisions = collisions.filter(c => c.isResolved);
  const displayedCollisions = showResolved ? collisions : activeCollisions;

  return (
    <div className="modal-backdrop">
      <div className="bg-surface-50 rounded-2xl shadow-elevated w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-surface-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
                <circle cx="12" cy="12" r="6" strokeWidth={2} />
                <circle cx="12" cy="12" r="2" strokeWidth={2} />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-surface-900">Collision Radar</h2>
              <p className="text-sm text-surface-500">
                {owner}/{repo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-100 rounded-xl transition-all duration-200"
          >
            <svg className="w-5 h-5 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4" />
              <p className="text-surface-500">Scanning for overlaps...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-surface-900 mb-2">Something went wrong</h3>
              <p className="text-surface-500">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Status Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <StatusIndicator 
                  level={stats.riskLevel || 'low'} 
                  score={stats.riskScore || 0} 
                />
                <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Total Overlaps" value={stats.totalCollisions || 0} color="gray" />
                  <StatCard label="Same Lines" value={stats.lineOverlaps || 0} color="red" />
                  <StatCard label="Same Function" value={stats.functionOverlaps || 0} color="amber" />
                  <StatCard label="Same File Only" value={stats.fileOnlyOverlaps || 0} color="green" />
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('overlaps')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeTab === 'overlaps'
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-white text-surface-600 hover:bg-surface-100'
                    }`}
                  >
                    File Overlaps
                    {activeCollisions.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-brand-200 text-brand-700 rounded-full text-xs">
                        {activeCollisions.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('hotzones')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeTab === 'hotzones'
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-white text-surface-600 hover:bg-surface-100'
                    }`}
                  >
                    Hot Zones
                    {hotZones.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-orange-200 text-orange-700 rounded-full text-xs">
                        {hotZones.length}
                      </span>
                    )}
                  </button>
                </div>
                
                {/* Show resolved toggle */}
                {activeTab === 'overlaps' && resolvedCollisions.length > 0 && (
                  <label className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showResolved}
                      onChange={(e) => setShowResolved(e.target.checked)}
                      className="w-4 h-4 text-brand-600 rounded border-surface-300 focus:ring-brand-500"
                    />
                    Show resolved ({resolvedCollisions.length})
                  </label>
                )}
              </div>

              {/* Tab Content */}
              {activeTab === 'overlaps' && (
                <div>
                  {collisions.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <div className="space-y-3">
                      {displayedCollisions.map((collision, idx) => (
                        <OverlapItem
                          key={collision.id || `${collision.file}-${idx}`}
                          collision={collision}
                          isExpanded={expandedItems.has(collision.id || idx)}
                          onToggle={() => toggleExpanded(collision.id || idx)}
                          onResolve={handleResolve}
                          onUnresolve={handleUnresolve}
                          isResolving={resolvingId === collision.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'hotzones' && (
                <div>
                  {hotZones.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-surface-500">No hot zones detected.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {hotZones.map((zone, idx) => (
                        <HotZoneItem
                          key={zone.area}
                          zone={zone}
                          maxCommits={maxHotZoneCommits}
                          rank={idx + 1}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white px-6 py-3 border-t border-surface-200 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-surface-400">
            Based on {stats.totalCommitsAnalyzed || 0} commits from {stats.totalAuthors || 0} contributors
          </p>
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

CollisionRadarPanel.propTypes = {
  owner: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired
};

export default CollisionRadarPanel;
