import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getCollisions } from '../utils/api';

/**
 * Severity badge component
 */
function SeverityBadge({ severity }) {
  const styles = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200'
  };

  const labels = {
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW'
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${styles[severity] || styles.low}`}>
      {labels[severity] || 'UNKNOWN'}
    </span>
  );
}

SeverityBadge.propTypes = {
  severity: PropTypes.string.isRequired
};

/**
 * Single collision card
 */
function CollisionCard({ collision }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <SeverityBadge severity={collision.severity} />
            <span className="text-xs text-gray-500">
              {collision.authorCount} contributors · {collision.totalCommits} commits
            </span>
          </div>
          <h4 className="text-sm font-mono text-gray-900 truncate" title={collision.file}>
            {collision.file}
          </h4>
        </div>
      </div>

      {/* Authors visualization */}
      <div className="flex items-center justify-center gap-2 my-4">
        {collision.authors.slice(0, 2).map((author, idx) => (
          <div key={author.name} className="flex items-center">
            {idx > 0 && (
              <div className="flex items-center mx-2">
                <span className="text-red-500 text-xs font-bold px-2 py-1 bg-red-50 rounded-full">
                  OVERLAP
                </span>
              </div>
            )}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-pulse-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {author.name.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-xs text-gray-600 mt-1 font-medium">{author.name}</span>
              <span className="text-[10px] text-gray-400">{author.commits} commits</span>
            </div>
          </div>
        ))}
        {collision.authors.length > 2 && (
          <div className="flex flex-col items-center ml-2">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm">
              +{collision.authors.length - 2}
            </div>
            <span className="text-xs text-gray-400 mt-1">more</span>
          </div>
        )}
      </div>

      {/* Recent work summary */}
      <div className="space-y-2 mb-3">
        {collision.authors.slice(0, 2).map(author => (
          <div key={author.name} className="text-xs bg-gray-50 rounded p-2">
            <span className="font-medium text-gray-700">{author.name}:</span>
            <span className="text-gray-600 ml-1">
              "{author.lastCommit?.message?.substring(0, 60) || 'No message'}
              {(author.lastCommit?.message?.length || 0) > 60 ? '...' : ''}"
            </span>
          </div>
        ))}
      </div>

      {/* Suggestion */}
      <div className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
        <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-blue-700">{collision.suggestion}</p>
      </div>

      {/* Expand/collapse for more details */}
      {collision.authors.some(a => a.allCommits?.length > 1) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {expanded ? 'Hide' : 'Show'} commit history
        </button>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          {collision.authors.map(author => (
            <div key={author.name}>
              <h5 className="text-xs font-medium text-gray-700 mb-1">{author.name}'s commits:</h5>
              <div className="space-y-1">
                {author.allCommits?.map(commit => (
                  <div key={commit.sha} className="text-xs text-gray-500 flex items-center gap-2">
                    <code className="text-[10px] bg-gray-100 px-1 rounded">{commit.shortId}</code>
                    <span className="truncate">{commit.message?.substring(0, 50)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

CollisionCard.propTypes = {
  collision: PropTypes.shape({
    file: PropTypes.string.isRequired,
    severity: PropTypes.string.isRequired,
    authorCount: PropTypes.number.isRequired,
    totalCommits: PropTypes.number.isRequired,
    authors: PropTypes.array.isRequired,
    suggestion: PropTypes.string
  }).isRequired
};

/**
 * Hot zone bar
 */
function HotZoneBar({ zone, maxCommits }) {
  const percentage = Math.round((zone.commitCount / maxCommits) * 100);

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-xs font-mono text-gray-600 truncate" title={zone.area}>
        {zone.area}
      </div>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 w-20 text-right">
        {zone.authorCount} devs · {zone.commitCount}
      </div>
    </div>
  );
}

HotZoneBar.propTypes = {
  zone: PropTypes.shape({
    area: PropTypes.string.isRequired,
    authorCount: PropTypes.number.isRequired,
    commitCount: PropTypes.number.isRequired
  }).isRequired,
  maxCommits: PropTypes.number.isRequired
};

/**
 * Risk score gauge
 */
function RiskGauge({ score, level }) {
  const colors = {
    high: 'text-red-500',
    medium: 'text-yellow-500',
    low: 'text-green-500'
  };

  const bgColors = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500'
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 transform -rotate-90">
          <circle
            cx="32"
            cy="32"
            r="28"
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            className="text-gray-200"
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={`${(score / 100) * 176} 176`}
            className={colors[level]}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${colors[level]}`}>{score}</span>
        </div>
      </div>
      <div>
        <div className={`text-sm font-semibold ${colors[level]}`}>
          {level.toUpperCase()} RISK
        </div>
        <div className="text-xs text-gray-500">Collision Score</div>
      </div>
    </div>
  );
}

RiskGauge.propTypes = {
  score: PropTypes.number.isRequired,
  level: PropTypes.string.isRequired
};

/**
 * Main CollisionRadar component
 */
function CollisionRadar({ owner, repo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Collision Radar</h3>
            <p className="text-sm text-gray-500">Detecting work overlaps...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-100 rounded-lg"></div>
          <div className="h-20 bg-gray-100 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const { collisions, hotZones, stats } = data || {};
  const maxHotZoneCommits = hotZones?.[0]?.commitCount || 1;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Collision Radar</h3>
              <p className="text-sm text-gray-500">
                {stats?.totalCommitsAnalyzed || 0} commits · {stats?.totalAuthors || 0} contributors
              </p>
            </div>
          </div>
          <RiskGauge score={stats?.riskScore || 0} level={stats?.riskLevel || 'low'} />
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats?.totalCollisions || 0}</div>
          <div className="text-xs text-gray-500">Total Overlaps</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500">{stats?.highSeverity || 0}</div>
          <div className="text-xs text-gray-500">High Risk</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-500">{stats?.mediumSeverity || 0}</div>
          <div className="text-xs text-gray-500">Medium Risk</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-500">{stats?.lowSeverity || 0}</div>
          <div className="text-xs text-gray-500">Low Risk</div>
        </div>
      </div>

      {/* Main content */}
      <div className="p-6">
        {/* No collisions state */}
        {(!collisions || collisions.length === 0) && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-1">All Clear!</h4>
            <p className="text-sm text-gray-500">No work collisions detected. Your team is well coordinated.</p>
          </div>
        )}

        {/* Collisions list */}
        {collisions && collisions.length > 0 && (
          <div className="space-y-4 mb-6">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Active Collisions
            </h4>
            <div className="space-y-3">
              {collisions.slice(0, 5).map((collision, idx) => (
                <CollisionCard key={`${collision.file}-${idx}`} collision={collision} />
              ))}
            </div>
            {collisions.length > 5 && (
              <p className="text-xs text-gray-500 text-center">
                +{collisions.length - 5} more collisions detected
              </p>
            )}
          </div>
        )}

        {/* Hot zones */}
        {hotZones && hotZones.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              Hot Zones (Most Contested Areas)
            </h4>
            <div className="space-y-2">
              {hotZones.slice(0, 5).map((zone, idx) => (
                <HotZoneBar key={zone.area} zone={zone} maxCommits={maxHotZoneCommits} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

CollisionRadar.propTypes = {
  owner: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired
};

export default CollisionRadar;
