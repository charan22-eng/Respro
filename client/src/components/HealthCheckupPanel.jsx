import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { getHealthCheckup } from '../utils/api';

/**
 * Grade Badge Component
 */
function GradeBadge({ grade, size = 'large' }) {
  const getGradeStyle = (g) => {
    const letter = g.charAt(0);
    switch (letter) {
      case 'A': return 'bg-emerald-500 text-white';
      case 'B': return 'bg-blue-500 text-white';
      case 'C': return 'bg-yellow-500 text-white';
      case 'D': return 'bg-orange-500 text-white';
      case 'F': return 'bg-red-500 text-white';
      default: return 'bg-surface-500 text-white';
    }
  };

  const sizeClasses = size === 'large' 
    ? 'w-24 h-24 text-4xl' 
    : 'w-12 h-12 text-xl';

  return (
    <div className={`${sizeClasses} ${getGradeStyle(grade)} rounded-2xl flex items-center justify-center font-bold shadow-lg`}>
      {grade}
    </div>
  );
}

GradeBadge.propTypes = {
  grade: PropTypes.string.isRequired,
  size: PropTypes.string
};

/**
 * Score Progress Bar
 */
function ScoreBar({ score, color }) {
  const getBarColor = (c) => {
    switch (c) {
      case 'green': return 'bg-emerald-500';
      case 'blue': return 'bg-blue-500';
      case 'yellow': return 'bg-yellow-500';
      case 'orange': return 'bg-orange-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-surface-500';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-surface-200 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${getBarColor(color)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-medium text-surface-600 w-12 text-right">{score}%</span>
    </div>
  );
}

ScoreBar.propTypes = {
  score: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired
};

/**
 * Overall Health Score Card
 */
function OverallScoreCard({ overall }) {
  return (
    <div className="premium-card p-6">
      <div className="flex items-center gap-6">
        {/* Grade Circle */}
        <GradeBadge grade={overall.grade} size="large" />
        
        {/* Score Details */}
        <div className="flex-1">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-surface-900">{overall.score}</span>
            <span className="text-lg text-surface-500">/ 100</span>
          </div>
          <p className="text-surface-600 text-sm leading-relaxed">
            {overall.summary}
          </p>
        </div>
      </div>
    </div>
  );
}

OverallScoreCard.propTypes = {
  overall: PropTypes.object.isRequired
};

/**
 * Top Recommendations Card
 */
function RecommendationsCard({ suggestions }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="bg-surface-900 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wide mb-4">
        Top Recommendations
      </h3>
      <ul className="space-y-3">
        {suggestions.map((suggestion, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
              {idx + 1}
            </span>
            <span className="text-surface-200 text-sm leading-relaxed">{suggestion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

RecommendationsCard.propTypes = {
  suggestions: PropTypes.array
};

/**
 * Category Card Component
 */
function CategoryCard({ category, isExpanded, onToggle }) {
  const getGradeStyle = (g) => {
    const letter = g.charAt(0);
    switch (letter) {
      case 'A': return 'bg-emerald-100 text-emerald-700';
      case 'B': return 'bg-blue-100 text-blue-700';
      case 'C': return 'bg-yellow-100 text-yellow-700';
      case 'D': return 'bg-orange-100 text-orange-700';
      case 'F': return 'bg-red-100 text-red-700';
      default: return 'bg-surface-100 text-surface-700';
    }
  };

  return (
    <div className="premium-card overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-50 transition-all duration-200"
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${getGradeStyle(category.grade)}`}>
            {category.grade}
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-surface-900">{category.category}</h3>
            <div className="mt-1 w-40">
              <ScoreBar score={category.score} color={category.color} />
            </div>
          </div>
        </div>
        <svg 
          className={`w-5 h-5 text-surface-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-surface-100">
          {/* Findings */}
          {category.findings && category.findings.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">Findings</h4>
              <div className="space-y-2">
                {category.findings.map((finding, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
                    {finding.type === 'success' && (
                      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    {finding.type === 'warning' && (
                      <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    )}
                    {finding.type === 'info' && (
                      <svg className="w-5 h-5 text-brand-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    )}
                    <div>
                      <p className="text-sm font-medium text-surface-900">{finding.message}</p>
                      {finding.detail && (
                        <p className="text-xs text-surface-500 mt-0.5">{finding.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {category.suggestions && category.suggestions.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">Suggestions</h4>
              <ul className="space-y-2">
                {category.suggestions.map((suggestion, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-surface-600">
                    <svg className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Metrics */}
          {category.metrics && Object.keys(category.metrics).length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">Metrics</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(category.metrics).map(([key, value]) => (
                  <div key={key} className="bg-surface-50 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-surface-900">
                      {typeof value === 'number' ? value.toLocaleString() : value || '-'}
                    </div>
                    <div className="text-xs text-surface-500 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

CategoryCard.propTypes = {
  category: PropTypes.object.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired
};

/**
 * Main Health Checkup Panel
 */
function HealthCheckupPanel({ owner, repo, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set([0]));

  const fetchData = useCallback(() => {
    if (!owner || !repo) return;

    setLoading(true);
    setError(null);

    getHealthCheckup(owner, repo)
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch health checkup:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [owner, repo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleCategory = (index) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="bg-surface-100 rounded-2xl shadow-elevated w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-surface-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-surface-900">Health Checkup</h2>
            <p className="text-sm text-surface-500">{owner}/{repo}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 hover:bg-surface-100 rounded-xl transition-all duration-200 disabled:opacity-50"
              title="Refresh"
            >
              <svg className={`w-5 h-5 text-surface-500 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-100 rounded-xl transition-all duration-200"
            >
              <svg className="w-5 h-5 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4" />
              <p className="text-surface-500 text-sm">Running health checkup...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-surface-900 mb-2">Something went wrong</h3>
              <p className="text-sm text-surface-500">{error}</p>
              <button
                onClick={fetchData}
                className="btn-brand mt-4"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Data Display */}
          {!loading && !error && data && (
            <>
              {/* Overall Score */}
              <OverallScoreCard overall={data.overall} />

              {/* Top Recommendations */}
              {data.overall.topSuggestions?.length > 0 && (
                <RecommendationsCard suggestions={data.overall.topSuggestions} />
              )}

              {/* Category Breakdown */}
              <div>
                <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">
                  Category Breakdown
                </h3>
                <div className="space-y-3">
                  {data.categories.map((category, idx) => (
                    <CategoryCard
                      key={category.category}
                      category={category}
                      isExpanded={expandedCategories.has(idx)}
                      onToggle={() => toggleCategory(idx)}
                    />
                  ))}
                </div>
              </div>

              {/* Footer Info */}
              {data.repoInfo && (
                <p className="text-xs text-surface-400 text-center pt-2">
                  Based on {data.repoInfo.totalCommits} commits
                  {data.repoInfo.techAreas?.length > 0 && ` across ${data.repoInfo.techAreas.length} tech areas`}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white px-6 py-3 border-t border-surface-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 btn-brand rounded-xl text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

HealthCheckupPanel.propTypes = {
  owner: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired
};

export default HealthCheckupPanel;
